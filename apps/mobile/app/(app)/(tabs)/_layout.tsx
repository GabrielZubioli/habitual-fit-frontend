import { Tabs } from "expo-router/tabs";
import { TabBar } from "@/ui/tab-bar";

/**
 * Todas as telas de quem tem conta ficam aqui, como no `_authenticated` do
 * web: a barra de baixo aparece em todas. Só quatro viram abas; as outras
 * (`href: null`) se abrem pelo Menu ou por links e mantêm a barra.
 */
const OCULTAS = [
  "workouts/session/[id]",
  "workouts/calendar",
  "workouts/routines/new",
  "stats",
  "body",
  "exercises/index",
  "exercises/[id]",
  "recipes/index",
  "recipes/[id]",
  "profile",
  "settings",
] as const;

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
      // "Voltar" segue o histórico, como no navegador.
      backBehavior="history"
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="train" />
      <Tabs.Screen name="diet" />
      {OCULTAS.map((nome) => (
        <Tabs.Screen key={nome} name={nome} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
