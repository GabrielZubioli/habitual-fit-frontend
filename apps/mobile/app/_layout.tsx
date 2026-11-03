import "../global.css";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@forja/app-core/lib/query-client";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/lib/supabase"; // registra o cliente no @forja/app-core
import { iniciarPowerSync } from "@/lib/powersync";
import { ThemeProvider, useTheme } from "@/theme/theme";
import { Abertura } from "@/ui/abertura";

function Barra() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
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
            <Stack screenOptions={{ headerShown: false }} />
            <Abertura />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
