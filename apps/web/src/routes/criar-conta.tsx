import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * O cadastro vive em /auth, ao lado do login (a troca entre os dois é
 * animada). Esta rota fica para os links antigos.
 */
export const Route = createFileRoute("/criar-conta")({
  beforeLoad: () => {
    throw redirect({ to: "/auth", search: { modo: "cadastro" }, replace: true });
  },
});
