import type { Enums } from "@gabrielzubioli/db/types";
import type { Weekday } from "@forja/domain";
import { formatDate } from "./date";
import { t } from "../i18n";
/**
 * Rótulos (no idioma do app) para os enums do banco.
 *
 * As colunas guardam identificadores em inglês (`chest`, `barbell`, `very_active`),
 * que estavam vazando direto para a interface — a biblioteca de exercícios exibia
 * badges "chest · barbell · strength" num app inteiramente em português.
 *
 * Espelham os enums definidos em `supabase/migrations/*.sql`.
 */

export const MUSCLE_LABELS = {
  chest: t("Peito"),
  back: t("Costas"),
  lats: t("Dorsal"),
  traps: t("Trapézio"),
  shoulders: t("Ombros"),
  front_delts: t("Deltoide anterior"),
  side_delts: t("Deltoide lateral"),
  rear_delts: t("Deltoide posterior"),
  biceps: t("Bíceps"),
  triceps: t("Tríceps"),
  forearms: t("Antebraço"),
  core: t("Core"),
  abs: t("Abdômen"),
  obliques: t("Oblíquos"),
  quads: t("Quadríceps"),
  hamstrings: t("Posterior de coxa"),
  glutes: t("Glúteos"),
  calves: t("Panturrilhas"),
  adductors: t("Adutores"),
  abductors: t("Abdutores"),
  lower_back: t("Lombar"),
  neck: t("Pescoço"),
  cardio: t("Cardio"),
  full_body: t("Corpo inteiro"),
} as const satisfies Record<Enums<"muscle_t">, string>;

export type MuscleValue = keyof typeof MUSCLE_LABELS;

export const EQUIPMENT_LABELS = {
  barbell: t("Barra"),
  dumbbell: t("Halter"),
  machine: t("Máquina"),
  cable: t("Polia"),
  bodyweight: t("Peso corporal"),
  kettlebell: t("Kettlebell"),
  band: t("Elástico"),
  cardio: t("Cardio"),
  other: t("Outro"),
} as const satisfies Record<Enums<"equipment_t">, string>;

export const CATEGORY_LABELS = {
  strength: t("Força"),
  cardio: t("Cardio"),
  stretching: t("Alongamento"),
  plyometrics: t("Pliometria"),
  olympic: t("Olímpico"),
} as const;

export const SET_TYPE_LABELS = {
  warmup: t("Aquecimento"),
  working: t("Série de trabalho"),
  drop: t("Drop set"),
  failure: t("Até a falha"),
} as const;

export type SetTypeValue = keyof typeof SET_TYPE_LABELS;

/** Abreviação exibida no botão de tipo de série. */
export const SET_TYPE_SHORT = {
  warmup: t("Aquecimento").charAt(0),
  working: "",
  drop: "D",
  failure: t("Falha").charAt(0),
} as const;

/**
 * As oito refeições do dia.
 *
 * Eram quatro (`breakfast`, `lunch`, `dinner`, `snack`). Pré e pós-treino não
 * são "lanches": têm composição, horário e propósito próprios, e amontoá-los
 * numa caixa genérica impedia tanto prescrever quanto ler o que aconteceu.
 *
 * A ordem do array é a ordem cronológica do dia — é ela que a tela usa.
 */
export const MEAL_LABELS = {
  breakfast: t("Café da manhã"),
  morning_snack: t("Lanche da manhã"),
  lunch: t("Almoço"),
  afternoon_snack: t("Lanche da tarde"),
  pre_workout: t("Pré-treino"),
  post_workout: t("Pós-treino"),
  dinner: t("Jantar"),
  supper: t("Ceia"),
} as const;

export type MealValue = keyof typeof MEAL_LABELS;

/** Horário padrão de cada refeição, usado quando o usuário não informa o dele. */
export const MEAL_DEFAULT_TIMES: Record<MealValue, string> = {
  breakfast: "07:00",
  morning_snack: "10:00",
  lunch: "12:30",
  afternoon_snack: "15:30",
  pre_workout: "17:30",
  post_workout: "19:30",
  dinner: "20:30",
  supper: "22:30",
};

export const MEALS = [
  { key: "breakfast", label: MEAL_LABELS.breakfast },
  { key: "morning_snack", label: MEAL_LABELS.morning_snack },
  { key: "lunch", label: MEAL_LABELS.lunch },
  { key: "afternoon_snack", label: MEAL_LABELS.afternoon_snack },
  { key: "pre_workout", label: MEAL_LABELS.pre_workout },
  { key: "post_workout", label: MEAL_LABELS.post_workout },
  { key: "dinner", label: MEAL_LABELS.dinner },
  { key: "supper", label: MEAL_LABELS.supper },
] as const satisfies readonly { key: MealValue; label: string }[];

export const MOVEMENT_PATTERN_LABELS = {
  horizontal_push: t("Empurrar horizontal"),
  vertical_push: t("Empurrar vertical"),
  horizontal_pull: t("Puxar horizontal"),
  vertical_pull: t("Puxar vertical"),
  squat: t("Agachamento"),
  hinge: t("Dobradiça de quadril"),
  lunge: t("Passada"),
  isolation: t("Isolado"),
  core: t("Core"),
  carry: t("Carregamento"),
  cardio: t("Cardio"),
  mobility: t("Mobilidade"),
} as const;

