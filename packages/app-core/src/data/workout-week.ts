import { supabase } from "../supabase";
import { assertOk, num, unwrap, unwrapList } from "./supabase-helpers";
import { atualizar, inserir, jsonList, localDb, marcadores } from "../local";
import { t } from "../i18n";

/**
 * A semana de treino: divisões, exercícios e o que cada um estimula.
 *
 * Carrega tudo de uma vez, e não uma consulta por divisão. Uma rotina de 5 dias
 * com 7 exercícios cada renderia 5 idas ao servidor só para desenhar a tela —
 * e no celular, em rede de academia, isso é a diferença entre instantâneo e
 * perceptível.
 */

export interface WeekExercise {
  /** Id da linha em `workout_template_exercises`. */
  itemId: string;
  exerciseId: string;
  name: string;
  position: number;
  targetSets: number;
  targetReps: number;
  targetRepMin: number | null;
  targetRepMax: number | null;
  restSeconds: number;
  targetRpe: number | null;
  cadence: string | null;
  notes: string | null;
  supersetGroup: number | null;

  equipment: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  level: string | null;
  mechanic: string | null;
  imageUrls: string[];
  /** Contribuição por músculo, para o mapa corporal. */
  muscles: { muscle: string; contribution: number }[];
}

export interface WeekSplit {
  templateId: string;
  letter: string | null;
  /** Ícone escolhido (chave de `ROUTINE_ICONS`); null = palpite pelo nome. */
  icon: string | null;
  name: string;
  order: number;
  /** Dias da divisão na semana fixa (0 = domingo). */
  weekdays: number[];
  exercises: WeekExercise[];
}

export interface WorkoutWeek {
  routineId: string;
  routineName: string;
  daysPerWeek: number;
  currentIndex: number;
  trainingWeekdays: number[];
  scheduleMode: "rotation" | "fixed";
  splits: WeekSplit[];
}

export async function fetchWorkoutWeek(): Promise<WorkoutWeek | null> {
  if (localDb()) return semanaLocal();
  const routine = unwrapList(
    "carregar rotina",
    await supabase
      .from("workout_routines")
      .select("id, name, days_per_week, current_index, training_weekdays, schedule_mode")
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(1),
  )[0];

  if (!routine) return null;

  const templates = unwrapList(
    "carregar divisões",
    await supabase
      .from("workout_templates")
      .select("id, name, icon, routine_letter, routine_order, weekdays")
      .eq("routine_id", routine.id)
      .is("deleted_at", null)
      .order("routine_order"),
  );

  if (templates.length === 0) {
    return {
      routineId: routine.id,
      routineName: routine.name,
      daysPerWeek: routine.days_per_week,
      currentIndex: routine.current_index,
      trainingWeekdays: routine.training_weekdays ?? [],
      scheduleMode: routine.schedule_mode === "fixed" ? "fixed" : "rotation",
      splits: [],
    };
  }

  // Uma consulta para os itens de todas as divisões, com o exercício e a
  // contribuição muscular embutidos.
  const itens = unwrapList(
    "carregar exercícios das divisões",
    await supabase
      .from("workout_template_exercises")
      .select(
        "id, template_id, exercise_id, position, target_sets, target_reps, target_rep_min, target_rep_max, rest_seconds, target_rpe, cadence, notes, superset_group, exercises(name, equipment, primary_muscle, secondary_muscles, level, mechanic, image_urls, exercise_muscles(muscle, contribution))",
      )
      .in(
        "template_id",
        templates.map((item2) => item2.id),
      )
      .order("position"),
  );

  const porTemplate = new Map<string, WeekExercise[]>();
  for (const item of itens) {
    const ex = item.exercises;
    const lista = porTemplate.get(item.template_id) ?? [];

    lista.push({
      itemId: item.id,
      exerciseId: item.exercise_id,
      name: ex?.name ?? t("Exercício"),
      position: item.position,
      targetSets: num(item.target_sets, 3),
      targetReps: num(item.target_reps, 10),
      targetRepMin: item.target_rep_min,
      targetRepMax: item.target_rep_max,
      restSeconds: num(item.rest_seconds, 90),
      targetRpe: item.target_rpe !== null ? num(item.target_rpe) : null,
      cadence: item.cadence,
      notes: item.notes,
      supersetGroup: item.superset_group,
      equipment: ex?.equipment ?? "other",
      primaryMuscle: ex?.primary_muscle ?? "full_body",
      secondaryMuscles: ex?.secondary_muscles ?? [],
      level: ex?.level ?? null,
      mechanic: ex?.mechanic ?? null,
      imageUrls: ex?.image_urls ?? [],
      muscles: (ex?.exercise_muscles ?? []).map((m) => ({
        muscle: m.muscle,
        contribution: num(m.contribution),
      })),
    });

    porTemplate.set(item.template_id, lista);
  }

  return {
    routineId: routine.id,
    routineName: routine.name,
    daysPerWeek: routine.days_per_week,
    currentIndex: routine.current_index,
    trainingWeekdays: routine.training_weekdays ?? [],
    scheduleMode: routine.schedule_mode === "fixed" ? "fixed" : "rotation",
    splits: templates.map((item2, i) => ({
      templateId: item2.id,
      letter: item2.routine_letter,
      icon: item2.icon,
      name: item2.name,
      order: item2.routine_order ?? i,
      weekdays: item2.weekdays ?? [],
      exercises: (porTemplate.get(item2.id) ?? []).sort((a, b) => a.position - b.position),
    })),
  };
}

