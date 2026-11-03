import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, startOfWeek } from "date-fns";
import { __iconNode as calendarDays } from "lucide-react/dist/esm/icons/calendar-days.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as flame } from "lucide-react/dist/esm/icons/flame.js";
import { __iconNode as history } from "lucide-react/dist/esm/icons/history.js";
import { __iconNode as scale } from "lucide-react/dist/esm/icons/scale.js";
import { __iconNode as trophy } from "lucide-react/dist/esm/icons/trophy.js";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { fetchActiveRoutine, fetchCompletedWorkouts } from "@forja/app-core/data/routines";
import {
  fetchMuscleSetEntries,
  fetchPersonalRecords,
  fetchRecentSessions,
} from "@forja/app-core/data/workouts";
import { fetchWeighIns, fetchWorkoutCounts } from "@forja/app-core/data/body";
import {
  RECOVERY_STATUS_LABELS,
  describeRemaining,
  fetchMuscleRecovery,
} from "@forja/app-core/data/recovery";
import { MUSCLE_LABELS, label } from "@forja/app-core/lib/labels";
import { formatDate, formatDuration, toISODate, todayISO } from "@forja/app-core/lib/date";
import { diasSeguidos } from "@forja/app-core/lib/streak";
import { cn } from "@/lib/cn";
import { useCurrentUserId } from "@/lib/session";
import { useColor } from "@/theme/theme";
import { BodyMap } from "@/ui/body-map";
import { ErrorState } from "@/ui/card";
import { ActivityHeatmap } from "@/ui/activity-heatmap";
import { WeeklyChart } from "@/ui/charts";
import { useCorRecuperacao } from "@/ui/home-cards";
import { Icon, type IconNode } from "@/ui/icon";
import { HeaderIconButton, PageHeader } from "@/ui/page-header";
import { Text } from "@/ui/text";

/**
 * Estatísticas — o `stats.tsx` do web: a semana contra a meta, os números, a
 * constância do ano e os músculos (equilíbrio, fadiga e força).
 */
const LARANJA = "#FF7A1F";

