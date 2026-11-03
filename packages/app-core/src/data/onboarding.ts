import { supabase } from "../supabase";
import { assertOk, unwrapMaybe } from "./supabase-helpers";
import { agoraIso, atualizar, inserir, localDb, marcadores } from "../local";
import { insertRows } from "./rows";
import { updateProfile, perfilLocal } from "./profile";
import { saveBodyWeight } from "./body";
import { PlanLimitationError, saveSuggestedRoutine } from "./routines";
import { ensureActiveMealPlan } from "./meal-plans";
import { todayISO } from "../lib/date";
import type { Answers } from "../lib/onboarding/schema";
import { derivedActivityLevel, derivedObjective } from "../lib/onboarding/options";
import { DEFAULT_MEALS_PER_DAY, type SessionDuration } from "@forja/domain";
import { t } from "../i18n";

/**
 * Montagem da conta, logo depois do questionário.
 *
 * ## O que monta
 *
 * O perfil, o treino sugerido e a estrutura da dieta: as refeições do dia,
 * vazias. Na tela final a pessoa segue com o sugerido ou começa sem um plano. A dieta nunca é gerada: o
 * app não prescreve alimentos, quantidades nem metas nutricionais.
 *
 * ## A ordem importa
 *
 * Cada etapa é idempotente e o progresso é reportado: repetir a montagem
 * corrige o que faltou em vez de duplicar o que deu certo.
 */

export type GenerationStage = "profile" | "workout" | "diet" | "done";

export interface GenerationProgress {
  stage: GenerationStage;
  label: string;
}

const STAGE_LABELS: Record<GenerationStage, string> = {
  profile: t("Salvando seu perfil"),
  workout: t("Preparando seu treino"),
  diet: t("Criando suas refeições"),
  done: t("Tudo pronto"),
};

export interface GenerationResult {
  routineId: string | null;
  mealPlanId: string | null;
  warnings: string[];
}

/** Converte a idade declarada numa data de nascimento aproximada. */
function birthDateFromAge(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return d.toISOString().slice(0, 10);
}

