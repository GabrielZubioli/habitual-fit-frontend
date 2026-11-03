import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@gabrielzubioli/db/types";

/**
 * O cliente Supabase usado por `data/`.
 *
 * Cada app cria o seu — o web com `localStorage` e SSR, o nativo com
 * SecureStore — e o entrega aqui na inicialização, antes de qualquer consulta:
 *
 *     configureSupabase(client, SUPABASE_URL);
 *
 * Os módulos de `data/` continuam escrevendo `supabase.from(...)`; o proxy
 * repassa para o cliente configurado.
 */
let cliente: SupabaseClient<Database> | null = null;
let url = "";

export function configureSupabase(client: SupabaseClient<Database>, supabaseUrl: string): void {
  cliente = client;
  url = supabaseUrl.replace(/\/$/, "");
}

function atual(): SupabaseClient<Database> {
  if (!cliente)
    throw new Error("Supabase não configurado: chame configureSupabase() ao iniciar o app.");
  return cliente;
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    const c = atual();
    const valor = Reflect.get(c, prop, c);
    return typeof valor === "function" ? valor.bind(c) : valor;
  },
});

/** URL do projeto, para chamadas que não passam pelo cliente (streaming do coach). */
export function supabaseUrl(): string {
  atual();
  return url;
}