/** A mesma semana, lida do banco local. */
async function semanaLocal(): Promise<WorkoutWeek | null> {
  const db = localDb()!;
  const routine = await db.getOptional<{
    id: string;
    name: string;
    days_per_week: number;
    current_index: number;
    training_weekdays: string | null;
    schedule_mode: string;
  }>(
    `SELECT id, name, days_per_week, current_index, training_weekdays, schedule_mode
       FROM workout_routines WHERE is_active = 1 AND deleted_at IS NULL LIMIT 1`,
  );
  if (!routine) return null;

  const templates = await db.getAll<{
    id: string;
    name: string;
    icon: string | null;
    routine_letter: string | null;
    routine_order: number | null;
    weekdays: string | null;
  }>(
    `SELECT id, name, icon, routine_letter, routine_order, weekdays FROM workout_templates
      WHERE routine_id = ? AND deleted_at IS NULL ORDER BY routine_order`,
    [routine.id],
  );

  const ids = templates.map((item2) => item2.id);
  const itens = ids.length
    ? await db.getAll<{
        id: string;
        template_id: string;
        exercise_id: string;
        position: number;
        target_sets: number | null;
        target_reps: number | null;
        target_rep_min: number | null;
        target_rep_max: number | null;
        rest_seconds: number | null;
        target_rpe: number | null;
        cadence: string | null;
        notes: string | null;
        superset_group: number | null;
        name: string | null;
        equipment: string | null;
        primary_muscle: string | null;
        secondary_muscles: string | null;
        level: string | null;
        mechanic: string | null;
        image_urls: string | null;
      }>(
        `SELECT i.id, i.template_id, i.exercise_id, i.position, i.target_sets, i.target_reps,
                i.target_rep_min, i.target_rep_max, i.rest_seconds, i.target_rpe, i.cadence, i.notes,
                i.superset_group, e.name, e.equipment, e.primary_muscle, e.secondary_muscles,
                e.level, e.mechanic, e.image_urls
           FROM workout_template_exercises i LEFT JOIN exercises e ON e.id = i.exercise_id
          WHERE i.template_id IN (${marcadores(ids.length)}) ORDER BY i.position`,
        ids,
      )
    : [];

  const exIds = [...new Set(itens.map((i) => i.exercise_id))];
  const musculos = new Map<string, { muscle: string; contribution: number }[]>();
  if (exIds.length) {
    for (const m of await db.getAll<{ exercise_id: string; muscle: string; contribution: number }>(
      `SELECT exercise_id, muscle, contribution FROM exercise_muscles
        WHERE exercise_id IN (${marcadores(exIds.length)})`,
      exIds,
    )) {
      const lista = musculos.get(m.exercise_id) ?? [];
      lista.push({ muscle: m.muscle, contribution: num(m.contribution) });
      musculos.set(m.exercise_id, lista);
    }
  }

  const porTemplate = new Map<string, WeekExercise[]>();
  for (const item of itens) {
    const lista = porTemplate.get(item.template_id) ?? [];
    lista.push({
      itemId: item.id,
      exerciseId: item.exercise_id,
      name: item.name ?? t("Exercício"),
      position: item.position,
      targetSets: num(item.target_sets, 3),
      targetReps: num(item.target_reps, 10),
      targetRepMin: item.target_rep_min,
      targetRepMax: item.target_rep_max,
      restSeconds: num(item.rest_seconds, 90),
      targetRpe: item.target_rpe !== null ? num(item.target_rpe) : null,
      cadence: item.cadence,
      notes: item.notes,
      supersetGroup: item.superset_group,
      equipment: item.equipment ?? "other",
      primaryMuscle: item.primary_muscle ?? "full_body",
      secondaryMuscles: jsonList(item.secondary_muscles),
      level: item.level,
      mechanic: item.mechanic,
      imageUrls: jsonList(item.image_urls),
      muscles: musculos.get(item.exercise_id) ?? [],
    });
    porTemplate.set(item.template_id, lista);
  }

  return {
    routineId: routine.id,
    routineName: routine.name,
    daysPerWeek: routine.days_per_week,
    currentIndex: routine.current_index,
    trainingWeekdays: jsonList<number>(routine.training_weekdays),
    scheduleMode: routine.schedule_mode === "fixed" ? "fixed" : "rotation",
    splits: templates.map((item2, i) => ({
      templateId: item2.id,
      letter: item2.routine_letter,
      icon: item2.icon,
      name: item2.name,
      order: item2.routine_order ?? i,
      weekdays: jsonList<number>(item2.weekdays),
      exercises: (porTemplate.get(item2.id) ?? []).sort((a, b) => a.position - b.position),
    })),
  };
}

