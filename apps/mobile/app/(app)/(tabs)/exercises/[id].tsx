import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { __iconNode as circlePlay } from "lucide-react/dist/esm/icons/circle-play.js";
import { __iconNode as externalLink } from "lucide-react/dist/esm/icons/external-link.js";
import { __iconNode as flag } from "lucide-react/dist/esm/icons/flag.js";
import { __iconNode as target } from "lucide-react/dist/esm/icons/target.js";
import { __iconNode as trendingUp } from "lucide-react/dist/esm/icons/trending-up.js";
import { exerciseMedia, isSafeUrl, videoSearchUrl } from "@forja/app-core/data/exercise-media";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import {
  PERIODS,
  exerciseProgress,
  fetchExerciseDetail,
  fetchExerciseHistory,
  summarizeExerciseSessions,
  type Period,
  type SessionSummary,
} from "@forja/app-core/data/exercise-detail";
import { aggregateMuscleIntensities } from "@forja/app-core/lib/body-map/intensity";
import {
  EQUIPMENT_LABELS,
  EXERCISE_LEVEL_LABELS,
  MECHANIC_LABELS,
  MUSCLE_LABELS,
  label,
} from "@forja/app-core/lib/labels";
import { formatDate, formatDayMonth } from "@forja/app-core/lib/date";
import { cn } from "@/lib/cn";
import { useCurrentUserId } from "@/lib/session";
import { useColor } from "@/theme/theme";
import { BodyMap } from "@/ui/body-map";
import { Button } from "@/ui/button";
import { EmptyState, ErrorState } from "@/ui/card";
import { AreaChart, BarChart } from "@/ui/charts";
import { ExerciseMediaView } from "@/ui/exercise-demo";
import { ExerciseHowTo } from "@/ui/exercise-how-to";
import { FavoriteButton } from "@/ui/favorite-button";
import { Icon } from "@/ui/icon";
import { BackButton, PageScroll } from "@/ui/page-header";
import { Text } from "@/ui/text";

/** A ficha do exercício — o `exercises_.$id.tsx` do web: como fazer e o seu histórico. */
export default function Tela() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // A tela fica montada entre um exercício e outro: o `key` zera aba e período.
  return <ExerciseDetail key={id} id={id} />;
}

