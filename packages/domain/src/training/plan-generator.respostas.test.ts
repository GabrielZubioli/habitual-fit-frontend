import { describe, expect, it } from "vitest";
import {
  INJURY_RESTRICTIONS,
  allowedEquipment,
  exerciseFitsInjuries,
  exerciseFitsLevel,
  exerciseIsSelectable,
  generatePlan,
  type GeneratedPlan,
  type PlanInput,
} from "./plan-generator";
import type { Muscle } from "./volume";

/**
 * O plano reflete as respostas do questionário: foco, lesões, nível,
 * equipamento e dias — cada um mudando o plano, não só o nome dele.
 */

const BASE: PlanInput = {
  level: "intermediate",
  goal: "hypertrophy",
  equipment: "full_gym",
  daysPerWeek: 3,
};

const INFERIORES = new Set<Muscle>([
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "adductors",
  "abductors",
]);
const SUPERIORES = new Set<Muscle>([
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
]);

/** Grupos musculares de cada metade do corpo, para comparar volume por grupo. */
const GRUPOS_INFERIORES: Muscle[][] = [["quads"], ["hamstrings"], ["glutes"], ["calves"]];
const GRUPOS_SUPERIORES: Muscle[][] = [
  ["chest"],
  ["back", "lats", "traps"],
  ["shoulders", "front_delts", "side_delts", "rear_delts"],
  ["biceps"],
  ["triceps"],
];

/**
 * Volume por região. A comparação justa é a **média por grupo**: o tronco tem
 * mais grupos musculares, então a soma bruta favorece os superiores mesmo
 * quando cada grupo de pernas recebe mais séries.
 */
function seriesPorRegiao(plan: GeneratedPlan) {
  const doGrupo = (g: Muscle[]) => g.reduce((n, m) => n + (plan.weeklySetsByMuscle[m] ?? 0), 0);
  const media = (gs: Muscle[][]) => gs.reduce((n, g) => n + doGrupo(g), 0) / gs.length;
  let inferiores = 0;
  let superiores = 0;
  for (const [muscle, sets] of Object.entries(plan.weeklySetsByMuscle)) {
    if (INFERIORES.has(muscle as Muscle)) inferiores += sets ?? 0;
    if (SUPERIORES.has(muscle as Muscle)) superiores += sets ?? 0;
  }
  const mediaInferiores = media(GRUPOS_INFERIORES);
  const mediaSuperiores = media(GRUPOS_SUPERIORES);
  return {
    inferiores,
    superiores,
    mediaInferiores,
    mediaSuperiores,
    fracaoInferiores: mediaInferiores / (mediaInferiores + mediaSuperiores),
  };
}

const vagas = (plan: GeneratedPlan) => plan.splits.flatMap((s) => s.slots);

describe("foco muscular", () => {
  it("1. foco em membros inferiores: mais sessões e mais volume de pernas", () => {
    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      for (const days of [2, 3, 4, 5, 6] as const) {
        const base = { ...BASE, level, daysPerWeek: days };
        const equilibrado = seriesPorRegiao(generatePlan(base));
        const pernas = seriesPorRegiao(generatePlan({ ...base, focus: "legs" }));
        expect(pernas.fracaoInferiores).toBeGreaterThan(equilibrado.fracaoInferiores);
        expect(pernas.mediaInferiores).toBeGreaterThan(pernas.mediaSuperiores);
      }
    }
    // Em 3 dias, duas das três sessões são de inferiores.
    const nomes = generatePlan({ ...BASE, focus: "legs" }).splits.map((s) => s.name);
    expect(nomes.filter((n) => n.startsWith("Inferiores"))).toHaveLength(2);
  });

  it("2. foco em membros superiores: o tronco ganha volume em relação ao equilibrado", () => {
    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      for (const days of [2, 3, 4, 5, 6] as const) {
        const base = { ...BASE, level, daysPerWeek: days };
        const equilibrado = seriesPorRegiao(generatePlan(base));
        const tronco = seriesPorRegiao(generatePlan({ ...base, focus: "upper" }));
        expect(tronco.fracaoInferiores).toBeLessThan(equilibrado.fracaoInferiores);
        expect(tronco.mediaSuperiores).toBeGreaterThan(tronco.mediaInferiores);
      }
    }
  });

  it("3. equilibrado não dá volume extra a nenhum grupo e treina o corpo todo", () => {
    const plan = generatePlan({ ...BASE, daysPerWeek: 4 });
    const pernas = generatePlan({ ...BASE, daysPerWeek: 4, focus: "legs" });
    expect(plan.weeklySetsByMuscle.quads!).toBeLessThan(pernas.weeklySetsByMuscle.quads!);
    for (const m of ["chest", "lats", "quads", "hamstrings", "shoulders"] as const) {
      expect(plan.weeklySetsByMuscle[m] ?? 0).toBeGreaterThan(0);
    }
    const { fracaoInferiores } = seriesPorRegiao(plan);
    expect(fracaoInferiores).toBeGreaterThan(0.3);
    expect(fracaoInferiores).toBeLessThan(0.6);
  });

  it("foco num grupo específico acrescenta vagas desse grupo", () => {
    const equilibrado = vagas(generatePlan({ ...BASE, daysPerWeek: 4 }));
    const bracos = vagas(generatePlan({ ...BASE, daysPerWeek: 4, focus: "arms" }));
    const contaBracos = (v: typeof equilibrado) =>
      v.filter((s) => ["biceps", "triceps", "forearms"].includes(s.primaryMuscle)).length;
    expect(contaBracos(bracos)).toBeGreaterThan(contaBracos(equilibrado));
  });
});

