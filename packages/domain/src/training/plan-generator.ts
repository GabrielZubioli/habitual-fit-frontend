import { z } from "zod";
import { MUSCLES, type Muscle } from "./volume";

/**
 * Gerador de plano de treino.
 *
 * Transforma quatro respostas do usuário — nível, objetivo, equipamento
 * disponível e frequência semanal — numa rotina estruturada (divisão A/B/C…),
 * como fazem os apps que montam a ficha automaticamente.
 *
 * ## Por que o gerador devolve "vagas", não exercícios
 *
 * O domínio é puro: não conhece o catálogo de exercícios, que vive no banco e
 * varia por usuário (exercícios personalizados). Então aqui produzimos
 * **`ExerciseSlot`** — a *intenção* ("um empurrão horizontal de peito, 3×8-12,
 * 120s de descanso") — e a camada de dados casa cada vaga com um exercício real
 * respeitando o equipamento disponível.
 *
 * Isso mantém a lógica de programação testável e deixa a seleção de exercícios
 * trocável sem tocar nas regras de treino.
 *
 * ## Base das recomendações
 *
 * O volume é distribuído por **grupo muscular** (ver `TARGET_WEEKLY_SETS`),
 * mirando 8, 12 e 16 séries diretas por semana para iniciante, intermediário e
 * avançado. São números menores que os 10–20 citados na literatura porque aqui
 * só contam séries **diretas**: o estímulo indireto que o tríceps recebe num
 * supino, por exemplo, fica de fora da conta.
 */

/** Padrão de movimento — o que define a "vaga" a ser preenchida. */
export const MOVEMENT_PATTERNS = [
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "isolation",
  "core",
  "cardio",
] as const;

export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const TRAINING_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];

export const TRAINING_GOALS = ["strength", "hypertrophy", "endurance"] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];

/** Ambientes de treino, que determinam o equipamento disponível. */
export const EQUIPMENT_PROFILES = ["full_gym", "home_basic", "bodyweight"] as const;
export type EquipmentProfile = (typeof EQUIPMENT_PROFILES)[number];

/**
 * Duração pretendida da sessão — define **quantos exercícios** cabem no treino.
 *
 * É a restrição mais concreta que o usuário sabe informar: ninguém sabe dizer
 * "quero 18 séries", mas todo mundo sabe se tem 30 ou 90 minutos.
 */
export const SESSION_DURATIONS = ["quick", "short", "average", "long"] as const;
export type SessionDuration = (typeof SESSION_DURATIONS)[number];

/** Faixa de exercícios por sessão em cada duração. */
export const EXERCISES_BY_DURATION: Record<SessionDuration, { min: number; max: number }> = {
  quick: { min: 3, max: 3 },
  short: { min: 4, max: 6 },
  average: { min: 5, max: 7 },
  long: { min: 8, max: 10 },
};

/** Minutos estimados, para exibir junto da opção. */
export const MINUTES_BY_DURATION: Record<SessionDuration, string> = {
  quick: "até 20 min",
  short: "20–40 min",
  average: "40–60 min",
  long: "60+ min",
};

/**
 * Região que o usuário quer enfatizar. `full_body` = sem ênfase; `legs` cobre
 * os membros inferiores e `upper` os superiores.
 */
export const FOCUS_AREAS = [
  "full_body",
  "upper",
  "shoulders",
  "arms",
  "chest",
  "abs",
  "back",
  "glutes",
  "legs",
] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

/**
 * Regiões de lesão ou dor que o questionário aceita. Os valores espelham a
 * coluna `exercises.contraindications` do catálogo.
 */
export const INJURY_AREAS = [
  "shoulder",
  "elbow",
  "wrist",
  "lower_back",
  "neck",
  "hip",
  "knee",
  "ankle",
] as const;
export type InjuryArea = (typeof INJURY_AREAS)[number];

export const planInputSchema = z.object({
  level: z.enum(TRAINING_LEVELS),
  goal: z.enum(TRAINING_GOALS),
  equipment: z.enum(EQUIPMENT_PROFILES),
  /** Quantos treinos por semana o usuário consegue manter. */
  daysPerWeek: z.number().int().min(2).max(6),
  /** Duração pretendida da sessão. Padrão: sessão média. */
  duration: z.enum(SESSION_DURATIONS).default("average"),
  /** Região a enfatizar. Padrão: sem ênfase. */
  focus: z.enum(FOCUS_AREAS).default("full_body"),
  /** Lesões ou dores: os padrões e músculos que sobrecarregam a região saem do plano. */
  injuries: z.array(z.enum(INJURY_AREAS)).default([]),
});