export default function StatsPage() {
  const hoje = todayISO();
  const apagada = useColor("muted-foreground");
  const contagem = useQuery({
    queryKey: [...queryKeys.workouts.all, "counts"],
    queryFn: fetchWorkoutCounts,
  });
  const rotina = useQuery({
    queryKey: queryKeys.workouts.activeRoutine(),
    queryFn: fetchActiveRoutine,
  });
  const recentes = useQuery({
    queryKey: [...queryKeys.workouts.all, "completed-recent"],
    queryFn: () => {
      const inicio = startOfWeek(new Date(), { weekStartsOn: 1 });
      return fetchCompletedWorkouts(
        toISODate(addDays(inicio, -7 * 25)),
        toISODate(addDays(inicio, 6)),
      );
    },
  });
  const pesos = useQuery({
    queryKey: [...queryKeys.body.all, "weigh-ins", 30],
    queryFn: () => fetchWeighIns(30),
  });

  const r = rotina.data;
  const diasDoPlano = new Set(
    r
      ? r.scheduleMode === "fixed"
        ? r.templates.flatMap((t) => t.weekdays)
        : r.trainingWeekdays
      : [],
  );
  const sequencia = diasSeguidos(
    new Set((recentes.data ?? []).map((w) => w.date)),
    (wd) => diasDoPlano.has(wd),
    hoje,
  );

  // Últimas 12 semanas (segunda a domingo), da mais antiga à atual.
  const semanas = useMemo(() => {
    const atual = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 12 }, (_, i) => {
      const ini = toISODate(addDays(atual, -7 * (11 - i)));
      const fim = toISODate(addDays(atual, -7 * (11 - i) + 6));
      return {
        label: formatDate(ini, "d/MM"),
        value: (recentes.data ?? []).filter((w) => w.date >= ini && w.date <= fim).length,
      };
    });
  }, [recentes.data]);
  const estaSemana = semanas[semanas.length - 1]!.value;
  const meta = rotina.data?.daysPerWeek ?? null;
  const variacao =
    pesos.data && pesos.data.length >= 2
      ? pesos.data[pesos.data.length - 1]!.kg - pesos.data[0]!.kg
      : null;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-28">
      <PageHeader
        title="Estatísticas"
        description="Progresso e histórico"
        action={
          <HeaderIconButton
            icon={history}
            label="Calendário de treinos"
            onPress={() => router.push("/workouts/calendar")}
          />
        }
      />
      <View className="px-4 pt-2">
        {/* Herói: a semana atual contra a meta e as últimas 12 semanas. */}
        <View className="flex-row items-start justify-between gap-3">
          <View>
            <Text className="text-xs font-bold uppercase tracking-[1.7px] text-primary">
              Esta semana
            </Text>
            {recentes.isPending ? (
              <View className="mt-2 h-12 w-24 rounded-md bg-muted" />
            ) : (
              <View className="mt-1 flex-row items-baseline gap-1.5">
                <Text className="text-6xl font-extrabold leading-none">{estaSemana}</Text>
                {meta ? (
                  <Text className="text-xl font-bold text-muted-foreground">/ {meta}</Text>
                ) : null}
                <Text className="ml-1 text-sm text-muted-foreground">treinos</Text>
              </View>
            )}
          </View>
          <View
            className={cn(
              "flex-row items-center gap-1.5 rounded-full px-3 py-1.5",
              sequencia === 0 && "bg-muted",
            )}
            style={sequencia > 0 ? { backgroundColor: `${LARANJA}26` } : undefined}
          >
            <Icon
              node={flame}
              size={16}
              color={sequencia > 0 ? LARANJA : apagada}
              fill={sequencia > 0 ? "#FFB01F" : undefined}
            />
            <Text
              className="text-sm font-extrabold"
              style={{ color: sequencia > 0 ? LARANJA : undefined }}
            >
              {rotina.isPending ? "…" : sequencia} {sequencia === 1 ? "dia" : "dias"}
            </Text>
          </View>
        </View>
        {meta && !recentes.isPending ? (
          <View className="mt-4 h-2 overflow-hidden rounded-full bg-primary/15">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (estaSemana / meta) * 100)}%` }}
            />
          </View>
        ) : null}
        <View className="mt-4">
          {recentes.isPending ? (
            <View className="h-40 w-full rounded-md bg-muted" />
          ) : (
            <WeeklyChart data={semanas} goal={meta} height={160} />
          )}
        </View>
        <Text className="mt-1 text-center text-xs text-muted-foreground">Treinos por semana</Text>

        <View className="mt-6 flex-row border-y border-border py-4">
          <Numero icon={dumbbell} rotulo="Treinos" valor={contagem.data?.total} solido />
          <Numero icon={calendarDays} rotulo="Este mês" valor={contagem.data?.month} borda />
          <Numero
            icon={scale}
            rotulo="Peso 30d"
            borda
            valor={
              pesos.isPending
                ? undefined
                : variacao === null
                  ? "—"
                  : `${variacao > 0 ? "+" : ""}${variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`
            }
            unidade={variacao === null ? undefined : "kg"}
          />
        </View>

        <Titulo>Atividade — últimos 12 meses</Titulo>
        <ActivityHeatmap />

        <MusculosCard />

        <Historico />
      </View>
    </ScrollView>
  );
}

function Titulo({ children }: { children: ReactNode }) {
  return (
    <View className="mb-3 mt-7 flex-row items-center gap-2 px-1">
      <View className="h-5 w-1.5 rounded-full bg-primary" />
      <Text className="text-lg font-bold">{children}</Text>
    </View>
  );
}

function Numero({
  icon,
  rotulo,
  valor,
  unidade,
  solido = false,
  borda = false,
}: {
  icon: IconNode;
  rotulo: string;
  valor: number | string | undefined;
  unidade?: string;
  solido?: boolean;
  borda?: boolean;
}) {
  const apagada = useColor("muted-foreground");
  return (
    <View className={cn("flex-1 items-center px-2", borda && "border-l border-border")}>
      {valor === undefined ? (
        <View className="h-8 w-12 rounded-md bg-muted" />
      ) : (
        <Text className={cn("text-3xl font-extrabold leading-none", solido && "text-primary")}>
          {valor}
          {unidade ? (
            <Text className="text-sm font-bold text-muted-foreground"> {unidade}</Text>
          ) : null}
        </Text>
      )}
      <View className="mt-1.5 flex-row items-center gap-1">
        <Icon node={icon} color={apagada} size={14} />
        <Text className="text-xs font-medium text-muted-foreground">{rotulo}</Text>
      </View>
    </View>
  );
}

const PERIODOS = [
  { value: 1, label: "Semana" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
] as const;

/** Equilíbrio muscular (séries por músculo), fadiga e força, numa aba só. */
function MusculosCard() {
  const [aba, setAba] = useState<"equilibrio" | "fadiga" | "forca">("equilibrio");
  const [periodo, setPeriodo] = useState<number>(30);
  const primaria = useColor("primary");
  const series = useQuery({
    queryKey: queryKeys.workouts.muscleSets(),
    queryFn: () => fetchMuscleSetEntries(13),
  });
  const recordes = useQuery({
    queryKey: queryKeys.workouts.personalRecords(),
    queryFn: () => fetchPersonalRecords(20),
  });

  const porMusculo = useMemo(() => {
    const corte =
      periodo === 1
        ? toISODate(startOfWeek(new Date(), { weekStartsOn: 1 }))
        : toISODate(addDays(new Date(), -periodo));
    const soma = new Map<string, number>();
    for (const e of series.data ?? [])
      if (e.day >= corte) soma.set(e.muscle, (soma.get(e.muscle) ?? 0) + e.sets);
    const max = Math.max(1, ...soma.values());
    return [...soma].map(([muscle, sets]) => ({ muscle, intensity: sets / max }));
  }, [series.data, periodo]);
  const maxRecorde = Math.max(1, ...(recordes.data ?? []).map((r) => r.e1rm));

  return (
    <View>
      <Titulo>Músculos</Titulo>
      <Abas
        value={aba}
        onChange={setAba}
        options={[
          { value: "equilibrio", label: "Equilíbrio" },
          { value: "fadiga", label: "Fadiga" },
          { value: "forca", label: "Força" },
        ]}
      />

      {aba === "equilibrio" ? (
        <View className="mt-4">
          <Text className="mb-3 text-muted-foreground">
            Equilíbrio muscular · por séries feitas
          </Text>
          <Abas
            value={periodo}
            onChange={setPeriodo}
            options={PERIODOS.map((p) => ({ value: p.value, label: p.label }))}
          />
          {series.isPending ? (
            <View className="mt-4 h-64 w-full rounded-md bg-muted" />
          ) : series.isError ? (
            <ErrorState
              message={errorMessage(series.error)}
              onRetry={() => void series.refetch()}
              compact
            />
          ) : porMusculo.length === 0 ? (
            <Text className="mt-6 text-center text-muted-foreground">
              Nenhuma série neste período.
            </Text>
          ) : (
            <View className="mt-4 items-center">
              <BodyMap muscles={porMusculo} size="lg" showLegend={false} />
            </View>
          )}
        </View>
      ) : null}

      {aba === "fadiga" ? (
        <View className="mt-4">
          <RecoveryCard />
        </View>
      ) : null}

      {aba === "forca" ? (
        <View className="mt-4">
          {recordes.isPending ? (
            <View className="h-40 w-full rounded-md bg-muted" />
          ) : (recordes.data ?? []).length === 0 ? (
            <Text className="py-6 text-center text-muted-foreground">
              Seus recordes aparecem aqui depois do primeiro treino com carga.
            </Text>
          ) : (
            (recordes.data ?? []).map((r, i) => (
              <Pressable
                key={r.exerciseId}
                onPress={() =>
                  router.push({ pathname: "/exercises/[id]", params: { id: r.exerciseId } })
                }
                className={cn("py-3 active:bg-primary/5", i > 0 && "border-t border-border/60")}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className={cn(
                      "h-9 w-9 items-center justify-center rounded-xl",
                      i === 0 ? "bg-[#01D798]" : "bg-primary/15",
                    )}
                  >
                    <Icon node={trophy} color={i === 0 ? "#020306" : primaria} size={16} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text numberOfLines={1} className="font-semibold">
                      {r.exerciseName}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {formatDate(r.date, "d 'de' MMM")} · {r.weightKg.toLocaleString("pt-BR")} kg ×{" "}
                      {r.reps}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-lg font-extrabold leading-none text-primary">
                      {Math.round(r.e1rm)}
                    </Text>
                    <Text className="text-[10px] font-medium uppercase text-muted-foreground">
                      1RM kg
                    </Text>
                  </View>
                </View>
                <View className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-primary/10">
                  <View
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(r.e1rm / maxRecorde) * 100}%` }}
                  />
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Fadiga — o `RecoveryCard` do web: o boneco colorido pela recuperação e a lista. */
function RecoveryCard() {
  const userId = useCurrentUserId();
  const corDe = useCorRecuperacao();
  const recovery = useQuery({
    queryKey: queryKeys.workouts.recovery(),
    queryFn: () => fetchMuscleRecovery(userId),
    enabled: Boolean(userId),
  });

  if (recovery.isPending) return <View className="h-48 w-full rounded-xl bg-muted" />;
  if (recovery.isError) {
    return (
      <ErrorState
        message={errorMessage(recovery.error)}
        onRetry={() => void recovery.refetch()}
        compact
      />
    );
  }
  const musculos = [...recovery.data].sort((a, b) => a.percent - b.percent);
  if (musculos.length === 0) {
    return (
      <Text className="px-1 text-sm text-muted-foreground">
        Nenhum músculo treinado nos últimos dias — tudo descansado.
      </Text>
    );
  }

  return (
    <View className="gap-4">
      <View className="items-center">
        <BodyMap
          muscles={musculos.map((m) => ({
            muscle: m.muscle,
            // Fadigado aparece forte; pronto, suave — cada um na sua cor.
            intensity: m.status === "recovered" ? 0.35 : 1 - m.ratio,
            color: corDe(m.status),
          }))}
          size="sm"
          showToggle={false}
          showLegend={false}
        />
        <Text className="mt-1 text-center text-xs text-muted-foreground">
          Laranja: fadigado · verde: pronto
        </Text>
      </View>
      <View className="gap-2.5">
        {musculos.slice(0, 8).map((m) => (
          <View key={m.muscle}>
            <View className="flex-row items-baseline justify-between gap-2">
              <Text className="text-sm font-medium">{label(MUSCLE_LABELS, m.muscle)}</Text>
              <Text className="text-xs text-muted-foreground">
                {RECOVERY_STATUS_LABELS[m.status]} · {describeRemaining(m)}
              </Text>
            </View>
            <View
              accessibilityLabel={`${label(MUSCLE_LABELS, m.muscle)}: ${m.percent}% recuperado`}
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <View
                className="h-full rounded-full"
                style={{ width: `${m.percent}%`, backgroundColor: corDe(m.status) }}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Últimos treinos, com o volume de cada um comparado ao maior da lista. */
function Historico() {
  const historico = useQuery({
    queryKey: queryKeys.workouts.history(),
    queryFn: () => fetchRecentSessions(10),
  });
  const lista = historico.data ?? [];
  const maxVolume = Math.max(1, ...lista.map((s) => Number(s.total_volume_kg ?? 0)));

  return (
    <View>
      <Titulo>Últimos treinos</Titulo>
      {historico.isPending ? (
        <View className="h-32 w-full rounded-[20px] bg-muted" />
      ) : lista.length === 0 ? (
        <Text className="px-1 text-muted-foreground">Nenhum treino concluído ainda.</Text>
      ) : (
        lista.map((s, i) => {
          const volume = Number(s.total_volume_kg ?? 0);
          return (
            <Pressable
              key={s.id}
              onPress={() =>
                router.push({ pathname: "/workouts/session/[id]", params: { id: s.id } })
              }
              className={cn(
                "flex-row items-center gap-3 py-3.5 active:bg-primary/5",
                i > 0 && "border-t border-border/60",
              )}
            >
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                <Text className="text-base font-extrabold leading-none text-primary">
                  {formatDate(s.started_at, "d")}
                </Text>
                <Text className="text-[10px] font-bold uppercase leading-none text-primary">
                  {formatDate(s.started_at, "MMM")}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-baseline justify-between gap-2">
                  <Text numberOfLines={1} className="shrink font-semibold">
                    {s.name}
                  </Text>
                  <Text className="text-sm font-bold">
                    {Math.round(volume).toLocaleString("pt-BR")} kg
                  </Text>
                </View>
                <Text className="mt-0.5 text-xs capitalize text-muted-foreground">
                  {formatDate(s.started_at, "EEEE")} · {formatDuration(s.duration_seconds)}
                </Text>
                <View className="mt-2 h-1 overflow-hidden rounded-full bg-primary/10">
                  <View
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(volume / maxVolume) * 100}%` }}
                  />
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

function Abas<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-2xl bg-elevated p-1">
      {options.map((o) => (
        <Pressable
          key={String(o.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === o.value }}
          onPress={() => onChange(o.value)}
          className={cn("flex-1 items-center rounded-xl py-2.5", value === o.value && "bg-primary")}
        >
          <Text
            className={cn(
              "text-[15px]",
              value === o.value
                ? "font-bold text-primary-foreground"
                : "font-medium text-muted-foreground",
            )}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
