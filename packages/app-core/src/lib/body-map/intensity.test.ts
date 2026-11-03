import { describe, expect, it } from "vitest";
import {
  aggregateMuscleIntensities,
  framedViewBox,
  intensityByGroup,
  pathBounds,
  suggestedView,
} from "./intensity";
import { MUSCLES_BY_VIEW, VIEW_BOX } from "./muscle-paths";

describe("pathBounds", () => {
  it("flags do arco coladas (`0 01-.19`) são dois dígitos, não o número 01", () => {
    expect(pathBounds("M10 10a.23.23 0 01-.19-.21L20 20")).toEqual({
      minX: 9.81,
      minY: 9.79,
      maxX: 20,
      maxY: 20,
    });
  });

  it("nenhum músculo do desenho dá caixa inválida", () => {
    for (const view of ["front", "back"] as const)
      for (const paths of Object.values(MUSCLES_BY_VIEW[view]))
        for (const d of paths) {
          const b = pathBounds(d);
          expect(b && Object.values(b).every(Number.isFinite)).toBe(true);
        }
  });

  it("absolutos, relativos, curvas e o Z voltando ao início", () => {
    // M10 20 → l30 0 (40,20) → q0 10 -10 20 (30,40) → Z → c dos pontos de controle
    expect(pathBounds("M10 20 l30 0 q0 10 -10 20 Z c-5 0 -5 5 0 5")).toEqual({
      minX: 5,
      minY: 20,
      maxX: 40,
      maxY: 40,
    });
  });
  it("pares depois de M viram linhas", () => {
    expect(pathBounds("M0 0 10 10 20 -5")).toEqual({ minX: 0, minY: -5, maxX: 20, maxY: 10 });
  });
  it("arco conta o ponto final", () => {
    expect(pathBounds("M0 0 A 5 5 0 0 1 10 0")).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 0 });
  });
});

describe("intensidades", () => {
  it("normaliza pelo máximo", () => {
    expect(
      aggregateMuscleIntensities([
        { muscle: "chest", contribution: 1 },
        { muscle: "chest", contribution: 1 },
        { muscle: "triceps", contribution: 0.5 },
      ]),
    ).toEqual([
      { muscle: "chest", intensity: 1 },
      { muscle: "triceps", intensity: 0.25 },
    ]);
  });
  it("treino de costas abre de costas; sem destaque, vista inteira", () => {
    const costas = intensityByGroup([{ muscle: "lats", intensity: 1 }]);
    expect(suggestedView(costas)).toBe("back");
    expect(framedViewBox("front", new Map())).toBe(VIEW_BOX.front);
    const [, , w, h] = framedViewBox("back", costas).split(" ").map(Number);
    expect(w! / h!).toBeCloseTo(4 / 3);
  });
});
