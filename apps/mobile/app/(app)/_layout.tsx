import { Redirect, Stack } from "expo-router";
import { View } from "react-native";
import { useSession } from "@/lib/session";

/**
 * Telas de quem tem conta — o `_authenticated` do web. Sem sessão, volta para
 * a raiz (boas-vindas). A sessão é lida do aparelho, sem ida ao servidor: um
 * token vencido é renovado pelo cliente ou derruba a sessão, e aí cai aqui.
 */
export default function AppLayout() {
  const session = useSession();
  if (session === undefined) return <View className="flex-1 bg-background" />;
  if (!session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
