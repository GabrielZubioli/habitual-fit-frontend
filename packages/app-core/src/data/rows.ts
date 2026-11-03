/**
 * Escritas simples por `id`, no banco local quando o app tem um (offline,
 * ver `../local`) e no Supabase quando não. As operações compostas continuam
 * nos módulos; aqui ficam só as de uma linha, que eram iguais em toda parte.
 */
import type { PostgrestError, PostgrestSingleResponse } from "@supabase/supabase-js";
import type { Database, TablesInsert, TablesUpdate } from "@gabrielzubioli/db/types";
import { supabase } from "../supabase";
import { agoraIso, atualizar, inserir, localDb } from "../local";
import { assertOk, unwrap } from "./supabase-helpers";

type Tabela = keyof Database["public"]["Tables"];

/**
 * O cliente com a tabela como string: os tipos do supabase-js não aceitam uma
 * tabela genérica. A checagem de colunas fica nas assinaturas abaixo.
 */
type Resposta = PromiseLike<{ error: PostgrestError | null }>;
const solto = supabase as unknown as {
  from(table: string): {
    update(patch: unknown): { eq(col: "id", id: string): Resposta };
    delete(): { eq(col: "id", id: string): Resposta };
    insert(row: unknown): {
      select(cols: "id"): { single(): PromiseLike<PostgrestSingleResponse<{ id: string }>> };
    } & Resposta;
  };
};

/** As únicas tabelas do aparelho sem `created_at`. */
const SEM_CREATED_AT = new Set<string>(["exercise_muscles", "water_intake", "diet_days"]);

export async function updateById<T extends Tabela>(
  operation: string,
  table: T,
  id: string,
  patch: TablesUpdate<T>,
): Promise<void> {
  const db = localDb();
  if (db) return atualizar(db, table, id, patch as Record<string, unknown>);
  assertOk(operation, await solto.from(table).update(patch).eq("id", id));
}

/** Insere e devolve o `id`. No banco local, `created_at` vai junto (ordenação). */
export async function insertRow<T extends Tabela>(
  operation: string,
  table: T,
  row: TablesInsert<T>,
): Promise<string> {
  const db = localDb();
  if (db) {
    const linha = row as Record<string, unknown>;
    return inserir(
      db,
      table,
      SEM_CREATED_AT.has(table) ? linha : { created_at: agoraIso(), ...linha },
    );
  }
  return unwrap(operation, await solto.from(table).insert(row).select("id").single()).id;
}

/** Várias linhas de uma vez (numa transação, no banco local). */
export async function insertRows<T extends Tabela>(
  operation: string,
  table: T,
  rows: readonly TablesInsert<T>[],
): Promise<void> {
  if (rows.length === 0) return;
  const db = localDb();
  if (db) {
    const agora = agoraIso();
    await db.writeTransaction(async (tx) => {
      for (const row of rows) {
        const linha = row as Record<string, unknown>;
        await inserir(
          tx,
          table,
          SEM_CREATED_AT.has(table) ? linha : { created_at: agora, ...linha },
        );
      }
    });
    return;
  }
  assertOk(operation, await solto.from(table).insert(rows));
}

export async function deleteById(operation: string, table: Tabela, id: string): Promise<void> {
  const db = localDb();
  if (db) {
    await db.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return;
  }
  assertOk(operation, await solto.from(table).delete().eq("id", id));
}
