import { supabase } from "../supabase";
import { found, num, unwrap, unwrapList } from "./supabase-helpers";
import type { Tables } from "@gabrielzubioli/db/types";
import { localDb, marcadores } from "../local";
import { deleteById, insertRow, insertRows, updateById } from "./rows";
import type { MealValue } from "../lib/labels";
import { recipeNutrition, type Portion } from "@forja/domain";
import { t } from "../i18n";

/**
 * Receitas: as prontas (do sistema, `user_id` nulo — todos leem, ninguém
 * edita) e as da pessoa. Uma receita entra na refeição como os ingredientes
 * dela, na proporção das porções escolhidas — assim os macros do dia somam o
 * que de fato foi comido, e cada ingrediente pode ser ajustado depois.
 */

export const RECIPE_CATEGORIES = [
  { key: "vitaminas", label: t("Vitaminas e shakes"), emoji: "🥤" },
  { key: "cafe-da-manha", label: t("Café da manhã"), emoji: "🍳" },
  { key: "sanduiches", label: t("Sanduíches"), emoji: "🥪" },
  { key: "pratos", label: t("Pratos"), emoji: "🍛" },
  { key: "saladas", label: t("Saladas"), emoji: "🥗" },
  { key: "lanches", label: t("Lanches"), emoji: "🥜" },
  { key: "bolos-e-doces", label: t("Bolos e doces"), emoji: "🍰" },
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number]["key"];

export function recipeCategoryOf(key: string | null) {
  return RECIPE_CATEGORIES.find((c) => c.key === key) ?? null;
}

export interface RecipeSummary {
  id: string;
  name: string;
  category: string | null;
  /** Foto do prato (receitas do sistema); null = mostrar o símbolo da categoria. */
  imageUrl: string | null;
  servings: number;
  prepMinutes: number | null;
  instructions: string | null;
  isSystem: boolean;
  items: { foodId: string; name: string; grams: number }[];
  /** Macros de uma porção. */
  perServing: { kcal: number; proteinG: number; carbsG: number; fatG: number };
}

/** Todas as receitas visíveis: as prontas e as da pessoa. */
export async function fetchRecipes(): Promise<RecipeSummary[]> {
  const db = localDb();
  const rows = db
    ? await receitasLocais()
    : unwrapList(
        "carregar receitas",
        await supabase
          .from("recipes")
          .select(
            "id, name, category, image_url, servings, prep_minutes, instructions, user_id, recipe_items(food_id, grams, foods(name, serving_size_g, kcal, protein_g, carbs_g, fat_g))",
          )
          .is("deleted_at", null)
          .order("name"),
      );

  return rows.map((r) => {
    const porcoes = Math.max(1, num(r.servings, 1));
    const itens = r.recipe_items ?? [];
    // Mesma conta do diário e do gerador: ingredientes reais ÷ rendimento.
    const { perServing } = recipeNutrition(
      itens.map((i) => ({
        food: {
          servingSizeG: num(i.foods?.serving_size_g, 100),
          kcal: num(i.foods?.kcal),
          proteinG: num(i.foods?.protein_g),
          carbsG: num(i.foods?.carbs_g),
          fatG: num(i.foods?.fat_g),
        },
        grams: num(i.grams),
      })),
      porcoes,
    );
    const items = itens.map((i) => ({
      foodId: i.food_id,
      name: i.foods?.name ?? t("Alimento"),
      grams: num(i.grams),
    }));
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      imageUrl: r.image_url,
      servings: porcoes,
      prepMinutes: r.prep_minutes,
      instructions: r.instructions,
      isSystem: r.user_id === null,
      items,
      perServing: {
        kcal: perServing.kcal,
        proteinG: perServing.proteinG,
        carbsG: perServing.carbsG,
        fatG: perServing.fatG,
      },
    };
  });
}