/**
 * Entrada do gerador. `duration` e `focus` são opcionais: `z.input` mantém os
 * campos com `.default()` dispensáveis para quem chama, enquanto `PlanConfig`
 * representa a configuração já resolvida.
 */
export type PlanInput = z.input<typeof planInputSchema>;

/** Configuração após aplicar os padrões. */
export type PlanConfig = z.infer<typeof planInputSchema>;

export interface ExerciseSlot {
  /** Músculo que a vaga deve estimular. */
  primaryMuscle: Muscle;
  pattern: MovementPattern;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
  /**
   * Vagas de prioridade 1 são os exercícios compostos que sustentam o treino —
   * se o catálogo não tiver candidato, vale avisar em vez de silenciar.
   */
  priority: 1 | 2;
}

export interface PlanSplit {
  /** Letra da divisão: "A", "B", "C"… */
  letter: string;
  /** Nome apresentável, ex.: "Empurrar (peito, ombro, tríceps)". */
  name: string;
  slots: ExerciseSlot[];
}

export interface GeneratedPlan {
  input: PlanConfig;
  splits: PlanSplit[];
  /** Séries efetivas por semana e por músculo, para exibir e validar. */
  weeklySetsByMuscle: Partial<Record<Muscle, number>>;
  /** Vagas retiradas por causa das lesões informadas. */
  removedForInjury: number;
  /**
   * Divisões que ficaram sem exercícios suficientes depois das restrições de
   * lesão. Não vazio = o plano não deve ser gravado: melhor explicar do que
   * entregar um dia de treino incoerente.
   */
  blockedSplits: string[];
}

// --- Parâmetros derivados do nível e do objetivo -------------------------

/**
 * Séries **diretas** por músculo e por semana que o plano tenta atingir.
 *
 * "Diretas" importa: só contamos as vagas cujo músculo-alvo é aquele. O estímulo
 * indireto que o tríceps recebe num supino, por exemplo, não entra na conta — por
 * isso os alvos aqui são menores que os números de 10–20 séries citados para
 * volume *total*.
 */
const TARGET_WEEKLY_SETS: Record<TrainingLevel, number> = {
  beginner: 8,
  intermediate: 12,
  advanced: 16,
};

/**
 * Limites por vaga. Menos de 2 séries não estimula; mais de 5 do mesmo
 * exercício rende pouco e alonga demais a sessão — quando o alvo semanal não
 * cabe nesse teto, `findVolumeOutliers` avisa em vez de inflar a prescrição.
 */
const SETS_PER_SLOT = { min: 2, max: 5 } as const;

/** Compostos carregam mais volume que isolados dentro do mesmo músculo. */
const SLOT_WEIGHT: Record<1 | 2, number> = { 1: 1.25, 2: 1 };

/** Músculos que cada área de foco abrange. */
const MUSCLES_BY_FOCUS: Record<FocusArea, readonly Muscle[]> = {
  full_body: [],
  upper: [
    "chest",
    "back",
    "lats",
    "traps",
    "shoulders",
    "front_delts",
    "side_delts",
    "rear_delts",
    "biceps",
    "triceps",
    "forearms",
  ],
  shoulders: ["shoulders", "front_delts", "side_delts", "rear_delts"],
  arms: ["biceps", "triceps", "forearms"],
  chest: ["chest"],
  abs: ["abs", "core", "obliques"],
  back: ["back", "lats", "traps"],
  glutes: ["glutes"],
  legs: ["quads", "hamstrings", "calves", "glutes"],
};

/**
 * Ajusta o número de exercícios da divisão à duração pretendida.
 *
 * Ao **cortar**, os compostos (prioridade 1) são intocáveis: são eles que
 * sustentam o treino. Saem primeiro os isolados que não pertencem à área de
 * foco — assim uma sessão curta com foco em braços perde a panturrilha, não a
 * rosca.
 *
 * Ao **estender**, repetimos músculo e padrão de movimento de vagas que a
 * divisão já tem (uma segunda variação do mesmo movimento), em vez de inventar
 * grupos que não fazem parte dela — ou um "isolado de core", que não existe
 * no catálogo.
 */
