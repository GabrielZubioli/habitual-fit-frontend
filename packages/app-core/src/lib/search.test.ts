import { describe, expect, it } from "vitest";
import { localSearch } from "./search";

describe("busca no banco local", () => {
  it("cada palavra no nome, também com a inicial maiúscula", () => {
    expect(localSearch("frango grelhado")).toEqual({
      where: "(name LIKE ? OR name LIKE ?) AND (name LIKE ? OR name LIKE ?)",
      params: ["%frango%", "%Frango%", "%grelhado%", "%Grelhado%"],
    });
  });

  it("com várias colunas, a palavra pode estar em qualquer uma (o nome traduzido)", () => {
    expect(localSearch("chicken", ["name", "name_en"])).toEqual({
      where: "(name LIKE ? OR name LIKE ? OR name_en LIKE ? OR name_en LIKE ?)",
      params: ["%chicken%", "%Chicken%", "%chicken%", "%Chicken%"],
    });
  });

  it("busca vazia não filtra", () => {
    expect(localSearch("  ", ["name", "name_es"])).toEqual({ where: "1", params: [] });
  });
});
