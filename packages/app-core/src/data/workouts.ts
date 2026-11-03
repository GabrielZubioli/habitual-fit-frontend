/**
 * Acesso a dados do módulo de treinos.
 *
 * As rotas montavam as queries inline, o que impedia reutilizar operações
 * compostas (como iniciar uma sessão a partir de um template) e tornava
 * impossível testá-las.
 */
import { supabase } from "../supabase";
import type { Enums } from "@gabrielzubioli/db/types";
import { assertOk, found, num, unwrap, unwrapList } from "./supabase-helpers";
import { agoraIso, bool, inserir, jsonList, localDb, marcadores } from "../local";
import { countsTowardVolume, epley1RM, type MuscleSetEntry } from "@forja/domain";
import { formatDate, localDayRange, toISODate } from "../lib/date";

/** Defaults de template, alinhados com os do banco. */
const DEFAULT_TARGET_SETS = 3;
const DEFAULT_TARGET_REPS = 10;
const DEFAULT_REST_SECONDS = 90;
/** Teto de segurança: um template corrompido não deve gerar centenas de linhas. */
const MAX_SETS_PER_EXERCISE = 12;

export type LastPerformance = {
  exerciseId: string;
  weightKg: number | null;
  reps: number | null;
};

/**
 * Última série registrada pelo usuário para cada exercício informado.
 *
 * Usada para pré-preencher a sessão. Uma única consulta cobre todos os
 * exercícios do template — antes era uma requisição por exercício adicionado.
 */
export async function fetchLastPerformances(
  userId: string,
  exerciseIds: readonly string[],
): Promise<Map<string, LastPerformance>> {
  const byExercise = new Map<string, LastPerformance>();
  if (exerciseIds.length === 0) return byExercise;

  const db = localDb();
  const rows = db
    ? await db.getAll<{ exercise_id: string; weight_kg: number | null; reps: number | null }>(
        `SELECT ws.exercise_id, ws.weight_kg, ws.reps
           FROM workout_sets ws JOIN workout_sessions ss ON ss.id = ws.session_id
          WHERE ws.exercise_id IN (${marcadores(exerciseIds.length)}) AND ss.user_id = ?
            AND ws.weight_kg IS NOT NULL
          ORDER BY ws.created_at DESC LIMIT ?`,
        [...exerciseIds, userId, exerciseIds.length * 20],
      )
    : unwrapList(
        "buscar histórico dos exercícios",
        await supabase
          .from("workout_sets")
          .select("exercise_id, weight_kg, reps, created_at, workout_sessions!inner(user_id)")
          .in("exercise_id", exerciseIds as string[])
          .eq("workout_sessions.user_id", userId)
          .not("weight_kg", "is", null)
          .order("created_at", { ascending: false })
          .limit(exerciseIds.length * 20),
      );

  // As linhas vêm da mais recente para a mais antiga: a primeira de cada
  // exercício já é a que interessa.
  for (const row of rows) {
    if (byExercise.has(row.exercise_id)) continue;
    byExercise.set(row.exercise_id, {
      exerciseId: row.exercise_id,
      weightKg: row.weight_kg === null ? null : num(row.weight_kg),
      reps: row.reps === null ? null : num(row.reps),
    });
  }

  return byExercise;
}

/** Cria uma sessão em branco ("treino rápido"). */
export async function startBlankSession(userId: string): Promise<string> {
  if (localDb()) {
    return criarSessaoLocal(userId, null, `Treino ${formatDate(new Date(), "dd/MM HH:mm")}`);
  }
  const session = unwrap(
    "criar treino",
    await supabase
      .from("workout_sessions")
      .insert({ user_id: userId, name: `Treino ${formatDate(new Date(), "dd/MM HH:mm")}` })
      .select("id")
      .single(),
  );
  return session.id;
}

/**
 * Cria uma sessão a partir de um template **copiando os exercícios**.
 *
 * Antes, `startFromTemplate` copiava apenas o nome e gravava `template_id`: a
 * sessão nascia vazia e o usuário precisava readicionar tudo à mão, o que
 * anulava o propósito do template.
 *
 * Cada exercício gera `target_sets` séries com `completed: false`, na ordem do
 * template, pré-preenchidas com o desempenho da última vez.
 */
