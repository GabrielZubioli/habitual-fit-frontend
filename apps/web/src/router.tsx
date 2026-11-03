import { createQueryClient } from "@forja/app-core/lib/query-client";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import "./integrations/supabase/client"; // registra o cliente no @forja/app-core
import { RouteErrorComponent } from "./components/route-error";
import { slideTypes } from "./lib/swipe-nav";

export const getRouter = () => {
  const queryClient = createQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega a rota assim que o usuário demonstra intenção (hover/touch),
    // tornando a navegação praticamente instantânea.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    // Erro dentro de uma tela: mostra a tela de erro no lugar do conteúdo,
    // mantendo a barra de navegação para a pessoa seguir usando o app.
    defaultErrorComponent: RouteErrorComponent,
    // Entre as abas da barra, a tela desliza (View Transitions); no resto, nada.
    defaultViewTransition: { types: slideTypes },
  });

  return router;
};
