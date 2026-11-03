import { useEffect } from "react";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { ErrorScreen } from "@/components/status-screen";

/** Erro numa tela: a tela de erro ocupa só o conteúdo, a navegação continua. */
export function RouteErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      telaCheia={false}
      error={error}
      onRetry={() => {
        void router.invalidate();
        reset();
      }}
    />
  );
}
