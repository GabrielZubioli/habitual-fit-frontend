/**
 * Rotinas de treino — materializa o plano gerado em templates reais.
 *
 * O gerador em `@forja/domain` devolve *vagas* (`ExerciseSlot`): "um empurrão
 * horizontal de peito, 4×8-12, 120s". Aqui casamos cada vaga com um exercício
 * concreto do catálogo, respeitando o equipamento disponível, e gravamos a
 * rotina + os templates A/B/C.
 *
 * A separação existe porque o catálogo é dado (varia por usuário, cresce com o
 * tempo) enquanto as regras de programação são lógica pura e testável.
 */
import { supabase } from "@/integrations/supabase/client";
import { assertOk, num, unwrap, unwrapList, unwrapMaybe } from "@/data/supabase-helpers";
import { loadPlanningInputs, trainingPlanInput } from "@/data/planning-profile";
import { localDayRange, toISODate } from "@/lib/date";
import { suggestWeekdays } from "@/lib/onboarding/options";
import {
  allowedEquipment,
  exerciseIsSelectable,
  generatePlan,
  type ExerciseSlot,
  type GeneratedPlan,
  type MovementPattern,
  type PlanInput,
  type ScheduleInput,
} from "@forja/domain";

/**
 * O catálogo agora **declara** o padrão de movimento (coluna
 * `movement_pattern`), preenchida na importação.
 *
 * Antes, isto era adivinhado por palavra-chave no nome a cada geração de plano
 * — uma heurística tolerável para 68 exercícios e insustentável para 880:
 * "Remada Alta" contém "remada" e é empurrão vertical de ombro, não puxada
 * horizontal. Resolver uma vez, na importação, com mais informação disponível,
 * é mais barato e mais correto que resolver mal a cada execução.
 *
 * O mapa por palavra-chave permanece só como rede de segurança para exercícios
 * criados pelo usuário, que nascem sem padrão declarado.
 */
const PATTERN_KEYWORDS: Record<MovementPattern, string[]> = {
  horizontal_push: ["supino", "crucifixo", "flexão", "flexao", "peck", "crossover", "mergulho"],
  vertical_push: ["desenvolvimento", "militar", "remada alta"],
  horizontal_pull: ["remada", "serrote", "face pull", "encolhimento"],
  vertical_pull: ["puxada", "barra fixa", "pulldown", "pull-up", "pullover"],
  squat: ["agachamento", "leg press", "cadeira extensora", "hack"],
  hinge: [
    "terra",
    "stiff",
    "levantamento",
    "good morning",
    "bom dia",
    "hip thrust",
    "elevação pélvica",
  ],
  lunge: ["afundo", "avanço", "avanco", "passada", "búlgaro", "bulgaro", "subida no banco"],
  isolation: [
    "rosca",
    "tríceps",
    "triceps",
    "elevação",
    "elevacao",
    "panturrilha",
    "flexora",
    "extensora",
  ],
  core: ["abdominal", "prancha", "abdômen", "abdomen", "elevação de pernas", "russian"],
  cardio: ["esteira", "bicicleta", "corrida", "remo", "elíptico", "eliptico"],
};

type CatalogExercise = {
  id: string;
  name: string;
  primary_muscle: string;
  equipment: string;
  category: string;
  movement_pattern: string | null;
  level: string | null;
  mechanic: string | null;
  contraindications: string[] | null;
  popularity: number | null;
};

export type RoutineDraft = {
  plan: GeneratedPlan;
  splits: {
    letter: string;
    name: string;
    items: { slot: ExerciseSlot; exercise: CatalogExercise }[];
    /** Vagas que o catálogo não conseguiu preencher. */
    unmatched: ExerciseSlot[];
  }[];
};

export interface RoutineDraftOptions {
  /** Equipamentos que o usuário marcou ter, quando mais restritos que o perfil. */
  equipmentAvailable?: readonly string[];
}

/**
 * Gera o plano e resolve cada vaga num exercício real, **sem gravar nada**.
 *
 * Separar o preview da gravação permite mostrar a ficha ao usuário antes de
 * criar seis templates no banco.
 */