function fitToDuration(
  slots: readonly [Muscle, MovementPattern, 1 | 2][],
  duration: SessionDuration,
  focus: FocusArea,
  level: TrainingLevel,
): [Muscle, MovementPattern, 1 | 2][] {
  const faixa = faixaDeExercicios(duration, level);
  const focados = new Set<Muscle>(MUSCLES_BY_FOCUS[focus]);

  if (slots.length > faixa.max) {
    // Ordena por "descartabilidade": compostos por último, focados protegidos.
    const ordenado = [...slots]
      .map((slot, index) => ({ slot, index }))
      .sort((a, b) => {
        const scoreA = descartabilidade(a.slot, focados);
        const scoreB = descartabilidade(b.slot, focados);
        return scoreA - scoreB || a.index - b.index;
      });
    // Mantém os primeiros e restaura a ordem original da divisão.
    const mantidos = ordenado.slice(0, faixa.max).sort((a, b) => a.index - b.index);
    return mantidos.map((m) => m.slot);
  }

  if (slots.length < faixa.min) {
    const estendido = [...slots];
    // Repete as vagas que a divisão já tem, priorizando o foco.
    const candidatos = slots
      .map(([muscle, pattern]) => [muscle, pattern] as const)
      .sort((a, b) => Number(focados.has(b[0])) - Number(focados.has(a[0])));

    let i = 0;
    while (estendido.length < faixa.min && candidatos.length > 0) {
      const [muscle, pattern] = candidatos[i % candidatos.length]!;
      estendido.push([muscle, pattern, 2]);
      i += 1;
    }
    return estendido;
  }

  return [...slots];
}

/**
 * Exercícios por sessão. Iniciante tem teto de 6, mesmo em sessão longa: uma
 * ficha curta e repetida é o que dá tempo de aprender os movimentos.
 */
const MAX_EXERCICIOS_INICIANTE = 6;

function faixaDeExercicios(duration: SessionDuration, level: TrainingLevel) {
  const faixa = EXERCISES_BY_DURATION[duration];
  if (level !== "beginner") return faixa;
  const max = Math.min(faixa.max, MAX_EXERCICIOS_INICIANTE);
  return { min: Math.min(faixa.min, max), max };
}

/** Quanto mais alto, mais cedo a vaga é cortada numa sessão curta. */
function descartabilidade(
  slot: readonly [Muscle, MovementPattern, 1 | 2],
  focados: ReadonlySet<Muscle>,
): number {
  const [muscle, pattern, priority] = slot;
  if (priority === 1) return 0; // composto: nunca sai
  if (focados.has(muscle)) return 1; // isolado da área de foco
  if (pattern === "core") return 3; // core é o primeiro a sair
  return 2;
}

/** Faixa de repetições e descanso, por objetivo. */
const PRESCRIPTION_BY_GOAL: Record<
  TrainingGoal,
  {
    compound: [number, number];
    isolation: [number, number];
    restCompound: number;
    restIsolation: number;
  }
> = {
  // Força: cargas altas, poucas reps, descanso longo para recuperar o sistema nervoso.
  strength: { compound: [4, 6], isolation: [8, 10], restCompound: 180, restIsolation: 90 },
  hypertrophy: { compound: [8, 12], isolation: [10, 15], restCompound: 120, restIsolation: 75 },
  // Resistência: reps altas e descanso curto sustentam a demanda metabólica.
  endurance: { compound: [12, 15], isolation: [15, 20], restCompound: 60, restIsolation: 45 },
};

/**
 * Vagas indisponíveis fora da academia completa.
 *
 * O gerador substitui o padrão por uma alternativa viável em vez de omitir o
 * estímulo — um treino em casa ainda precisa treinar costas.
 */
const PATTERN_FALLBACK: Record<
  EquipmentProfile,
  Partial<Record<MovementPattern, MovementPattern>>
> = {
  full_gym: {},
  home_basic: {},
  bodyweight: {
    // Sem barra/halteres, agachamento e levantamento terra viram unilaterais e core.
    hinge: "lunge",
    vertical_push: "horizontal_push",
  },
};

// --- Definição das divisões por frequência -------------------------------

type SplitBlueprint = {
  name: string;
  /** `[músculo, padrão, prioridade]` — as séries e reps vêm do nível/objetivo. */
  slots: [Muscle, MovementPattern, 1 | 2][];
};

const FULL_BODY_A: SplitBlueprint = {
  name: "Corpo inteiro A",
  slots: [
    ["quads", "squat", 1],
    ["chest", "horizontal_push", 1],
    ["lats", "vertical_pull", 1],
    ["shoulders", "vertical_push", 2],
    ["core", "core", 2],
  ],
};

const FULL_BODY_B: SplitBlueprint = {
  name: "Corpo inteiro B",
  slots: [
    ["hamstrings", "hinge", 1],
    ["back", "horizontal_pull", 1],
    ["chest", "horizontal_push", 2],
    ["glutes", "lunge", 2],
    ["core", "core", 2],
  ],
};

/*
 * As divisões abaixo têm de 5 a 7 vagas — o tamanho de uma sessão real de
 * musculação. Versões mais enxutas pareciam elegantes no código, mas davam a
 * cada músculo uma única vaga por semana; como há um teto de séries por vaga,
 * o volume semanal ficava sistematicamente abaixo do produtivo.
 * Grupos grandes recebem dois movimentos (um composto + um complementar).
 */