/** As receitas no formato do `select` com ingredientes embutidos. */
async function receitasLocais() {
  const db = localDb()!;
  const receitas = await db.getAll<{
    id: string;
    name: string;
    category: string | null;
    image_url: string | null;
    servings: number | null;
    prep_minutes: number | null;
    instructions: string | null;
    user_id: string | null;
  }>(
    `SELECT id, name, category, image_url, servings, prep_minutes, instructions, user_id
       FROM recipes WHERE deleted_at IS NULL ORDER BY name`,
  );
  const itens = receitas.length
    ? await db.getAll<{
        recipe_id: string;
        food_id: string;
        grams: number | null;
        name: string | null;
        serving_size_g: number | null;
        kcal: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
      }>(
        `SELECT i.recipe_id, i.food_id, i.grams, f.name, f.serving_size_g, f.kcal, f.protein_g,
                f.carbs_g, f.fat_g
           FROM recipe_items i LEFT JOIN foods f ON f.id = i.food_id
          WHERE i.recipe_id IN (${marcadores(receitas.length)})`,
        receitas.map((r) => r.id),
      )
    : [];
  return receitas.map((r) => ({
    ...r,
    recipe_items: itens
      .filter((i) => i.recipe_id === r.id)
      .map(({ food_id, grams, name, ...f }) => ({
        food_id,
        grams,
        foods: name === null ? null : { name, ...f },
      })),
  }));
}

/**
 * Lança uma receita numa refeição do dia: um item por ingrediente, com as
 * gramas da proporção pedida. Já entra consumida — como qualquer item
 * adicionado à mão, quem lança está relatando o que comeu.
 */
export async function addRecipeToMeal(params: {
  userId: string;
  date: string;
  slot: MealValue;
  recipe: RecipeSummary;
  portions: number;
}): Promise<number> {
  const { userId, date, slot, recipe, portions } = params;
  const fator = portions / recipe.servings;
  const agora = new Date().toISOString();
  await insertRows(
    "adicionar receita",
    "food_log_entries",
    recipe.items.map((i) => ({
      user_id: userId,
      food_id: i.foodId,
      meal_slot: slot,
      log_date: date,
      grams: Math.round(i.grams * fator),
      servings: 1,
      consumed: true,
      consumed_at: agora,
      source: "recipe",
      notes: recipe.name,
    })),
  );
  return recipe.items.length;
}

// ------------------------------------------------- receitas da pessoa (edição)

/** Cria uma receita vazia da pessoa e devolve o id. */
export async function createRecipe(userId: string): Promise<string> {
  return insertRow("criar receita", "recipes", {
    user_id: userId,
    name: "Nova receita",
    servings: 1,
  });
}

/** Copia uma receita (pronta ou não) para as da pessoa, com os ingredientes. */
export async function copyRecipe(userId: string, r: RecipeSummary): Promise<string> {
  const id = await insertRow("copiar receita", "recipes", {
    user_id: userId,
    name: r.name,
    servings: r.servings,
    category: r.category,
    prep_minutes: r.prepMinutes,
    instructions: r.instructions,
  });
  await insertRows(
    "copiar ingredientes",
    "recipe_items",
    r.items.map((i) => ({ recipe_id: id, food_id: i.foodId, grams: i.grams })),
  );
  return id;
}

/** Exclusão branda: `restore` desfaz. */
export async function deleteRecipe(id: string, restore = false): Promise<void> {
  await updateById(restore ? t("restaurar receita") : t("excluir receita"), "recipes", id, {
    deleted_at: restore ? null : new Date().toISOString(),
  });
}

export async function fetchRecipe(id: string) {
  const db = localDb();
  if (db) {
    return found(
      "carregar receita",
      await db.getOptional<Tables<"recipes">>("SELECT * FROM recipes WHERE id = ?", [id]),
    );
  }
  return unwrap(
    "carregar receita",
    await supabase.from("recipes").select("*").eq("id", id).single(),
  );
}

