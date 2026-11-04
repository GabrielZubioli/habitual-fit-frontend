import { useEffect } from "react";
import { View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { ErrorState } from "./card";

/**
 * O `route-error.tsx` do web: um erro ao montar a tela vira a tela de erro com
 * "Tentar novamente", em vez de derrubar a árvore toda (a tela em branco).
 * Exportado como `ErrorBoundary` pelas rotas do expo-router.
 */
export function RouteError({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();
  useEffect(() => {
    // Continua no console e no LogBox em desenvolvimento.
    console.error(error);
  }, [error]);
  return (
    <View className="flex-1 justify-center bg-background px-4" style={{ paddingTop: insets.top }}>
      <ErrorState message={errorMessage(error)} onRetry={() => void retry()} />
    </View>
  );
}