const PUSH: SplitBlueprint = {
  name: "Empurrar (peito, ombro, tríceps)",
  slots: [
    ["chest", "horizontal_push", 1],
    ["shoulders", "vertical_push", 1],
    ["chest", "horizontal_push", 2],
    ["side_delts", "isolation", 2],
    ["triceps", "isolation", 2],
    ["triceps", "isolation", 2],
  ],
};

const PULL: SplitBlueprint = {
  name: "Puxar (costas, bíceps)",
  slots: [
    ["lats", "vertical_pull", 1],
    ["back", "horizontal_pull", 1],
    ["lats", "vertical_pull", 2],
    ["rear_delts", "isolation", 2],
    ["biceps", "isolation", 2],
    ["biceps", "isolation", 2],
  ],
};

const LEGS: SplitBlueprint = {
  name: "Pernas",
  slots: [
    ["quads", "squat", 1],
    ["hamstrings", "hinge", 1],
    ["quads", "squat", 2],
    ["hamstrings", "isolation", 2],
    ["glutes", "lunge", 2],
    ["calves", "isolation", 2],
    ["core", "core", 2],
  ],
};

const UPPER: SplitBlueprint = {
  name: "Superiores",
  slots: [
    ["chest", "horizontal_push", 1],
    ["lats", "vertical_pull", 1],
    ["shoulders", "vertical_push", 2],
    ["back", "horizontal_pull", 2],
    ["biceps", "isolation", 2],
    ["triceps", "isolation", 2],
  ],
};

const LOWER: SplitBlueprint = {
  name: "Inferiores",
  slots: [
    ["quads", "squat", 1],
    ["hamstrings", "hinge", 1],
    ["glutes", "lunge", 2],
    ["quads", "squat", 2],
    ["calves", "isolation", 2],
    ["core", "core", 2],
  ],
};

/** Terceiro dia de corpo inteiro, para o iniciante que treina 3×. */
const FULL_BODY_C: SplitBlueprint = {
  name: "Corpo inteiro C",
  slots: [
    ["quads", "lunge", 1],
    ["shoulders", "vertical_push", 1],
    ["lats", "vertical_pull", 2],
    ["chest", "horizontal_push", 2],
    ["core", "core", 2],
  ],
};

/** Segundo dia de superiores, puxado para costas e ombros — quem prioriza o tronco. */
const UPPER_B: SplitBlueprint = {
  name: "Superiores — costas e ombros",
  slots: [
    ["back", "horizontal_pull", 1],
    ["shoulders", "vertical_push", 1],
    ["lats", "vertical_pull", 2],
    ["chest", "horizontal_push", 2],
    ["side_delts", "isolation", 2],
    ["biceps", "isolation", 2],
    ["triceps", "isolation", 2],
  ],
};

/** Segundo dia de inferiores, puxado para posteriores e glúteos — quem prioriza as pernas. */
const LOWER_B: SplitBlueprint = {
  name: "Inferiores — posteriores e glúteos",
  slots: [
    ["hamstrings", "hinge", 1],
    ["glutes", "lunge", 1],
    ["quads", "squat", 2],
    ["hamstrings", "isolation", 2],
    ["glutes", "isolation", 2],
    ["calves", "isolation", 2],
    ["core", "core", 2],
  ],
};

/**
 * A semana, por frequência — e por quem treina.
 *
 * - **Equilibrado:** o consenso prático — corpo inteiro com poucos dias,
 *   divisões maiores a partir de 3.
 * - **Iniciante:** só corpo inteiro e superiores/inferiores. Menos fichas
 *   diferentes, mais repetição de cada movimento.
 * - **Foco em inferiores/superiores:** a região escolhida ganha mais sessões
 *   (ou, onde a proporção não muda, uma sessão própria e mais volume).
 *
 * Cada lista tem exatamente `daysPerWeek` divisões: nenhuma sessão a mais que
 * os dias disponíveis, nenhum dia sem treino.
 */
