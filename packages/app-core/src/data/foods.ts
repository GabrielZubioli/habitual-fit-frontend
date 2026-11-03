import { supabase } from "../supabase";
import { localSearch, searchWords } from "../lib/search";
import { localDb } from "../local";
import { num, unwrapList } from "./supabase-helpers";

/**
 * O catálogo de alimentos como os seletores o mostram — o mesmo no web e no
 * app nativo.
 */
export type PickedFood = {
  id: string;
  name: string;
  brand: string | null;
  servingSizeG: number;
  kcal: number;
};

/** O alimento com macros `null` quando o catálogo não tem o dado. */
export type FoodOption = PickedFood & {
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  imageUrl: string | null;
  category: string | null;
  /** Medida caseira ("fatia", "colher de sopa") e quanto ela pesa. */
  measure: string | null;
  measureG: number | null;
};

export const FOOD_SEARCH_LIMIT = 50;

/** Número do catálogo, ou `null` quando ausente — dado que falta não vira zero. */
const opcional = (v: unknown) => {
  const n = num(v, Number.NaN);
  return Number.isNaN(n) ? null : n;
};

/** Busca pelo nome, todas as palavras, em ordem alfabética. */
export async function searchFoods(term: string): Promise<FoodOption[]> {
  const db = localDb();
  if (db) {
    const busca = localSearch(term);
    return (
      await db.getAll<Parameters<typeof paraOpcao>[0]>(
        `SELECT ${COLUNAS} FROM foods WHERE deleted_at IS NULL AND ${busca.where}
          ORDER BY name LIMIT ?`,
        [...busca.params, FOOD_SEARCH_LIMIT],
      )
    ).map(paraOpcao);
  }
  let query = supabase
    .from("foods")
    .select(
      "id, name, brand, serving_size_g, kcal, protein_g, carbs_g, fat_g, image_url, category, household_measure, household_grams",
    )
    .is("deleted_at", null)
    .order("name")
    .limit(FOOD_SEARCH_LIMIT);
  for (const w of searchWords(term)) query = query.ilike("name", `%${w}%`);
  return unwrapList("buscar alimentos", await query).map(paraOpcao);
}

const COLUNAS =
  "id, name, brand, serving_size_g, kcal, protein_g, carbs_g, fat_g, image_url, category, household_measure, household_grams";

function paraOpcao(f: {
  id: string;
  name: string;
  brand: string | null;
  serving_size_g: number | string | null;
  kcal: number | string | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
  image_url: string | null;
  category: string | null;
  household_measure: string | null;
  household_grams: number | string | null;
}): FoodOption {
  return {
    id: f.id,
    name: f.name,
    brand: f.brand,
    servingSizeG: num(f.serving_size_g, 100),
    kcal: num(f.kcal),
    proteinG: opcional(f.protein_g),
    carbsG: opcional(f.carbs_g),
    fatG: opcional(f.fat_g),
    imageUrl: f.image_url,
    category: f.category,
    measure: f.household_measure,
    measureG: opcional(f.household_grams) || null,
  };
}
