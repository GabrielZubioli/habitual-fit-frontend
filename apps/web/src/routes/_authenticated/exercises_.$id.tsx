import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExternalLink, Flag, PlayCircle, Target, TrendingUp } from "lucide-react";
import { isSafeUrl } from "@/components/exercise-demo";
import { BackButton } from "@/components/back-button";
import { FavoriteButton } from "@/components/exercises/favorite-button";
import { BodyMap, aggregateMuscleIntensities } from "@/components/body-map/body-map";
import { ExerciseHowTo } from "@/components/workouts/exercise-how-to";
import { ExerciseMediaView } from "@/components/workouts/exercise-media-view";
import { exerciseMedia, videoSearchUrl } from "@forja/app-core/data/exercise-media";
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
import { useCurrentUserId } from "@/hooks/use-current-user";
import { PageBody } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartSkeleton, EmptyState, ErrorState } from "@/components/query-boundary";
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
} from "@/components/charts/chart-theme";
import {
  EQUIPMENT_LABELS,
  EXERCISE_LEVEL_LABELS,
  MECHANIC_LABELS,
  MUSCLE_LABELS,
  label,
} from "@forja/app-core/lib/labels";
import { formatDate, formatDayMonth } from "@forja/app-core/lib/date";
import { cn } from "@/lib/utils";
import { LOCALE } from "@forja/app-core/i18n";
import { t } from "@forja/app-core/i18n";

export const Route = createFileRoute("/_authenticated/exercises_/$id")({
  head: () => ({
    meta: [
      { title: t("Histórico do exercício — Habitual Fit") },
      { name: "description", content: t("Progressão de carga, volume e recordes por exercício.") },
    ],
  }),
  component: ExerciseDetail,
});

