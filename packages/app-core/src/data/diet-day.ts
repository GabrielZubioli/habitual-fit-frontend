import { supabase } from "../supabase";
import { assertOk, num, unwrapList, unwrapMaybe } from "./supabase-helpers";
import { agoraIso, atualizar, bool, inserir, jsonValue, localDb, type LocalTx } from "../local";
import { deleteById, updateById } from "./rows";
import { addDays } from "date-fns";
import { weekdayOf, type FoodCandidate, type MealSlot } from "@forja/domain";
import { fromISODate, toISODate } from "../lib/date";

/**
 * O dia do diário.
 *
 * ## Materialização
 *
 * Ao abrir um dia pela primeira vez, o plano ativo é **copiado** para
 * `food_log_entries` com `consumed = false`. Cada item vira uma linha real,
 * marcável.
 *
 * A alternativa — calcular o dia por junção com o plano, sem gravar nada —
 * parece mais limpa e é pior em duas situações que acontecem toda semana:
 *
 * 1. **Editar só hoje.** Trocar o almoço de terça sem alterar o plano exigiria
 *    uma tabela de exceções por dia, que é a materialização de novo, só que
 *    mais complicada.
 * 2. **O passado mudar sozinho.** Alterar o plano em março reescreveria o que
 *    o app afirma que você comeu em janeiro. Histórico que muda
 *    retroativamente não é histórico.
 *
 * `diet_days` registra que o dia já foi materializado — sem isso, apagar todos
 * os itens de uma terça faria o app remontá-la na próxima abertura, e o usuário
 * nunca conseguiria ter um dia deliberadamente vazio.
 */

export interface DayEntry {
  id: string;
  slot: MealSlot;
  foodId: string;
  name: string;
  grams: number;
  consumed: boolean;
  planItemId: string | null;
  source: string;
  food: {
    servingSizeG: number;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    imageUrl: string | null;
    category: string | null;
    /** Medida caseira ("2 fatias") e o peso que ela representa. */
    measure: string | null;
    measureG: number | null;
  };
}

/**
 * Garante que o dia exista, materializando-o do plano ativo se for a primeira
 * abertura.
 *
 * Só materializa **de hoje em diante**: remontar retroativamente um dia que a
 * pessoa simplesmente não registrou inventaria refeições que ela não fez, e
 * contaminaria toda a análise de aderência.
 */
export async function ensureDayMaterialized(
  userId: string,
  date: string,
  today: string,
): Promise<void> {
  if (date < today) return;

  if (localDb()) return materializarLocal(userId, date);

  const existing = unwrapMaybe(
    "verificar dia do diário",
    await supabase
      .from("diet_days")
      .select("log_date")
      .eq("user_id", userId)
      .eq("log_date", date)
      .maybeSingle(),
  );
  if (existing) return;

  const plan = unwrapMaybe(
    "carregar plano ativo",
    await supabase
      .from("meal_plans")
      .select("id")
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle(),
  );

  // Sem plano, o dia nasce vazio e é registrado como visitado — o usuário passa
  // a montar à mão, que é um modo de uso legítimo.
  if (!plan) {
    assertOk(
      "registrar dia do diário",
      await supabase
        .from("diet_days")
        .upsert(
          { user_id: userId, log_date: date, plan_id: null },
          { onConflict: "user_id,log_date" },
        ),
    );
    return;
  }

  const meals = unwrapList(
    "carregar refeições do plano",
    await supabase
      .from("meal_plan_meals")
      .select("slot, meal_plan_items(id, food_id, grams, weekday)")
      .eq("plan_id", plan.id)
      .order("position"),
  );

  // Cardápio da semana: entram os itens de todo dia e os deste dia da semana.
  const diaDaSemana = weekdayOf(date);
  const linhas = meals.flatMap((m) =>
    (m.meal_plan_items ?? [])
      .filter((item) => item.weekday === null || item.weekday === diaDaSemana)
      .map((item) => ({
        user_id: userId,
        food_id: item.food_id,
        log_date: date,
        meal_slot: m.slot,
        grams: num(item.grams),
        servings: 1,
        plan_item_id: item.id,
        consumed: false,
        source: "plan",
      })),
  );

  if (linhas.length > 0) {
    // Inserção simples, e não `upsert`.
    //
    // O índice único de (plan_item_id, log_date) é **parcial**
    // (`WHERE plan_item_id IS NOT NULL`), e o Postgres não infere índice
    // parcial numa cláusula `ON CONFLICT` sem o predicado — que o PostgREST
    // não tem como enviar. O `upsert` que estava aqui falhava com 42P10 em
    // toda materialização com itens, e o erro subia como "não foi possível
    // montar o dia": a dieta ficava vazia sem que nada indicasse o motivo.
    //
    // Sem `ON CONFLICT`, a proteção contra duas abas abrindo o mesmo dia passa
    // a ser o filtro abaixo, mais o tratamento do 23505 — que é o conflito
    // acontecendo, não um erro do usuário.
    const jaMaterializados = new Set(
      unwrapList(
        "verificar itens já materializados",
        await supabase
          .from("food_log_entries")
          .select("plan_item_id")
          .eq("user_id", userId)
          .eq("log_date", date)
          .not("plan_item_id", "is", null),
      ).map((r) => r.plan_item_id),
    );

    const novas = linhas.filter((l) => !jaMaterializados.has(l.plan_item_id));

    if (novas.length > 0) {
      const resultado = await supabase.from("food_log_entries").insert(novas);
      if (resultado.error && resultado.error.code !== "23505") {
        assertOk("montar o dia a partir do plano", resultado);
      }
    }
  }

  assertOk(
    "registrar dia do diário",
    await supabase
      .from("diet_days")
      .upsert(
        { user_id: userId, log_date: date, plan_id: plan.id },
        { onConflict: "user_id,log_date" },
      ),
  );
}

