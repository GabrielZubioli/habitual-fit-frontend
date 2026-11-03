import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import type { Database } from "@gabrielzubioli/db/types";
import { configureSupabase } from "@forja/app-core/supabase";
import { chunkedStorage } from "@forja/app-core/lib/chunked-storage";

/**
 * Client Supabase para React Native.
 *
 * Registrado no `@forja/app-core`: as mesmas consultas de `data/` que o web
 * usa passam por aqui. O PowerSync (offline) entra depois, na fase 8 de
 * docs/migracao-expo.md.
 *
 * A sessão fica no SecureStore (Keystore do Android), em pedaços: ele aceita
 * ~2 KB por valor e o token passa disso — ver `chunkedStorage`.
 */
const SecureStoreAdapter = chunkedStorage({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
});

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Variáveis EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ausentes. Veja apps/mobile/.env.example.",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

configureSupabase(supabase, supabaseUrl);