describe("4. lesões e limitações", () => {
  it("joelho: nenhuma vaga de agachamento, afundo ou quadríceps", () => {
    const plan = generatePlan({ ...BASE, daysPerWeek: 4, injuries: ["knee"] });
    for (const slot of vagas(plan)) {
      expect(INJURY_RESTRICTIONS.knee.patterns).not.toContain(slot.pattern);
      expect(INJURY_RESTRICTIONS.knee.muscles).not.toContain(slot.primaryMuscle);
    }
    expect(plan.removedForInjury).toBeGreaterThan(0);
    expect(plan.blockedSplits).toEqual([]);
  });

  it("ombro: nenhum empurrão nem vaga de deltoide/peito", () => {
    const plan = generatePlan({ ...BASE, injuries: ["shoulder"], focus: "upper" });
    for (const slot of vagas(plan)) {
      expect(["vertical_push", "horizontal_push"]).not.toContain(slot.pattern);
      expect(["shoulders", "front_delts", "side_delts", "rear_delts", "chest"]).not.toContain(
        slot.primaryMuscle,
      );
    }
  });

  it("não depende do nome: o padrão e o músculo do exercício bastam para excluí-lo", () => {
    const legPress = {
      primaryMuscle: "quads",
      pattern: "squat",
      contraindications: null,
    };
    expect(exerciseFitsInjuries(legPress, ["knee"])).toBe(false);
    // Contraindicação declarada no catálogo também exclui.
    expect(
      exerciseFitsInjuries(
        { primaryMuscle: "lats", pattern: "vertical_pull", contraindications: ["shoulder"] },
        ["shoulder"],
      ),
    ).toBe(false);
    // Mesa flexora com dor lombar: isolado de posterior, sem padrão restrito — fica.
    expect(
      exerciseFitsInjuries(
        { primaryMuscle: "hamstrings", pattern: "isolation", contraindications: null },
        ["lower_back"],
      ),
    ).toBe(true);
  });

  it("sem padrão de movimento conhecido, o exercício não é presumido seguro", () => {
    expect(
      exerciseFitsInjuries({ primaryMuscle: "lats", pattern: null, contraindications: null }, [
        "elbow",
      ]),
    ).toBe(false);
    // Sem lesão nenhuma, a falta de metadado não bloqueia.
    expect(
      exerciseFitsInjuries({ primaryMuscle: "lats", pattern: null, contraindications: null }, []),
    ).toBe(true);
  });

  it("lesões que inviabilizam uma sessão são apontadas em vez de gerar um dia incoerente", () => {
    const plan = generatePlan({
      ...BASE,
      daysPerWeek: 4,
      injuries: ["knee", "hip", "lower_back", "ankle"],
    });
    expect(plan.blockedSplits.length).toBeGreaterThan(0);
  });
});

