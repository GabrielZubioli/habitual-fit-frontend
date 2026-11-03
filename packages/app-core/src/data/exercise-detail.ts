import { subDays } from "date-fns";
import { countsTowardVolume, epley1RM, setVolume } from "@forja/domain";
import { supabase } from "../supabase";
import { found, num, unwrap, unwrapList } from "./supabase-helpers";
import type { Enums } from "@gabrielzubioli/db/types";
import { bool, jsonList, jsonValue, localDb } from "../local";
import { toISODate } from "../lib/date";
import { t } from "../i18n";

/**
 * A ficha de um exercício: o cadastro e o histórico de quem está logado — as
 * mesmas consultas e a mesma agregação no web e no app nativo.
 */

export const PERIODS = [
  { value: "90", label: t("3 meses") },
  { value: "180", label: t("6 meses") },
  { value: "365", label: t("1 ano") },
  { value: "all", label: t("Tudo") },
] as const;

export type Period = (typeof PERIODS)[number]["value"];

export type SessionSummary = {
  sessionId: string;
  date: string;
  /** Melhor 1RM estimado da sessão. */
  bestE1rm: number;
  /** Tonelagem do exercício naquela sessão. */
  volume: number;
  /** Melhor série (a de maior e1RM), para exibir "80 kg × 8". */
  bestSet: { weight: number; reps: number } | null;
  workingSets: number;
  hasPr: boolean;
};

export async function fetchExerciseDetail(id: string): Promise<ExerciseDetail> {
  const db = localDb();
  if (!db) return detalheRemoto(id);
  const ex = found(
    "carregar exercício",
    await db.getOptional<Record<string, unknown> & { id: string }>(
      `SELECT id, name, name_en, name_es, primary_muscle, secondary_muscles, equipment, category, level, mechanic,
              execution, instructions, execution_en, execution_es, cues, common_mistakes, contraindications,
              image_urls, external_id, media_id, media_ref, media_source, video_url
         FROM exercises WHERE id = ?`,
      [id],
    ),
  );
  const musculos = await db.getAll<{ muscle: string; contribution: number }>(
    "SELECT muscle, contribution FROM exercise_muscles WHERE exercise_id = ?",
    [id],
  );
  return {
    ...ex,
    secondary_muscles: jsonList(ex.secondary_muscles),
    image_urls: jsonList(ex.image_urls),
    cues: jsonList(ex.cues),
    common_mistakes: jsonList(ex.common_mistakes),
    contraindications: jsonList(ex.contraindications),
    execution: jsonValue(ex.execution, null),
    execution_en: jsonValue(ex.execution_en, null),
    execution_es: jsonValue(ex.execution_es, null),
    exercise_muscles: musculos,
  } as unknown as ExerciseDetail;
}

async function detalheRemoto(id: string) {
  return unwrap(
    "carregar exercício",
    await supabase
      .from("exercises")
      .select(
        "id, name, name_en, name_es, primary_muscle, secondary_muscles, equipment, category, level, mechanic, execution, instructions, execution_en, execution_es, cues, common_mistakes, contraindications, image_urls, external_id, media_id, media_ref, media_source, video_url, exercise_muscles(muscle, contribution)",
      )
      .eq("id", id)
      .single(),
  );
}

export type ExerciseDetail = Awaited<ReturnType<typeof detalheRemoto>>;

export async function fetchExerciseHistory(id: string, userId: string, period: Period) {
  const db = localDb();
  if (db) {
    const desde =
      period === "all" ? "" : `${toISODate(subDays(new Date(), Number(period)))}T00:00:00`;
    return (
      await db.getAll<{
        id: string;
        weight_kg: number | null;
        reps: number | null;
        set_type: string;
        completed: number;
        is_pr: number;
        session_id: string;
        user_id: string;
        started_at: string;
        deleted_at: string | null;
      }>(
        `SELECT ws.id, ws.weight_kg, ws.reps, ws.set_type, ws.completed, ws.is_pr, ws.session_id,
                ss.user_id, ss.started_at, ss.deleted_at
           FROM workout_sets ws JOIN workout_sessions ss ON ss.id = ws.session_id
          WHERE ws.exercise_id = ? AND ss.user_id = ? AND ss.deleted_at IS NULL AND ss.started_at >= ?
          ORDER BY ws.created_at`,
        [id, userId, desde],
      )
    ).map(({ user_id, started_at, deleted_at, ...r }) => ({
      ...r,
      set_type: r.set_type as Enums<"set_type_t">,
      completed: bool(r.completed),
      is_pr: bool(r.is_pr),
      workout_sessions: { id: r.session_id, user_id, started_at, deleted_at },
    }));
  }
  let query = supabase
    .from("workout_sets")
    .select(
      "id, weight_kg, reps, set_type, completed, is_pr, session_id, workout_sessions!inner(id, user_id, started_at, deleted_at)",
    )
    .eq("exercise_id", id)
    .eq("workout_sessions.user_id", userId)
    .is("workout_sessions.deleted_at", null)
    .order("created_at");
  if (period !== "all") {
    const from = toISODate(subDays(new Date(), Number(period)));
    query = query.gte("workout_sessions.started_at", `${from}T00:00:00`);
  }
  return unwrapList("carregar histórico do exercício", await query);
}

/**
 * Agrega as séries por sessão. Só séries válidas (concluídas, não-aquecimento)
 * entram nas métricas — a mesma regra usada na sessão ao vivo e no dashboard.
 */
export function summarizeExerciseSessions(
  rows: Awaited<ReturnType<typeof fetchExerciseHistory>>,
): SessionSummary[] {
  const bySession = new Map<string, SessionSummary>();
  for (const set of rows) {
    const parent = set.workout_sessions;
    if (!parent) continue;
    if (
      !countsTowardVolume({
        weightKg: set.weight_kg,
        reps: set.reps,
        setType: set.set_type,
        completed: set.completed,
      })
    ) {
      continue;
    }
    const weight = num(set.weight_kg);
    const reps = num(set.reps);
    if (weight <= 0 || reps <= 0) continue;
    const current = bySession.get(parent.id) ?? {
      sessionId: parent.id,
      date: parent.started_at,
      bestE1rm: 0,
      volume: 0,
      bestSet: null,
      workingSets: 0,
      hasPr: false,
    };
    const e1rm = epley1RM(weight, reps);
    current.volume += setVolume(weight, reps);
    current.workingSets += 1;
    current.hasPr = current.hasPr || Boolean(set.is_pr);
    if (e1rm > current.bestE1rm) {
      current.bestE1rm = e1rm;
      current.bestSet = { weight, reps };
    }
    bySession.set(parent.id, current);
  }
  return Array.from(bySession.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

/** Recorde, evolução (primeira × última sessão) e a série para os gráficos. */
export function exerciseProgress(sessions: readonly SessionSummary[]) {
  const recorde = sessions.reduce<SessionSummary | null>(
    (best, s) => (!best || s.bestE1rm > best.bestE1rm ? s : best),
    null,
  );
  const primeiro = sessions[0];
  const ultimo = sessions.at(-1);
  const ganho =
    primeiro && ultimo && primeiro.bestE1rm > 0
      ? ((ultimo.bestE1rm - primeiro.bestE1rm) / primeiro.bestE1rm) * 100
      : null;
  return { recorde, ganho };
}
