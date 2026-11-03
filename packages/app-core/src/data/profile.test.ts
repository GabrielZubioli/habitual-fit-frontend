import { describe, expect, it } from "vitest";
import { convertProfileField, parseNutritionTargets, validateProfileField } from "./profile";

describe("perfil", () => {
  it("valida e converte altura e meta de peso (vírgula vale)", () => {
    expect(validateProfileField("height_cm", "99")).not.toBeNull();
    expect(validateProfileField("height_cm", "175")).toBeNull();
    expect(validateProfileField("goal_weight_kg", "")).toBeNull();
    expect(convertProfileField("goal_weight_kg", "72,5")).toBe(72.5);
    expect(convertProfileField("display_name", "  ")).toBeNull();
  });

  it("metas: vazio é sem meta, fora da faixa vira erro", () => {
    const vazio = {
      daily_kcal_target: "",
      protein_g_target: "",
      carbs_g_target: "",
      fat_g_target: "",
      fiber_g_target: "",
    };
    expect(parseNutritionTargets(vazio)).toEqual({
      ok: true,
      patch: {
        daily_kcal_target: null,
        protein_g_target: null,
        carbs_g_target: null,
        fat_g_target: null,
        fiber_g_target: null,
      },
    });
    const r = parseNutritionTargets({
      ...vazio,
      daily_kcal_target: "100",
      protein_g_target: "150,4",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erros)).toEqual(["daily_kcal_target"]);
  });
});
