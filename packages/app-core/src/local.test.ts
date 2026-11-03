import { describe, expect, it } from "vitest";
import { atualizar, bool, inserir, jsonList, jsonValue, paraLocal } from "./local";

describe("leitura do SQLite", () => {
  it("arrays, JSON e booleanos chegam como texto e 0/1", () => {
    expect(jsonList('["a","b"]')).toEqual(["a", "b"]);
    expect(jsonList(null)).toEqual([]);
    expect(jsonList("não é json")).toEqual([]);
    expect(jsonValue('{"x":1}', {})).toEqual({ x: 1 });
    expect(jsonValue(null, { y: 2 })).toEqual({ y: 2 });
    expect(bool(1)).toBe(true);
    expect(bool(0)).toBe(false);
    expect(bool(null)).toBe(false);
  });
});

describe("escrita no SQLite", () => {
  function bancoFalso() {
    const chamadas: { sql: string; params: unknown[] }[] = [];
    return {
      chamadas,
      execute: async (sql: string, params: unknown[] = []) => void chamadas.push({ sql, params }),
      getOptional: async <T>() => ({ id: "novo-id" }) as T,
    };
  }

  it("guarda booleano como 0/1 e array como JSON", () => {
    expect(paraLocal(true)).toBe(1);
    expect(paraLocal(false)).toBe(0);
    expect(paraLocal([1, 2])).toBe("[1,2]");
    expect(paraLocal(undefined)).toBe(null);
    expect(paraLocal(null)).toBe(null);
    expect(paraLocal(7.5)).toBe(7.5);
  });

  it("insere com id novo e ignora campos indefinidos", async () => {
    const db = bancoFalso();
    const id = await inserir(db, "workout_sets", { reps: 8, completed: false, notes: undefined });
    expect(id).toBe("novo-id");
    expect(db.chamadas[0]).toEqual({
      sql: "INSERT INTO workout_sets (reps, completed, id) VALUES (?, ?, ?)",
      params: [8, 0, "novo-id"],
    });
  });

  it("atualiza só o que veio no patch; patch vazio não toca o banco", async () => {
    const db = bancoFalso();
    await atualizar(db, "workout_templates", "t1", { weekdays: [1, 3], name: undefined });
    await atualizar(db, "workout_templates", "t1", {});
    expect(db.chamadas).toEqual([
      { sql: "UPDATE workout_templates SET weekdays = ? WHERE id = ?", params: ["[1,3]", "t1"] },
    ]);
  });
});
