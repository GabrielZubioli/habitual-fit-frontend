import {
  PowerSyncDatabase,
  UpdateType,
  type AbstractPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
} from "@powersync/react-native";
import { AppSchema, JSON_COLUMNS } from "@gabrielzubioli/db/schema";
import { configureLocalDb } from "@forja/app-core/local";
import { supabase } from "./supabase";

/**
 * Offline com o PowerSync: um SQLite no aparelho com os dados da pessoa e o
 * catálogo; as escritas entram numa fila que sobe quando há conexão.
 *
 * Só liga com `EXPO_PUBLIC_POWERSYNC_URL` (ver forja-backend/docs/powersync.md).
 * Sem ela, `db` é `null` e o app segue online pelo Supabase, como antes.
 */
const ENDPOINT = process.env.EXPO_PUBLIC_POWERSYNC_URL?.trim() || null;

export const db: AbstractPowerSyncDatabase | null = ENDPOINT
  ? new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: "habitualfit.db" } })
  : null;

/**
 * Tabelas de chave composta: no aparelho o `id` é derivado da chave natural
 * (ver `streams.yaml`) e não existe no Postgres. A escrita vai pela chave.
 */
const CHAVES: Record<string, string[]> = {
  diet_days: ["user_id", "log_date"],
  exercise_favorites: ["user_id", "exercise_id"],
  exercise_muscles: ["exercise_id", "muscle"],
  food_substitution_prefs: ["user_id", "food_id", "substitute_id"],
  onboarding_answers: ["user_id"],
};

/** No SQLite, arrays e JSON são texto: voltam a ser array/objeto para o Postgres. */
function paraPostgres(tabela: string, dados: Record<string, unknown>): Record<string, unknown> {
  const json = JSON_COLUMNS[tabela] ?? [];
  return Object.fromEntries(
    Object.entries(dados).map(([k, v]) =>
      json.includes(k) && typeof v === "string" ? [k, JSON.parse(v) as unknown] : [k, v],
    ),
  );
}

/** A chave natural a partir do `id` derivado ("a:b:c"). */
function chaveDe(tabela: string, id: string): Record<string, string> {
  const colunas = CHAVES[tabela]!;
  const partes = id.split(":");
  return Object.fromEntries(colunas.map((c, i) => [c, partes[i] ?? ""]));
}

async function aplicar(op: CrudEntry): Promise<void> {
  const tabela = supabase.from(op.table as never) as unknown as {
    upsert: (v: unknown, o?: unknown) => PromiseLike<{ error: unknown }>;
    update: (v: unknown) => {
      eq: (c: string, v: string) => PromiseLike<{ error: unknown }>;
      match: (m: unknown) => PromiseLike<{ error: unknown }>;
    };
    delete: () => {
      eq: (c: string, v: string) => PromiseLike<{ error: unknown }>;
      match: (m: unknown) => PromiseLike<{ error: unknown }>;
    };
  };
  const chave = CHAVES[op.table];
  const dados = paraPostgres(op.table, op.opData ?? {});
  let resultado: { error: unknown };
  if (op.op === UpdateType.PUT) {
    resultado = chave
      ? await tabela.upsert(
          { ...chaveDe(op.table, op.id), ...dados },
          { onConflict: chave.join(",") },
        )
      : await tabela.upsert({ ...dados, id: op.id });
  } else if (op.op === UpdateType.PATCH) {
    resultado = chave
      ? await tabela.update(dados).match(chaveDe(op.table, op.id))
      : await tabela.update(dados).eq("id", op.id);
  } else {
    resultado = chave
      ? await tabela.delete().match(chaveDe(op.table, op.id))
      : await tabela.delete().eq("id", op.id);
  }
  if (resultado.error) throw resultado.error;
}

/**
 * Erro que não melhora tentando de novo (RLS, restrição, dado inválido): a
 * operação é descartada para não travar a fila inteira atrás dela. Erro de
 * rede ou do servidor fica na fila e é tentado de novo.
 */
function ehPermanente(e: unknown): boolean {
  const codigo = (e as { code?: string } | null)?.code ?? "";
  return /^(22|23|42)/.test(codigo) || codigo === "PGRST204";
}