/** `diet_days` no aparelho: o `id` é a chave natural `user_id:log_date`. */
async function registrarDiaLocal(
  tx: LocalTx,
  userId: string,
  date: string,
  planId: string | null,
): Promise<void> {
  const id = `${userId}:${date}`;
  const existe = await tx.getOptional<{ id: string }>("SELECT id FROM diet_days WHERE id = ?", [
    id,
  ]);
  if (existe) await atualizar(tx, "diet_days", id, { plan_id: planId });
  else await inserir(tx, "diet_days", { id, user_id: userId, log_date: date, plan_id: planId });
}

async function materializarLocal(userId: string, date: string): Promise<void> {
  const db = localDb()!;
  await db.writeTransaction(async (tx) => {
    const dia = await tx.getOptional<{ id: string }>("SELECT id FROM diet_days WHERE id = ?", [
      `${userId}:${date}`,
    ]);
    if (dia) return;

    const plan = await tx.getOptional<{ id: string }>(
      "SELECT id FROM meal_plans WHERE is_active = 1 AND deleted_at IS NULL LIMIT 1",
    );
    if (plan) {
      const diaDaSemana = weekdayOf(date);
      const itens = await tx.getAll<{
        id: string;
        food_id: string;
        grams: number | null;
        slot: string;
      }>(
        `SELECT i.id, i.food_id, i.grams, m.slot FROM meal_plan_meals m
           JOIN meal_plan_items i ON i.meal_id = m.id
          WHERE m.plan_id = ? AND (i.weekday IS NULL OR i.weekday = ?)
          ORDER BY m.position`,
        [plan.id, diaDaSemana],
      );
      const ja = new Set(
        (
          await tx.getAll<{ plan_item_id: string }>(
            "SELECT plan_item_id FROM food_log_entries WHERE user_id = ? AND log_date = ? AND plan_item_id IS NOT NULL",
            [userId, date],
          )
        ).map((r) => r.plan_item_id),
      );
      const agora = agoraIso();
      for (const item of itens) {
        if (ja.has(item.id)) continue;
        await inserir(tx, "food_log_entries", {
          user_id: userId,
          food_id: item.food_id,
          log_date: date,
          meal_slot: item.slot,
          grams: num(item.grams),
          servings: 1,
          plan_item_id: item.id,
          consumed: false,
          source: "plan",
          created_at: agora,
        });
      }
    }
    await registrarDiaLocal(tx, userId, date, plan?.id ?? null);
  });
}