export async function buildRoutineDraft(
  input: PlanInput,
  options: RoutineDraftOptions = {},
): Promise<RoutineDraft> {
  const plan = generatePlan(input);
  const config = plan.input;

  // Lesões que deixam uma sessão sem treino possível: explicar, não improvisar.
  if (plan.blockedSplits.length > 0) throw new PlanLimitationError();

  // A regra única de seleção (domínio): equipamento disponível, nível e lesões.
  // Uma vaga sem candidato fica vazia e é avisada — nunca cai para o catálogo
  // inteiro, o que traria aparelho que a pessoa não tem ou exercício que
  // carrega a região lesionada.
  const permitidos = allowedEquipment(config.equipment, options.equipmentAvailable ?? []);
  const usavel = (await fetchCatalog()).filter((e) =>
    exerciseIsSelectable(
      {
        primaryMuscle: e.primary_muscle,
        pattern: e.movement_pattern,
        equipment: e.equipment,
        level: e.level,
        contraindications: e.contraindications,
      },
      { equipment: permitidos, level: config.level, injuries: config.injuries },
    ),
  );

  const usados = new Set<string>();

  const splits = plan.splits.map((split) => {
    const items: { slot: ExerciseSlot; exercise: CatalogExercise }[] = [];
    const unmatched: ExerciseSlot[] = [];

    for (const slot of split.slots) {
      const naSessao = new Set(items.map((i) => i.exercise.id));
      const escolhido = pickExercise(usavel, slot, permitidos, usados, naSessao, config.level);
      if (escolhido) {
        // Evita repetir o mesmo exercício dentro da rotina — duas vagas de peito
        // devem virar dois movimentos diferentes.
        usados.add(escolhido.id);
        items.push({ slot, exercise: escolhido });
      } else {
        unmatched.push(slot);
      }
    }

    return { letter: split.letter, name: split.name, items, unmatched };
  });

  return { plan, splits };
}

/**
 * As lesões informadas impedem montar uma semana coerente com os dias
 * escolhidos. A mensagem é para a pessoa.
 */
export class PlanLimitationError extends Error {
  constructor() {
    super(
      "Com as lesões ou dores que você informou, não conseguimos montar um treino automático coerente. Procure um profissional de saúde e de educação física para montar um plano adequado — você pode criar suas rotinas manualmente na tela Plano.",
    );
    this.name = "PlanLimitationError";
  }
}

/** O catálogo de força (sem cardio nem alongamento), do mais ao menos conhecido. */
async function fetchCatalog(): Promise<CatalogExercise[]> {
  return unwrapList(
    "carregar catálogo de exercícios",
    await supabase
      .from("exercises")
      .select(
        "id, name, primary_muscle, equipment, category, movement_pattern, level, mechanic, contraindications, popularity",
      )
      .is("deleted_at", null)
      .neq("category", "cardio")
      // Alongamento e mobilidade existem no catálogo para consulta, não para
      // ocupar vaga de exercício de força num plano de hipertrofia.
      .neq("category", "stretching")
      .order("popularity", { ascending: false })
      .limit(900),
  ) as CatalogExercise[];
}

/** Ordem de exigência técnica, para comparar o nível do exercício com o do usuário. */
const LEVEL_RANK: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/**
 * Escolhe o melhor exercício para a vaga.
 *
 * Pontuação, do mais para o menos relevante: músculo exato > padrão de
 * movimento declarado > equipamento preferido > adequação ao nível >
 * popularidade > ainda não usado.
 *
 * A popularidade entra por último e vale pouco, mas é o que impede o gerador
 * de, entre 880 exercícios, prescrever "Remada Cavalinho com Alça Landmine" a
 * um iniciante quando existe "Remada Curvada com Barra". Entre dois exercícios
 * igualmente adequados, o conhecido é sempre a escolha melhor: o usuário sabe
 * executá-lo e vai encontrá-lo na academia.
 */