describe("5. nível de experiência", () => {
  it("iniciante em 3 dias treina corpo inteiro, não divisões avançadas", () => {
    const plan = generatePlan({ ...BASE, level: "beginner" });
    expect(plan.splits.map((s) => s.name)).toEqual([
      "Corpo inteiro A",
      "Corpo inteiro B",
      "Corpo inteiro C",
    ]);
  });

  it("iniciante tem no máximo 6 exercícios por sessão, mesmo com tempo de sobra", () => {
    const plan = generatePlan({ ...BASE, level: "beginner", duration: "long", daysPerWeek: 4 });
    for (const split of plan.splits) expect(split.slots.length).toBeLessThanOrEqual(6);
    const avancado = generatePlan({ ...BASE, level: "advanced", duration: "long", daysPerWeek: 4 });
    expect(avancado.splits[0]!.slots.length).toBeGreaterThan(6);
  });

  it("iniciante não recebe exercício classificado como avançado", () => {
    expect(exerciseFitsLevel("beginner", "advanced")).toBe(false);
    expect(exerciseFitsLevel("beginner", "beginner")).toBe(true);
    expect(exerciseFitsLevel("advanced", "advanced")).toBe(true);
  });

  it("iniciante tem menos volume semanal que intermediário", () => {
    const total = (p: GeneratedPlan) => vagas(p).reduce((n, s) => n + s.sets, 0);
    expect(total(generatePlan({ ...BASE, level: "beginner" }))).toBeLessThan(
      total(generatePlan(BASE)),
    );
  });
});

describe("6. equipamento disponível", () => {
  it("só os equipamentos marcados (e o peso do corpo) entram", () => {
    expect(allowedEquipment("home_basic", ["dumbbell"])).toEqual(["dumbbell", "bodyweight"]);
    // Marcar algo que o ambiente não oferece não amplia o ambiente.
    expect(allowedEquipment("bodyweight", ["barbell"])).toEqual(["bodyweight", "band"]);
  });

  it("exercício que depende de equipamento indisponível nunca é selecionável", () => {
    const regras = {
      equipment: allowedEquipment("home_basic", ["dumbbell"]),
      level: "intermediate" as const,
      injuries: [],
    };
    const supinoBarra = {
      primaryMuscle: "chest",
      pattern: "horizontal_push",
      equipment: "barbell",
      level: "intermediate",
      contraindications: null,
    };
    expect(exerciseIsSelectable(supinoBarra, regras)).toBe(false);
    expect(exerciseIsSelectable({ ...supinoBarra, equipment: "dumbbell" }, regras)).toBe(true);
  });
});

describe("7. dias disponíveis", () => {
  it("exatamente uma sessão por dia, em toda combinação de foco e nível", () => {
    for (const days of [2, 3, 4, 5, 6] as const) {
      for (const focus of ["full_body", "legs", "upper", "arms", "abs"] as const) {
        for (const level of ["beginner", "intermediate", "advanced"] as const) {
          const plan = generatePlan({ ...BASE, daysPerWeek: days, focus, level });
          expect(plan.splits).toHaveLength(days);
          for (const split of plan.splits) expect(split.slots.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("poucos dias: 2 sessões de corpo inteiro, sem duplicar a mesma ficha", () => {
    const plan = generatePlan({ ...BASE, daysPerWeek: 2 });
    expect(plan.splits.map((s) => s.name)).toEqual(["Corpo inteiro A", "Corpo inteiro B"]);
  });
});

describe("8. respostas combinadas", () => {
  it("iniciante, foco em pernas, joelho lesionado, em casa com halteres", () => {
    const plan = generatePlan({
      level: "beginner",
      goal: "hypertrophy",
      equipment: "home_basic",
      daysPerWeek: 3,
      focus: "legs",
      injuries: ["knee"],
    });
    expect(plan.splits).toHaveLength(3);
    expect(plan.blockedSplits).toEqual([]);
    for (const split of plan.splits) expect(split.slots.length).toBeLessThanOrEqual(6);
    for (const slot of vagas(plan)) {
      expect(["squat", "lunge"]).not.toContain(slot.pattern);
      expect(slot.primaryMuscle).not.toBe("quads");
    }
    // O foco continua valendo com o que sobrou: posteriores, glúteos e panturrilha.
    expect(seriesPorRegiao(plan).inferiores).toBeGreaterThan(0);
  });
});