export async function fetchDayEntries(date: string): Promise<DayEntry[]> {
  const db = localDb();
  const rows = db
    ? (
        await db.getAll<{
          id: string;
          meal_slot: string;
          food_id: string;
          grams: number | null;
          servings: number | null;
          consumed: number;
          plan_item_id: string | null;
          source: string;
          name: string | null;
          serving_size_g: number | null;
          kcal: number | null;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          fiber_g: number | null;
          image_url: string | null;
          category: string | null;
          household_measure: string | null;
          household_grams: number | null;
        }>(
          `SELECT l.id, l.meal_slot, l.food_id, l.grams, l.servings, l.consumed, l.plan_item_id, l.source,
                  f.name, f.serving_size_g, f.kcal, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g,
                  f.image_url, f.category, f.household_measure, f.household_grams
             FROM food_log_entries l LEFT JOIN foods f ON f.id = l.food_id
            WHERE l.log_date = ? ORDER BY l.created_at`,
          [date],
        )
      ).map(
        ({
          name,
          serving_size_g,
          kcal,
          protein_g,
          carbs_g,
          fat_g,
          fiber_g,
          image_url,
          category,
          household_measure,
          household_grams,
          ...r
        }) => ({
          ...r,
          consumed: bool(r.consumed),
          foods:
            name === null
              ? null
              : {
                  name,
                  serving_size_g,
                  kcal,
                  protein_g,
                  carbs_g,
                  fat_g,
                  fiber_g,
                  image_url,
                  category,
                  household_measure,
                  household_grams,
                },
        }),
      )
    : unwrapList(
        "carregar diário",
        await supabase
          .from("food_log_entries")
          // Precisa ser um literal único: o supabase-js infere o tipo do retorno a
          // partir do texto do `select`, e uma concatenação com `+` produz `string`
          // genérica — todo o resultado colapsa para `GenericStringError`.
          .select(
            "id, meal_slot, food_id, grams, servings, consumed, plan_item_id, source, foods(name, serving_size_g, kcal, protein_g, carbs_g, fat_g, fiber_g, image_url, category, household_measure, household_grams)",
          )
          .eq("log_date", date)
          .order("created_at"),
      );

  return rows.map((r) => ({
    id: r.id,
    slot: r.meal_slot as MealSlot,
    foodId: r.food_id,
    name: r.foods?.name ?? "Alimento removido",
    // `grams` é nulo quando o registro veio por porções; converter aqui evita
    // espalhar a regra `grams ?? servings * serving_size` por toda a UI.
    grams: r.grams !== null ? num(r.grams) : num(r.servings, 1) * num(r.foods?.serving_size_g, 100),
    consumed: r.consumed,
    planItemId: r.plan_item_id,
    source: r.source,
    food: {
      servingSizeG: num(r.foods?.serving_size_g, 100),
      kcal: num(r.foods?.kcal),
      proteinG: num(r.foods?.protein_g),
      carbsG: num(r.foods?.carbs_g),
      fatG: num(r.foods?.fat_g),
      fiberG: num(r.foods?.fiber_g),
      imageUrl: r.foods?.image_url ?? null,
      category: r.foods?.category ?? null,
      measure: r.foods?.household_measure ?? null,
      measureG:
        r.foods?.household_grams !== undefined ? num(r.foods.household_grams, 0) || null : null,
    },
  }));
}

/**
 * Ajusta a quantidade de um item do dia.
 *
 * Editar a porção é a correção mais comum do diário — o plano manda 150 g de
 * arroz e a pessoa comeu meia concha a mais. Sem isso, a única saída era
 * remover e adicionar de novo, o que perde a origem (`plan`) e faz o item
 * deixar de contar como aderência ao plano.
 */
export async function setEntryGrams(entryId: string, grams: number): Promise<void> {
  await updateById("ajustar quantidade", "food_log_entries", entryId, {
    grams: Math.max(1, Math.round(grams)),
    servings: 1,
  });
}

/** Marca ou desmarca um item como consumido. */
export async function setConsumed(entryId: string, consumed: boolean): Promise<void> {
  await updateById(
    consumed ? "marcar como consumido" : "desmarcar item",
    "food_log_entries",
    entryId,
    { consumed, consumed_at: consumed ? new Date().toISOString() : null },
  );
}

/** Marca todos os itens de uma refeição de uma vez. */
export async function setMealConsumed(
  date: string,
  slot: MealSlot,
  consumed: boolean,
): Promise<void> {
  const db = localDb();
  if (db) {
    await db.execute(
      "UPDATE food_log_entries SET consumed = ?, consumed_at = ? WHERE log_date = ? AND meal_slot = ?",
      [consumed ? 1 : 0, consumed ? new Date().toISOString() : null, date, slot],
    );
    return;
  }
  assertOk(
    "concluir refeição",
    await supabase
      .from("food_log_entries")
      .update({ consumed, consumed_at: consumed ? new Date().toISOString() : null })
      .eq("log_date", date)
      .eq("meal_slot", slot),
  );
}

/**
 * Troca o alimento de um item mantendo a posição na refeição.
 *
 * A quantidade vem calculada pelo domínio (`findSubstitutions`), que a ajusta
 * para preservar o macro dominante — trocar 150 g de frango por 150 g de feijão
 * não seria substituir.
 */
