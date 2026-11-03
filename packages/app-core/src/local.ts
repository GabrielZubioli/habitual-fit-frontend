/**
 * O banco local (SQLite do PowerSync), quando o app tem um.
 *
 * O app nativo com instância do PowerSync registra o banco na inicialização:
 *
 *     configureLocalDb(db);
 *
 * e os módulos de `data/` passam a ler e escrever nele — as escritas entram na
 * fila do PowerSync e sobem para o Supabase quando há conexão. Sem banco local
 * (o web, ou o app sem `EXPO_PUBLIC_POWERSYNC_URL`), tudo segue pelo Supabase,
 * exatamente como antes.
 *
 * No SQLite, arrays e JSON chegam como texto JSON e booleanos como 0/1: use
 * `jsonList`, `jsonValue` e `bool` ao ler.
 */
export interface LocalDb {
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getOptional<T>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  writeTransaction<T>(fn: (tx: LocalTx) => Promise<T>): Promise<T>;
}

export interface LocalTx {
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getOptional<T>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<unknown>;
}

let banco: LocalDb | null = null;

export function configureLocalDb(db: LocalDb | null): void {
  banco = db;
}

/** O banco local, ou `null` para seguir pelo Supabase. */
export function localDb(): LocalDb | null {
  return banco;
}

/** Texto JSON de um array (ou nulo) → array. */
export function jsonList<T = string>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v !== "string" || !v) return [];
  try {
    const r = JSON.parse(v) as unknown;
    return Array.isArray(r) ? (r as T[]) : [];
  } catch {
    return [];
  }
}

/** Texto JSON (ou nulo) → valor. */
export function jsonValue<T>(v: unknown, padrao: T): T {
  if (typeof v !== "string" || !v) return v == null ? padrao : (v as T);
  try {
    return JSON.parse(v) as T;
  } catch {
    return padrao;
  }
}

/** 0/1 do SQLite (ou boolean) → boolean. */
export function bool(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

/** Um uuid novo, gerado pelo próprio SQLite do PowerSync. */
export async function newId(db: Pick<LocalDb, "getOptional">): Promise<string> {
  const r = await db.getOptional<{ id: string }>("SELECT uuid() AS id");
  if (!r) throw new Error("Não foi possível gerar um id local.");
  return r.id;
}

/** Valor JS → como o SQLite do PowerSync guarda (boolean 0/1, array/objeto JSON). */
export function paraLocal(v: unknown): unknown {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v !== null && typeof v === "object") return JSON.stringify(v);
  return v === undefined ? null : v;
}

/** `UPDATE tabela SET … WHERE id = ?` a partir de um patch. */
export async function atualizar(
  db: Pick<LocalDb, "execute">,
  tabela: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const colunas = Object.keys(patch).filter((c) => patch[c] !== undefined);
  if (colunas.length === 0) return;
  await db.execute(
    `UPDATE ${tabela} SET ${colunas.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
    [...colunas.map((c) => paraLocal(patch[c])), id],
  );
}

/** `INSERT` de uma linha com `id` novo; devolve o id. */
export async function inserir(
  db: Pick<LocalDb, "execute" | "getOptional">,
  tabela: string,
  linha: Record<string, unknown>,
): Promise<string> {
  const id = typeof linha.id === "string" ? linha.id : await newId(db);
  const dados = { ...linha, id };
  const colunas = Object.keys(dados).filter((c) => dados[c as keyof typeof dados] !== undefined);
  await db.execute(
    `INSERT INTO ${tabela} (${colunas.join(", ")}) VALUES (${marcadores(colunas.length)})`,
    colunas.map((c) => paraLocal(dados[c as keyof typeof dados])),
  );
  return id;
}

/** `?, ?, ?` para um `IN (...)` com `n` valores. */
export function marcadores(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ");
}

/** Agora, no formato que o Postgres grava em `timestamptz`. */
export function agoraIso(): string {
  return new Date().toISOString();
}
