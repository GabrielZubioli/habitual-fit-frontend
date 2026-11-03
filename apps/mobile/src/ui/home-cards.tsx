import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { __iconNode as batteryCharging } from "lucide-react/dist/esm/icons/battery-charging.js";
import { __iconNode as chevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
import { __iconNode as droplets } from "lucide-react/dist/esm/icons/droplets.js";
import { __iconNode as minus } from "lucide-react/dist/esm/icons/minus.js";
import { WATER_QUICK_ADD_ML } from "@forja/domain";
import type { MuscleRecovery } from "@forja/domain";
import { fetchMuscleRecovery } from "@forja/app-core/data/recovery";
import { addWater, fetchWaterMl, undoLastWater } from "@forja/app-core/data/diet-day";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { MUSCLE_LABELS, label } from "@forja/app-core/lib/labels";
import { cn } from "@/lib/cn";
import { useCurrentUserId } from "@/lib/session";
import { useColor } from "@/theme/theme";
import { Card } from "./card";
import { Icon } from "./icon";
import { Text } from "./text";

/** Mistura duas cores `#rrggbb` (o `color-mix` do web). */
function misturar(a: string, b: string, pesoA: number): string {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  const canal = (s: number) =>
    Math.round(((ca >> s) & 255) * pesoA + ((cb >> s) & 255) * (1 - pesoA))
      .toString(16)
      .padStart(2, "0");
  return `#${canal(16)}${canal(8)}${canal(0)}`;
}

/** A cor de cada estado de recuperação — o `recoveryColor` do app-core, em hex. */
export function useCorRecuperacao() {
  const primaria = useColor("primary");
  const treino = useColor("treino");
  return (status: MuscleRecovery["status"]) =>
    status === "recovered"
      ? primaria
      : status === "recovering"
        ? misturar(primaria, treino, 0.7)
        : treino;
}

const SEGMENTOS = 10;

/**
 * Prontidão do corpo — o `home/readiness-card.tsx` do web: quanto dos músculos
 * treinados nos últimos dias já se recuperou, como uma bateria.
 */
export function ReadinessCard() {
  const userId = useCurrentUserId();
  const primaria = useColor("primary");
  const texto = useColor("foreground");
  const corDe = useCorRecuperacao();
  const recovery = useQuery({
    queryKey: queryKeys.workouts.recovery(),
    queryFn: () => fetchMuscleRecovery(userId),
    enabled: Boolean(userId),
  });

  if (recovery.isPending) return <View className="h-36 w-full rounded-3xl bg-muted" />;
  if (recovery.isError) return null;

  const musculos = recovery.data;
  const media = musculos.length
    ? Math.round(musculos.reduce((n, m) => n + m.percent, 0) / musculos.length)
    : 100;
  const recuperando = musculos
    .filter((m) => m.hoursRemaining > 0)
    .sort((a, b) => b.hoursRemaining - a.hoursRemaining)
    .slice(0, 3);
  const prontos = musculos.filter((m) => m.hoursRemaining <= 0);
  const cheios = Math.round((media / 100) * SEGMENTOS);

  return (
    <Pressable
      onPress={() => router.push("/stats")}
      accessibilityLabel={`Prontidão do corpo: ${media}%`}
      className="rounded-3xl bg-card p-5 active:bg-elevated"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Icon node={batteryCharging} color={primaria} size={20} />
          <Text className="text-lg text-muted-foreground">Prontidão do corpo</Text>
        </View>
        <Icon node={chevronRight} color={texto} size={20} />
      </View>

      <View className="mt-3 flex-row items-end gap-4">
        <Text className="text-5xl font-extrabold leading-none">
          {media}
          <Text className="text-2xl font-bold text-muted-foreground">%</Text>
        </Text>
        <View className="mb-1.5 flex-1 flex-row gap-1">
          {Array.from({ length: SEGMENTOS }, (_, i) => (
            <View
              key={i}
              className={cn("h-6 flex-1 rounded-[4px]", i >= cheios && "bg-muted")}
              style={
                i < cheios
                  ? { backgroundColor: media >= 60 ? primaria : corDe("fatigued") }
                  : undefined
              }
            />
          ))}
        </View>
      </View>

      {recuperando.length === 0 ? (
        <Text className="mt-3 text-muted-foreground">
          Tudo recuperado — dia perfeito para um treino pesado.
        </Text>
      ) : (
        <View className="mt-4 gap-1.5">
          {recuperando.map((m) => (
            <View key={m.muscle} className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: corDe(m.status) }} />
              <Text className="flex-1 text-sm font-medium">{label(MUSCLE_LABELS, m.muscle)}</Text>
              <Text className="text-sm text-muted-foreground">
                {m.hoursRemaining < 24
                  ? `${m.hoursRemaining}h`
                  : `${Math.round(m.hoursRemaining / 24)}d`}{" "}
                para recuperar
              </Text>
            </View>
          ))}
          {prontos.length > 0 ? (
            <Text className="pt-1 text-sm text-muted-foreground">
              Prontos:{" "}
              <Text className="text-sm font-medium">
                {prontos
                  .slice(0, 4)
                  .map((m) => label(MUSCLE_LABELS, m.muscle))
                  .join(", ")}
                {prontos.length > 4 ? ` e mais ${prontos.length - 4}` : ""}
              </Text>
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

/**
 * Água — o `home/water-card.tsx` do web: um toque grava (otimista, a barra
 * sobe antes da resposta); o "−" desfaz o último registro.
 */
export function WaterCard({
  date,
  targetMl,
  onError,
}: {
  date: string;
  targetMl: number;
  onError: (e: unknown) => void;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const azul = useColor("chart-2");
  const primaria = useColor("primary");
  const texto = useColor("foreground");
  const water = useQuery({
    queryKey: queryKeys.water.day(date),
    queryFn: () => fetchWaterMl(date),
  });

  const consumido = water.data ?? 0;
  const meta = targetMl || 2500;
  const pct = Math.min(100, (consumido / meta) * 100);
  const atingiu = consumido >= meta;

  const add = useMutation({
    mutationFn: (ml: number) => addWater(userId, date, ml),
    onMutate: async (ml) => {
      await qc.cancelQueries({ queryKey: queryKeys.water.day(date) });
      const anterior = qc.getQueryData<number>(queryKeys.water.day(date)) ?? 0;
      qc.setQueryData(queryKeys.water.day(date), anterior + ml);
      return { anterior };
    },
    onError: (e, _ml, ctx) => {
      // Reverter: uma barra que subiu e não gravou faria acreditar que bateu a meta.
      if (ctx) qc.setQueryData(queryKeys.water.day(date), ctx.anterior);
      onError(e);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.water.day(date) }),
  });
  const undo = useMutation({
    mutationFn: () => undoLastWater(date),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.water.day(date) }),
    onError,
  });

  return (
    <Card className="overflow-hidden">
      <View className="p-4">
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-chart-2/15">
              <Icon node={droplets} color={azul} size={16} />
            </View>
            <View>
              <Text className="text-sm font-semibold leading-tight">Água</Text>
              {water.isPending ? (
                <View className="mt-1 h-3 w-20 rounded bg-muted" />
              ) : (
                <Text className="text-xs text-muted-foreground">
                  {(consumido / 1000).toFixed(1)} L de {(meta / 1000).toFixed(1)} L
                </Text>
              )}
            </View>
          </View>
          {consumido > 0 ? (
            <Pressable
              onPress={() => undo.mutate()}
              disabled={undo.isPending}
              accessibilityLabel="Desfazer último registro de água"
              className="h-8 w-8 items-center justify-center rounded-full active:bg-accent"
            >
              <Icon node={minus} color={texto} size={16} />
            </Pressable>
          ) : null}
        </View>

        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Água: ${consumido} de ${meta} mililitros`}
          className="mb-3 h-2 overflow-hidden rounded-full bg-muted"
        >
          <View
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: atingiu ? primaria : azul }}
          />
        </View>

        <View className="flex-row gap-2">
          {WATER_QUICK_ADD_ML.map((ml) => (
            <Pressable
              key={ml}
              onPress={() => add.mutate(ml)}
              disabled={add.isPending}
              className="h-10 flex-1 items-center justify-center rounded-xl border border-border bg-card active:bg-accent"
            >
              <Text className="text-xs font-semibold">+{ml}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Card>
  );
}