export async function substituteEntry(
  entryId: string,
  newFoodId: string,
  grams: number,
): Promise<void> {
  await updateById("substituir alimento", "food_log_entries", entryId, {
    food_id: newFoodId,
    grams,
    servings: 1,
    source: "manual",
  });
}

/** Registra a troca como preferência, para subir nas próximas sugestões. */
export async function recordSubstitutionPreference(
  userId: string,
  foodId: string,
  substituteId: string,
): Promise<void> {
  const db = localDb();
  if (db) {
    // Chave composta: no aparelho o `id` é `user_id:food_id:substitute_id`.
    const id = `${userId}:${foodId}:${substituteId}`;
    await db.writeTransaction(async (tx) => {
      const atual = await tx.getOptional<{ times_used: number | null }>(
        "SELECT times_used FROM food_substitution_prefs WHERE id = ?",
        [id],
      );
      if (atual)
        await atualizar(tx, "food_substitution_prefs", id, {
          times_used: num(atual.times_used) + 1,
        });
      else
        await inserir(tx, "food_substitution_prefs", {
          id,
          user_id: userId,
          food_id: foodId,
          substitute_id: substituteId,
          times_used: 1,
          created_at: agoraIso(),
        });
    });
    return;
  }
  const existing = unwrapMaybe(
    "ler preferência de substituição",
    await supabase
      .from("food_substitution_prefs")
      .select("times_used")
      .eq("user_id", userId)
      .eq("food_id", foodId)
      .eq("substitute_id", substituteId)
      .maybeSingle(),
  );

  assertOk(
    "salvar preferência de substituição",
    await supabase.from("food_substitution_prefs").upsert(
      {
        user_id: userId,
        food_id: foodId,
        substitute_id: substituteId,
        times_used: (existing?.times_used ?? 0) + 1,
      },
      { onConflict: "user_id,food_id,substitute_id" },
    ),
  );
}

// ------------------------------------------------------------------- água

export async function fetchWaterMl(date: string): Promise<number> {
  const db = localDb();
  const rows = db
    ? await db.getAll<{ ml: number }>("SELECT ml FROM water_intake WHERE log_date = ?", [date])
    : unwrapList(
        "carregar consumo de água",
        await supabase.from("water_intake").select("ml").eq("log_date", date),
      );
  return rows.reduce((sum, r) => sum + num(r.ml), 0);
}

export async function addWater(userId: string, date: string, ml: number): Promise<void> {
  const db = localDb();
  if (db) {
    // `logged_at` ordena o "desfazer último copo".
    await inserir(db, "water_intake", {
      user_id: userId,
      log_date: date,
      ml,
      logged_at: agoraIso(),
    });
    return;
  }
  assertOk(
    "registrar água",
    await supabase.from("water_intake").insert({ user_id: userId, log_date: date, ml }),
  );
}

/**
 * Remove o último registro do dia.
 *
 * Desfazer o último copo é o erro mais comum aqui — daí o registro ser por
 * gole, e não um total por dia que precisaria ser editado à mão.
 */
