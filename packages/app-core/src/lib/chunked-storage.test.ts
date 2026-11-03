import { describe, expect, it } from "vitest";
import { chunkedStorage, type KeyValueStore } from "./chunked-storage";

function memoria(limite = 2048) {
  const m = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => {
      if (v.length > limite) throw new Error("valor grande demais");
      m.set(k, v);
    },
    removeItem: async (k) => void m.delete(k),
  };
  return { m, store };
}

describe("chunkedStorage", () => {
  it("guarda e lê de volta um valor maior que o limite do armazenamento", async () => {
    const { m, store } = memoria();
    const s = chunkedStorage(store);
    const sessao = "x".repeat(5000);
    await s.setItem("sb-auth", sessao);
    expect(await s.getItem("sb-auth")).toBe(sessao);
    expect(m.get("sb-auth.n")).toBe("3");
  });

  it("encolher o valor apaga os pedaços que sobraram", async () => {
    const { m, store } = memoria();
    const s = chunkedStorage(store);
    await s.setItem("k", "a".repeat(4000));
    await s.setItem("k", "curto");
    expect(await s.getItem("k")).toBe("curto");
    expect([...m.keys()].sort()).toEqual(["k.0", "k.n"]);
  });

  it("lê a sessão antiga, gravada numa chave só, e a apaga ao sair", async () => {
    const { m, store } = memoria();
    m.set("k", "antiga");
    const s = chunkedStorage(store);
    expect(await s.getItem("k")).toBe("antiga");
    await s.removeItem("k");
    expect(m.size).toBe(0);
  });

  it("pedaço faltando vira sessão nenhuma", async () => {
    const { m, store } = memoria();
    const s = chunkedStorage(store);
    await s.setItem("k", "b".repeat(4000));
    m.delete("k.1");
    expect(await s.getItem("k")).toBeNull();
  });
});