export const EXERCISE_LEVEL_LABELS = {
  beginner: t("Iniciante"),
  intermediate: t("Intermediário"),
  advanced: t("Avançado"),
} as const;

export const MECHANIC_LABELS = {
  compound: t("Composto"),
  isolation: t("Isolado"),
} as const;

export const FORCE_TYPE_LABELS = {
  push: t("Empurrar"),
  pull: t("Puxar"),
  static: t("Isometria"),
} as const;

export const FOOD_CATEGORY_LABELS = {
  protein_meat: t("Carnes e peixes"),
  protein_egg: t("Ovos"),
  dairy: t("Laticínios"),
  legume: t("Leguminosas"),
  grain: t("Cereais e pães"),
  tuber: t("Tubérculos"),
  vegetable: t("Vegetais"),
  fruit: t("Frutas"),
  fat: t("Gorduras e oleaginosas"),
  beverage: t("Bebidas"),
  supplement: t("Suplementos"),
  sweet: t("Doces"),
  condiment: t("Temperos e molhos"),
  prepared: t("Preparações"),
  other: t("Outros"),
} as const;

export type FoodCategoryValue = keyof typeof FOOD_CATEGORY_LABELS;

/** Lesões que o questionário coleta e que filtram exercícios do plano. */
export const INJURY_LABELS = {
  shoulder: t("Ombro"),
  elbow: t("Cotovelo"),
  wrist: t("Punho"),
  lower_back: t("Lombar"),
  neck: t("Pescoço"),
  hip: t("Quadril"),
  knee: t("Joelho"),
  ankle: t("Tornozelo"),
} as const;

export type InjuryValue = keyof typeof INJURY_LABELS;

export const SEX_LABELS = {
  male: t("Masculino"),
  female: t("Feminino"),
  other: t("Outro"),
} as const;

export const ACTIVITY_LABELS = {
  sedentary: t("Sedentário"),
  light: t("Leve"),
  moderate: t("Moderado"),
  active: t("Ativo"),
  very_active: t("Muito ativo"),
} as const;

/** Descrições que ajudam o usuário a escolher o nível certo. */
export const ACTIVITY_HINTS = {
  sedentary: t("Pouco ou nenhum exercício"),
  light: t("Exercício leve 1–3× por semana"),
  moderate: t("Exercício moderado 3–5× por semana"),
  active: t("Exercício intenso 6–7× por semana"),
  very_active: t("Trabalho físico ou 2 treinos por dia"),
} as const;

export const GOAL_LABELS = {
  lose: t("Perder gordura"),
  maintain: t("Manter"),
  gain: t("Ganhar massa"),
} as const;

/**
 * Ângulos da foto de evolução.
 *
 * Quatro ângulos e não três: um lado só esconde metade das assimetrias, e
 * assimetria é justamente o que fotos de evolução revelam melhor que a balança.
 *
 * `side` continua no mapa por causa dos registros antigos — a coluna é TEXT
 * livre, então as fotos gravadas antes de existirem esquerda e direita têm esse
 * valor e precisam continuar exibindo um rótulo em português. Ele fica fora de
 * `PHOTO_ANGLE_OPTIONS`, que é o que a interface oferece para novas fotos.
 */
export const PHOTO_ANGLE_LABELS = {
  front: t("Frente"),
  back: t("Costas"),
  side_left: t("Lado esquerdo"),
  side_right: t("Lado direito"),
  side: t("Lateral"),
} as const;

export type PhotoAngleValue = keyof typeof PHOTO_ANGLE_LABELS;

/** Os ângulos oferecidos ao registrar, na ordem em que se fotografa. */
export const PHOTO_ANGLE_OPTIONS = [
  { value: "front", label: PHOTO_ANGLE_LABELS.front },
  { value: "back", label: PHOTO_ANGLE_LABELS.back },
  { value: "side_left", label: PHOTO_ANGLE_LABELS.side_left },
  { value: "side_right", label: PHOTO_ANGLE_LABELS.side_right },
] as const satisfies readonly { value: PhotoAngleValue; label: string }[];

/** Busca segura num mapa de rótulos, caindo no valor cru se o enum crescer. */
export function label<T extends Record<string, string>>(
  map: T,
  value: string | null | undefined,
  fallback = "—",
): string {
  if (!value) return fallback;
  return map[value] ?? value;
}

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: t("Domingo"),
  1: t("Segunda"),
  2: t("Terça"),
  3: t("Quarta"),
  4: t("Quinta"),
  5: t("Sexta"),
  6: t("Sábado"),
};

/** Iniciais para a faixa compacta da tela inicial, no idioma do app (7/1/2024 foi domingo). */
export const WEEKDAY_INITIALS = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((d) => [
    d,
    formatDate(new Date(2024, 0, 7 + d), "EEEEE").toUpperCase(),
  ]),
) as Record<Weekday, string>;

/** Sigla em maiúsculas (DOM, SEG… / SUN, MON…), no idioma do app. */
export const WEEKDAY_SHORT = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((d) => [
    d,
    formatDate(new Date(2024, 0, 7 + d), "EEE")
      .replace(".", "")
      .toUpperCase(),
  ]),
) as Record<Weekday, string>;
