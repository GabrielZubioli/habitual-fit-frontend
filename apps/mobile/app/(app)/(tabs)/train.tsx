import { useCallback, useEffect, type ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useTheme } from "@/theme/theme";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { __iconNode as chevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
import { __iconNode as circleCheck } from "lucide-react/dist/esm/icons/circle-check.js";
import { __iconNode as moon } from "lucide-react/dist/esm/icons/moon.js";
import { __iconNode as play } from "lucide-react/dist/esm/icons/play.js";
import { todaysWorkout, weekdayOf } from "@forja/domain";
import { queryKeys } from "@forja/app-core/data/query-keys";
import {
  fetchActiveRoutine,
  fetchCompletedWorkouts,
  scheduleInputOf,
  splitDisplayName,
  type ActiveRoutine,
} from "@forja/app-core/data/routines";
import { fetchOpenSessionId, openWorkoutForTemplate } from "@forja/app-core/data/workout-session";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { formatLongDate, todayISO } from "@forja/app-core/lib/date";
import { useCurrentUserId } from "@/lib/session";
import { ErrorState, NoRoutineCard } from "@/ui/card";
import { Icon } from "@/ui/icon";
import { PageScroll } from "@/ui/page-header";
import { routineIconOf } from "@/ui/routine-icon";
import { Text } from "@/ui/text";

/**
 * Treinar — o `train.tsx` do web: o que falta fazer hoje e, abaixo, os outros
 * treinos do plano. Tela de ação, no verde da marca com elementos escuros
 * (cores fixas, iguais no tema claro e no escuro). Com um treino aberto, vai
 * direto para ele.
 */
const VERDE = "#01D798";
const TINTA = "#020306";

type Template = ActiveRoutine["templates"][number];

export default function Treinar() {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const hoje = todayISO();

  const aberto = useQuery({
    queryKey: [...queryKeys.workouts.all, "open-session"],
    queryFn: fetchOpenSessionId,
  });
  const rotina = useQuery({
    queryKey: queryKeys.workouts.activeRoutine(),
    queryFn: fetchActiveRoutine,
  });
  const feitos = useQuery({
    queryKey: [...queryKeys.workouts.all, "completed", hoje],
    queryFn: () => fetchCompletedWorkouts(hoje, hoje),
  });

  useEffect(() => {
    if (aberto.data)
      router.replace({ pathname: "/workouts/session/[id]", params: { id: aberto.data } });
  }, [aberto.data]);

  const comecar = useMutation({
    mutationFn: (templateId: string) => openWorkoutForTemplate(userId, templateId),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.workouts.all });
      router.push({ pathname: "/workouts/session/[id]", params: { id } });
    },
  });
  /** Só o botão tocado mostra que está abrindo. */
  const abrindo = (templateId: string) => comecar.isPending && comecar.variables === templateId;
  const iniciar = (templateId: string) => {
    if (!comecar.isPending) comecar.mutate(templateId);
  };

  if (aberto.isPending || aberto.data || rotina.isPending || feitos.isPending) {
    return (
      <TelaVerde>
        <View className="gap-3" accessibilityLabel="Carregando">
          <View className="h-32 rounded-3xl bg-[#020306]/15" />
          <View className="h-20 rounded-[20px] bg-[#020306]/10" />
          <View className="h-20 rounded-[20px] bg-[#020306]/10" />
        </View>
      </TelaVerde>
    );
  }

  if (rotina.isError || feitos.isError) {
    return (
      <TelaVerde>
        <ErrorState
          message={errorMessage(rotina.error ?? feitos.error)}
          onRetry={() => {
            void rotina.refetch();
            void feitos.refetch();
          }}
        />
      </TelaVerde>
    );
  }

  const r = rotina.data;
  if (!r || r.templates.length === 0) {
    return (
      <TelaVerde>
        <NoRoutineCard />
      </TelaVerde>
    );
  }

  const deHoje = feitos.data.filter((w) => w.date === hoje);
  const treinouHoje = deHoje.length > 0;
  const feita = (t: Template) => deHoje.some((w) => w.splitIndex === t.order);

  // Semana fixa: todas as rotinas do dia que faltam. Rotação: a próxima da
  // sequência, se hoje é dia de treino e ainda não treinou.
  let pendentes: Template[];
  if (r.scheduleMode === "fixed") {
    const dia = weekdayOf(hoje);
    pendentes = r.templates.filter((t) => t.weekdays.includes(dia) && !feita(t));
  } else {
    const { splitIndex, isPlannedDay, alreadyDone } = todaysWorkout(
      hoje,
      scheduleInputOf(r),
      feitos.data,
    );
    const t = r.templates[splitIndex];
    pendentes = t && isPlannedDay && !alreadyDone ? [t] : [];
  }
  pendentes = pendentes.filter((t) => t.exerciseCount > 0);
  const outros = r.templates.filter((t) => !pendentes.includes(t));
  const erro = comecar.isError ? errorMessage(comecar.error) : null;

  return (
    <TelaVerde>
      {erro ? (
        <View className="mb-4 rounded-2xl bg-[#020306] p-4">
          <Text className="text-sm font-medium text-white">{erro}</Text>
        </View>
      ) : null}

      {pendentes.length > 0 ? (
        <View accessibilityLabel="Treinos de hoje">
          <Titulo>{pendentes.length === 1 ? "Treino de hoje" : "Treinos de hoje"}</Titulo>
          <View className="gap-3">
            {pendentes.map((t, i) => (
              <Animated.View key={t.id} entering={FadeInDown.delay(200 + i * 90).duration(500)}>
                <Pressable
                  onPress={() => iniciar(t.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Começar ${splitDisplayName(t.name)}`}
                  accessibilityState={{ busy: abrindo(t.id) }}
                  className="flex-row items-center gap-4 rounded-[28px] bg-[#020306] p-5 active:scale-[0.98]"
                  style={{
                    shadowColor: TINTA,
                    shadowOpacity: 0.7,
                    shadowRadius: 20,
                    shadowOffset: { width: 0, height: 18 },
                    elevation: 10,
                  }}
                >
                  <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#01D798]">
                    <Icon node={routineIconOf(t.icon, t.name)} color={TINTA} size={28} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="text-2xl font-extrabold text-white">
                      {splitDisplayName(t.name)}
                    </Text>
                    <Text className="text-white/60">
                      {t.exerciseCount} {t.exerciseCount === 1 ? "exercício" : "exercícios"}
                    </Text>
                  </View>
                  <View className="h-14 w-14 items-center justify-center rounded-full bg-[#01D798]">
                    {abrindo(t.id) ? (
                      <ActivityIndicator color={TINTA} />
                    ) : (
                      <View className="ml-0.5">
                        <Icon node={play} color={TINTA} size={24} preenchido />
                      </View>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>
      ) : (
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          className="flex-row items-center gap-4 rounded-[28px] bg-[#020306] p-5"
          accessibilityLabel="Hoje"
        >
          {treinouHoje ? (
            <Icon node={circleCheck} color={VERDE} size={56} strokeWidth={2.25} />
          ) : (
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#01D798]">
              <Icon node={moon} color={TINTA} size={28} />
            </View>
          )}
          <View className="min-w-0 flex-1">
            <Text className="text-xl font-bold text-white">
              {treinouHoje ? "Você já treinou hoje" : "Hoje é dia de descanso"}
            </Text>
            <Text className="text-white/60">
              {treinouHoje
                ? "Se quiser treinar mais, escolha abaixo."
                : "Aproveite para recuperar. Se quiser treinar mesmo assim, escolha abaixo."}
            </Text>
          </View>
        </Animated.View>
      )}

      {outros.length > 0 ? (
        <View className="mt-8" accessibilityLabel="Seus treinos">
          <Titulo>{pendentes.length > 0 ? "Outros treinos" : "Seus treinos"}</Titulo>
          <View className="gap-2.5">
            {outros.map((t, i) => (
              <Animated.View
                key={t.id}
                entering={FadeInDown.delay(320 + i * 60).duration(500)}
                className="flex-row items-center gap-3 rounded-[20px] bg-[#020306]/90 p-3.5"
              >
                <View className="h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                  <Icon node={routineIconOf(t.icon, t.name)} color={VERDE} size={24} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-lg font-semibold text-white">
                    {splitDisplayName(t.name)}
                  </Text>
                  <Text className="text-sm text-white/55">
                    {t.exerciseCount} {t.exerciseCount === 1 ? "exercício" : "exercícios"}
                    {feita(t) ? " · feito hoje ✓" : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={() => iniciar(t.id)}
                  disabled={t.exerciseCount === 0}
                  accessibilityRole="button"
                  accessibilityLabel={`Começar ${splitDisplayName(t.name)}`}
                  className="min-w-[104px] items-center justify-center rounded-full bg-[#01D798] px-4 py-2 active:scale-95"
                  style={t.exerciseCount === 0 ? { opacity: 0.5 } : undefined}
                >
                  {abrindo(t.id) ? (
                    <ActivityIndicator color={TINTA} size="small" />
                  ) : (
                    <Text className="font-bold text-[#020306]">Começar</Text>
                  )}
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => router.push("/plan")}
        className="mt-6 flex-row items-center justify-between rounded-[20px] px-4 py-3 active:bg-[#020306]/10"
      >
        <Text className="font-semibold text-[#020306]/75">Editar rotinas e agenda no Plano</Text>
        <Icon node={chevronRight} color="rgba(2,3,6,0.75)" size={20} />
      </Pressable>
    </TelaVerde>
  );
}

/** O fundo verde ocupa a tela inteira, por trás da barra de status. */
function TelaVerde({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  // Ícones escuros sobre o verde enquanto a tela está em foco; ao sair, os do tema.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("dark");
      return () => setStatusBarStyle(scheme === "dark" ? "light" : "dark");
    }, [scheme]),
  );
  const data = formatLongDate(todayISO()).toLowerCase();
  return (
    <PageScroll
      tint="#01D798"
      className="flex-1 bg-[#01D798]"
      contentContainerClassName="px-4 pb-36 pt-3"
      header={
        <View className="px-4 pb-3" style={{ paddingTop: Math.max(24, insets.top + 8) }}>
          <Text className="text-[44px] font-extrabold leading-[44px] tracking-tight text-[#020306]">
            Treinar
          </Text>
          <Text className="mt-2 text-lg font-medium text-[#020306]/65">
            {data.charAt(0).toUpperCase() + data.slice(1)}
          </Text>
        </View>
      }
    >
      {children}
    </PageScroll>
  );
}

function Titulo({ children }: { children: string }) {
  return (
    <Text className="mb-3 px-1 text-sm font-bold uppercase tracking-wider text-[#020306]/65">
      {children}
    </Text>
  );
}