function ExerciseDetail() {
  const { id } = Route.useParams();
  const userId = useCurrentUserId();
  const [period, setPeriod] = useState<Period>("180");
  const [aba, setAba] = useState<"como" | "historico">("como");

  const exercise = useQuery({
    queryKey: ["exercise", id],
    queryFn: () => fetchExerciseDetail(id),
  });

  const history = useQuery({
    queryKey: ["exercise-history", id, period],
    queryFn: () => fetchExerciseHistory(id, userId, period),
  });

  /**
   * Agrega as séries por sessão. Só séries válidas (concluídas, não-aquecimento)
   * entram nas métricas — a mesma regra usada na sessão ao vivo e no dashboard.
   */
  const sessions = useMemo(() => summarizeExerciseSessions(history.data ?? []), [history.data]);

  const chartData = sessions.map((s) => ({
    date: formatDayMonth(s.date),
    e1rm: Number(s.bestE1rm.toFixed(1)),
    volume: Math.round(s.volume),
  }));

  const { recorde, ganho } = exerciseProgress(sessions);

  // Volta para onde a pessoa estava: a biblioteca, uma rotina do Plano…
  const voltar = <BackButton fallback="/exercises" />;

  if (exercise.isError) {
    return (
      <PageBody>
        <div className="mb-4 pt-2">{voltar}</div>
        <ErrorState message={errorMessage(exercise.error)} onRetry={exercise.refetch} />
      </PageBody>
    );
  }

  const ex = exercise.data;
  const secundarios = ex?.secondary_muscles ?? [];

  return (
    <PageBody>
      <div className="flex items-center justify-between gap-3 pb-3 pt-2">
        {voltar}
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {t("Exercício")}
        </span>
        {ex ? (
          <FavoriteButton exerciseId={ex.id} nome={ex.name} className="size-11 bg-card" />
        ) : (
          <span className="size-11" aria-hidden />
        )}
      </div>

      {!ex ? (
        <>
          <Skeleton className="aspect-square w-full rounded-[1.75rem]" />
          <Skeleton className="mt-4 h-8 w-2/3" />
        </>
      ) : (
        <>
          {/* A demonstração é o conteúdo principal: ocupa a largura e anima sozinha. */}
          <div className="overflow-hidden rounded-[1.75rem] bg-white">
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
              autoPlay
              className="[&>button]:rounded-none [&>div]:rounded-none"
            />
          </div>

          <h1 className="mt-5 text-[1.75rem] font-extrabold leading-tight">{ex.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
              {label(MUSCLE_LABELS, ex.primary_muscle)}
            </span>
            {[
              label(EQUIPMENT_LABELS, ex.equipment),
              ex.mechanic ? label(MECHANIC_LABELS, ex.mechanic) : null,
              ex.level ? label(EXERCISE_LEVEL_LABELS, ex.level) : null,
            ]
              .filter(Boolean)
              .map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border px-3 py-1 text-sm font-medium text-muted-foreground"
                >
                  {item}
                </span>
              ))}
          </div>
        </>
      )}

      <div role="tablist" className="mt-6 flex rounded-2xl bg-card p-1">
        {(
          [
            ["como", t("Como fazer")],
            ["historico", t("Seu histórico")],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={aba === valor}
            onClick={() => setAba(valor)}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-[15px] font-medium transition-colors",
              aba === valor
                ? "bg-primary font-bold text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {aba === "como" ? (
          !ex ? (
            <Skeleton className="h-48 w-full rounded-[1.25rem]" />
          ) : (
            <>
              {/* Músculos trabalhados: o mapa diz onde, a lista diz qual. */}
              <section className="mb-3 rounded-[1.25rem] bg-card p-4">
                <h3 className="mb-3 flex items-center gap-2 font-bold">
                  <Target className="size-4" aria-hidden />
                  {t("Músculos trabalhados")}
                </h3>
                <div className="flex items-center gap-4">
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
                    className="shrink-0"
                  />
                  <dl className="min-w-0 space-y-3 text-sm">
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t("Principal")}
                      </dt>
                      <dd className="mt-0.5">
                        <span className="rounded-full bg-primary px-2.5 py-0.5 text-sm font-bold text-primary-foreground">
                          {label(MUSCLE_LABELS, ex.primary_muscle)}
                        </span>
                      </dd>
                    </div>
                    {secundarios.length > 0 && (
                      <div>
                        <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {t("Secundários")}
                        </dt>
                        <dd className="mt-1 flex flex-wrap gap-1.5">
                          {secundarios.map((m) => (
                            <span
                              key={m}
                              className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold"
                            >
                              {label(MUSCLE_LABELS, m)}
                            </span>
                          ))}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </section>
              <ExerciseHowTo exercise={ex} />
              <a
                href={isSafeUrl(ex.video_url) ? ex.video_url! : videoSearchUrl(ex.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-between gap-3 rounded-[1.25rem] border border-border px-4 py-3.5 text-sm font-medium transition-colors hover:bg-card"
              >
                <span className="flex items-center gap-2.5">
                  <PlayCircle className="size-5 text-primary" aria-hidden />
                  {t("Ver vídeos de execução")}
                </span>
                <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
              </a>
            </>
          )
        ) : (
          <Historico
            period={period}
            setPeriod={setPeriod}
            history={history}
            sessions={sessions}
            chartData={chartData}
            recorde={recorde}
            ganho={ganho}
          />
        )}
      </div>
    </PageBody>
  );
}

function Historico({
  period,
  setPeriod,
  history,
  sessions,
  chartData,
  recorde,
  ganho,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
  history: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  sessions: SessionSummary[];
  chartData: { date: string; e1rm: number; volume: number }[];
  recorde: SessionSummary | null;
  ganho: number | null;
}) {
  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            aria-pressed={period === p.value}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
              period === p.value
                ? "border-primary bg-primary/12 text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {history.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-[1.25rem]" />
          <ChartSkeleton className="h-56" />
        </div>
      ) : history.isError ? (
        <ErrorState message={errorMessage(history.error)} onRetry={history.refetch} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="size-6" />}
          title={t("Sem registros neste período")}
          description={t(
            "Assim que você registrar séries deste exercício, a progressão de carga aparece aqui.",
          )}
          action={
            <Button asChild>
              <Link to="/plan">Ir para o plano</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat
              destaque
              label={t("Recorde")}
              value={recorde ? `${Math.round(recorde.bestE1rm)}` : "—"}
              unit="kg"
              sub={recorde?.bestSet ? `${recorde.bestSet.weight} × ${recorde.bestSet.reps}` : ""}
            />
            <Stat
              label={t("Sessões")}
              value={String(sessions.length)}
              sub={t("{{v0}} séries", { v0: sessions.reduce((n, s) => n + s.workingSets, 0) })}
            />
            <Stat
              label={t("Evolução")}
              value={ganho === null ? "—" : `${ganho >= 0 ? "+" : ""}${ganho.toFixed(0)}%`}
              sub={t("1RM estimado")}
            />
          </div>

          <section className="rounded-[1.25rem] bg-card p-4">
            <h3 className="font-bold">{t("Progressão de carga")}</h3>
            <p className="text-xs text-muted-foreground">{t("1RM estimado por sessão")}</p>
            <div className="mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="date" {...CHART_AXIS} minTickGap={20} />
                  <YAxis {...CHART_AXIS} width={40} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    cursor={{ stroke: "var(--border)" }}
                    formatter={(value: number) => [t("{{value}} kg", { value }), t("1RM estimado")]}
                  />
                  <Area
                    type="monotone"
                    dataKey="e1rm"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    fill="var(--chart-1)"
                    fillOpacity={0.12}
                    dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--card)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-[1.25rem] bg-card p-4">
            <h3 className="font-bold">{t("Volume por sessão")}</h3>
            <p className="text-xs text-muted-foreground">{t("peso × repetições, em kg")}</p>
            <div className="mt-3 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid {...CHART_GRID} />
                  <XAxis dataKey="date" {...CHART_AXIS} minTickGap={20} />
                  <YAxis {...CHART_AXIS} width={40} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    formatter={(value: number) => [
                      t("{{v0}} kg", { v0: value.toLocaleString(LOCALE) }),
                      t("Volume"),
                    ]}
                  />
                  <Bar dataKey="volume" fill="var(--chart-1)" radius={[6, 6, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.25rem] bg-card">
            <h3 className="px-4 pb-1 pt-4 font-bold">{t("Sessões")}</h3>
            <ul className="divide-y divide-border/60">
              {[...sessions].reverse().map((s) => (
                <li key={s.sessionId}>
                  <Link
                    to="/workouts/session/$id"
                    params={{ id: s.sessionId }}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-elevated"
                  >
                    <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-elevated leading-none">
                      <span className="text-base font-extrabold">{formatDate(s.date, "d")}</span>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        {formatDate(s.date, "MMM")}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold">
                        {s.bestSet
                          ? t("{{weight}} kg × {{reps}}", {
                              weight: s.bestSet.weight,
                              reps: s.bestSet.reps,
                            })
                          : "—"}
                        {s.hasPr && (
                          <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning">
                            <Flag className="size-3" aria-hidden />
                            {t("Recorde")}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {s.workingSets} {s.workingSets === 1 ? t("série") : t("séries")}{" "}
                        {t("· {{v0}} kg de volume", {
                          v0: Math.round(s.volume).toLocaleString(LOCALE),
                        })}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-extrabold tabular-nums">
                        {Math.round(s.bestE1rm)}
                      </span>
                      <span className="text-[10px] uppercase text-muted-foreground">
                        {t("1RM kg")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
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
  return (
    <div
      className={cn(
        "rounded-[1.25rem] p-3.5",
        destaque ? "bg-primary text-primary-foreground" : "bg-card",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-bold uppercase tracking-wider",
          destaque ? "opacity-75" : "text-muted-foreground",
        )}
      >
        {statLabel}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold leading-none tabular-nums">
        {value}
        {unit && value !== "—" ? (
          <span className="ml-0.5 text-sm font-bold opacity-70">{unit}</span>
        ) : null}
      </p>
      {sub && (
        <p
          className={cn(
            "mt-1 truncate text-[11px]",
            destaque ? "opacity-75" : "text-muted-foreground",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