function ExerciseDetail({ id }: { id: string }) {
  const userId = useCurrentUserId();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>("180");
  const [aba, setAba] = useState<"como" | "historico">("como");
  const texto = useColor("foreground");
  const primaria = useColor("primary");
  const apagada = useColor("muted-foreground");

  const exercise = useQuery({ queryKey: ["exercise", id], queryFn: () => fetchExerciseDetail(id) });
  const history = useQuery({
    queryKey: ["exercise-history", id, period],
    queryFn: () => fetchExerciseHistory(id, userId, period),
    // A sessão chega um instante depois da tela: sem id, nada de consulta.
    enabled: Boolean(userId),
  });
  const sessions = useMemo(() => summarizeExerciseSessions(history.data ?? []), [history.data]);

  const ex = exercise.data;
  const secundarios = ex?.secondary_muscles ?? [];

  return (
    <PageScroll
      className="flex-1 bg-background"
      contentContainerClassName="px-4 pb-28"
      header={
        <View
          className="flex-row items-center justify-between gap-3 px-4 pb-3"
          style={{ paddingTop: Math.max(24, insets.top) }}
        >
          {/* Volta para onde a pessoa estava: a biblioteca, uma rotina do Plano… */}
          <BackButton fallback="/exercises" />
          <Text className="text-xs font-bold uppercase tracking-[1.7px] text-muted-foreground">
            Exercício
          </Text>
          {ex ? (
            <FavoriteButton exerciseId={ex.id} nome={ex.name} className="h-11 w-11 bg-card" />
          ) : (
            <View className="h-11 w-11" />
          )}
        </View>
      }
    >
      {exercise.isError ? (
        <ErrorState
          message={errorMessage(exercise.error)}
          onRetry={() => void exercise.refetch()}
        />
      ) : !ex ? (
        <>
          <View className="aspect-square w-full rounded-[28px] bg-muted" />
          <View className="mt-4 h-8 w-2/3 rounded-md bg-muted" />
        </>
      ) : (
        <>
          {/* A demonstração é o conteúdo principal: ocupa a largura e anima sozinha. */}
          <View className="overflow-hidden rounded-[28px] bg-white">
            <ExerciseMediaView
              media={exerciseMedia({
                name: ex.name,
                imageUrls: ex.image_urls,
                externalId: ex.external_id,
                mediaId: ex.media_id,
                mediaRef: ex.media_ref,
                mediaSource: ex.media_source,
                videoUrl: ex.video_url,
              })}
              name={ex.name}
            />
          </View>

          <Text className="mt-5 text-[28px] font-extrabold leading-tight">{ex.name}</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            <View className="rounded-full bg-primary px-3 py-1">
              <Text className="text-sm font-bold text-primary-foreground">
                {label(MUSCLE_LABELS, ex.primary_muscle)}
              </Text>
            </View>
            {[
              label(EQUIPMENT_LABELS, ex.equipment),
              ex.mechanic ? label(MECHANIC_LABELS, ex.mechanic) : null,
              ex.level ? label(EXERCISE_LEVEL_LABELS, ex.level) : null,
            ]
              .filter((t): t is string => Boolean(t))
              .map((t) => (
                <View key={t} className="rounded-full border border-border px-3 py-1">
                  <Text className="text-sm font-medium text-muted-foreground">{t}</Text>
                </View>
              ))}
          </View>
        </>
      )}

      {exercise.isError ? null : (
        <>
          <View accessibilityRole="tablist" className="mt-6 flex-row rounded-2xl bg-card p-1">
            {(
              [
                ["como", "Como fazer"],
                ["historico", "Seu histórico"],
              ] as const
            ).map(([valor, rotulo]) => (
              <Pressable
                key={valor}
                accessibilityRole="tab"
                accessibilityState={{ selected: aba === valor }}
                onPress={() => setAba(valor)}
                className={cn(
                  "flex-1 items-center rounded-xl py-2.5",
                  aba === valor && "bg-primary",
                )}
              >
                <Text
                  className={cn(
                    "text-[15px]",
                    aba === valor
                      ? "font-bold text-primary-foreground"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {rotulo}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="mt-4">
            {aba === "como" ? (
              !ex ? (
                <View className="h-48 w-full rounded-[20px] bg-muted" />
              ) : (
                <>
                  {/* Músculos trabalhados: o mapa diz onde, a lista diz qual. */}
                  <View className="mb-3 rounded-[20px] bg-card p-4">
                    <View className="mb-3 flex-row items-center gap-2">
                      <Icon node={target} color={texto} size={16} />
                      <Text className="font-bold">Músculos trabalhados</Text>
                    </View>
                    <View className="flex-row items-center gap-4">
                      <View className="w-32">
                        <BodyMap
                          muscles={aggregateMuscleIntensities(
                            (ex.exercise_muscles ?? []).map((m) => ({
                              muscle: m.muscle,
                              contribution: Number(m.contribution),
                            })),
                          )}
                          size="sm"
                          showLegend={false}
                          showToggle={false}
                        />
                      </View>
                      <View className="min-w-0 flex-1 gap-3">
                        <View>
                          <Text className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Principal
                          </Text>
                          <View className="mt-0.5 flex-row">
                            <View className="rounded-full bg-primary px-2.5 py-0.5">
                              <Text className="text-sm font-bold text-primary-foreground">
                                {label(MUSCLE_LABELS, ex.primary_muscle)}
                              </Text>
                            </View>
                          </View>
                        </View>
                        {secundarios.length > 0 ? (
                          <View>
                            <Text className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Secundários
                            </Text>
                            <View className="mt-1 flex-row flex-wrap gap-1.5">
                              {secundarios.map((m) => (
                                <View
                                  key={m}
                                  className="rounded-full border border-border px-2.5 py-0.5"
                                >
                                  <Text className="text-xs font-semibold">
                                    {label(MUSCLE_LABELS, m)}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <ExerciseHowTo exercise={ex} />
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(
                        isSafeUrl(ex.video_url) ? ex.video_url : videoSearchUrl(ex.name),
                      )
                    }
                    className="mt-3 flex-row items-center justify-between gap-3 rounded-[20px] border border-border px-4 py-3.5 active:bg-card"
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Icon node={circlePlay} color={primaria} size={20} />
                      <Text className="text-sm font-medium">Ver vídeos de execução</Text>
                    </View>
                    <Icon node={externalLink} color={apagada} size={16} />
                  </Pressable>
                </>
              )
            ) : (
              <Historico
                period={period}
                setPeriod={setPeriod}
                history={history}
                sessions={sessions}
              />
            )}
          </View>
        </>
      )}
    </PageScroll>
  );
}

function Historico({
  period,
  setPeriod,
  history,
  sessions,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  history: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  sessions: SessionSummary[];
}) {
  const aviso = useColor("warning");
  const { recorde, ganho } = exerciseProgress(sessions);
  const e1rm = sessions.map((s) => ({
    label: formatDayMonth(s.date),
    value: Number(s.bestE1rm.toFixed(1)),
  }));
  const volume = sessions.map((s) => ({
    label: formatDayMonth(s.date),
    value: Math.round(s.volume),
  }));

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-4 grow-0"
        contentContainerClassName="items-center gap-2"
      >
        {PERIODS.map((p) => (
          <Pressable
            key={p.value}
            onPress={() => setPeriod(p.value)}
            accessibilityState={{ selected: period === p.value }}
            className={cn(
              "rounded-full border px-3.5 py-1.5",
              period === p.value ? "border-primary bg-primary/10" : "border-border",
            )}
          >
            <Text
              className={cn(
                "text-sm font-semibold",
                period === p.value ? "text-primary" : "text-muted-foreground",
              )}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {history.isPending ? (
        <View className="gap-3">
          <View className="h-24 w-full rounded-[20px] bg-muted" />
          <View className="h-56 w-full rounded-[20px] bg-muted" />
        </View>
      ) : history.isError ? (
        <ErrorState message={errorMessage(history.error)} onRetry={() => void history.refetch()} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={trendingUp}
          title="Sem registros neste período"
          description="Assim que você registrar séries deste exercício, a progressão de carga aparece aqui."
          action={
            <Button onPress={() => router.navigate("/plan")}>
              <Text className="font-semibold text-primary-foreground">Ir para o plano</Text>
            </Button>
          }
        />
      ) : (
        <View className="gap-3">
          <View className="flex-row gap-2">
            <Stat
              destaque
              label="Recorde"
              value={recorde ? `${Math.round(recorde.bestE1rm)}` : "—"}
              unit="kg"
              sub={recorde?.bestSet ? `${recorde.bestSet.weight} × ${recorde.bestSet.reps}` : ""}
            />
            <Stat
              label="Sessões"
              value={String(sessions.length)}
              sub={`${sessions.reduce((n, s) => n + s.workingSets, 0)} séries`}
            />
            <Stat
              label="Evolução"
              value={ganho === null ? "—" : `${ganho >= 0 ? "+" : ""}${ganho.toFixed(0)}%`}
              sub="1RM estimado"
            />
          </View>

          <View className="rounded-[20px] bg-card p-4">
            <Text className="font-bold">Progressão de carga</Text>
            <Text className="text-xs text-muted-foreground">1RM estimado por sessão</Text>
            <View className="mt-3">
              <AreaChart data={e1rm} height={208} />
            </View>
          </View>

          <View className="rounded-[20px] bg-card p-4">
            <Text className="font-bold">Volume por sessão</Text>
            <Text className="text-xs text-muted-foreground">peso × repetições, em kg</Text>
            <View className="mt-3">
              <BarChart data={volume} height={176} />
            </View>
          </View>

          <View className="overflow-hidden rounded-[20px] bg-card">
            <Text className="px-4 pb-1 pt-4 font-bold">Sessões</Text>
            {[...sessions].reverse().map((s, i) => (
              <Pressable
                key={s.sessionId}
                onPress={() =>
                  router.push({ pathname: "/workouts/session/[id]", params: { id: s.sessionId } })
                }
                className={cn(
                  "flex-row items-center gap-3 px-4 py-3 active:bg-elevated",
                  i > 0 && "border-t border-border/60",
                )}
              >
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-elevated">
                  <Text className="text-base font-extrabold leading-none">
                    {formatDate(s.date, "d")}
                  </Text>
                  <Text className="text-[10px] font-bold uppercase leading-none text-muted-foreground">
                    {formatDate(s.date, "MMM")}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-semibold">
                      {s.bestSet ? `${s.bestSet.weight} kg × ${s.bestSet.reps}` : "—"}
                    </Text>
                    {s.hasPr ? (
                      <View className="flex-row items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5">
                        <Icon node={flag} color={aviso} size={12} />
                        <Text className="text-[11px] font-bold text-warning">Recorde</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {s.workingSets} {s.workingSets === 1 ? "série" : "séries"} ·{" "}
                    {Math.round(s.volume).toLocaleString("pt-BR")} kg de volume
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-extrabold">{Math.round(s.bestE1rm)}</Text>
                  <Text className="text-[10px] uppercase text-muted-foreground">1RM kg</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

function Stat({
  label: statLabel,
  value,
  unit,
  sub,
  destaque = false,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  destaque?: boolean;
}) {
  const cor = destaque ? "text-primary-foreground" : "text-foreground";
  return (
    <View className={cn("flex-1 rounded-[20px] p-3.5", destaque ? "bg-primary" : "bg-card")}>
      <Text
        className={cn(
          "text-[11px] font-bold uppercase tracking-wider",
          destaque ? "text-primary-foreground/75" : "text-muted-foreground",
        )}
      >
        {statLabel}
      </Text>
      <Text className={cn("mt-1.5 text-2xl font-extrabold leading-none", cor)}>
        {value}
        {unit && value !== "—" ? (
          <Text className={cn("text-sm font-bold opacity-70", cor)}> {unit}</Text>
        ) : null}
      </Text>
      {sub ? (
        <Text
          numberOfLines={1}
          className={cn(
            "mt-1 text-[11px]",
            destaque ? "text-primary-foreground/75" : "text-muted-foreground",
          )}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}