export type RecipeItem = {
  id: string;
  grams: number;
  foods: {
    id: string;
    name: string;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    serving_size_g: number;
  } | null;
};

export async function fetchRecipeItems(id: string): Promise<RecipeItem[]> {
  const db = localDb();
  if (db) {
    return (
      await db.getAll<{
        id: string;
        grams: number;
        food_id: string;
        name: string | null;
        kcal: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        fiber_g: number;
        serving_size_g: number;
      }>(
        `SELECT i.id, i.grams, i.food_id, f.name, f.kcal, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g,
                f.serving_size_g
           FROM recipe_items i LEFT JOIN foods f ON f.id = i.food_id
          WHERE i.recipe_id = ? ORDER BY i.created_at`,
        [id],
      )
    ).map(({ id: itemId, grams, food_id, name, ...f }) => ({
      id: itemId,
      grams,
      foods: name === null ? null : { id: food_id, name, ...f },
    }));
  }
  return unwrapList(
    "carregar ingredientes",
    await supabase
      .from("recipe_items")
      .select(
        "id, grams, foods(id, name, kcal, protein_g, carbs_g, fat_g, fiber_g, serving_size_g)",
      )
      .eq("recipe_id", id)
      .order("created_at"),
  ) as RecipeItem[];
}

/** O ingrediente como porção, para `nutritionTotals`/`portionMacros`. */
export function recipeItemPortion(item: RecipeItem): Portion {
  const f = item.foods;
  return {
    food: {
      servingSizeG: f?.serving_size_g ?? 100,
      kcal: f?.kcal ?? 0,
      proteinG: f?.protein_g ?? 0,
      carbsG: f?.carbs_g ?? 0,
      fatG: f?.fat_g ?? 0,
      fiberG: f?.fiber_g ?? 0,
    },
    grams: item.grams,
  };
}

export async function saveRecipe(
  id: string,
  { name, servings, notes }: { name: string; servings: number; notes: string },
): Promise<void> {
  const nome = name.trim();
  if (!nome) throw new Error("Dê um nome à receita.");
  await updateById("salvar receita", "recipes", id, {
    name: nome,
    servings: Math.max(1, servings || 1),
    notes: notes.trim() || null,
  });
}

export async function addRecipeItem(
  recipeId: string,
  foodId: string,
  grams: number,
): Promise<void> {
  await insertRow("adicionar ingrediente", "recipe_items", {
    recipe_id: recipeId,
    food_id: foodId,
    grams,
  });
}

export async function setRecipeItemGrams(itemId: string, grams: number): Promise<void> {
  await updateById("atualizar ingrediente", "recipe_items", itemId, { grams });
}

export async function removeRecipeItem(itemId: string): Promise<void> {
  await deleteById("remover ingrediente", "recipe_items", itemId);
}

/**
 * Lança `portions` porções da receita no diário de `date`: um item por
 * ingrediente, na proporção do rendimento. Devolve a data.
 */
export async function logRecipeToDiary(params: {
  userId: string;
  date: string;
  meal: MealValue;
  name: string;
  servings: number;
  portions: number;
  items: readonly RecipeItem[];
}): Promise<string> {
  const { userId, date, meal, name, servings, portions, items } = params;
  if (items.length === 0) throw new Error("Adicione ingredientes antes de lançar no diário.");
  if (!Number.isFinite(portions) || portions <= 0)
    throw new Error("Informe um número de porções válido.");
  await insertRows(
    "lançar receita no diário",
    "food_log_entries",
    items
      .filter((it) => it.foods)
      .map((it) => ({
        user_id: userId,
        food_id: it.foods!.id,
        log_date: date,
        meal_slot: meal,
        grams: (num(it.grams) / Math.max(1, servings)) * portions,
        servings: 1,
        notes: t("Da receita: {{name}}", { name }),
      })),
  );
  return date;
}