function pickExercise(
  catalog: readonly CatalogExercise[],
  slot: ExerciseSlot,
  equipmentPreference: readonly string[],
  usados: ReadonlySet<string>,
  /** Já está nesta sessão: nunca o mesmo exercício duas vezes no mesmo dia. */
  naSessao: ReadonlySet<string>,
  userLevel: string,
): CatalogExercise | null {
  const keywords = PATTERN_KEYWORDS[slot.pattern] ?? [];
  const nivelUsuario = LEVEL_RANK[userLevel] ?? 1;

  const candidatos = catalog
    .map((exercise) => {
      let score = 0;

      if (exercise.primary_muscle === slot.primaryMuscle) score += 100;
      else if (sameRegion(exercise.primary_muscle, slot.primaryMuscle)) score += 40;
      else return null; // músculo sem relação: descarta

      if (naSessao.has(exercise.id)) return null;

      // Padrão declarado no catálogo: se diz outro movimento, não serve para a
      // vaga (um "empurrão" não preenche um isolado de glúteo, mesmo com o
      // músculo certo). O casamento por nome é a rede de segurança para
      // exercícios criados pelo usuário, que nascem sem padrão.
      if (exercise.movement_pattern === slot.pattern) score += 60;
      else if (exercise.movement_pattern) return null;
      else if (keywords.some((k) => exercise.name.toLowerCase().includes(k))) score += 50;

      // Equipamento mais alto na ordem de preferência vale mais.
      const posicao = equipmentPreference.indexOf(exercise.equipment);
      if (posicao >= 0) score += Math.max(0, 20 - posicao * 2);

      // Compostos preferem barra/halter; isolamentos, máquina/polia.
      if (
        slot.priority === 1 &&
        (exercise.equipment === "barbell" || exercise.equipment === "dumbbell")
      ) {
        score += 15;
      }
      if (
        slot.pattern === "isolation" &&
        (exercise.equipment === "cable" || exercise.equipment === "machine")
      ) {
        score += 10;
      }
      if (slot.priority === 1 && exercise.mechanic === "compound") score += 12;

      // Exercício mais exigente que o usuário é penalizado com força; mais
      // simples, só levemente — um iniciante fazendo um movimento básico está
      // certo, um iniciante fazendo arranco não.
      const nivelExercicio = LEVEL_RANK[exercise.level ?? "intermediate"] ?? 1;
      const diferenca = nivelExercicio - nivelUsuario;
      score += diferenca > 0 ? -35 * diferenca : 5 * diferenca;

      score += (exercise.popularity ?? 50) * 0.25;

      if (usados.has(exercise.id)) score -= 200;

      return { exercise, score };
    })
    .filter((c): c is { exercise: CatalogExercise; score: number } => c !== null)
    .sort((a, b) => b.score - a.score);

  const melhor = candidatos[0];
  // Score negativo significa que só sobraram exercícios já usados.
  return melhor && melhor.score > 0 ? melhor.exercise : (candidatos[0]?.exercise ?? null);
}

/** Músculos da mesma região, usados como segunda opção quando não há exato. */
const REGIONS: Record<string, string[]> = {
  chest: ["chest"],
  back: ["back", "lats", "traps"],
  lats: ["lats", "back"],
  traps: ["traps", "back"],
  shoulders: ["shoulders", "front_delts", "side_delts", "rear_delts"],
  front_delts: ["front_delts", "shoulders"],
  side_delts: ["side_delts", "shoulders"],
  rear_delts: ["rear_delts", "shoulders", "back"],
  biceps: ["biceps", "forearms"],
  triceps: ["triceps"],
  forearms: ["forearms", "biceps"],
  quads: ["quads", "glutes"],
  hamstrings: ["hamstrings", "glutes"],
  glutes: ["glutes", "hamstrings", "quads"],
  calves: ["calves"],
  core: ["core", "abs", "obliques"],
  abs: ["abs", "core"],
  obliques: ["obliques", "core"],
};

function sameRegion(exerciseMuscle: string, slotMuscle: string): boolean {
  return (REGIONS[slotMuscle] ?? []).includes(exerciseMuscle);
}

/**
 * Grava a rotina: cria o registro, desativa a anterior e materializa um
 * template por divisão com seus exercícios.
 */