export async function startSessionFromTemplate(
  userId: string,
  templateId: string,
): Promise<string> {
  if (localDb()) return iniciarDoTemplateLocal(userId, templateId);

  const template = unwrap(
    "carregar template",
    await supabase.from("workout_templates").select("id, name").eq("id", templateId).single(),
  );

  const items = unwrapList(
    "carregar exercícios do template",
    await supabase
      .from("workout_template_exercises")
      .select(
        "exercise_id, position, target_sets, target_reps, rest_seconds, superset_group, notes",
      )
      .eq("template_id", templateId)
      .order("position"),
  );

  const session = unwrap(
    "criar treino",
    await supabase
      .from("workout_sessions")
      .insert({ user_id: userId, template_id: templateId, name: template.name || "Treino" })
      .select("id")
      .single(),
  );

  if (items.length === 0) return session.id;

  const rows = await seriesDoTemplate(userId, session.id, items);

  // Se a cópia das séries falhar, a sessão vazia já criada seria lixo — desfaz.
  const insert = await supabase.from("workout_sets").insert(rows);
  if (insert.error) {
    await supabase.from("workout_sessions").delete().eq("id", session.id);
    assertOk("copiar exercícios do template", insert);
  }

  return session.id;
}

type ItemDoTemplate = {
  exercise_id: string;
  target_sets: number | null;
  target_reps: number | null;
  rest_seconds: number | null;
  superset_group: number | null;
};

/** As séries da sessão nova: as de cada exercício do template, com a última carga. */
async function seriesDoTemplate(
  userId: string,
  sessionId: string,
  items: readonly ItemDoTemplate[],
) {
  const lastByExercise = await fetchLastPerformances(
    userId,
    items.map((i) => i.exercise_id),
  );

  return items.flatMap((item, index) => {
    const targetSets = clamp(num(item.target_sets, DEFAULT_TARGET_SETS), 1, MAX_SETS_PER_EXERCISE);
    const targetReps = num(item.target_reps, DEFAULT_TARGET_REPS) || null;
    const rest = num(item.rest_seconds, DEFAULT_REST_SECONDS) || null;
    const last = lastByExercise.get(item.exercise_id);

    return Array.from({ length: targetSets }, (_, i) => ({
      session_id: sessionId,
      exercise_id: item.exercise_id,
      // Reindexa a posição: um template com posições esparsas (efeito do swap
      // com valor temporário) geraria buracos na sessão.
      position: index + 1,
      set_index: i + 1,
      set_type: "working" as const,
      weight_kg: last?.weightKg ?? null,
      reps: last?.reps ?? targetReps,
      rest_seconds: rest,
      completed: false,
      // Preserva a supersérie definida no template. Antes a coluna existia só
      // do lado do template e o agrupamento se perdia ao iniciar o treino.
      superset_group: item.superset_group ?? null,
    }));
  });
}

/**
 * Séries novas no banco local, numa transação. `created_at` vai junto: o
 * histórico ordena por ele, e sem ele a série só ganharia data depois de subir.
 */
export async function inserirSeries(
  linhas: readonly {
    session_id: string;
    exercise_id: string;
    position: number;
    set_index: number;
    weight_kg: number | null;
    reps: number | null;
    rest_seconds: number | null;
    completed: boolean;
    set_type?: string;
    superset_group?: number | null;
  }[],
): Promise<void> {
  const agora = agoraIso();
  await localDb()!.writeTransaction(async (tx) => {
    for (const l of linhas) {
      await inserir(tx, "workout_sets", {
        set_type: "working",
        superset_group: null,
        ...l,
        is_pr: false,
        created_at: agora,
      });
    }
  });
}

/** `started_at` vai junto: sem ele a sessão só teria data depois de subir. */
async function criarSessaoLocal(
  userId: string,
  templateId: string | null,
  name: string,
): Promise<string> {
  const agora = agoraIso();
  return inserir(localDb()!, "workout_sessions", {
    user_id: userId,
    template_id: templateId,
    name,
    started_at: agora,
    created_at: agora,
    updated_at: agora,
  });
}

async function iniciarDoTemplateLocal(userId: string, templateId: string): Promise<string> {
  const db = localDb()!;
  const template = found(
    "carregar template",
    await db.getOptional<{ name: string }>("SELECT name FROM workout_templates WHERE id = ?", [
      templateId,
    ]),
  );
  const items = await db.getAll<ItemDoTemplate>(
    `SELECT exercise_id, target_sets, target_reps, rest_seconds, superset_group
       FROM workout_template_exercises WHERE template_id = ? ORDER BY position`,
    [templateId],
  );
  const sessionId = await criarSessaoLocal(userId, templateId, template.name || "Treino");
  if (items.length > 0) await inserirSeries(await seriesDoTemplate(userId, sessionId, items));
  return sessionId;
}