export async function undoLastWater(date: string): Promise<void> {
  const db = localDb();
  const last = db
    ? await db.getOptional<{ id: string }>(
        "SELECT id FROM water_intake WHERE log_date = ? ORDER BY logged_at DESC LIMIT 1",
        [date],
      )
    : unwrapMaybe(
        "localizar último registro de água",
        await supabase
          .from("water_intake")
          .select("id")
          .eq("log_date", date)
          .order("logged_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
  if (!last) return;

  await deleteById("desfazer registro de água", "water_intake", last.id);
}

/**
 * Nomes de refeição que valem **só neste dia** ("Não, somente hoje"), por
 * slot. O nome da semana toda fica no plano (`meal_plan_meals.label`).
 */
export async function fetchDayMealLabels(date: string): Promise<Partial<Record<MealSlot, string>>> {
  const db = localDb();
  const v = db
    ? jsonValue<unknown>(
        (
          await db.getOptional<{ meal_labels: string | null }>(
            "SELECT meal_labels FROM diet_days WHERE log_date = ?",
            [date],
          )
        )?.meal_labels,
        null,
      )
    : unwrapMaybe(
        "carregar nomes das refeições do dia",
        await supabase.from("diet_days").select("meal_labels").eq("log_date", date).maybeSingle(),
      )?.meal_labels;
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Partial<Record<MealSlot, string>>)
    : {};
}

/**
 * Grava (ou tira, com `null`) o nome de uma refeição só neste dia. Mexe apenas
 * no nome: alimentos, quantidades e horários ficam como estão. O dia já foi
 * materializado ao ser aberto — por isso é update, e não upsert, que criaria
 * um dia vazio e travaria a materialização.
 */
export async function setDayMealLabel(
  date: string,
  slot: MealSlot,
  nome: string | null,
): Promise<void> {
  const atuais = await fetchDayMealLabels(date);
  const proximos = { ...atuais };
  if (nome?.trim()) proximos[slot] = nome.trim();
  else delete proximos[slot];
  const db = localDb();
  if (db) {
    const dia = await db.getOptional<{ id: string }>(
      "SELECT id FROM diet_days WHERE log_date = ?",
      [date],
    );
    if (!dia) throw new Error("Abra o dia no diário antes de renomear a refeição.");
    await atualizar(db, "diet_days", dia.id, { meal_labels: proximos });
    return;
  }
  const linhas = unwrapList(
    "renomear a refeição do dia",
    await supabase
      .from("diet_days")
      .update({ meal_labels: proximos })
      .eq("log_date", date)
      .select("log_date"),
  );
  if (linhas.length === 0) throw new Error("Abra o dia no diário antes de renomear a refeição.");
}

/** Tira um item do dia. */
export async function removeEntry(entryId: string): Promise<void> {
  await deleteById("remover item", "food_log_entries", entryId);
}

/** Copia os itens do dia anterior para `date`, ainda não consumidos. Devolve quantos. */
export async function copyPreviousDay(userId: string, date: string): Promise<number> {
  const anterior = toISODate(addDays(fromISODate(date), -1));
  const itens = await fetchDayEntries(anterior);
  if (itens.length === 0) throw new Error("Não há nada registrado no dia anterior.");
  const linhas = itens.map((e) => ({
    user_id: userId,
    food_id: e.foodId,
    meal_slot: e.slot,
    log_date: date,
    grams: e.grams,
    servings: 1,
    consumed: false,
    source: "copy",
  }));
  const db = localDb();
  if (db) {
    const agora = agoraIso();
    await db.writeTransaction(async (tx) => {
      for (const l of linhas) await inserir(tx, "food_log_entries", { ...l, created_at: agora });
    });
    return itens.length;
  }
  assertOk("copiar dia anterior", await supabase.from("food_log_entries").insert(linhas));
  return itens.length;
}

/** O item como porção, para `nutritionTotals`/`portionMacros`. */
export function entryPortion(e: DayEntry) {
  const { servingSizeG, kcal, proteinG, carbsG, fatG, fiberG } = e.food;
  return {
    food: { servingSizeG, kcal, proteinG, carbsG, fatG, fiberG },
    grams: e.grams,
    servings: 1,
  };
}

/** O item como candidato do domínio (valores por 100 g), para a substituição. */
export function entryCandidate(e: DayEntry): FoodCandidate {
  const porcao = e.food.servingSizeG || 100;
  return {
    id: e.foodId,
    name: e.name,
    category: (e.food.category ?? "other") as FoodCandidate["category"],
    kcal: (e.food.kcal / porcao) * 100,
    proteinG: (e.food.proteinG / porcao) * 100,
    carbsG: (e.food.carbsG / porcao) * 100,
    fatG: (e.food.fatG / porcao) * 100,
    fiberG: (e.food.fiberG / porcao) * 100,
    popularity: 50,
  };
}

/** Ordem em que refeições extras aparecem quando a pessoa aumenta as do dia. */
const PRIORIDADE_REFEICOES: MealSlot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "afternoon_snack",
  "morning_snack",
  "supper",
  "pre_workout",
  "post_workout",
];

/**
 * Refeições exibidas no diário: as do plano, mais qualquer uma com item
 * lançado à mão, completadas até `mealsPerDay` na ordem em que as pessoas
 * costumam acrescentar refeições. Nada disso: o dia inteiro, em vez de tela em
 * branco. Sempre na ordem cronológica do dia (`ordem`).
 */
export function visibleSlots(
  ordem: readonly MealSlot[],
  doPlano: Iterable<MealSlot>,
  comItem: Iterable<MealSlot>,
  mealsPerDay: number,
): MealSlot[] {
  const escolhidos = new Set<MealSlot>([...doPlano, ...comItem]);
  const quantas = Math.min(ordem.length, mealsPerDay);
  for (const k of PRIORIDADE_REFEICOES) {
    if (escolhidos.size >= quantas) break;
    escolhidos.add(k);
  }
  return escolhidos.size > 0 ? ordem.filter((k) => escolhidos.has(k)) : [...ordem];
}
