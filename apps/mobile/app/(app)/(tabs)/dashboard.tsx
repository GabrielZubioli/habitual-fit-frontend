import { WEEKDAY_LABELS, WEEKDAY_SHORT } from "@forja/app-core/lib/labels";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, startOfWeek } from "date-fns";
import { __iconNode as arrowDown } from "lucide-react/dist/esm/icons/arrow-down.js";
import { __iconNode as arrowUp } from "lucide-react/dist/esm/icons/arrow-up.js";
import { __iconNode as calendarDays } from "lucide-react/dist/esm/icons/calendar-days.js";
import { __iconNode as check } from "lucide-react/dist/esm/icons/check.js";
import { __iconNode as chevronLeft } from "lucide-react/dist/esm/icons/chevron-left.js";
import { __iconNode as chevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as flame } from "lucide-react/dist/esm/icons/flame.js";
import { __iconNode as moon } from "lucide-react/dist/esm/icons/moon.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { __iconNode as target } from "lucide-react/dist/esm/icons/target.js";
import { __iconNode as utensils } from "lucide-react/dist/esm/icons/utensils.js";
import {
  ema,
  nutritionTotals,
  projectSchedule,
  todaysWorkout,
  weekStart,
  weekdayOf,
} from "@forja/domain";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage, num } from "@forja/app-core/data/supabase-helpers";
import { fetchProfile } from "@forja/app-core/data/profile";
import {
  fetchActiveRoutine,
  fetchCompletedWorkouts,
  scheduleInputOf,
} from "@forja/app-core/data/routines";
import { openWorkoutForTemplate } from "@forja/app-core/data/workout-session";
import {
  ensureDayMaterialized,
  entryPortion,
  fetchDayEntries,
} from "@forja/app-core/data/diet-day";
import { ensureActiveMealPlan } from "@forja/app-core/data/meal-plans";
import { fetchGoalWeight, fetchWeighIns } from "@forja/app-core/data/body";
import {
  formatDate,
  formatLongDate,
  fromISODate,
  toISODate,
  todayISO,
} from "@forja/app-core/lib/date";
import { useStreak } from "@forja/app-core/hooks/use-streak";
import { cn } from "@/lib/cn";
import { useCurrentUserId } from "@/lib/session";
import { useColor } from "@/theme/theme";
import { BrandLogo } from "@/ui/brand-logo";
import { NoRoutineCard } from "@/ui/card";
import { WeightChart } from "@/ui/charts";
import { ReadinessCard, WaterCard } from "@/ui/home-cards";
import { Icon } from "@/ui/icon";
import { PageScroll } from "@/ui/page-header";
import { CalorieRing } from "@/ui/macro-rings";
import { Text } from "@/ui/text";
import { LOCALE } from "@forja/app-core/i18n";
import { t } from "@forja/app-core/i18n";

/**
 * Início — o `dashboard.tsx` do web: a sequência, a semana com o treino de
 * hoje, a prontidão, o peso contra a meta, a dieta do dia e a água. Gráficos
 * longos e histórico ficam em Estatísticas.
 */
const INICIAIS = WEEKDAY_SHORT;
const LARANJA = "#FF7A1F";
const semLetra = (nome: string) => nome.replace(/^[A-Z]\s*—\s*/, "");

export default function Home() {
  const today = todayISO();
  const insets = useSafeAreaInsets();
  const [erro, setErro] = useState<string | null>(null);
  const falhou = (e: unknown) => setErro(errorMessage(e));
  const profile = useQuery({ queryKey: queryKeys.profile(), queryFn: fetchProfile });
  const data = formatLongDate(today).toLowerCase();

  return (
    <PageScroll
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pb-28 pt-3"
      header={
        <View className="items-center pb-3" style={{ paddingTop: Math.max(24, insets.top) }}>
          <BrandLogo height={48} />
          <Text className="mt-2 text-lg text-muted-foreground">
            {data.charAt(0).toUpperCase() + data.slice(1)}
          </Text>
        </View>
      }
    >
      {erro ? (
        <Pressable
          onPress={() => setErro(null)}
          className="mb-4 rounded-xl bg-destructive-soft px-3.5 py-3"
        >
          <Text className="text-sm font-medium text-destructive">{erro}</Text>
        </Pressable>
      ) : null}

      <View className="gap-4">
        <SequenciaCard />
        <SemanaCard onError={falhou} />
        <ReadinessCard />
        <PesoCard />
        <DietaCard
          kcalTarget={num(profile.data?.daily_kcal_target)}
          proteinTarget={num(profile.data?.protein_g_target)}
          loadingProfile={profile.isPending}
        />
        <WaterCard
          date={today}
          targetMl={num(profile.data?.water_ml_target, 2500)}
          onError={falhou}
        />
      </View>
    </PageScroll>
  );
}

