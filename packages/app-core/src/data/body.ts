/**
 * Peso corporal para os cards da Início e das Estatísticas.
 */
import { supabase } from "../supabase";
import { assertOk, num, unwrapList, unwrapMaybe } from "./supabase-helpers";
import { toISODate } from "../lib/date";
import type { Tables } from "@gabrielzubioli/db/types";
import { atualizar, localDb } from "../local";
import { deleteById, insertRow } from "./rows";

export interface WeighIn {
  /** `YYYY-MM-DD` local. */
  date: string;
  kg: number;
}

/** Pesagens dos últimos `days` dias, da mais antiga à mais nova. */
export async function fetchWeighIns(days: number): Promise<WeighIn[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - days);
  const db = localDb();
  if (db) {
    return (
      await db.getAll<{ log_date: string; weight_kg: number }>(
        "SELECT log_date, weight_kg FROM body_weights WHERE log_date >= ? ORDER BY log_date",
        [toISODate(desde)],
      )
    ).map((r) => ({ date: r.log_date, kg: num(r.weight_kg) }));
  }
  return unwrapList(
    "carregar peso",
    await supabase
      .from("body_weights")
      .select("log_date, weight_kg")
      .gte("log_date", toISODate(desde))
      .order("log_date"),
  ).map((r) => ({ date: r.log_date, kg: num(r.weight_kg) }));
}

/** Primeira e última pesagem — o começo e o agora da jornada de peso. */
export async function fetchWeightEnds(): Promise<{ first: number | null; latest: number | null }> {
  const db = localDb();
  if (db) {
    const r = await db.getOptional<{ first: number | null; latest: number | null }>(
      `SELECT (SELECT weight_kg FROM body_weights ORDER BY log_date LIMIT 1) AS first,
              (SELECT weight_kg FROM body_weights ORDER BY log_date DESC LIMIT 1) AS latest`,
    );
    return { first: r?.first ?? null, latest: r?.latest ?? null };
  }
  const uma = (ascending: boolean) =>
    supabase
      .from("body_weights")
      .select("weight_kg")
      .order("log_date", { ascending })
      .limit(1)
      .maybeSingle();
  const [primeira, ultima] = await Promise.all([uma(true), uma(false)]);
  const p = unwrapMaybe("buscar peso inicial", primeira);
  const u = unwrapMaybe("buscar último peso", ultima);
  return { first: p ? num(p.weight_kg) : null, latest: u ? num(u.weight_kg) : null };
}

/** Meta de peso do perfil, se definida. */
export async function fetchGoalWeight(): Promise<number | null> {
  const db = localDb();
  const p = db
    ? await db.getOptional<{ goal_weight_kg: number | null }>(
        "SELECT goal_weight_kg FROM profiles LIMIT 1",
      )
    : unwrapMaybe(
        "carregar meta de peso",
        await supabase.from("profiles").select("goal_weight_kg").maybeSingle(),
      );
  return p?.goal_weight_kg == null ? null : num(p.goal_weight_kg);
}

/** Total de treinos concluídos e os do mês corrente. */
export async function fetchWorkoutCounts(): Promise<{ total: number; month: number }> {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const db = localDb();
  if (db) {
    const r = await db.getOptional<{ total: number; month: number }>(
      `SELECT count(*) AS total, sum(CASE WHEN started_at >= ? THEN 1 ELSE 0 END) AS month
         FROM workout_sessions WHERE deleted_at IS NULL AND ended_at IS NOT NULL`,
      [inicioMes.toISOString()],
    );
    return { total: r?.total ?? 0, month: r?.month ?? 0 };
  }
  const base = () =>
    supabase
      .from("workout_sessions")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .not("ended_at", "is", null);
  const [total, mes] = await Promise.all([
    base(),
    base().gte("started_at", inicioMes.toISOString()),
  ]);
  if (total.error) throw total.error;
  if (mes.error) throw mes.error;
  return { total: total.count ?? 0, month: mes.count ?? 0 };
}

// ------------------------------------------------------- registro (tela Corpo)

/** Faixa plausível de peso corporal — evita erros de digitação virarem dados. */
export const WEIGHT_RANGE = { min: 20, max: 400 };

/** Registra o peso do dia; registrar de novo na mesma data atualiza o valor. */
export async function saveBodyWeight(userId: string, date: string, kg: number): Promise<void> {
  if (!Number.isFinite(kg) || kg < WEIGHT_RANGE.min || kg > WEIGHT_RANGE.max) {
    throw new Error(`Informe um peso entre ${WEIGHT_RANGE.min} e ${WEIGHT_RANGE.max} kg.`);
  }
  const db = localDb();
  if (db) {
    // Um peso por dia: registrar de novo na mesma data atualiza.
    const existente = await db.getOptional<{ id: string }>(
      "SELECT id FROM body_weights WHERE user_id = ? AND log_date = ?",
      [userId, date],
    );
    if (existente) await atualizar(db, "body_weights", existente.id, { weight_kg: kg });
    else
      await insertRow("registrar peso", "body_weights", {
        user_id: userId,
        log_date: date,
        weight_kg: kg,
      });
    return;
  }
  assertOk(
    "registrar peso",
    await supabase
      .from("body_weights")
      .upsert(
        { user_id: userId, log_date: date, weight_kg: kg },
        { onConflict: "user_id,log_date" },
      ),
  );
}