const DIVISOES: Record<"equilibrado" | "iniciante" | Regiao, Record<number, SplitBlueprint[]>> = {
  equilibrado: {
    2: [FULL_BODY_A, FULL_BODY_B],
    3: [PUSH, PULL, LEGS],
    4: [UPPER, LOWER, UPPER, LOWER],
    5: [PUSH, PULL, LEGS, UPPER, LOWER],
    6: [PUSH, PULL, LEGS, PUSH, PULL, LEGS],
  },
  iniciante: {
    2: [FULL_BODY_A, FULL_BODY_B],
    3: [FULL_BODY_A, FULL_BODY_B, FULL_BODY_C],
    4: [UPPER, LOWER, UPPER, LOWER],
    5: [UPPER, LOWER, FULL_BODY_A, UPPER, LOWER],
    6: [UPPER, LOWER, UPPER, LOWER, UPPER, LOWER],
  },
  inferiores: {
    2: [FULL_BODY_A, FULL_BODY_B],
    3: [LOWER, UPPER, LOWER_B],
    4: [LOWER, UPPER, LOWER_B, FULL_BODY_B],
    5: [LOWER, PUSH, LOWER_B, PULL, LEGS],
    6: [LOWER, PUSH, LOWER_B, PULL, LEGS, UPPER],
  },
  superiores: {
    2: [FULL_BODY_A, FULL_BODY_B],
    3: [UPPER, LOWER, UPPER_B],
    4: [UPPER, LOWER, UPPER_B, LOWER],
    5: [PUSH, PULL, LOWER, UPPER, UPPER_B],
    6: [PUSH, PULL, LEGS, UPPER, UPPER_B, LOWER],
  },
};

type Regiao = "inferiores" | "superiores";

/** A que metade do corpo cada foco pertence. Abdômen e corpo inteiro não mudam a semana. */
const REGIAO_DO_FOCO: Partial<Record<FocusArea, Regiao>> = {
  legs: "inferiores",
  glutes: "inferiores",
  upper: "superiores",
  chest: "superiores",
  back: "superiores",
  shoulders: "superiores",
  arms: "superiores",
};

/** Focos de um grupo só: além da semana, cada sessão que já treina o grupo ganha uma vaga dele. */
const FOCO_ESPECIFICO = new Set<FocusArea>(["glutes", "chest", "back", "shoulders", "arms", "abs"]);

/** Multiplicador do alvo semanal de séries nos músculos da área de foco. */
const VOLUME_DO_FOCO = 1.4;

/**
 * Com foco numa metade do corpo, a outra fica em volume de manutenção. Sem
 * isso, a metade de cima — que tem mais grupos musculares — continuava com
 * mais séries na semana mesmo para quem escolheu priorizar as pernas.
 */
const VOLUME_DA_OUTRA_REGIAO = 0.75;

const MUSCULOS_DA_REGIAO: Record<Regiao, readonly Muscle[]> = {
  inferiores: ["quads", "hamstrings", "glutes", "calves", "adductors", "abductors"],
  superiores: [
    "chest",
    "back",
    "lats",
    "traps",
    "shoulders",
    "front_delts",
    "side_delts",
    "rear_delts",
    "biceps",
    "triceps",
    "forearms",
  ],
};

/** Multiplicador do volume semanal de um músculo, dado o foco. */
function pesoDoFoco(muscle: Muscle, focus: FocusArea): number {
  if ((MUSCLES_BY_FOCUS[focus] as readonly Muscle[]).includes(muscle)) return VOLUME_DO_FOCO;
  const regiao = REGIAO_DO_FOCO[focus];
  if (!regiao) return 1;
  const outra: Regiao = regiao === "inferiores" ? "superiores" : "inferiores";
  return MUSCULOS_DA_REGIAO[outra].includes(muscle) ? VOLUME_DA_OUTRA_REGIAO : 1;
}

function escolherDivisoes(input: PlanConfig): SplitBlueprint[] {
  const regiao = REGIAO_DO_FOCO[input.focus];
  const tabela = regiao
    ? DIVISOES[regiao]
    : input.level === "beginner"
      ? DIVISOES.iniciante
      : DIVISOES.equilibrado;
  return tabela[input.daysPerWeek] ?? DIVISOES.equilibrado[3]!;
}

/**
 * Acrescenta à sessão uma vaga do grupo em foco, se ela já trabalha esse grupo.
 * Foco numa metade do corpo só reforça as sessões de corpo inteiro — as
 * demais já vêm da tabela de divisões com a ênfase certa.
 */
function reforcarFoco(
  slots: readonly [Muscle, MovementPattern, 1 | 2][],
  focus: FocusArea,
): [Muscle, MovementPattern, 1 | 2][] {
  const regiao = REGIAO_DO_FOCO[focus];
  const corpoInteiro =
    slots.some(([m]) => MUSCULOS_DA_REGIAO.inferiores.includes(m)) &&
    slots.some(([m]) => MUSCULOS_DA_REGIAO.superiores.includes(m));
  if (!FOCO_ESPECIFICO.has(focus) && !(regiao && corpoInteiro)) return [...slots];
  if (focus === "abs") return [...slots, ["abs", "core", 2]];
  const alvo = MUSCLES_BY_FOCUS[focus];
  const presente = slots.find(([muscle]) => alvo.includes(muscle));
  return presente ? [...slots, [presente[0], "isolation", 2]] : [...slots];
}

// --- Lesões --------------------------------------------------------------

