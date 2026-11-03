import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { __iconNode as calendarDays } from "lucide-react/dist/esm/icons/calendar-days.js";
import { __iconNode as chevronLeft } from "lucide-react/dist/esm/icons/chevron-left.js";
import { __iconNode as chevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { WEEKDAY_INITIALS, type Weekday } from "@forja/domain";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { fetchActiveRoutine, fetchCompletedWorkouts } from "@forja/app-core/data/routines";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { formatDate, formatDuration, toISODate, todayISO } from "@forja/app-core/lib/date";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Card, EmptyState, ErrorState } from "@/ui/card";
import { Icon } from "@/ui/icon";
import { BackButton, PageHeader } from "@/ui/page-header";
import { RoutineIcon, routineIconOf } from "@/ui/routine-icon";
import { Text } from "@/ui/text";

/**
 * Calendário mensal de treinos — o `workouts_.calendar.tsx` do web. Mostra só o
 * que aconteceu, não o que estava planejado: não é um painel de cobrança.
 */
export default function WorkoutCalendar() {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const texto = useColor("foreground");
  const branco = useColor("primary-foreground");

  const inicio = startOfMonth(monthCursor);
  const fim = endOfMonth(monthCursor);
  // A grade inclui os dias vizinhos que completam as semanas.
  const gradeInicio = startOfWeek(inicio, { weekStartsOn: 1 });
  const gradeFim = endOfWeek(fim, { weekStartsOn: 1 });

  const routine = useQuery({
    queryKey: queryKeys.workouts.activeRoutine(),
    queryFn: fetchActiveRoutine,
  });
  const workouts = useQuery({
    queryKey: ["workout-calendar", toISODate(gradeInicio), toISODate(gradeFim)],
    queryFn: () => fetchCompletedWorkouts(toISODate(gradeInicio), toISODate(gradeFim)),
  });

  const porDia = useMemo(() => {
    const mapa = new Map<string, NonNullable<typeof workouts.data>>();
    for (const treino of workouts.data ?? []) {
      const lista = mapa.get(treino.date) ?? [];
      lista.push(treino);
      mapa.set(treino.date, lista);
    }
    return mapa;
  }, [workouts.data]);

  const dias = eachDayOfInterval({ start: gradeInicio, end: gradeFim });
  const hoje = todayISO();
  const templates = routine.data?.templates ?? [];
  const doMes = (workouts.data ?? []).filter((w) =>
    isSameMonth(new Date(`${w.date}T12:00:00`), monthCursor),
  );
  const volumeMes = doMes.reduce((soma, w) => soma + w.volumeKg, 0);
  const selecionados = selectedDate ? (porDia.get(selectedDate) ?? []) : [];
  const semanas = Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7));

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-28">
      <PageHeader
        title="Calendário"
        description="Seus treinos por mês."
        action={<BackButton fallback="/plan" />}
      />
      <View className="px-4 py-4">
        <Card>
          <View className="flex-row items-center justify-between p-4 pb-3">
            <Text className="text-base font-semibold capitalize">
              {formatDate(monthCursor, "MMMM 'de' yyyy")}
            </Text>
            <View className="flex-row items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onPress={() => setMonthCursor((m) => subMonths(m, 1))}
                accessibilityLabel="Mês anterior"
              >
                <Icon node={chevronLeft} color={texto} size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setMonthCursor(startOfMonth(new Date()))}
              >
                Hoje
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onPress={() => setMonthCursor((m) => addMonths(m, 1))}
                accessibilityLabel="Próximo mês"
              >
                <Icon node={chevronRight} color={texto} size={16} />
              </Button>
            </View>
          </View>

          <View className="px-4 pb-4">
            {workouts.isError ? (
              <ErrorState
                message={errorMessage(workouts.error)}
                onRetry={() => void workouts.refetch()}
              />
            ) : (
              <>
                <View className="mb-2 flex-row gap-1">
                  {([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((d) => (
                    <Text
                      key={d}
                      className="flex-1 py-1 text-center text-[10px] font-medium uppercase text-muted-foreground"
                    >
                      {WEEKDAY_INITIALS[d]}
                    </Text>
                  ))}
                </View>

                <View className="gap-1">
                  {semanas.map((semana, s) => (
                    <View key={s} className="flex-row gap-1">
                      {semana.map((dia) => {
                        if (workouts.isPending) {
                          return (
                            <View
                              key={dia.toISOString()}
                              className="aspect-square flex-1 rounded-lg bg-muted"
                            />
                          );
                        }
                        const iso = toISODate(dia);
                        const treinos = porDia.get(iso) ?? [];
                        const temTreino = treinos.length > 0;
                        const ehHoje = iso === hoje;
                        const foraDoMes = !isSameMonth(dia, monthCursor);
                        const rotina =
                          treinos[0]?.splitIndex !== undefined
                            ? templates[treinos[0].splitIndex]
                            : undefined;
                        const icone = rotina ? routineIconOf(rotina.icon, rotina.name) : dumbbell;
                        return (
                          <Pressable
                            key={iso}
                            onPress={() => setSelectedDate(temTreino ? iso : null)}
                            disabled={!temTreino}
                            accessibilityLabel={`${formatDate(iso, "dd 'de' MMMM")}: ${
                              temTreino
                                ? `${treinos.length} treino${treinos.length > 1 ? "s" : ""}`
                                : "sem treino"
                            }`}
                            accessibilityState={{ selected: selectedDate === iso }}
                            className={cn(
                              "aspect-square flex-1 items-center justify-center rounded-lg border",
                              foraDoMes && "opacity-35",
                              temTreino ? "border-transparent bg-primary" : "border-border",
                              ehHoje && !temTreino && "border-primary",
                              selectedDate === iso && "border-2 border-foreground",
                            )}
                          >
                            <Text
                              className={cn(
                                "text-sm",
                                ehHoje ? "font-bold" : "font-medium",
                                temTreino
                                  ? "text-primary-foreground"
                                  : ehHoje
                                    ? "text-primary"
                                    : "text-muted-foreground",
                              )}
                            >
                              {dia.getDate()}
                            </Text>
                            {temTreino ? <Icon node={icone} color={branco} size={12} /> : null}
                            {treinos.length > 1 ? (
                              <View className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>

                <View className="mt-4 flex-row flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <Text className="text-sm text-muted-foreground">
                    {doMes.length === 0
                      ? "Nenhum treino neste mês"
                      : `${doMes.length} ${doMes.length === 1 ? "treino" : "treinos"} neste mês`}
                  </Text>
                  {volumeMes > 0 ? (
                    <Text className="text-sm text-muted-foreground">
                      {Math.round(volumeMes).toLocaleString("pt-BR")} kg de volume
                    </Text>
                  ) : null}
                </View>
              </>
            )}
          </View>
        </Card>

        {selectedDate && selecionados.length > 0 ? (
          <Card className="mt-4">
            <Text className="p-4 pb-3 text-base font-semibold">
              {formatDate(selectedDate, "EEEE, dd 'de' MMMM")}
            </Text>
            {selecionados.map((treino, i) => {
              const t = treino.splitIndex !== undefined ? templates[treino.splitIndex] : undefined;
              return (
                <Pressable
                  key={treino.sessionId}
                  onPress={() =>
                    router.push({
                      pathname: "/workouts/session/[id]",
                      params: { id: treino.sessionId },
                    })
                  }
                  className={cn(
                    "flex-row items-center justify-between gap-3 px-4 py-3 active:bg-accent/50",
                    i > 0 && "border-t border-border",
                  )}
                >
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="font-medium">
                      {treino.name}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {formatDuration(treino.durationSeconds)}
                      {treino.volumeKg > 0
                        ? ` · ${Math.round(treino.volumeKg).toLocaleString("pt-BR")} kg`
                        : ""}
                    </Text>
                  </View>
                  {t ? <RoutineIcon icon={t.icon} name={t.name} pequeno muted /> : null}
                </Pressable>
              );
            })}
          </Card>
        ) : null}

        {!workouts.isPending && !workouts.isError && (workouts.data?.length ?? 0) === 0 ? (
          <View className="mt-4">
            <EmptyState
              icon={calendarDays}
              title="Nenhum treino neste período"
              description="Assim que você finalizar um treino, ele aparece aqui."
              action={<Button onPress={() => router.push("/plan")}>Ir para treinos</Button>}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
