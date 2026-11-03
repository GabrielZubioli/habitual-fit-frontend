import type { TablesUpdate } from "@gabrielzubioli/db/types";
import { yearsBetween } from "@forja/domain";
import { supabase } from "../supabase";
import { num, unwrapMaybe } from "./supabase-helpers";
import type { Tables } from "@gabrielzubioli/db/types";
import { bool, jsonList, localDb } from "../local";
import { updateById } from "./rows";
import { LOCALE } from "../i18n";
import { t } from "../i18n";

/** O perfil de quem está logado (`null` antes do questionário). */
export async function fetchProfile() {
  if (localDb()) return perfilLocal();
  return unwrapMaybe("carregar perfil", await supabase.from("profiles").select("*").maybeSingle());
}

/** Colunas array do perfil (texto JSON no SQLite). */
const LISTAS_DO_PERFIL = [
  "allergies",
  "dietary_restrictions",
  "disliked_foods",
  "equipment_available",
  "health_conditions",
  "injuries",
  "liked_foods",
] as const;

/** O perfil do banco local, no formato do Supabase. */
export async function perfilLocal(): Promise<Tables<"profiles"> | null> {
  const r = await localDb()!.getOptional<Record<string, unknown>>("SELECT * FROM profiles LIMIT 1");
  if (!r) return null;
  for (const c of LISTAS_DO_PERFIL) r[c] = jsonList(r[c]);
  r.onboarding_completed = bool(r.onboarding_completed);
  return r as Tables<"profiles">;
}

export type ProfileUpdate = TablesUpdate<"profiles">;

/** Grava uma alteração no perfil. */
export async function updateProfile(
  id: string,
  patch: ProfileUpdate,
  acao = "salvar perfil",
): Promise<void> {
  await updateById(acao, "profiles", id, patch);
}

// ------------------------------------------------------ campos do Perfil

export type ProfileField =
  | "display_name"
  | "sex"
  | "birth_date"
  | "height_cm"
  | "goal_weight_kg"
  | "goal"
  | "activity_level";

export const PROFILE_FIELD_TITLES: Record<ProfileField, { titulo: string; dica?: string }> = {
  display_name: { titulo: t("Seu nome") },
  sex: { titulo: t("Sexo"), dica: t("Entra no cálculo do gasto calórico.") },
  birth_date: {
    titulo: t("Data de nascimento"),
    dica: t("A idade entra no cálculo do gasto calórico."),
  },
  height_cm: { titulo: t("Altura"), dica: t("Em centímetros.") },
  goal_weight_kg: { titulo: t("Meta de peso"), dica: t("Deixe em branco se não tiver uma meta.") },
  goal: { titulo: t("Objetivo"), dica: t("Ajusta as calorias: déficit, manutenção ou superávit.") },
  activity_level: {
    titulo: t("Nível de atividade"),
    dica: t("Quanto você se movimenta na semana."),
  },
};

/** O erro do valor digitado, ou `null` se vale. */
export function validateProfileField(campo: ProfileField, v: string): string | null {
  switch (campo) {
    case "display_name":
      return v.trim().length > 80 ? t("Nome muito longo.") : null;
    case "height_cm": {
      const n = Number(v.replace(",", "."));
      return !v || !(n >= 100 && n <= 250) ? t("Altura esperada entre 100 e 250 cm.") : null;
    }
    case "goal_weight_kg": {
      if (!v) return null;
      const n = Number(v.replace(",", "."));
      return !(n >= 30 && n <= 300) ? t("Peso-alvo esperado entre 30 e 300 kg.") : null;
    }
    case "birth_date": {
      if (!v) return t("Escolha a data.");
      const idade = yearsBetween(v);
      return idade < 10 || idade > 120 ? t("Informe uma data entre 10 e 120 anos atrás.") : null;
    }
    default:
      return v ? null : t("Escolha uma opção.");
  }
}

/** O valor como vai para o banco. */
export function convertProfileField(campo: ProfileField, v: string): string | number | null {
  if (campo === "height_cm") return Number(v.replace(",", "."));
  if (campo === "goal_weight_kg") return v ? Number(v.replace(",", ".")) : null;
  if (campo === "display_name") return v.trim() || null;
  return v;
}