export type MeasureKey =
  | "shoulder_cm"
  | "chest_cm"
  | "waist_cm"
  | "abdomen_cm"
  | "hip_cm"
  | "arm_cm"
  | "forearm_cm"
  | "thigh_cm"
  | "calf_cm"
  | "neck_cm"
  | "body_fat_pct";

/**
 * As medidas acompanhadas, por região. As faixas impedem um `180` digitado no
 * campo de braço (a altura, por reflexo) de entrar como circunferência.
 */
export const MEASURE_FIELDS: {
  key: MeasureKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  grupo: "Tronco" | "Braços" | "Pernas" | "Composição";
}[] = [
  { key: "shoulder_cm", label: "Ombro", unit: "cm", min: 60, max: 200, grupo: "Tronco" },
  { key: "chest_cm", label: "Peito", unit: "cm", min: 30, max: 250, grupo: "Tronco" },
  { key: "waist_cm", label: "Cintura", unit: "cm", min: 30, max: 250, grupo: "Tronco" },
  { key: "abdomen_cm", label: "Abdômen", unit: "cm", min: 30, max: 250, grupo: "Tronco" },
  { key: "hip_cm", label: "Quadril", unit: "cm", min: 30, max: 250, grupo: "Tronco" },
  { key: "neck_cm", label: "Pescoço", unit: "cm", min: 20, max: 80, grupo: "Tronco" },
  { key: "arm_cm", label: "Braço", unit: "cm", min: 10, max: 100, grupo: "Braços" },
  { key: "forearm_cm", label: "Antebraço", unit: "cm", min: 10, max: 80, grupo: "Braços" },
  { key: "thigh_cm", label: "Coxa", unit: "cm", min: 20, max: 150, grupo: "Pernas" },
  { key: "calf_cm", label: "Panturrilha", unit: "cm", min: 15, max: 100, grupo: "Pernas" },
  { key: "body_fat_pct", label: "% Gordura", unit: "%", min: 1, max: 70, grupo: "Composição" },
];

/** Regiões na ordem em que aparecem no formulário, de cima para baixo do corpo. */
export const MEASURE_GROUPS = ["Tronco", "Braços", "Pernas", "Composição"] as const;

/** Campo fora da faixa (vazio não conta). */
export function measureInvalid(key: MeasureKey, raw: string): boolean {
  const f = MEASURE_FIELDS.find((m) => m.key === key)!;
  const v = Number(raw.replace(",", "."));
  return raw !== "" && (!Number.isFinite(v) || v < f.min || v > f.max);
}

/** Medidas dos últimos `days` dias, da mais antiga à mais nova. */
export async function fetchMeasurements(days: number) {
  const desde = new Date();
  desde.setDate(desde.getDate() - days);
  const db = localDb();
  if (db) {
    return db.getAll<Tables<"body_measurements">>(
      "SELECT * FROM body_measurements WHERE log_date >= ? ORDER BY log_date",
      [toISODate(desde)],
    );
  }
  return unwrapList(
    "carregar medidas",
    await supabase
      .from("body_measurements")
      .select("*")
      .gte("log_date", toISODate(desde))
      .order("log_date"),
  );
}

/** Grava as medidas preenchidas de uma data. */
export async function saveMeasurements(
  userId: string,
  date: string,
  values: Partial<Record<MeasureKey, string>>,
): Promise<void> {
  const preenchidos = MEASURE_FIELDS.filter((f) => (values[f.key] ?? "") !== "");
  if (preenchidos.length === 0) throw new Error("Preencha ao menos uma medida.");
  const invalido = preenchidos.find((f) => measureInvalid(f.key, values[f.key]!));
  if (invalido) throw new Error(`${invalido.label}: valor fora da faixa esperada.`);
  const payload: Record<string, number | string> = { user_id: userId, log_date: date };
  for (const f of preenchidos) payload[f.key] = Number(values[f.key]!.replace(",", "."));
  await insertRow("registrar medidas", "body_measurements", payload as never);
}

export async function deleteMeasurement(id: string): Promise<void> {
  await deleteById("excluir medida", "body_measurements", id);
}

/** A última medição — cintura e pescoço destravam a estimativa de gordura. */
export async function fetchLatestMeasurement() {
  const db = localDb();
  if (db) {
    return db.getOptional<
      Pick<
        Tables<"body_measurements">,
        "log_date" | "waist_cm" | "neck_cm" | "hip_cm" | "body_fat_pct"
      >
    >(
      "SELECT log_date, waist_cm, neck_cm, hip_cm, body_fat_pct FROM body_measurements ORDER BY log_date DESC LIMIT 1",
    );
  }
  return unwrapMaybe(
    "carregar última medida",
    await supabase
      .from("body_measurements")
      .select("log_date, waist_cm, neck_cm, hip_cm, body_fat_pct")
      .order("log_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

/** As metas ativas da pessoa. */
export async function fetchActiveGoals() {
  const db = localDb();
  if (db) {
    return db.getAll<
      Pick<
        Tables<"goals">,
        | "id"
        | "kind"
        | "label"
        | "metric_key"
        | "start_value"
        | "target_value"
        | "unit"
        | "achieved_at"
      >
    >(
      `SELECT id, kind, label, metric_key, start_value, target_value, unit, achieved_at
         FROM goals WHERE is_active = 1 ORDER BY created_at`,
    );
  }
  return unwrapList(
    "carregar metas",
    await supabase
      .from("goals")
      .select("id, kind, label, metric_key, start_value, target_value, unit, achieved_at")
      .eq("is_active", true)
      .order("created_at"),
  );
}