/** A semana navegável e o treino de hoje com o botão de começar. */
function SemanaCard({ onError }: { onError: (e: unknown) => void }) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const today = todayISO();
  const [offset, setOffset] = useState(0);
  const [selecionado, setSelecionado] = useState(today);
  const texto = useColor("foreground");
  const branco = useColor("primary-foreground");
  const apagada = useColor("muted-foreground");

  const routine = useQuery({
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

  const comecar = useMutation({
    mutationFn: (templateId: string) => openWorkoutForTemplate(userId, templateId),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.workouts.all });
      router.push({ pathname: "/workouts/session/[id]", params: { id } });
    },
    onError,
  });

  const dias = useMemo(() => {
    const inicio = addDays(fromISODate(weekStart(today)), offset * 7);
    return Array.from({ length: 7 }, (_, i) => toISODate(addDays(inicio, i)));
  }, [today, offset]);

  if (routine.isPending) return <View className="h-64 w-full rounded-3xl bg-muted" />;
  // Sem rotina ou com o plano em branco: convite a montar, não "Descanso".
  if (!routine.data || routine.data.templates.length === 0) return <NoRoutineCard />;

  const r = routine.data;
  const entrada = scheduleInputOf(r);
  const feitos = recentes.data ?? [];
  const { splitIndex, isPlannedDay, alreadyDone } = todaysWorkout(today, entrada, feitos);
  const template = r.templates[splitIndex];
  const proximo = projectSchedule(
    Array.from({ length: 7 }, (_, i) => toISODate(addDays(fromISODate(today), i + 1))),
    today,
    entrada,
    feitos,
  ).find((d) => d.splitIndex !== null);

  const titulo =
    offset === 0
      ? t("Esta semana")
      : offset === -1
        ? t("Semana passada")
        : offset === 1
          ? t("Próxima semana")
          : `${formatDate(dias[0]!, t("d MMM"))} – ${formatDate(dias[6]!, t("d MMM"))}`;

  const previsto = (() => {
    const i = projectSchedule([selecionado], today, entrada, feitos)[0]?.splitIndex;
    return i != null ? (r.templates[i] ? semLetra(r.templates[i].name) : null) : null;
  })();

  return (
    <View className="rounded-3xl bg-card p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Pressable
          onPress={() => setOffset((o) => o - 1)}
          accessibilityLabel={t("Semana anterior")}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-elevated"
        >
          <Icon node={chevronLeft} color={texto} size={20} />
        </Pressable>
        <Text className="text-lg text-muted-foreground">{titulo}</Text>
        <Pressable
          onPress={() => setOffset((o) => o + 1)}
          accessibilityLabel={t("Próxima semana")}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-elevated"
        >
          <Icon node={chevronRight} color={texto} size={20} />
        </Pressable>
      </View>

      <View className="flex-row">
        {dias.map((dia) => {
          const eHoje = dia === today;
          return (
            <Pressable
              key={dia}
              onPress={() => setSelecionado(dia)}
              accessibilityState={{ selected: dia === selecionado }}
              className="flex-1 items-center gap-1"
            >
              <Text className="text-sm text-muted-foreground">{INICIAIS[weekdayOf(dia)]}</Text>
              <View
                className={cn(
                  "h-11 w-11 items-center justify-center rounded-full",
                  eHoje && "bg-primary",
                  !eHoje && dia === selecionado && "border-2 border-primary bg-elevated",
                )}
              >
                <Text
                  className={cn(
                    "text-xl",
                    eHoje
                      ? "font-extrabold text-primary-foreground"
                      : dia === selecionado && "font-bold",
                  )}
                >
                  {Number(dia.slice(8))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {selecionado !== today ? (
        <View className="mt-4 rounded-2xl bg-elevated p-4">
          <Text className="text-sm uppercase tracking-wide text-muted-foreground">
            {formatDate(selecionado, t("EEEE, d 'de' MMM"))}
          </Text>
          {feitos.filter((w) => w.date === selecionado).length > 0 ? (
            <View className="mt-2 gap-2">
              {feitos
                .filter((w) => w.date === selecionado)
                .map((w) => (
                  <Pressable
                    key={w.sessionId}
                    onPress={() =>
                      router.push({
                        pathname: "/workouts/session/[id]",
                        params: { id: w.sessionId },
                      })
                    }
                    className="flex-row items-center gap-3"
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
                      <Icon node={check} color={branco} size={20} strokeWidth={3} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-lg">
                        {semLetra(w.name)}
                      </Text>
                      <Text className="text-sm text-muted-foreground">{t("Treino concluído")}</Text>
                    </View>
                    <Icon node={chevronRight} color={apagada} size={20} />
                  </Pressable>
                ))}
            </View>
          ) : (
            <View className="mt-2 flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Icon
                  node={previsto && selecionado >= today ? dumbbell : moon}
                  color={apagada}
                  size={20}
                />
              </View>
              <Text numberOfLines={1} className="min-w-0 flex-1 text-lg">
                {selecionado < today
                  ? previsto
                    ? t("Não treinou · era {{previsto}}", { previsto })
                    : t("Descanso")
                  : previsto
                    ? t("Previsto: {{previsto}}", { previsto })
                    : t("Descanso")}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View className="mt-4 flex-row items-center gap-4 rounded-2xl bg-elevated p-4">
          <View
            className={cn(
              "h-12 w-12 items-center justify-center rounded-xl",
              isPlannedDay && !alreadyDone ? "bg-primary" : "bg-muted",
            )}
          >
            <Icon
              node={isPlannedDay ? dumbbell : moon}
              color={isPlannedDay && !alreadyDone ? branco : apagada}
              size={24}
            />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm uppercase tracking-wide text-muted-foreground">
              {t("Hoje")}
            </Text>
            <Text numberOfLines={1} className="text-xl">
              {alreadyDone
                ? t("Treino concluído")
                : isPlannedDay && template
                  ? semLetra(template.name)
                  : proximo
                    ? t("Descanso · {{v0}} tem treino", {
                        v0: WEEKDAY_LABELS[proximo.weekday].toLowerCase(),
                      })
                    : t("Descanso")}
            </Text>
          </View>
          {template && !alreadyDone ? (
            <Pressable
              onPress={() => comecar.mutate(template.id)}
              disabled={comecar.isPending}
              className={cn(
                "rounded-xl bg-primary-soft px-4 py-2",
                comecar.isPending && "opacity-60",
              )}
            >
              <Text className="text-lg font-medium text-primary-soft-foreground">
                {isPlannedDay ? t("Começar") : t("Treinar")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** A dieta do dia em uma linha: kcal e proteína contra a meta (ou só o consumido). */
function DietaCard({
  kcalTarget,
  proteinTarget,
  loadingProfile,
}: {
  kcalTarget: number;
  proteinTarget: number;
  loadingProfile: boolean;
}) {
  const userId = useCurrentUserId();
  const today = todayISO();
  const apagada = useColor("muted-foreground");
  const proteina = useColor("chart-1");
  const diario = useQuery({
    queryKey: queryKeys.diet.log(today),
    enabled: Boolean(userId),
    queryFn: async () => {
      await ensureActiveMealPlan(userId);
      await ensureDayMaterialized(userId, today, today);
      return fetchDayEntries(today);
    },
  });

  const linhas = diario.data ?? [];
  const totais = nutritionTotals(linhas.filter((e) => e.consumed).map(entryPortion));
  const planejado = nutritionTotals(linhas.map(entryPortion)).kcal;
  const pendentes = linhas.filter((e) => !e.consumed).length;
  const pctProteina =
    proteinTarget > 0 ? Math.min(100, (totais.proteinG / proteinTarget) * 100) : 0;
  const restante = Math.round(kcalTarget - totais.kcal);
  const semMeta = kcalTarget <= 0;
  const vazio = !diario.isPending && linhas.length === 0;

  return (
    <Pressable
      onPress={() => router.push("/diet")}
      accessibilityLabel={t("Abrir a dieta de hoje")}
      className="flex-row items-center gap-4 rounded-3xl bg-card p-4 active:bg-elevated"
    >
      {diario.isPending || loadingProfile ? (
        <View className="h-[88px] w-[88px] rounded-full bg-muted" />
      ) : (
        <CalorieRing
          consumed={totais.kcal}
          target={kcalTarget}
          planejado={planejado}
          size={88}
          compacto
        />
      )}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Icon node={utensils} color={apagada} size={14} />
          <Text className="text-xs font-bold uppercase tracking-[1.7px] text-muted-foreground">
            {t("Dieta de hoje")}
          </Text>
        </View>
        <Text className="mt-1 text-lg font-extrabold">
          {Math.round(totais.kcal).toLocaleString(LOCALE)}
          <Text className="text-sm font-medium text-muted-foreground">
            {semMeta ? t(" kcal hoje") : ` / ${Math.round(kcalTarget).toLocaleString(LOCALE)} kcal`}
          </Text>
        </Text>
        {vazio ? (
          <Text className="mt-1.5 text-sm text-muted-foreground">
            {t("Nada registrado ainda. Monte suas refeições e adicione o que comer.")}
          </Text>
        ) : semMeta ? (
          <Text className="mt-1.5 text-sm text-muted-foreground">
            {t("Proteína: {{v0}} g", { v0: Math.round(totais.proteinG) })}
          </Text>
        ) : (
          <View className="mt-2">
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">{t("Proteína")}</Text>
              <Text className="text-xs text-muted-foreground">
                {t("{{v0}}/{{v1}} g", {
                  v0: Math.round(totais.proteinG),
                  v1: Math.round(proteinTarget),
                })}
              </Text>
            </View>
            <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <View
                className="h-full rounded-full"
                style={{ width: `${pctProteina}%`, backgroundColor: proteina }}
              />
            </View>
          </View>
        )}
        {!diario.isPending && pendentes > 0 ? (
          <Text className="mt-1.5 text-xs text-muted-foreground">
            {!semMeta && restante > 0
              ? t("Faltam {{v0}} kcal · ", { v0: restante.toLocaleString(LOCALE) })
              : ""}
            {pendentes} {pendentes === 1 ? "item" : "itens"} {t("a marcar")}
          </Text>
        ) : null}
      </View>
      <Icon node={chevronRight} color={apagada} size={20} />
    </Pressable>
  );
}

/** Peso corporal contra a meta, com o gráfico de 90 dias. */
function PesoCard() {
  const aviso = useColor("warning");
  const primaria = useColor("primary");
  const pesos = useQuery({
    queryKey: [...queryKeys.body.all, "weigh-ins", 90],
    queryFn: () => fetchWeighIns(90),
  });
  const meta = useQuery({
    queryKey: [...queryKeys.body.all, "goal-weight"],
    queryFn: fetchGoalWeight,
  });

  const lista = pesos.data ?? [];
  const tendencia = ema(
    lista.map((p) => p.kg),
    0.25,
  );
  const atual = lista.at(-1);
  const anterior = lista.at(-2);
  const delta = atual && anterior ? atual.kg - anterior.kg : null;
  const falta = atual && meta.data ? atual.kg - meta.data : null;
  const fmt = (n: number) => n.toLocaleString(LOCALE, { maximumFractionDigits: 1 });

  return (
    <View className="rounded-3xl bg-card p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg text-muted-foreground">{t("Peso corporal")}</Text>
        <View className="flex-row items-center gap-4">
          {meta.data ? (
            <View className="flex-row items-center gap-1">
              <Icon node={target} color={aviso} size={20} />
              <Text className="text-lg text-warning">{fmt(meta.data)}</Text>
            </View>
          ) : null}
          <Pressable onPress={() => router.push("/body")} className="flex-row items-center gap-1">
            <Icon node={plus} color={primaria} size={20} />
            <Text className="text-lg text-primary">{t("Registrar")}</Text>
          </Pressable>
        </View>
      </View>

      {pesos.isPending ? (
        <View className="mt-3 h-40 w-full rounded-md bg-muted" />
      ) : !atual ? (
        <Text className="mt-3 text-muted-foreground">
          {t("Registre seu peso para acompanhar a tendência.")}
        </Text>
      ) : (
        <>
          <View className="mt-2 flex-row items-end justify-between gap-3">
            <View className="flex-row items-baseline gap-2">
              <Text className="text-5xl font-extrabold">{fmt(atual.kg)}</Text>
              <Text className="text-2xl font-bold text-muted-foreground">{t("kg")}</Text>
              {delta !== null && Math.abs(delta) >= 0.05 ? (
                <View className="flex-row items-center">
                  <Icon node={delta < 0 ? arrowDown : arrowUp} color={primaria} size={16} />
                  <Text className="text-lg text-primary">{fmt(Math.abs(delta))}</Text>
                </View>
              ) : null}
            </View>
            <Text className="pb-1 text-muted-foreground">
              {formatDate(atual.date, t("EEE d MMM"))}
            </Text>
          </View>
          {meta.data && falta !== null ? (
            <View className="mt-1 flex-row items-center gap-1.5">
              <Icon node={target} color={aviso} size={20} />
              <Text className="text-lg text-warning">
                {t("Meta {{v0}} kg", { v0: fmt(meta.data) })}
                {Math.abs(falta) >= 0.1
                  ? ` · ${fmt(Math.abs(falta))} kg para ${falta > 0 ? "perder" : "ganhar"}`
                  : ""}
              </Text>
            </View>
          ) : null}
          {lista.length >= 2 ? (
            <View className="mt-4">
              <WeightChart
                height={176}
                goal={meta.data}
                data={lista.map((p, i) => ({
                  label: formatDate(p.date, t("d MMM")),
                  peso: p.kg,
                  tendencia: Math.round(tendencia[i]! * 10) / 10,
                }))}
              />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

/** Dias seguidos de treino e a semana atual. Toca e vai ao calendário. */
function SequenciaCard() {
  const today = todayISO();
  const { dias, treinou } = useStreak();
  const apagada = useColor("muted-foreground");
  const muted = useColor("muted");
  const aceso = dias > 0;
  const semana = Array.from({ length: 7 }, (_, i) =>
    toISODate(addDays(fromISODate(weekStart(today)), i)),
  );

  return (
    <Pressable
      onPress={() => router.push("/workouts/calendar")}
      accessibilityLabel={t("{{dias}} {{v1}} de treino. Ver calendário", {
        dias,
        v1: dias === 1 ? "dia seguido" : "dias seguidos",
      })}
      className="rounded-3xl border border-border bg-card p-5 active:bg-elevated"
    >
      <View className="absolute right-4 top-4">
        <Icon node={calendarDays} color={apagada} size={20} />
      </View>
      <View className="flex-row items-center">
        <Icon
          node={flame}
          size={80}
          strokeWidth={1.5}
          color={aceso ? "#FF5A1F" : apagada}
          fill={aceso ? "#FFB01F" : muted}
        />
        <View className="min-w-0">
          <Text className="text-6xl font-extrabold leading-none">{dias}</Text>
          <Text className="text-lg font-semibold">
            {dias === 1 ? t("dia seguido") : t("dias seguidos")}
          </Text>
        </View>
      </View>
      <View className="mt-4 flex-row gap-1.5">
        {semana.map((d) => (
          <View key={d} className="flex-1 items-center gap-1">
            <View
              className="h-1.5 w-full rounded-full"
              style={{
                backgroundColor: treinou.has(d) ? LARANJA : muted,
                ...(d === today && !treinou.has(d)
                  ? { borderWidth: 1, borderColor: `${LARANJA}99` }
                  : null),
              }}
            />
            <Text
              className={cn(
                "text-[10px] font-bold",
                d === today ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {INICIAIS[weekdayOf(d)].charAt(0)}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}