/** Faixa do IMC pela tabela da OMS. */
export function bmiBand(imc: number): string {
  if (imc < 18.5) return t("Abaixo do peso");
  if (imc < 25) return t("Peso normal");
  if (imc < 30) return t("Sobrepeso");
  return t("Obesidade");
}

// -------------------------------------------- metas nutricionais (manuais)

/** Os limites são os mesmos do banco. Campo vazio = sem meta. */
export const NUTRITION_TARGET_FIELDS = [
  { key: "daily_kcal_target", rotulo: t("Calorias"), unidade: "kcal", min: 500, max: 15000 },
  { key: "protein_g_target", rotulo: t("Proteína"), unidade: "g", min: 0, max: 2000 },
  { key: "carbs_g_target", rotulo: t("Carboidrato"), unidade: "g", min: 0, max: 3000 },
  { key: "fat_g_target", rotulo: t("Gordura"), unidade: "g", min: 0, max: 1000 },
  { key: "fiber_g_target", rotulo: t("Fibra"), unidade: "g", min: 0, max: 500 },
] as const;

export type NutritionTargetKey = (typeof NUTRITION_TARGET_FIELDS)[number]["key"];

/** Os valores do perfil como texto para o formulário. */
export function nutritionTargetDraft(
  profile: Partial<Record<NutritionTargetKey, number | string | null>>,
): Record<NutritionTargetKey, string> {
  return Object.fromEntries(
    NUTRITION_TARGET_FIELDS.map((c) => [
      c.key,
      profile[c.key] != null ? String(Math.round(num(profile[c.key]))) : "",
    ]),
  ) as Record<NutritionTargetKey, string>;
}

/** Valida o formulário: o patch para gravar, ou os erros por campo. */
export function parseNutritionTargets(
  valores: Record<NutritionTargetKey, string>,
):
  | { ok: true; patch: Record<NutritionTargetKey, number | null> }
  | { ok: false; erros: Partial<Record<NutritionTargetKey, string>> } {
  const erros: Partial<Record<NutritionTargetKey, string>> = {};
  const patch = {} as Record<NutritionTargetKey, number | null>;
  for (const c of NUTRITION_TARGET_FIELDS) {
    const bruto = valores[c.key].trim().replace(",", ".");
    if (!bruto) {
      patch[c.key] = null;
      continue;
    }
    const n = Number(bruto);
    if (!Number.isFinite(n) || n < c.min || n > c.max) {
      erros[c.key] = t("Entre {{v0}} e {{v1}} {{unidade}}", {
        v0: c.min.toLocaleString(LOCALE),
        v1: c.max.toLocaleString(LOCALE),
        unidade: c.unidade,
      });
    } else {
      patch[c.key] = Math.round(n);
    }
  }
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true, patch };
}

// ------------------------------------------------------ preferências

/** Preferências que não entram no cálculo de metas; salvam juntas, num botão só. */
export type PreferencesForm = {
  experience_level: string | null;
  days_per_week: number | null;
  session_duration: string | null;
  training_place: string | null;
  focus_area: string | null;
  equipment_available: string[];
  meals_per_day: number | null;
  water_ml_target: number | null;
  injuries: string[];
};

export function preferencesOf(p: {
  experience_level?: string | null;
  days_per_week?: number | null;
  session_duration?: string | null;
  training_place?: string | null;
  focus_area?: string | null;
  equipment_available?: string[] | null;
  meals_per_day?: number | null;
  water_ml_target?: number | null;
  injuries?: string[] | null;
}): PreferencesForm {
  return {
    experience_level: p.experience_level ?? null,
    days_per_week: p.days_per_week ?? null,
    session_duration: p.session_duration ?? null,
    training_place: p.training_place ?? null,
    focus_area: p.focus_area ?? null,
    equipment_available: p.equipment_available ?? [],
    meals_per_day: p.meals_per_day ?? null,
    water_ml_target: p.water_ml_target ?? null,
    injuries: p.injuries ?? [],
  };
}

export async function savePreferences(id: string, prefs: PreferencesForm): Promise<void> {
  await updateProfile(id, prefs as ProfileUpdate, "salvar preferências");
}

// ------------------------------------------------------------- conta

/**
 * Apaga de verdade: dados, fotos e a conta (Edge Function `delete-account`).
 * Depois só falta limpar a sessão local.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) throw error;
  await supabase.auth.signOut({ scope: "local" });
}
