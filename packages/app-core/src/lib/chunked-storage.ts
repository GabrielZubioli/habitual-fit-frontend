/**
 * Guarda valores grandes num armazenamento com limite por valor, dividindo em
 * pedaços: `<chave>.n` com a quantidade e `<chave>.0`, `<chave>.1`, … com o
 * texto.
 *
 * Existe para a sessão do Supabase no celular: o `SecureStore` (Keychain /
 * Keystore) aceita ~2 KB por valor e o token passa disso — acima do limite a
 * gravação falha e a pessoa é deslogada a cada vez que abre o app.
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Abaixo dos 2048 bytes do SecureStore, com folga para caracteres multibyte. */
export const CHUNK_SIZE = 1800;

export function chunkedStorage(store: KeyValueStore, size = CHUNK_SIZE): KeyValueStore {
  async function quantos(key: string): Promise<number> {
    const n = Number(await store.getItem(`${key}.n`));
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  async function remover(key: string): Promise<void> {
    const n = await quantos(key);
    for (let i = 0; i < n; i++) await store.removeItem(`${key}.${i}`);
    await store.removeItem(`${key}.n`);
    // Sessões gravadas antes dos pedaços, numa chave só.
    await store.removeItem(key);
  }

  return {
    async getItem(key) {
      const n = await quantos(key);
      if (n === 0) return store.getItem(key);
      const partes: string[] = [];
      for (let i = 0; i < n; i++) {
        const p = await store.getItem(`${key}.${i}`);
        // Pedaço faltando: a sessão está corrompida, melhor não ter nenhuma.
        if (p === null) return null;
        partes.push(p);
      }
      return partes.join("");
    },
    async setItem(key, value) {
      await remover(key);
      const n = Math.max(1, Math.ceil(value.length / size));
      for (let i = 0; i < n; i++)
        await store.setItem(`${key}.${i}`, value.slice(i * size, (i + 1) * size));
      // A quantidade por último: uma gravação interrompida não deixa meia sessão válida.
      await store.setItem(`${key}.n`, String(n));
    },
    removeItem: remover,
  };
}
