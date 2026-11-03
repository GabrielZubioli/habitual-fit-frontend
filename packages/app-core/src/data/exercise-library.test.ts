import { describe, expect, it } from "vitest";
import { exerciseName, exerciseSteps, idiomaDiferente } from "./exercise-library";

// O ambiente de teste roda em pt-BR (ver i18n/index.ts).
describe("nome e passo a passo no idioma do app", () => {
  it("em pt, o nome é o do banco", () => {
    expect(exerciseName({ name: "Supino Reto", name_en: "Bench Press", name_es: "Press" })).toBe(
      "Supino Reto",
    );
  });

  it("em pt, prefere o passo a passo em português e cai no inglês com selo", () => {
    expect(exerciseSteps({ execution: ["Deite"], execution_en: ["Lie"] })).toEqual({
      passos: ["Deite"],
      texto: null,
      idioma: "pt",
    });
    const reserva = exerciseSteps({ execution: [], execution_en: ["Lie down"] });
    expect(reserva).toEqual({ passos: ["Lie down"], texto: null, idioma: "en" });
    expect(idiomaDiferente(reserva.idioma)).toBe("em inglês");
    expect(idiomaDiferente("pt")).toBeNull();
  });

  it("sem passos, usa o texto corrido original", () => {
    expect(exerciseSteps({ execution: null, instructions: " Lie back. " })).toEqual({
      passos: [],
      texto: "Lie back.",
      idioma: "en",
    });
    expect(exerciseSteps({})).toEqual({ passos: [], texto: null, idioma: null });
  });
});