export async function createRoutine(
  userId: string,
  input: PlanInput,
  draft: RoutineDraft,
  name: string,
  trainingWeekdays: readonly number[],
): Promise<string> {
  // Só uma rotina ativa por vez (há índice único garantindo isso no banco).
  assertOk(
    "arquivar rotina anterior",
    await supabase
      .from("workout_routines")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true),
  );

  const routine = unwrap(
    "criar rotina",
    await supabase
      .from("workout_routines")
      .insert({
        user_id: userId,
        name,
        level: input.level,
        goal: input.goal,
        equipment: input.equipment,
        days_per_week: input.daysPerWeek,
        training_weekdays: [...trainingWeekdays].sort((a, b) => a - b),
        current_index: 0,
        schedule_mode: "fixed",
        is_active: true,
      })
      .select("id")
      .single(),
  );

  // Um template por divisão. Falha em qualquer ponto desfaz a rotina inteira,
  // para não deixar o usuário com meia ficha.
  // Semana fixa: os dias de treino vão para as divisões em sequência
  // (A no 1º dia, B no 2º, … e de novo A).
  const dias = [...trainingWeekdays].sort((a, b) => a - b);
  try {
    for (const [index, split] of draft.splits.entries()) {
      const template = unwrap(
        "criar template da divisão",
        await supabase
          .from("workout_templates")
          .insert({
            user_id: userId,
            name: `${split.letter} — ${split.name}`,
            routine_id: routine.id,
            routine_order: index,
            routine_letter: split.letter,
            weekdays: dias.filter((_, k) => k % draft.splits.length === index),
          })
          .select("id")
          .single(),
      );

      if (split.items.length === 0) continue;

      assertOk(
        "adicionar exercícios ao template",
        await supabase.from("workout_template_exercises").insert(
          split.items.map((item, position) => ({
            template_id: template.id,
            exercise_id: item.exercise.id,
            position: position + 1,
            target_sets: item.slot.sets,
            // `target_reps` guarda o piso da faixa (compatível com o que já
            // existia); a faixa completa vai nas colunas novas.
            target_reps: item.slot.repMin,
            target_rep_min: item.slot.repMin,
            target_rep_max: item.slot.repMax,
            rest_seconds: item.slot.restSeconds,
          })),
        ),
      );
    }
  } catch (error) {
    await supabase.from("workout_routines").delete().eq("id", routine.id);
    throw error;
  }

  return routine.id;
}

export type ActiveRoutine = {
  id: string;
  name: string;
  level: string;
  goal: string;
  daysPerWeek: number;
  currentIndex: number;
  /** Dias planejados para treinar (0=domingo … 6=sábado). */
  trainingWeekdays: number[];
  /** Rotação A → B → C, ou semana fixa (cada divisão no seu dia). */
  scheduleMode: "rotation" | "fixed";
  templates: {
    id: string;
    name: string;
    letter: string | null;
    /** Ícone escolhido (chave de `ROUTINE_ICONS`); null = palpite pelo nome. */
    icon: string | null;
    order: number;
    exerciseCount: number;
    /** Dias da divisão na semana fixa. */
    weekdays: number[];
  }[];
};

/**
 * Entrada da agenda a partir da rotina — a mesma regra para a Início, o Plano
 * e o botão Treinar. Na semana fixa, cada dia recebe os índices das divisões
 * marcadas para ele.
 */
export function scheduleInputOf(routine: {
  trainingWeekdays: number[];
  currentIndex: number;
  scheduleMode: "rotation" | "fixed";
  templates: readonly { weekdays: number[] }[];
}): ScheduleInput {
  const splitCount = Math.max(1, routine.templates.length);
  if (routine.scheduleMode === "fixed") {
    const fixed = Array.from({ length: 7 }, (_, dia) =>
      routine.templates.flatMap((t, i) => (t.weekdays.includes(dia) ? [i] : [])),
    );
    return { weekdays: [], splitCount, currentIndex: routine.currentIndex, fixed };
  }
  return {
    weekdays: routine.trainingWeekdays.length ? routine.trainingWeekdays : [1, 3, 5],
    splitCount,
    currentIndex: routine.currentIndex,
  };
}

/** Troca entre rotação e semana fixa. */
export async function setScheduleMode(routineId: string, mode: "rotation" | "fixed") {
  assertOk(
    "mudar o modo da agenda",
    await supabase.from("workout_routines").update({ schedule_mode: mode }).eq("id", routineId),
  );
}

