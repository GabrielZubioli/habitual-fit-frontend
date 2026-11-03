import { QueryClient } from "@tanstack/react-query";
import { DataError } from "../data/supabase-helpers";

/**
 * Defaults do cache. Antes o `QueryClient` era criado sem opções, então toda
 * navegação (e todo retorno de foco à aba) refazia todas as consultas da tela.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Dados de treino/dieta mudam por ação do próprio usuário, não por
        // eventos externos: 30s de frescor cobre a navegação entre abas.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Erros de permissão/inexistência não melhoram com repetição.
          if (error instanceof DataError) {
            const code = error.code ?? "";
            if (code.startsWith("42") || code === "PGRST116" || code === "PGRST301") return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
