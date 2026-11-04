import "../global.css";
import { useEffect, useMemo, useState } from "react";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@forja/app-core/lib/query-client";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/lib/supabase"; // registra o cliente no @forja/app-core
import { iniciarPowerSync } from "@/lib/powersync";
import { ThemeProvider, useTheme } from "@/theme/theme";
import tokens from "@/theme/tokens.gen.json";
import { Abertura } from "@/ui/abertura";

function Barra() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

/**
 * O tema dos navegadores com as cores do app. Sem ele, o React Navigation usa
 * o claro padrão: a tela que ainda está montando (Exercícios, na primeira
 * visita) mostra o fundo #f2f2f2 dele — o "branco" antes do conteúdo.
 */
function Navegacao() {
  const { scheme } = useTheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const c = tokens[scheme];
  const tema = useMemo(
    () => ({
      ...base,
      colors: {
        ...base.colors,
        primary: c.primary.hex,
        background: c.background.hex,
        card: c.card.hex,
        text: c.foreground.hex,
        border: c.border.hex,
      },
    }),
    [base, c],
  );
  return (
    <NavigationTheme value={tema}>
      <Stack screenOptions={{ headerShown: false }} />
    </NavigationTheme>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  // Offline (só com EXPO_PUBLIC_POWERSYNC_URL): cada sincronização renova as telas.
  useEffect(() => iniciarPowerSync(() => void queryClient.invalidateQueries()), [queryClient]);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Barra />
            <Navegacao />
            <Abertura />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
