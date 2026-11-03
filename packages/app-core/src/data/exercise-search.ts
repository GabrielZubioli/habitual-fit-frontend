import { supabase } from "../supabase";
import { unwrapList } from "./supabase-helpers";
import type { MuscleValue } from "../lib/labels";
import { localSearch, searchWords } from "../lib/search";
import type { Enums } from "@gabrielzubioli/db/types";
import { jsonList, localDb } from "../local";

/**
 * Busca do seletor de exercícios — a mesma no web e no app nativo.
 */

export type PickedExercise = {
  id: string;
  name: string;
  category: string;
  primaryMuscle: string;
};

/** Músculos oferecidos como filtro — os que de fato têm exercícios no seed. */
export const FILTERABLE_MUSCLES: MuscleValue[] = [
  "chest",
  "back",
  "lats",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "abs",
  "cardio",
];

export async function searchExercises(term: string, muscle: string) {
  const db = localDb();
  if (db) {
    // Todas as palavras no nome em português, ou todas no original em inglês.
    const pt = localSearch(term);
    const en = localSearch(term, "name_en");
    const porMusculo = muscle !== "all";
    return (
      await db.getAll<{
        id: string;
        name: string;
        name_en: string | null;
        primary_muscle: Enums<"muscle_t">;
        equipment: Enums<"equipment_t">;
        category: Enums<"exercise_category_t">;
        image_urls: string | null;
        external_id: string | null;
        media_id: string | null;
        media_ref: string | null;
        media_source: string | null;
        video_url: string | null;
        popularity: number | null;
      }>(
        `SELECT id, name, name_en, primary_muscle, equipment, category, image_urls, external_id,
                media_id, media_ref, media_source, video_url, popularity
           FROM exercises
          WHERE deleted_at IS NULL AND ((${pt.where}) OR (${en.where}))
            ${porMusculo ? "AND primary_muscle = ?" : ""}
          ORDER BY popularity DESC, name LIMIT 60`,
        [...pt.params, ...en.params, ...(porMusculo ? [muscle] : [])],
      )
    ).map((r) => ({ ...r, image_urls: jsonList(r.image_urls) }));
  }
  let query = supabase
    .from("exercises")
    .select(
      "id, name, name_en, primary_muscle, equipment, category, image_urls, external_id, media_id, media_ref, media_source, video_url, popularity",
    )
    .is("deleted_at", null)
    // Popularidade antes do nome: com 880 exercícios, a ordem alfabética
    // coloca variações obscuras acima dos movimentos que todo mundo faz.
    .order("popularity", { ascending: false })
    .order("name")
    .limit(60);
  if (term) {
    // Busca também pelo nome original: quem treina há anos procura por
    // "romanian deadlift", não por "terra romeno".
    const ws = searchWords(term);
    const todas = (col: string) => ws.map((w) => `${col}.ilike.%${w}%`).join(",");
    if (ws.length) query = query.or(`and(${todas("name")}),and(${todas("name_en")})`);
  }
  if (muscle !== "all") query = query.eq("primary_muscle", muscle as never);
  return unwrapList("buscar exercícios", await query);
}

export type ExerciseSearchRow = Awaited<ReturnType<typeof searchExercises>>[number];

export type SubstituteCandidate = {
  id: string;
  name: string;
  primary_muscle: string;
  equipment: string;
  category: string;
  image_urls: string[] | null;
  external_id: string | null;
  media_id: string | null;
  media_ref: string | null;
  media_source: string | null;
};

/**
 * Alternativas para trocar um exercício no meio do treino: o mesmo músculo
 * primário, o mesmo equipamento primeiro (a troca com menor mudança de padrão).
 */
export async function searchSubstitutes({
  primaryMuscle,
  excludeId,
  term,
  equipment,
}: {
  primaryMuscle: string;
  excludeId: string;
  term: string;
  equipment?: string;
}): Promise<SubstituteCandidate[]> {
  const db = localDb();
  const rows = db
    ? await alternativasLocais(primaryMuscle, excludeId, term)
    : await alternativasRemotas(primaryMuscle, excludeId, term);
  if (!equipment) return rows;
  return [...rows].sort(
    (a, b) =>
      (a.equipment === equipment ? 0 : 1) - (b.equipment === equipment ? 0 : 1) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
}

async function alternativasLocais(primaryMuscle: string, excludeId: string, term: string) {
  const busca = localSearch(term);
  return (
    await localDb()!.getAll<
      Omit<SubstituteCandidate, "image_urls"> & { image_urls: string | null }
    >(
      `SELECT id, name, primary_muscle, equipment, category, image_urls, external_id, media_id,
              media_ref, media_source
         FROM exercises
        WHERE deleted_at IS NULL AND primary_muscle = ? AND id != ? AND ${busca.where}
        ORDER BY name LIMIT 50`,
      [primaryMuscle, excludeId, ...busca.params],
    )
  ).map((r) => ({ ...r, image_urls: jsonList(r.image_urls) }));
}

async function alternativasRemotas(primaryMuscle: string, excludeId: string, term: string) {
  let query = supabase
    .from("exercises")
    .select(
      "id, name, primary_muscle, equipment, category, image_urls, external_id, media_id, media_ref, media_source",
    )
    .is("deleted_at", null)
    .eq("primary_muscle", primaryMuscle as never)
    .neq("id", excludeId)
    .order("name")
    .limit(50);
  for (const w of searchWords(term)) query = query.ilike("name", `%${w}%`);
  return unwrapList("buscar alternativas", await query) as SubstituteCandidate[];
}
