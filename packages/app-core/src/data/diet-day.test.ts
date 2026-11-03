import { describe, expect, it } from "vitest";
import type { MealSlot } from "@forja/domain";
import { entryCandidate, visibleSlots, type DayEntry } from "./diet-day";

const ORDEM: MealSlot[] = [
  "breakfast",
  "morning_snack",
  "lunch",
  "afternoon_snack",
  "pre_workout",
  "post_workout",
  "dinner",
  "supper",
];

describe("visibleSlots", () => {
  it("plano e itens à mão, na ordem do dia", () => {
    expect(visibleSlots(ORDEM, ["dinner", "breakfast"], ["supper"], 0)).toEqual([
      "breakfast",
      "dinner",
      "supper",
    ]);
  });

  it("completa até as refeições por dia, na ordem de prioridade", () => {
    expect(visibleSlots(ORDEM, ["lunch"], [], 4)).toEqual([
      "breakfast",
      "lunch",
      "afternoon_snack",
      "dinner",
    ]);
  });

  it("nada planejado nem lançado: o dia inteiro", () => {
    expect(visibleSlots(ORDEM, [], [], 0)).toEqual(ORDEM);
  });
});

describe("entryCandidate", () => {
  it("converte a porção do banco para 100 g", () => {
    const e = {
      foodId: "f",
      name: "Arroz",
      food: {
        servingSizeG: 50,
        kcal: 65,
        proteinG: 1,
        carbsG: 14,
        fatG: 0,
        fiberG: 0.5,
        category: null,
      },
    } as unknown as DayEntry;
    const c = entryCandidate(e);
    expect(c.kcal).toBeCloseTo(130);
    expect(c.proteinG).toBeCloseTo(2);
    expect(c.carbsG).toBeCloseTo(28);
    expect(c.category).toBe("other");
  });
});
