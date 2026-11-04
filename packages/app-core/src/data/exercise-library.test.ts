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
      idioma: "pt",
    });
    const reserva = exerciseSteps({ execution: [], execution_en: ["Lie down"] });
    expect(reserva).toEqual({ passos: ["Lie down"], idioma: "en" });
    expect(idiomaDiferente(reserva.idioma)).toBe("em inglês");
    expect(idiomaDiferente("pt")).toBeNull();
  });

  it("sem passos, divide o texto corrido original em passos", () => {
    expect(
      exerciseSteps({
        execution: null,
        instructions:
          " Lie back on a bench. Lift 2.5 kg (a light load). Tip: Go slow. (Note: see the stance section). Repeat. ",
      }),
    ).toEqual({
      passos: [
        "Lie back on a bench.",
        "Lift 2.5 kg (a light load).",
        "Tip: Go slow.",
        "(Note: see the stance section).",
        "Repeat.",
      ],
      idioma: "en",
    });
    expect(exerciseSteps({})).toEqual({ passos: [], idioma: null });
  });

  it("passo com quebras de linha vira vários passos", () => {
    expect(exerciseSteps({ execution: ["Deite.\nSegure a barra.", "  "] }).passos).toEqual([
      "Deite.",
      "Segure a barra.",
    ]);
  });
});