/**
 * Melhor e1RM histórico do usuário para um exercício, considerando apenas
 * séries válidas. Base do cálculo de recorde pessoal.
 */
export async function fetchBestE1rm(userId: string, exerciseId: string): Promise<number> {
  const db = localDb();
  const rows = db
    ? await db.getAll<{ weight_kg: number | null; reps: number | null }>(
        `SELECT ws.weight_kg, ws.reps FROM workout_sets ws JOIN workout_sessions ss ON ss.id = ws.session_id
          WHERE ws.exercise_id = ? AND ss.user_id = ? AND ws.completed = 1
            AND ws.set_type != 'warmup' AND ws.weight_kg IS NOT NULL LIMIT 500`,
        [exerciseId, userId],
      )
    : unwrapList(
        "buscar recorde do exercício",
        await supabase
          .from("workout_sets")
          .select("weight_kg, reps, set_type, completed, workout_sessions!inner(user_id)")
          .eq("exercise_id", exerciseId)
          .eq("workout_sessions.user_id", userId)
          .eq("completed", true)
          .neq("set_type", "warmup")
          .not("weight_kg", "is", null)
          .limit(500),
      );

  return rows.reduce((best, s) => {
    const e1rm = epley1RM(num(s.weight_kg), num(s.reps));
    return e1rm > best ? e1rm : best;
  }, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export type PersonalRecord = {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  /** 1RM estimado (Epley) — o que define "recorde" em `finishWorkout`. */
  e1rm: number;
  date: string;
};

/**
 * O recorde mais recente de cada exercício.
 *
 * Lê só as séries marcadas como PR (índice parcial `idx_workout_sets_pr`):
 * como cada PR supera o anterior, o mais recente por exercício é o atual.
 */
export async function fetchPersonalRecords(limit = 8): Promise<PersonalRecord[]> {
  const db = localDb();
  const rows = db
    ? (
        await db.getAll<{
          exercise_id: string;
          weight_kg: number | null;
          reps: number | null;
          name: string | null;
          started_at: string;
        }>(
          `SELECT ws.exercise_id, ws.weight_kg, ws.reps, e.name, ss.started_at
             FROM workout_sets ws JOIN workout_sessions ss ON ss.id = ws.session_id
             LEFT JOIN exercises e ON e.id = ws.exercise_id
            WHERE ws.is_pr = 1 AND ss.deleted_at IS NULL
            ORDER BY ws.created_at DESC LIMIT 300`,
        )
      ).map((r) => ({
        ...r,
        exercises: r.name === null ? null : { name: r.name },
        workout_sessions: { started_at: r.started_at },
      }))
    : unwrapList(
        "carregar recordes",
        await supabase
          .from("workout_sets")
          .select(
            "exercise_id, weight_kg, reps, exercises(name), workout_sessions!inner(started_at, deleted_at)",
          )
          .eq("is_pr", true)
          .is("workout_sessions.deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(300),
      );

  const porExercicio = new Map<string, PersonalRecord>();
  for (const r of rows) {
    if (porExercicio.has(r.exercise_id)) continue;
    const weightKg = num(r.weight_kg);
    const reps = num(r.reps);
    porExercicio.set(r.exercise_id, {
      exerciseId: r.exercise_id,
      exerciseName: r.exercises?.name ?? "Exercício",
      weightKg,
      reps,
      e1rm: epley1RM(weightKg, reps),
      date: r.workout_sessions.started_at,
    });
  }
  return [...porExercicio.values()].slice(0, limit);
}

/**
 * Séries efetivas por músculo e dia local nas últimas `weeks` semanas, para o
 * progresso por parte do corpo. Mesma convenção da recuperação: músculo
 * primário conta 1 série, secundário meia.
 */
export async function fetchMuscleSetEntries(weeks = 8): Promise<MuscleSetEntry[]> {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - 7 * weeks);
  const { start, endExclusive } = localDayRange(toISODate(inicio), toISODate(hoje));

  const db = localDb();
  const rows = db
    ? (
        await db.getAll<{
          set_type: string | null;
          completed: number;
          primary_muscle: string | null;
          secondary_muscles: string | null;
          started_at: string;
        }>(
          `SELECT ws.set_type, ws.completed, e.primary_muscle, e.secondary_muscles, ss.started_at
             FROM workout_sets ws JOIN workout_sessions ss ON ss.id = ws.session_id
             LEFT JOIN exercises e ON e.id = ws.exercise_id
            WHERE ss.deleted_at IS NULL AND ss.ended_at IS NOT NULL
              AND ss.started_at >= ? AND ss.started_at < ? LIMIT 5000`,
          [start, endExclusive],
        )
      ).map((r) => ({
        set_type: r.set_type as Enums<"set_type_t">,
        completed: bool(r.completed),
        exercises:
          r.primary_muscle === null
            ? null
            : {
                primary_muscle: r.primary_muscle as Enums<"muscle_t">,
                secondary_muscles: jsonList<Enums<"muscle_t">>(r.secondary_muscles),
              },
        workout_sessions: { started_at: r.started_at },
      }))
    : unwrapList(
        "carregar séries por músculo",
        await supabase
          .from("workout_sets")
          .select(
            "set_type, completed, exercises(primary_muscle, secondary_muscles), workout_sessions!inner(started_at, deleted_at, ended_at)",
          )
          .is("workout_sessions.deleted_at", null)
          .not("workout_sessions.ended_at", "is", null)
          .gte("workout_sessions.started_at", start)
          .lt("workout_sessions.started_at", endExclusive)
          .limit(5000),
      );

  const entries: MuscleSetEntry[] = [];
  for (const r of rows) {
    const valida = countsTowardVolume({
      weightKg: null,
      reps: null,
      setType: r.set_type,
      completed: r.completed,
    });
    if (!r.exercises || !valida) {
      continue;
    }
    const day = toISODate(new Date(r.workout_sessions.started_at));
    entries.push({ muscle: r.exercises.primary_muscle, day, sets: 1 });
    for (const m of r.exercises.secondary_muscles ?? [])
      entries.push({ muscle: m, day, sets: 0.5 });
  }
  return entries;
}

/**
 * Exercício próprio — para o aparelho da sua academia que não está no catálogo.
 * Fica privado (`is_public = false`) e entra no mapa corporal pelo músculo
 * principal.
 */
export async function createOwnExercise(
  userId: string,
  input: { name: string; primaryMuscle: Enums<"muscle_t">; equipment: Enums<"equipment_t"> },
): Promise<string> {
  const db = localDb();
  if (db) {
    return db.writeTransaction(async (tx) => {
      const id = await inserir(tx, "exercises", {
        owner_id: userId,
        is_public: false,
        name: input.name.trim(),
        primary_muscle: input.primaryMuscle,
        equipment: input.equipment,
        secondary_muscles: [],
        image_urls: [],
        created_at: agoraIso(),
      });
      // `exercise_muscles` não tem `id`: no aparelho ele é a chave natural.
      await inserir(tx, "exercise_muscles", {
        id: `${id}:${input.primaryMuscle}`,
        exercise_id: id,
        muscle: input.primaryMuscle,
        contribution: 1,
      });
      return id;
    });
  }
  const exercicio = unwrap(
    "criar exercício",
    await supabase
      .from("exercises")
      .insert({
        owner_id: userId,
        is_public: false,
        name: input.name.trim(),
        primary_muscle: input.primaryMuscle,
        equipment: input.equipment,
      })
      .select("id")
      .single(),
  );
  assertOk(
    "registrar músculo do exercício",
    await supabase
      .from("exercise_muscles")
      .insert({ exercise_id: exercicio.id, muscle: input.primaryMuscle, contribution: 1 }),
  );
  return exercicio.id;
}

/** Os últimos treinos concluídos, do mais recente: nome, data, duração e volume. */
export async function fetchRecentSessions(limit = 10) {
  const db = localDb();
  if (db) {
    return db.getAll<{
      id: string;
      name: string;
      started_at: string;
      duration_seconds: number | null;
      total_volume_kg: number | null;
    }>(
      `SELECT id, name, started_at, duration_seconds, total_volume_kg FROM workout_sessions
        WHERE deleted_at IS NULL AND ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?`,
      [limit],
    );
  }
  return unwrapList(
    "carregar histórico",
    await supabase
      .from("workout_sessions")
      .select("id, name, started_at, duration_seconds, total_volume_kg")
      .is("deleted_at", null)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(limit),
  );
}