/** Dias da semana de uma divisão (semana fixa). */
export async function setTemplateWeekdays(templateId: string, weekdays: number[]) {
  assertOk(
    "salvar os dias da rotina",
    await supabase
      .from("workout_templates")
      .update({ weekdays: [...new Set(weekdays)].sort() })
      .eq("id", templateId),
  );
}

/**
 * Exclui uma rotina do plano. Exclusão lógica: os treinos já feitos com ela
 * continuam no histórico. Solta a letra e os dias para uma rotina nova poder
 * usá-los.
 */
export async function deleteTemplate(templateId: string) {
  assertOk(
    "excluir a rotina",
    await supabase
      .from("workout_templates")
      .update({ deleted_at: new Date().toISOString(), routine_letter: null, weekdays: [] })
      .eq("id", templateId),
  );
}

/** Nome exibido de uma divisão, sem o prefixo "A — ". */
export function splitDisplayName(name: string): string {
  return name.replace(/^[A-Z]\s*—\s*/, "");
}

/** Renomeia uma divisão, mantendo a letra na frente (é ela que ordena a rotação). */
export async function renameTemplate(templateId: string, letter: string | null, name: string) {
  const limpo = name.trim();
  if (!limpo) throw new Error("Dê um nome à rotina.");
  assertOk(
    "renomear a rotina",
    await supabase
      .from("workout_templates")
      .update({ name: letter ? `${letter} — ${limpo}` : limpo })
      .eq("id", templateId),
  );
}

/** Ícone da rotina (chave de `ROUTINE_ICONS`). */
export async function setTemplateIcon(templateId: string, icon: string) {
  assertOk(
    "trocar o ícone da rotina",
    await supabase.from("workout_templates").update({ icon }).eq("id", templateId),
  );
}

/** Renomeia o plano (a rotina ativa como um todo). */
export async function renameRoutine(routineId: string, name: string) {
  const limpo = name.trim();
  if (!limpo) throw new Error("Dê um nome ao plano.");
  assertOk(
    "renomear o plano",
    await supabase.from("workout_routines").update({ name: limpo }).eq("id", routineId),
  );
}

/**
 * Cria uma divisão vazia no fim do plano, com a próxima letra.
 *
 * `routine_order` = quantidade atual: as ordens existentes são 0..n−1, e o
 * índice da divisão na agenda é a posição nessa ordem.
 */
export async function createTemplate(
  userId: string,
  routineId: string,
  existing: readonly { letter: string | null }[],
  name: string,
): Promise<string> {
  const limpo = name.trim();
  if (!limpo) throw new Error("Dê um nome à rotina.");
  const usadas = new Set(existing.map((t) => t.letter));
  const letter = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((l) => !usadas.has(l)) ?? null;
  return unwrap(
    "criar a rotina",
    await supabase
      .from("workout_templates")
      .insert({
        user_id: userId,
        routine_id: routineId,
        name: letter ? `${letter} — ${limpo}` : limpo,
        routine_letter: letter,
        routine_order: existing.length,
      })
      .select("id")
      .single(),
  ).id;
}

/** Dias de treino da rotação. */
export async function setTrainingWeekdays(routineId: string, weekdays: number[]) {
  assertOk(
    "salvar os dias de treino",
    await supabase
      .from("workout_routines")
      .update({ training_weekdays: [...new Set(weekdays)].sort() })
      .eq("id", routineId),
  );
}