/**
 * O que cada região de lesão tira do plano: padrões de movimento que a
 * carregam diretamente e músculos cujo treino a solicita.
 *
 * É deliberadamente conservador — na dúvida, sai. Não é avaliação clínica:
 * serve para não prescrever o óbvio (agachamento para quem informou dor no
 * joelho), e o app pede orientação profissional a quem informa uma lesão.
 */
export const INJURY_RESTRICTIONS: Record<
  InjuryArea,
  { patterns: readonly MovementPattern[]; muscles: readonly Muscle[] }
> = {
  shoulder: {
    patterns: ["vertical_push", "horizontal_push"],
    muscles: ["shoulders", "front_delts", "side_delts", "rear_delts", "chest"],
  },
  elbow: { patterns: [], muscles: ["biceps", "triceps", "forearms"] },
  wrist: { patterns: ["horizontal_push", "vertical_push"], muscles: ["forearms"] },
  lower_back: { patterns: ["hinge", "squat"], muscles: [] },
  neck: { patterns: ["vertical_push"], muscles: ["traps"] },
  hip: { patterns: ["squat", "hinge", "lunge"], muscles: ["glutes", "adductors", "abductors"] },
  knee: { patterns: ["squat", "lunge"], muscles: ["quads"] },
  ankle: { patterns: ["squat", "lunge"], muscles: ["calves"] },
};

function restrito(muscle: string, pattern: string, injuries: readonly InjuryArea[]): boolean {
  return injuries.some((i) => {
    const r = INJURY_RESTRICTIONS[i];
    return (
      (r.patterns as readonly string[]).includes(pattern) ||
      (r.muscles as readonly string[]).includes(muscle)
    );
  });
}

/**
 * O exercício pode entrar no plano de quem informou essas lesões?
 *
 * Sai se o catálogo o contraindica para a região, se o músculo ou o padrão de
 * movimento está nas restrições — e se o padrão não é conhecido: sem saber o
 * movimento não há como afirmar que é seguro, então não se presume.
 */
export function exerciseFitsInjuries(
  exercise: {
    primaryMuscle: string;
    pattern: string | null;
    contraindications: readonly string[] | null;
  },
  injuries: readonly InjuryArea[],
): boolean {
  if (injuries.length === 0) return true;
  if ((exercise.contraindications ?? []).some((c) => (injuries as readonly string[]).includes(c)))
    return false;
  if (!exercise.pattern) return false;
  return !restrito(exercise.primaryMuscle, exercise.pattern, injuries);
}

// --- Catálogo: o que pode entrar no plano ------------------------------

/** Equipamentos de cada ambiente, do mais ao menos preferido. */
export const EQUIPMENT_BY_PROFILE: Record<EquipmentProfile, readonly string[]> = {
  full_gym: [
    "barbell",
    "dumbbell",
    "machine",
    "cable",
    "bodyweight",
    "kettlebell",
    "band",
    "other",
  ],
  home_basic: ["dumbbell", "bodyweight", "band", "kettlebell", "other"],
  bodyweight: ["bodyweight", "band"],
};

/**
 * Equipamentos utilizáveis: o que a pessoa marcou ter, dentro do que o
 * ambiente oferece, mais o peso do corpo — que todo mundo tem. Sem nada
 * marcado, vale o ambiente inteiro.
 */
export function allowedEquipment(
  profile: EquipmentProfile,
  marked: readonly string[] = [],
): string[] {
  const doAmbiente = EQUIPMENT_BY_PROFILE[profile];
  const marcados = doAmbiente.filter((e) => marked.includes(e));
  if (marcados.length === 0) return [...doAmbiente];
  return marcados.includes("bodyweight") ? marcados : [...marcados, "bodyweight"];
}

/** Iniciante não recebe exercício classificado como avançado. */
export function exerciseFitsLevel(userLevel: TrainingLevel, exerciseLevel: string | null): boolean {
  return !(userLevel === "beginner" && exerciseLevel === "advanced");
}

export interface CatalogCandidate {
  primaryMuscle: string;
  pattern: string | null;
  equipment: string;
  level: string | null;
  contraindications: readonly string[] | null;
}

/**
 * A regra única de "este exercício pode entrar no plano desta pessoa":
 * equipamento disponível, nível e lesões. Não há fallback para o catálogo
 * inteiro — uma vaga sem candidato fica vazia e é avisada, em vez de
 * receber um exercício com aparelho que a pessoa não tem ou que carrega a
 * região lesionada.
 */
export function exerciseIsSelectable(
  exercise: CatalogCandidate,
  rules: { equipment: readonly string[]; level: TrainingLevel; injuries: readonly InjuryArea[] },
): boolean {
  return (
    rules.equipment.includes(exercise.equipment) &&
    exerciseFitsLevel(rules.level, exercise.level) &&
    exerciseFitsInjuries(exercise, rules.injuries)
  );
}

