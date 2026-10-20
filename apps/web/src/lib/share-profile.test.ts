import { describe, expect, it } from "vitest";
import {
  NOME_ANONIMO,
  OPCOES_PADRAO,
  conteudoCartao,
  type PerfilPublicavel,
} from "./share-profile";

const perfil: PerfilPublicavel = {
  nome: "Ana",
  fotoUrl: "https://exemplo/foto.webp",
  objetivo: "Ganhar massa",
  treinos: 42,
  sequencia: 5,
  recordes: [
    // Campos a mais, como chegam de `fetchPersonalRecords`.
    { exerciseName: "Supino", weightKg: 60, reps: 8, exerciseId: "uuid", date: "2026-10-01" },
    { exerciseName: "Agachamento", weightKg: 80, reps: 6 },
    { exerciseName: "Remada", weightKg: 50, reps: 10 },
    { exerciseName: "Terra", weightKg: 100, reps: 5 },
  ] as PerfilPublicavel["recordes"],
  metaPercent: 40,
};

describe("conteudoCartao", () => {
  it("por padrão deixa de fora recordes e meta de peso", () => {
    const c = conteudoCartao(perfil, OPCOES_PADRAO);
    expect(c.recordes).toEqual([]);
    expect(c.metaPercent).toBeNull();
    expect(c.nome).toBe("Ana");
    expect(c.treinos).toBe(42);
  });

  it("com tudo desmarcado, sobra só o nome genérico", () => {
    const nada = Object.fromEntries(Object.keys(OPCOES_PADRAO).map((k) => [k, false]));
    expect(conteudoCartao(perfil, nada as typeof OPCOES_PADRAO)).toEqual({
      nome: NOME_ANONIMO,
      fotoUrl: null,
      objetivo: null,
      treinos: null,
      sequencia: null,
      recordes: [],
      metaPercent: null,
    });
  });

  it("recordes: no máximo três, sem id nem data", () => {
    const c = conteudoCartao(perfil, { ...OPCOES_PADRAO, recordes: true });
    expect(c.recordes).toHaveLength(3);
    expect(c.recordes[0]).toEqual({ exerciseName: "Supino", weightKg: 60, reps: 8 });
  });
});