/** Rotina ativa do usuário, com os templates na ordem da divisão. */
export async function fetchActiveRoutine(): Promise<ActiveRoutine | null> {
  const routine = unwrapMaybe(
    "carregar rotina ativa",
    await supabase
      .from("workout_routines")
      .select(
        "id, name, level, goal, days_per_week, current_index, training_weekdays, schedule_mode",
      )
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle(),
  );

  if (!routine) return null;

  const templates = unwrapList(
    "carregar divisões da rotina",
    await supabase
      .from("workout_templates")
      .select(
        "id, name, icon, routine_letter, routine_order, weekdays, workout_template_exercises(count)",
      )
      .eq("routine_id", routine.id)
      .is("deleted_at", null)
      .order("routine_order"),
  );

  return {
    id: routine.id,
    name: routine.name,
    level: routine.level,
    goal: routine.goal,
    daysPerWeek: routine.days_per_week,
    currentIndex: routine.current_index,
    trainingWeekdays: routine.training_weekdays ?? [],
    scheduleMode: routine.schedule_mode === "fixed" ? "fixed" : "rotation",
    templates: templates.map((t, i) => ({
      id: t.id,
      name: t.name,
      letter: t.routine_letter,
      icon: t.icon,
      order: t.routine_order ?? i,
      exerciseCount: t.workout_template_exercises?.[0]?.count ?? 0,
      weekdays: t.weekdays ?? [],
    })),
  };
}

/**
 * Ativa o plano de treino **sugerido** a partir das respostas do questionário.
 *
 * Só roda por escolha da pessoa — no fim do questionário ou em "Usar o plano
 * sugerido" na tela Plano —, nunca sozinho: um plano vazio pode ser
 * exatamente o que ela quer. A rotina anterior é arquivada, não apagada; os
 * treinos feitos com ela continuam no histórico.
 *
 * `draft`: o rascunho já mostrado na prévia, para salvar exatamente o que foi
 * aceito. Sem ele, monta de novo a partir das mesmas respostas.
 */
export async function saveSuggestedRoutine(
  userId: string,
  draft: RoutineDraft | null = null,
): Promise<string> {
  const { answers, objectiveLabel, weekdays } = await loadPlanningInputs(userId);
  const planInput = trainingPlanInput(answers);

  const rascunho =
    draft ?? (await buildRoutineDraft(planInput, { equipmentAvailable: answers.equipment }));

  const preenchidos = rascunho.splits.reduce((n, s) => n + s.items.length, 0);
  if (preenchidos === 0) {
    throw new Error(
      "O catálogo de exercícios está indisponível no momento. Tente novamente em instantes.",
    );
  }
  // Um dia de treino sem nenhum exercício não é plano: explica em vez de gravar.
  const vazia = rascunho.splits.find((s) => s.items.length === 0);
  if (vazia) {
    throw new Error(
      `Não encontramos exercícios compatíveis com seu equipamento e suas limitações para o treino "${vazia.name}". Monte essa rotina manualmente na tela Plano ou procure um profissional de educação física.`,
    );
  }

  // Uma sessão por dia escolhido. Um rascunho antigo com dias que não batem
  // com a frequência deixaria divisões sem dia (ou repetidas): nesse caso
  // valem os dias sugeridos para a frequência.
  const dias =
    weekdays.length === planInput.daysPerWeek ? weekdays : suggestWeekdays(planInput.daysPerWeek);

  return createRoutine(
    userId,
    planInput,
    rascunho,
    `${objectiveLabel} · ${planInput.daysPerWeek}× por semana`,
    dias,
  );
}

/**
 * "Começar sem um plano" na tela final do questionário: troca o plano sugerido
 * que acabou de ser criado por um em branco. O sugerido é descartado (exclusão
 * lógica, com as divisões) em vez de só arquivado — ninguém treinou com ele, e
 * assim não sobra um plano a mais. Devolve o id do plano em branco.
 */
export async function startWithoutPlan(
  userId: string,
  suggestedRoutineId: string | null,
): Promise<string> {
  const vazio = await createEmptyRoutine(userId);
  if (suggestedRoutineId && suggestedRoutineId !== vazio) {
    const agora = new Date().toISOString();
    assertOk(
      "descartar as divisões do plano sugerido",
      await supabase
        .from("workout_templates")
        .update({ deleted_at: agora })
        .eq("routine_id", suggestedRoutineId),
    );
    assertOk(
      "descartar o plano sugerido",
      await supabase
        .from("workout_routines")
        .update({ deleted_at: agora, is_active: false })
        .eq("id", suggestedRoutineId),
    );
  }
  return vazio;
}

/**
 * Plano próprio, do zero: uma rotina ativa **sem** divisões, dias ou
 * exercícios — a pessoa monta tudo. A anterior é arquivada, não apagada.
 */