const connector: PowerSyncBackendConnector = {
  async fetchCredentials() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || !ENDPOINT) return null;
    return { endpoint: ENDPOINT, token: data.session.access_token };
  },
  async uploadData(database) {
    const transacao = await database.getNextCrudTransaction();
    if (!transacao) return;
    for (const op of transacao.crud) {
      try {
        await aplicar(op);
      } catch (e) {
        if (!ehPermanente(e)) throw e;
        console.warn("[powersync] operação descartada", op.table, op.op, e);
      }
    }
    await transacao.complete();
  },
};

/**
 * Liga e desliga a sincronização com a sessão: entrou, conecta; saiu, apaga o
 * banco local (os dados eram da pessoa que saiu). `aoSincronizar` roda a cada
 * download concluído — é onde o cache das telas é renovado.
 */
export function iniciarPowerSync(aoSincronizar: () => void): () => void {
  if (!db) return () => undefined;
  const banco = db;
  const local = {
    getAll: <T>(sql: string, params?: unknown[]) => banco.getAll<T>(sql, params as never),
    getOptional: <T>(sql: string, params?: unknown[]) => banco.getOptional<T>(sql, params as never),
    execute: (sql: string, params?: unknown[]) => banco.execute(sql, params as never),
    writeTransaction: <T>(fn: (tx: never) => Promise<T>) =>
      banco.writeTransaction((tx) => fn(tx as never)),
  };
  // As telas só leem do aparelho depois da primeira sincronização completa:
  // antes dela o banco local está vazio, e quem acabou de entrar veria tudo
  // zerado (e o questionário de novo). Até lá, Supabase. Nas aberturas
  // seguintes isso resolve na hora, mesmo sem rede.
  let usandoLocal = false;
  const usarLocalQuandoSincronizar = () => {
    void banco.waitForFirstSync().then(() => {
      if (usandoLocal) return;
      usandoLocal = true;
      configureLocalDb(local);
      aoSincronizar();
    });
  };
  const pararLocal = () => {
    usandoLocal = false;
    configureLocalDb(null);
  };
  usarLocalQuandoSincronizar();
  if (__DEV__) {
    void banco
      .get<{ id: string; tabelas: number }>(
        "SELECT uuid() AS id, (SELECT count(*) FROM sqlite_master WHERE type = 'view') AS tabelas",
      )
      .then((r) =>
        console.log(`[powersync] banco local pronto: ${r.tabelas} tabelas, uuid ${r.id}`),
      )
      .catch((e: unknown) => console.warn("[powersync] banco local falhou", e));
  }
  let logado = false;
  const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
    logado = !!sessao;
    if (sessao) {
      void banco.connect(connector);
      usarLocalQuandoSincronizar();
    } else if (evento === "SIGNED_OUT") {
      pararLocal();
      void banco.disconnectAndClear();
    }
  });
  void supabase.auth.getSession().then(({ data: d }) => {
    logado = !!d.session;
    if (d.session) void banco.connect(connector);
  });
  // A volta da rede nem sempre religa a sincronização: uma tentativa feita
  // enquanto a rede voltava pode ficar presa para sempre (o fetch do RN não
  // tem tempo limite de leitura), e a fila feita offline não sobe. Visto no
  // emulador: 6 min parado depois de religar o wi-fi. `connect` aborta a
  // tentativa presa e começa outra.
  const vigia = setInterval(() => {
    if (logado && !banco.currentStatus.connected) void banco.connect(connector);
  }, 30_000);
  let ultimo: number | undefined;
  const ouvinte = banco.registerListener({
    statusChanged: (status) => {
      const quando = status.lastSyncedAt?.getTime();
      if (quando && quando !== ultimo) {
        if (__DEV__ && ultimo === undefined) {
          void banco
            .get<Record<string, number>>(
              "SELECT (SELECT count(*) FROM exercises) AS exercises, (SELECT count(*) FROM exercise_muscles) AS exercise_muscles, (SELECT count(*) FROM foods) AS foods, (SELECT count(*) FROM workout_sessions) AS workout_sessions, (SELECT count(*) FROM workout_sets) AS workout_sets, (SELECT count(*) FROM recipe_items) AS recipe_items, (SELECT count(*) FROM food_log_entries) AS food_log_entries",
            )
            .then((r) => console.log("[powersync] sincronizado:", JSON.stringify(r)));
        }
        ultimo = quando;
        aoSincronizar();
      }
    },
  });
  return () => {
    clearInterval(vigia);
    data.subscription.unsubscribe();
    ouvinte();
  };
}