// ------------------------------------------------------- personalização
//
// O usuário não fica preso ao plano da geração. Todas as operações abaixo
// existem porque um plano que não se pode ajustar é um plano que se abandona na
// primeira vez que o banco está ocupado ou o exercício incomoda.

export interface UpdateItemPatch {
  target_sets?: number;
  target_reps?: number;
  target_rep_min?: number | null;
  target_rep_max?: number | null;
  rest_seconds?: number;
  target_rpe?: number | null;
  cadence?: string | null;
  notes?: string | null;
}

export async function updateTemplateItem(itemId: string, patch: UpdateItemPatch): Promise<void> {
  const db = localDb();
  if (db) return atualizar(db, "workout_template_exercises", itemId, { ...patch });
  assertOk(
    "atualizar exercício",
    await supabase.from("workout_template_exercises").update(patch).eq("id", itemId),
  );
}

export async function removeTemplateItem(itemId: string): Promise<void> {
  const db = localDb();
  if (db) {
    await db.execute("DELETE FROM workout_template_exercises WHERE id = ?", [itemId]);
    return;
  }
  assertOk(
    "remover exercício",
    await supabase.from("workout_template_exercises").delete().eq("id", itemId),
  );
}

export async function addTemplateItem(
  templateId: string,
  exerciseId: string,
  position: number,
): Promise<string> {
  const linha = {
    template_id: templateId,
    exercise_id: exerciseId,
    position,
    target_sets: 3,
    target_reps: 10,
    rest_seconds: 90,
  };
  const db = localDb();
  if (db) return inserir(db, "workout_template_exercises", linha);
  const row = unwrap(
    "adicionar exercício",
    await supabase.from("workout_template_exercises").insert(linha).select("id").single(),
  );
  return row.id;
}

/** Troca o exercício preservando séries, repetições e descanso já ajustados. */
export async function swapTemplateExercise(itemId: string, newExerciseId: string): Promise<void> {
  const db = localDb();
  if (db)
    return atualizar(db, "workout_template_exercises", itemId, { exercise_id: newExerciseId });
  assertOk(
    "trocar exercício",
    await supabase
      .from("workout_template_exercises")
      .update({ exercise_id: newExerciseId })
      .eq("id", itemId),
  );
}

/** Duplica um exercício logo abaixo do original, com a mesma prescrição. */
export async function duplicateTemplateItem(item: WeekExercise, templateId: string): Promise<void> {
  const copia = {
    template_id: templateId,
    exercise_id: item.exerciseId,
    position: item.position + 1,
    target_sets: item.targetSets,
    target_reps: item.targetReps,
    target_rep_min: item.targetRepMin,
    target_rep_max: item.targetRepMax,
    rest_seconds: item.restSeconds,
    target_rpe: item.targetRpe,
    cadence: item.cadence,
    notes: item.notes,
  };
  const db = localDb();
  if (db) {
    await db.writeTransaction(async (tx) => {
      await tx.execute(
        "UPDATE workout_template_exercises SET position = position + 1 WHERE template_id = ? AND position > ?",
        [templateId, item.position],
      );
      await inserir(tx, "workout_template_exercises", copia);
    });
    return;
  }
  // Abre espaço empurrando os seguintes: `position` não tem unicidade, mas
  // manter a ordem consistente evita empates arbitrários na renderização.
  const seguintes = unwrapList(
    "carregar exercícios seguintes",
    await supabase
      .from("workout_template_exercises")
      .select("id, position")
      .eq("template_id", templateId)
      .gt("position", item.position),
  );

  for (const s of seguintes) {
    assertOk(
      "reordenar exercícios",
      await supabase
        .from("workout_template_exercises")
        .update({ position: s.position + 1 })
        .eq("id", s.id),
    );
  }

  assertOk("duplicar exercício", await supabase.from("workout_template_exercises").insert(copia));
}

/**
 * Reatribui a faixa inteira de posições de uma vez.
 *
 * `position` não tem restrição de unicidade em `workout_template_exercises`, o
 * que permite gravar a ordem nova direto — sem o artifício do valor temporário
 * que uma coluna única exigiria.
 */
export async function reorderTemplateItems(orderedItemIds: readonly string[]): Promise<void> {
  const db = localDb();
  if (db) {
    await db.writeTransaction(async (tx) => {
      for (const [index, id] of orderedItemIds.entries()) {
        await tx.execute("UPDATE workout_template_exercises SET position = ? WHERE id = ?", [
          index + 1,
          id,
        ]);
      }
    });
    return;
  }
  for (const [index, id] of orderedItemIds.entries()) {
    assertOk(
      "reordenar exercícios",
      await supabase
        .from("workout_template_exercises")
        .update({ position: index + 1 })
        .eq("id", id),
    );
  }
}