/** Uma sessão com menos vagas que isto, depois das restrições, não é um treino. */
const MIN_VAGAS_POR_SESSAO = 2;

const LETTERS = "ABCDEF";

/** Gera o plano a partir das respostas do usuário. */
export function generatePlan(rawInput: PlanInput): GeneratedPlan {
  const input = planInputSchema.parse(rawInput);
  const blueprints = escolherDivisoes(input);
  const prescription = PRESCRIPTION_BY_GOAL[input.goal];
  const fallbacks = PATTERN_FALLBACK[input.equipment];
  const target = TARGET_WEEKLY_SETS[input.level];
  // Músculos que recebem bastante estímulo indireto dos compostos precisam de
  // menos volume direto do que os grandes grupos.
  const auxTarget = Math.round(target * 0.6);

  /*
   * Ordem: reforço do foco → padrão viável no equipamento → restrições de
   * lesão → duração. As restrições vêm antes da duração para que a sessão
   * curta seja montada com o que sobrou, e não cortada depois para menos que
   * o mínimo.
   */
  let removedForInjury = 0;
  const blockedSplits: string[] = [];
  const ajustados = blueprints.map((blueprint) => {
    const viaveis = reforcarFoco(blueprint.slots, input.focus)
      .map(([m, p, prio]): [Muscle, MovementPattern, 1 | 2] => [m, fallbacks[p] ?? p, prio])
      .filter(([m, p]) => {
        const sai = restrito(m, p, input.injuries);
        if (sai) removedForInjury += 1;
        return !sai;
      });
    if (viaveis.length < MIN_VAGAS_POR_SESSAO) blockedSplits.push(blueprint.name);
    return {
      ...blueprint,
      slots:
        viaveis.length === 0
          ? []
          : fitToDuration(viaveis, input.duration, input.focus, input.level),
    };
  });

  /*
   * O alvo semanal é distribuído por **grupo muscular**, não por valor do enum.
   *
   * Distribuir por enum inflava o volume: "costas" recebia o alvo cheio em
   * `lats` e outro tanto em `back`, e a sessão passava de 30 séries. Agrupar
   * antes de dividir mantém a soma do grupo no alvo pretendido.
   */
  const weightByGroup = new Map<string, number>();
  for (const blueprint of ajustados) {
    for (const [muscle, , priority] of blueprint.slots) {
      const key = volumeGroupOf(muscle);
      weightByGroup.set(key, (weightByGroup.get(key) ?? 0) + SLOT_WEIGHT[priority]);
    }
  }

  const splits: PlanSplit[] = ajustados.map((blueprint, index) => {
    const usedTwice = ajustados.filter((b) => b.name === blueprint.name).length > 1;

    return {
      letter: LETTERS[index] ?? String(index + 1),
      // Divisões repetidas (ex.: 4 dias = Superiores/Inferiores ×2) ganham
      // numeração para o usuário distinguir "Superiores 1" de "Superiores 2".
      name: usedTwice
        ? `${blueprint.name} ${countOccurrence(ajustados, blueprint, index)}`
        : blueprint.name,
      slots: blueprint.slots.map(([muscle, pattern, priority]) => {
        const resolvedPattern = fallbacks[pattern] ?? pattern;
        const isCompound = priority === 1 && resolvedPattern !== "isolation";
        const [repMin, repMax] = isCompound ? prescription.compound : prescription.isolation;

        const grupo = volumeGroupOf(muscle);
        const alvoBase = isValidatedGroup(grupo) ? target : auxTarget;
        // A área de foco recebe mais volume na semana — não só um nome diferente.
        const alvoDoGrupo = alvoBase * pesoDoFoco(muscle, input.focus);
        const pesoTotal = weightByGroup.get(grupo) ?? SLOT_WEIGHT[priority];
        const parcela = (alvoDoGrupo * SLOT_WEIGHT[priority]) / pesoTotal;

        return {
          primaryMuscle: muscle,
          pattern: resolvedPattern,
          sets: clamp(Math.round(parcela), SETS_PER_SLOT.min, SETS_PER_SLOT.max),
          repMin,
          repMax,
          restSeconds: isCompound ? prescription.restCompound : prescription.restIsolation,
          priority,
        } satisfies ExerciseSlot;
      }),
    };
  });

  return {
    input,
    splits,
    weeklySetsByMuscle: sumWeeklySets(splits),
    removedForInjury,
    blockedSplits,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Total de séries por músculo na semana — usado para exibir e para validar o plano. */
export function sumWeeklySets(splits: readonly PlanSplit[]): Partial<Record<Muscle, number>> {
  const totals: Partial<Record<Muscle, number>> = {};
  for (const split of splits) {
    for (const slot of split.slots) {
      totals[slot.primaryMuscle] = (totals[slot.primaryMuscle] ?? 0) + slot.sets;
    }
  }
  return totals;
}

/**
 * Faixa de séries **diretas** por semana considerada produtiva em cada nível.
 *
 * Mais baixa que os números usualmente citados (10–20) porque aqui só contamos
 * volume direto; o estímulo indireto dos compostos não entra. Serve para avisar
 * quando a frequência escolhida não comporta o alvo do nível — caso típico de um
 * avançado tentando treinar 2×/semana.
 */
export const WEEKLY_SET_RANGE: Record<TrainingLevel, { min: number; max: number }> = {
  beginner: { min: 4, max: 12 },
  intermediate: { min: 6, max: 18 },
  advanced: { min: 8, max: 22 },
};

/**
 * Grupos usados para validar o volume.
 *
 * A validação acontece por **grupo**, não por valor do enum, porque o enum
 * separa músculos que na prática são treinados juntos: um remada estimula
 * `back`, `lats` e `traps` ao mesmo tempo. Avaliar cada um isoladamente
 * produzia alertas falsos de "volume baixo" em planos perfeitamente sensatos.
 *
 * Ficam de fora os que recebem muito estímulo indireto (braços, panturrilhas,
 * antebraços) e os que não seguem faixas de hipertrofia (core, cardio).
 */
export const VALIDATED_MUSCLE_GROUPS = {
  peito: ["chest"],
  costas: ["back", "lats", "traps"],
  ombros: ["shoulders", "front_delts", "side_delts", "rear_delts"],
  quadriceps: ["quads"],
  posteriores: ["hamstrings", "glutes"],
} as const satisfies Record<string, readonly Muscle[]>;

export type ValidatedMuscleGroup = keyof typeof VALIDATED_MUSCLE_GROUPS;

/** Índice inverso músculo → grupo, montado uma vez. */
const GROUP_BY_MUSCLE = new Map<Muscle, ValidatedMuscleGroup>(
  Object.entries(VALIDATED_MUSCLE_GROUPS).flatMap(([group, muscles]) =>
    (muscles as readonly Muscle[]).map((m) => [m, group as ValidatedMuscleGroup] as const),
  ),
);

/**
 * Grupo usado para dividir o volume. Músculos fora dos grupos validados
 * (braços, panturrilhas, core) formam o próprio grupo e recebem o alvo auxiliar.
 */
function volumeGroupOf(muscle: Muscle): string {
  return GROUP_BY_MUSCLE.get(muscle) ?? muscle;
}

function isValidatedGroup(group: string): group is ValidatedMuscleGroup {
  return group in VALIDATED_MUSCLE_GROUPS;
}

/** Séries semanais somadas por grupo muscular. */
export function sumWeeklySetsByGroup(
  weeklySetsByMuscle: Partial<Record<Muscle, number>>,
): Record<ValidatedMuscleGroup, number> {
  const totals = {} as Record<ValidatedMuscleGroup, number>;
  for (const [group, muscles] of Object.entries(VALIDATED_MUSCLE_GROUPS)) {
    totals[group as ValidatedMuscleGroup] = (muscles as readonly Muscle[]).reduce(
      (sum, muscle) => sum + (weeklySetsByMuscle[muscle] ?? 0),
      0,
    );
  }
  return totals;
}

/** Grupos musculares cujo volume semanal ficou fora da faixa do nível. */
export function findVolumeOutliers(
  plan: GeneratedPlan,
): { muscle: ValidatedMuscleGroup; sets: number; status: "low" | "high" }[] {
  const range = WEEKLY_SET_RANGE[plan.input.level];
  const byGroup = sumWeeklySetsByGroup(plan.weeklySetsByMuscle);

  const outliers: { muscle: ValidatedMuscleGroup; sets: number; status: "low" | "high" }[] = [];
  for (const [group, sets] of Object.entries(byGroup)) {
    // Um grupo sem nenhuma vaga não é "volume baixo": é ausência deliberada
    // naquela divisão (ex.: pernas num treino de superiores).
    if (sets === 0) continue;
    if (sets < range.min)
      outliers.push({ muscle: group as ValidatedMuscleGroup, sets, status: "low" });
    else if (sets > range.max)
      outliers.push({ muscle: group as ValidatedMuscleGroup, sets, status: "high" });
  }

  return outliers;
}

function countOccurrence(
  blueprints: readonly { name: string }[],
  target: { name: string },
  index: number,
): number {
  return blueprints.slice(0, index + 1).filter((b) => b.name === target.name).length;
}

/** Reexportado por conveniência para quem consome só o gerador. */
export { MUSCLES };
