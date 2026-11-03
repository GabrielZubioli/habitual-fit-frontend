import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * A sessão atual: `undefined` enquanto lê do armazenamento, `null` sem conta.
 * Acompanha login, logout e renovação do token. A última sessão lida fica
 * guardada: uma tela que monta depois já nasce com ela, sem um render vazio.
 */
let ultima: Session | null | undefined;

export function useSession(): Session | null | undefined {
  const [session, setSession] = useState(ultima);
  useEffect(() => {
    const guardar = (s: Session | null) => {
      ultima = s;
      setSession(s);
    };
    void supabase.auth.getSession().then(({ data }) => guardar(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => guardar(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

/**
 * Id de quem está logado — o `useCurrentUserId` do web. Só para telas dentro de
 * `(app)`, onde a sessão já foi conferida; fora delas, string vazia.
 */
export function useCurrentUserId(): string {
  return useSession()?.user.id ?? "";
}