export async function createEmptyRoutine(userId: string): Promise<string> {
  const { answers } = await loadPlanningInputs(userId);
  const planInput = trainingPlanInput(answers);
  return createRoutine(
    userId,
    planInput,
    { plan: generatePlan(planInput), splits: [] },
    "Meu plano",
    [],
  );
}

/**
 * Treinos concluídos num intervalo, agrupados por dia local.
 *
 * Alimenta a faixa da semana e o calendário. Só sessões **finalizadas**
 * (`ended_at` preenchido) contam: uma sessão aberta e abandonada não é treino.
 */
export async function fetchCompletedWorkouts(
  fromDate: string,
  toDate: string,
): Promise<CompletedWorkoutDay[]> {
  const intervalo = localDayRange(fromDate, toDate);
  const rows = unwrapList(
    "carregar treinos do período",
    await supabase
      .from("workout_sessions")
      .select("id, name, started_at, ended_at, total_volume_kg, duration_seconds, template_id")
      .is("deleted_at", null)
      .not("ended_at", "is", null)
      .gte("started_at", intervalo.start)
      .lt("started_at", intervalo.endExclusive)
      .order("started_at"),
  );

  // Mapeia template → posição na rotina, para saber qual letra foi treinada.
  const templateIds = [
    ...new Set(rows.map((r) => r.template_id).filter((id): id is string => !!id)),
  ];
  const orderByTemplate = new Map<string, number>();

  if (templateIds.length > 0) {
    const templates = unwrapList(
      "identificar divisões dos treinos",
      await supabase.from("workout_templates").select("id, routine_order").in("id", templateIds),
    );
    for (const t of templates) {
      if (t.routine_order !== null) orderByTemplate.set(t.id, t.routine_order);
    }
  }

  return rows.map((row) => {
    const splitIndex = row.template_id ? orderByTemplate.get(row.template_id) : undefined;
    return {
      sessionId: row.id,
      name: row.name,
      // `started_at` é timestamptz; o dia local é o que interessa para o calendário.
      date: toISODate(new Date(row.started_at)),
      volumeKg: num(row.total_volume_kg),
      durationSeconds: num(row.duration_seconds),
      ...(splitIndex !== undefined ? { splitIndex } : {}),
    };
  });
}

export type CompletedWorkoutDay = {
  sessionId: string;
  name: string;
  /** Chave `YYYY-MM-DD` local. */
  date: string;
  volumeKg: number;
  durationSeconds: number;
  /** Posição da divisão na rotina (0 = A), quando o treino veio de uma. */
  splitIndex?: number;
};

/**
 * Avança a sequência a partir do template que originou a sessão.
 *
 * A sessão guarda `template_id`; daí chegamos à rotina e ao total de divisões.
 * Se o template não pertencer a nenhuma rotina (template avulso), não há nada
 * a fazer.
 */
export async function advanceRoutineForTemplate(templateId: string): Promise<void> {
  const template = unwrapMaybe(
    "identificar rotina do template",
    await supabase
      .from("workout_templates")
      .select("routine_id")
      .eq("id", templateId)
      .maybeSingle(),
  );

  if (!template?.routine_id) return;

  const divisoes = unwrapList(
    "contar divisões da rotina",
    await supabase
      .from("workout_templates")
      .select("id")
      .eq("routine_id", template.routine_id)
      .is("deleted_at", null),
  );

  await advanceRoutine(template.routine_id, divisoes.length);
}

/**
 * Avança a rotina para a próxima divisão, circulando de volta ao início.
 *
 * Chamado ao **finalizar** um treino, não ao iniciar: quem abre a sessão e
 * desiste não deve pular a divisão.
 */
export async function advanceRoutine(routineId: string, totalSplits: number): Promise<void> {
  if (totalSplits <= 0) return;

  const routine = unwrap(
    "carregar rotina",
    await supabase.from("workout_routines").select("current_index").eq("id", routineId).single(),
  );

  assertOk(
    "avançar rotina",
    await supabase
      .from("workout_routines")
      .update({ current_index: (routine.current_index + 1) % totalSplits })
      .eq("id", routineId),
  );
}
