import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabase";
import { assertOk, unwrapList } from "./supabase-helpers";
import { agoraIso, inserir, localDb } from "../local";

const CHAVE = ["exercises", "favorites"] as const;

async function fetchFavoriteIds(): Promise<string[]> {
  const db = localDb();
  if (db) {
    return (
      await db.getAll<{ exercise_id: string }>(
        "SELECT exercise_id FROM exercise_favorites ORDER BY created_at DESC",
      )
    ).map((r) => r.exercise_id);
  }
  return unwrapList(
    "carregar favoritos",
    await supabase
      .from("exercise_favorites")
      .select("exercise_id")
      .order("created_at", { ascending: false }),
  ).map((r) => r.exercise_id);
}

/**
 * Exercícios favoritos da pessoa (salvos no banco, valem em qualquer aparelho).
 * O coração muda na hora (otimista) e volta atrás se a gravação falhar.
 */
export function useFavoritos() {
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: CHAVE, queryFn: fetchFavoriteIds });
  const ids = new Set(lista.data ?? []);

  const alternar = useMutation({
    mutationFn: async ({ id, favorito }: { id: string; favorito: boolean }) => {
      if (favorito) {
        // Sessão local (sem rede): o hook não depende do roteador de cada app.
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user.id;
        if (!userId) throw new Error("Sessão expirada. Entre novamente.");
        const db = localDb();
        if (db) {
          // Chave composta: no aparelho o `id` é `user_id:exercise_id`.
          const chave = `${userId}:${id}`;
          const ja = await db.getOptional("SELECT id FROM exercise_favorites WHERE id = ?", [
            chave,
          ]);
          if (!ja) {
            await inserir(db, "exercise_favorites", {
              id: chave,
              user_id: userId,
              exercise_id: id,
              created_at: agoraIso(),
            });
          }
          return;
        }
        assertOk(
          "favoritar exercício",
          await supabase
            .from("exercise_favorites")
            .upsert({ user_id: userId, exercise_id: id }, { onConflict: "user_id,exercise_id" }),
        );
      } else {
        const db = localDb();
        if (db) {
          await db.execute("DELETE FROM exercise_favorites WHERE exercise_id = ?", [id]);
          return;
        }
        assertOk(
          "desfavoritar exercício",
          await supabase.from("exercise_favorites").delete().eq("exercise_id", id),
        );
      }
    },
    onMutate: async ({ id, favorito }) => {
      await qc.cancelQueries({ queryKey: CHAVE });
      const antes = qc.getQueryData<string[]>(CHAVE) ?? [];
      qc.setQueryData<string[]>(CHAVE, favorito ? [id, ...antes] : antes.filter((x) => x !== id));
      return { antes };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(CHAVE, ctx.antes),
    onSettled: () => void qc.invalidateQueries({ queryKey: CHAVE }),
  });

  return {
    ids,
    ordem: lista.data ?? [],
    carregando: lista.isPending,
    alternar: (id: string) => alternar.mutate({ id, favorito: !ids.has(id) }),
  };
}
