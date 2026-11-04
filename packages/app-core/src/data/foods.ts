import { supabase } from "../supabase";
import { localSearch, searchWords } from "../lib/search";
import { localDb } from "../local";
import { num, unwrapList } from "./supabase-helpers";
import { colunaDoIdioma, LOCALE, porIdioma } from "../i18n";

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

/**
 * Nome e medida caseira no idioma do app. Os alimentos públicos têm tradução
 * (`name_en`/`name_es`); os da pessoa ficam como ela escreveu.
 */
export function foodName(f: { name: string; name_en?: string | null; name_es?: string | null }) {
  return porIdioma(f.name, f.name_en, f.name_es);
}

export function foodMeasure(f: {
  household_measure: string | null;
  household_measure_en?: string | null;
  household_measure_es?: string | null;
}): string | null {
  return f.household_measure
    ? porIdioma(f.household_measure, f.household_measure_en, f.household_measure_es)
    : null;
}

export const FOOD_SEARCH_LIMIT = 50;

/** Número do catálogo, ou `null` quando ausente — dado que falta não vira zero. */
const opcional = (v: unknown) => {
  const n = num(v, Number.NaN);
  return Number.isNaN(n) ? null : n;
};

/**
 * Busca pelo nome, todas as palavras, em ordem alfabética. Fora do pt, procura
 * também no nome traduzido: "chicken" acha "Frango".
 */
export async function searchFoods(term: string): Promise<FoodOption[]> {
  const traduzida = colunaDoIdioma("name");
  const colunas = traduzida ? ["name", traduzida] : ["name"];
  const db = localDb();
  if (db) {
    const busca = localSearch(term, colunas);
    return ordenados(
      (
        await db.getAll<Parameters<typeof paraOpcao>[0]>(
          `SELECT ${COLUNAS} FROM foods WHERE deleted_at IS NULL AND ${busca.where}
            ORDER BY name LIMIT ?`,
          [...busca.params, FOOD_SEARCH_LIMIT],
        )
      ).map(paraOpcao),
    );
  }
  let query = supabase
    .from("foods")
    .select(COLUNAS)
    .is("deleted_at", null)
    .order("name")
    .limit(FOOD_SEARCH_LIMIT);
  for (const w of searchWords(term)) {
    query = query.or(colunas.map((c) => `${c}.ilike.%${w}%`).join(","));
  }
  return ordenados(unwrapList("buscar alimentos", await query).map(paraOpcao));
}

/** Em ordem alfabética do nome mostrado (o banco ordena pelo português). */
function ordenados(lista: FoodOption[]): FoodOption[] {
  return lista.sort((a, b) => a.name.localeCompare(b.name, LOCALE));
}

// Literal único: o supabase-js infere o tipo do retorno a partir do texto.
const COLUNAS =
  "id, name, name_en, name_es, brand, serving_size_g, kcal, protein_g, carbs_g, fat_g, image_url, category, household_measure, household_measure_en, household_measure_es, household_grams";

function paraOpcao(f: {
  id: string;
  name: string;
  name_en: string | null;
  name_es: string | null;
  household_measure_en: string | null;
  household_measure_es: string | null;
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
    name: foodName(f),
    brand: f.brand,
    servingSizeG: num(f.serving_size_g, 100),
    kcal: num(f.kcal),
    proteinG: opcional(f.protein_g),
    carbsG: opcional(f.carbs_g),
    fatG: opcional(f.fat_g),
    imageUrl: f.image_url,
    category: f.category,
    measure: foodMeasure(f),
    measureG: opcional(f.household_grams) || null,
  };
}