export async function generateEverything(
  userId: string,
  answers: Answers,
  onProgress?: (p: GenerationProgress) => void,
): Promise<GenerationResult> {
  const report = (stage: GenerationStage) => onProgress?.({ stage, label: STAGE_LABELS[stage] });
  const warnings: string[] = [];

  // ------------------------------------------------------------- 1. perfil
  report("profile");

  const objective = derivedObjective(answers);
  const activity = derivedActivityLevel(answers);
  const duration = (answers.duration ?? "average") as SessionDuration;
  const daysPerWeek = answers.daysPerWeek ?? 3;
  const weightKg = answers.weightKg ?? 75;
  const mealsPerDay = answers.mealsPerDay ?? DEFAULT_MEALS_PER_DAY;

  // Sem metas nutricionais: quem quiser as define (com o nutricionista) nas
  // Configurações.
  await updateProfile(
    userId,
    {
      sex: answers.sex ?? "other",
      birth_date: birthDateFromAge(answers.age ?? 28),
      height_cm: answers.heightCm ?? null,
      goal: objective.weightGoal,
      goal_weight_kg: answers.goalWeightKg ?? null,
      activity_level: activity,
      onboarding_completed: true,

      experience_level: answers.experience ?? null,
      focus_area: answers.focus ?? null,
      training_place: answers.place ?? null,
      equipment_available: answers.equipment,
      session_duration: duration,
      days_per_week: daysPerWeek,
      injuries: answers.injuries,
      meals_per_day: mealsPerDay,
      workout_time: answers.workoutTime ?? null,
    },
    "salvar perfil",
  );

  // As respostas cruas ficam guardadas para permitir montar o plano sugerido
  // depois, sem refazer o questionário.
  const db = localDb();
  if (db) {
    // Chave composta (`user_id`): no aparelho o `id` é o próprio `user_id`.
    const respostas = { payload: answers, version: 1, completed_at: agoraIso() };
    const ja = await db.getOptional("SELECT id FROM onboarding_answers WHERE id = ?", [userId]);
    if (ja) await atualizar(db, "onboarding_answers", userId, respostas);
    else
      await inserir(db, "onboarding_answers", {
        id: userId,
        user_id: userId,
        ...respostas,
        created_at: agoraIso(),
      });
  } else
    assertOk(
      "salvar respostas do questionário",
      await supabase
        .from("onboarding_answers")
        .upsert(
          { user_id: userId, payload: answers, version: 1, completed_at: new Date().toISOString() },
          { onConflict: "user_id" },
        ),
    );

  // Peso inicial: destrava a tendência corporal.
  await saveBodyWeight(userId, todayISO(), weightKg);

  // Metas de peso e de frequência — nenhuma nutricional.
  const metas: {
    user_id: string;
    kind: "weight" | "habit";
    label: string;
    metric_key: string;
    start_value: number;
    target_value: number;
    unit: string;
  }[] = [];

  if (answers.goalWeightKg && Math.abs(answers.goalWeightKg - weightKg) >= 1) {
    metas.push({
      user_id: userId,
      kind: "weight",
      label:
        answers.goalWeightKg < weightKg
          ? t("Chegar ao peso desejado")
          : t("Ganhar massa até a meta"),
      metric_key: "body_weight",
      start_value: weightKg,
      target_value: answers.goalWeightKg,
      unit: "kg",
    });
  }
  metas.push({
    user_id: userId,
    kind: "habit",
    label: t("Treinar toda semana"),
    metric_key: "workouts_per_week",
    start_value: 0,
    target_value: daysPerWeek,
    unit: "treinos",
  });

  // Refazer o questionário substitui as metas: o banco aceita uma ativa por métrica.
  if (db) {
    const chaves = metas.map((m) => m.metric_key);
    await db.execute(
      `UPDATE goals SET is_active = 0 WHERE user_id = ? AND is_active = 1 AND metric_key IN (${marcadores(chaves.length)})`,
      [userId, ...chaves],
    );
  } else
    assertOk(
      "arquivar metas antigas",
      await supabase
        .from("goals")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true)
        .in(
          "metric_key",
          metas.map((m) => m.metric_key),
        ),
    );
  await insertRows(
    "criar metas",
    "goals",
    metas.map((m) => ({ ...m, is_active: true })),
  );

  // ------------------------------------------------------------- 2. treino
  report("workout");

  let routineId: string | null = null;
  try {
    // O sugerido é montado sempre; quem não o quiser escolhe "Começar sem um
    // plano" na tela final, que o troca por um plano em branco.
    routineId = await saveSuggestedRoutine(userId);
  } catch (error) {
    // O treino falhar não pode impedir o resto: a tela Plano oferece montar de novo.
    // Limitação de lesão não melhora tentando de novo: vai a explicação, só.
    if (error instanceof PlanLimitationError) warnings.push(error.message);
    else
      warnings.push(
        `Não conseguimos preparar o treino (${error instanceof Error ? error.message : "erro desconhecido"}). Abra a tela Plano para tentar de novo.`,
      );
  }

  // -------------------------------------------------------------- 3. dieta
  report("diet");

  let mealPlanId: string | null = null;
  try {
    mealPlanId = (await ensureActiveMealPlan(userId))?.id ?? null;
  } catch (error) {
    warnings.push(
      `Não conseguimos criar suas refeições (${error instanceof Error ? error.message : "erro desconhecido"}). Abra a tela Dieta para tentar de novo.`,
    );
  }

  report("done");
  return { routineId, mealPlanId, warnings };
}

/** O usuário já passou pela geração? Usado para não repetir o fluxo. */
export async function hasCompletedOnboarding(): Promise<boolean> {
  if (localDb()) return (await perfilLocal())?.onboarding_completed ?? false;
  const profile = unwrapMaybe(
    "verificar onboarding",
    await supabase.from("profiles").select("onboarding_completed").maybeSingle(),
  );
  return profile?.onboarding_completed ?? false;
}

/** Duração estimada de cada etapa, só para a barra de progresso não travar. */
export const GENERATION_STAGES: GenerationStage[] = ["profile", "workout", "diet", "done"];
