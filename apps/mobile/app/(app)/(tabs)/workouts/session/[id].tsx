import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DeviceEventEmitter, Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown, FadeInRight, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { __iconNode as repeat } from "lucide-react/dist/esm/icons/repeat.js";
import { __iconNode as arrowDown } from "lucide-react/dist/esm/icons/arrow-down.js";
import { __iconNode as arrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { __iconNode as arrowUp } from "lucide-react/dist/esm/icons/arrow-up.js";
import { __iconNode as check } from "lucide-react/dist/esm/icons/check.js";
import { __iconNode as chevronLeft } from "lucide-react/dist/esm/icons/chevron-left.js";
import { __iconNode as chevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
import { __iconNode as disc3 } from "lucide-react/dist/esm/icons/disc-3.js";
import { __iconNode as equal } from "lucide-react/dist/esm/icons/equal.js";
import { __iconNode as history } from "lucide-react/dist/esm/icons/history.js";
import { __iconNode as info } from "lucide-react/dist/esm/icons/info.js";
import { __iconNode as lightbulb } from "lucide-react/dist/esm/icons/lightbulb.js";
import { __iconNode as minus } from "lucide-react/dist/esm/icons/minus.js";
import { __iconNode as moreHorizontal } from "lucide-react/dist/esm/icons/ellipsis.js";
import { __iconNode as pencil } from "lucide-react/dist/esm/icons/pencil.js";
import { __iconNode as playCircle } from "lucide-react/dist/esm/icons/circle-play.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { __iconNode as sparkles } from "lucide-react/dist/esm/icons/sparkles.js";
import { __iconNode as trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
import { __iconNode as trendingUp } from "lucide-react/dist/esm/icons/trending-up.js";
import { __iconNode as trophy } from "lucide-react/dist/esm/icons/trophy.js";
import { __iconNode as xIcon } from "lucide-react/dist/esm/icons/x.js";
import { nextDoubleProgression, platesFor, type ExerciseComparison } from "@forja/domain";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import {
  addSet,
  discardWorkout,
  fetchWorkoutBoard,
  finishWorkout,
  moveWorkoutDate,
  removeSet,
  saveFinishedWorkoutEdits,
  substituteSessionExercise,
  updateSet,
  type BoardExercise,
  type BoardSet,
  type WorkoutBoard,
} from "@forja/app-core/data/workout-session";
import { videoSearchUrl } from "@forja/app-core/data/exercise-media";
import { EQUIPMENT_LABELS, MUSCLE_LABELS, label } from "@forja/app-core/lib/labels";
import { formatDate, formatDuration, toISODate, todayISO } from "@forja/app-core/lib/date";
import { TERMINAR_TREINO } from "@/lib/eventos";
import { paletaTreino, comAlfa, type PaletaTreino } from "@/lib/paleta-treino";
import { useRestTimer } from "@/lib/rest-timer";
import { cn } from "@/lib/cn";
import { useTheme } from "@/theme/theme";
import { ErrorState } from "@/ui/card";
import { DatePicker } from "@/ui/date-picker";
import { AlertDialog, ConfirmDialog, MenuSheet } from "@/ui/dialog";
import { SubstituteExerciseDialog } from "@/ui/substitute-exercise-dialog";
import { ExerciseDemo } from "@/ui/exercise-demo";
import { Icon, type IconNode } from "@/ui/icon";
import { RestTimerBar } from "@/ui/rest-timer-bar";
import { Text } from "@/ui/text";
import { LOCALE } from "@forja/app-core/i18n";
import { t } from "@forja/app-core/i18n";
import { Skeleton } from "@/ui/skeleton";

/**
 * A execução do treino, um exercício por vez — o `workouts_.session.$id.tsx`
 * do web. Em cima, nome, cronômetro e séries feitas; os números de cada
 * exercício; a demonstração, a última vez, as anilhas e a dica de progressão;
 * a tabela de séries com − e +, o RIR e o círculo de concluir, que dispara o
 * descanso.
 *
 * O cronômetro corre desde `started_at` (o relógio é o banco), e a tela fica
 * acesa enquanto o treino está aberto.
 */

/** RIR: quantas repetições ainda sobravam. */
const RIR_OPCOES = [
  { valor: 0, texto: t("Falha — não sairia mais nenhuma") },
  { valor: 1, texto: t("Sobrava 1") },
  { valor: 2, texto: t("Sobravam 2") },
  { valor: 3, texto: t("Sobravam 3") },
  { valor: 4, texto: t("Sobravam 4 ou mais") },
] as const;

type Patch = Parameters<typeof updateSet>[1];

export default function Tela() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // A tela fica montada entre um treino e outro: o `key` zera exercício aberto,
  // edição e comemoração ao trocar de sessão.
  return <SessionPage key={id} id={id} />;
}

function SessionPage({ id }: { id: string }) {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const chave = queryKeys.workouts.session(id);

  const [atual, setAtual] = useState(0);
  const [celebrando, setCelebrando] = useState(false);
  const [recordes, setRecordes] = useState<string[]>([]);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const descanso = useRestTimer();

  // Descartada, a sessão some do banco: a consulta para de vez.
  const [descartada, setDescartada] = useState(false);
  const board = useQuery({
    queryKey: chave,
    queryFn: () => fetchWorkoutBoard(id),
    enabled: !descartada,
  });
  const dados = board.data;
  const terminado = Boolean(dados?.endedAt);
  const somenteLeitura = terminado && !editando;

  // Tela acesa durante o treino (o `useWakeLock` do web).
  const acesa = Boolean(dados) && !terminado;
  useEffect(() => {
    if (!acesa) return;
    void activateKeepAwakeAsync("treino");
    return () => void deactivateKeepAwake("treino");
  }, [acesa]);

  const invalidar = () => qc.invalidateQueries({ queryKey: chave });
  const falhou = (e: unknown) => setErro(errorMessage(e));

  /** Edição de série com resposta imediata: a tela muda antes do servidor confirmar. */
  const serie = useMutation({
    mutationFn: ({ setId, patch }: { setId: string; patch: Patch }) => updateSet(setId, patch),
    onMutate: async ({ setId, patch }) => {
      await qc.cancelQueries({ queryKey: chave });
      const anterior = qc.getQueryData<WorkoutBoard>(chave);
      qc.setQueryData<WorkoutBoard>(chave, (b) => (b ? aplicarSerie(b, setId, patch) : b));
      return { anterior };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(chave, ctx.anterior);
      falhou(e);
    },
    onSettled: () => void invalidar(),
  });

  const maisSerie = useMutation({
    mutationFn: (exercise: BoardExercise) => addSet(id, exercise),
    onSuccess: () => void invalidar(),
    onError: falhou,
  });
  const menosSerie = useMutation({
    mutationFn: (setId: string) => removeSet(setId),
    onSuccess: () => void invalidar(),
    onError: falhou,
  });

  const trocar = useMutation({
    mutationFn: ({ de, para }: { de: string; para: string }) =>
      substituteSessionExercise(id, de, para),
    onSuccess: () => void invalidar(),
    onError: falhou,
  });

  const mudarData = useMutation({
    mutationFn: (dia: string) => moveWorkoutDate(id, dados!.startedAt, dados!.endedAt, dia),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
    onError: falhou,
  });

  const finalizar = useMutation({
    mutationFn: () => finishWorkout(id),
    onSuccess: (resultado) => {
      setRecordes(resultado.personalRecords);
      descanso.stop();
      setCelebrando(true);
      void qc.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
    onError: falhou,
  });

  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const descartar = useMutation({
    mutationFn: () => discardWorkout(id),
    onSuccess: () => {
      descanso.stop();
      // A sessão não existe mais: esta tela segue montada entre as abas e, sem
      // isto, a buscaria de novo ao invalidar e mostraria o erro.
      setDescartada(true);
      qc.removeQueries({ queryKey: chave });
      void qc.invalidateQueries({ queryKey: queryKeys.workouts.all });
      router.replace("/dashboard");
    },
    onError: falhou,
  });

  const salvarEdicao = useMutation({
    mutationFn: () => saveFinishedWorkoutEdits(id),
    onSuccess: () => {
      setEditando(false);
      void qc.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
    onError: falhou,
  });

  const totais = useMemo(() => {
    const sets = dados?.exercises.flatMap((e) => e.sets) ?? [];
    return { feitas: sets.filter((s) => s.completed).length, total: sets.length };
  }, [dados]);

  // Terminar: direto se tudo foi marcado, com confirmação se há pendentes, e
  // um aviso se nada foi marcado. O botão central da barra usa o mesmo fluxo.
  const [confirmarFim, setConfirmarFim] = useState(false);
  const [semSeries, setSemSeries] = useState(false);
  const estadoFim = useRef({ terminado, feitas: totais.feitas, total: totais.total });
  estadoFim.current = { terminado, feitas: totais.feitas, total: totais.total };
  const terminar = useRef(() => {});
  terminar.current = () => {
    const { terminado: fim, feitas, total } = estadoFim.current;
    if (fim || finalizar.isPending) return;
    if (feitas === 0) return setSemSeries(true);
    if (total - feitas > 0) setConfirmarFim(true);
    else finalizar.mutate();
  };
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TERMINAR_TREINO, () => terminar.current());
    return () => sub.remove();
  }, []);

  // Exercício atual dentro dos limites quando a lista muda.
  useEffect(() => {
    if (dados && atual >= dados.exercises.length) setAtual(Math.max(0, dados.exercises.length - 1));
  }, [dados, atual]);

  const aoVivo = !terminado || celebrando;
  const p = paletaTreino(aoVivo, scheme);

  if (board.isPending) return <BoardSkeleton />;
  if (board.isError || !dados) {
    return (
      <View className="flex-1 bg-background p-4" style={{ paddingTop: insets.top + 16 }}>
        <ErrorState message={errorMessage(board.error)} onRetry={() => void board.refetch()} />
      </View>
    );
  }

  const exercicio = dados.exercises[atual];
  const pendentes = totais.total - totais.feitas;
  const progresso = totais.total ? totais.feitas / totais.total : 0;
  const ultimo = atual >= dados.exercises.length - 1;

  return (
    <View className="flex-1" style={{ backgroundColor: p.page }}>
      {/* Cabeçalho fixo: sair, nome e cronômetro, descartar/editar; e o progresso. */}
      <View
        className="px-4 pb-4"
        style={{ paddingTop: insets.top + 16, backgroundColor: comAlfaSeguro(p.page, 0.92) }}
      >
        <View className="flex-row items-center gap-2">
          <Circulo
            cor={p.inkFaint}
            onPress={() => router.navigate("/dashboard")}
            label={t("Sair do treino (continua salvo)")}
          >
            <Icon node={xIcon} color={p.ink} size={20} strokeWidth={2.5} />
          </Circulo>
          <View className="min-w-0 flex-1 items-center">
            <Text
              numberOfLines={1}
              className="text-xs font-bold uppercase tracking-[2px]"
              style={{ color: p.inkSoft }}
            >
              {dados.name.replace(/^[A-Z]\s*—\s*/, "")}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-2">
              {!terminado ? (
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.ink }} />
              ) : null}
              <Cronometro dados={dados} cor={p.ink} />
            </View>
          </View>
          {terminado ? (
            <Circulo
              cor={p.inkFaint}
              onPress={() => setEditando((v) => !v)}
              label={editando ? t("Parar de editar") : t("Corrigir cargas e séries")}
            >
              <Icon node={pencil} color={p.ink} size={20} strokeWidth={2.5} />
            </Circulo>
          ) : (
            <Circulo
              cor={p.ink}
              onPress={() => setConfirmarDescarte(true)}
              label={t("Descartar treino")}
            >
              <Icon node={trash2} color={p.page} size={20} strokeWidth={2.5} />
            </Circulo>
          )}
        </View>

        <View className="mt-4 flex-row items-center gap-3">
          <View
            className="h-2 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: p.inkFaint }}
            accessibilityRole="progressbar"
            accessibilityLabel={t("Séries concluídas")}
            accessibilityValue={{ min: 0, max: totais.total, now: totais.feitas }}
          >
            <View
              className="h-full rounded-full"
              style={{ width: `${progresso * 100}%`, backgroundColor: p.ink }}
            />
          </View>
          <Text className="text-sm font-bold" style={{ color: p.ink }}>
            {totais.feitas}/{totais.total}
            <Text className="text-sm font-medium" style={{ color: p.inkSoft }}>
              {t("séries")}
            </Text>
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="px-4"
        // O fim da página fica livre da barra de baixo (e da barra do descanso).
        contentContainerStyle={{
          paddingBottom: descanso.remaining !== null && !terminado ? 224 : 128,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {erro ? (
          <Pressable
            onPress={() => setErro(null)}
            className="mb-2 rounded-2xl p-3"
            style={{ backgroundColor: p.surface }}
          >
            <Text className="text-sm" style={{ color: p.on }}>
              {erro}
            </Text>
          </Pressable>
        ) : null}

        {terminado ? (
          <View
            className="mt-2 flex-row flex-wrap items-center gap-2 rounded-2xl p-3"
            style={{ backgroundColor: p.surface }}
          >
            <Text style={{ color: p.onSoft }}>{t("Data")}</Text>
            <DatePicker
              max={todayISO()}
              value={toISODate(new Date(dados.startedAt))}
              onChange={(v) => mudarData.mutate(v)}
              accessibilityLabel={t("Data do treino")}
              className="h-9"
            />
            <View className="ml-auto">
              {editando ? (
                <Pressable
                  onPress={() => salvarEdicao.mutate()}
                  disabled={salvarEdicao.isPending}
                  className="h-8 flex-row items-center gap-1.5 rounded-full bg-primary px-3"
                >
                  <Icon node={check} color={p.accentFg} size={16} />
                  <Text className="text-xs font-medium text-primary-foreground">
                    {salvarEdicao.isPending ? t("Salvando…") : t("Concluir edição")}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setEditando(true)}
                  className="h-8 justify-center rounded-full bg-secondary px-3"
                >
                  <Text className="text-xs font-medium text-secondary-foreground">
                    {t("Corrigir cargas e séries")}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {dados.exercises.length === 0 || !exercicio ? (
          <View
            className="mt-6 items-center rounded-[28px] p-6"
            style={{ backgroundColor: p.surface }}
          >
            <Text className="text-lg font-semibold" style={{ color: p.on }}>
              {t("Este treino está sem exercícios")}
            </Text>
            <Text className="mt-1" style={{ color: p.onSoft }}>
              {t("Adicione exercícios à rotina no Plano.")}
            </Text>
            <Pressable
              onPress={() => router.push("/plan")}
              className="mt-4 rounded-full px-5 py-2.5"
              style={{ backgroundColor: p.accent }}
            >
              <Text className="font-bold" style={{ color: p.accentFg }}>
                {t("Abrir o Plano")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="mt-2 gap-2 p-1.5"
            >
              {dados.exercises.map((e, i) => {
                const eAtual = i === atual;
                return (
                  <Pressable
                    key={`${e.position}-${e.exerciseId}`}
                    onPress={() => setAtual(i)}
                    accessibilityLabel={`${i + 1}. ${e.name}${e.done ? " — feito" : ""}`}
                    accessibilityState={{ selected: eAtual }}
                    className={cn(
                      "h-10 w-10 items-center justify-center rounded-full",
                      eAtual && "scale-110",
                    )}
                    style={{
                      backgroundColor: eAtual ? p.surface : e.done ? p.ink : p.inkFaint,
                      ...(eAtual
                        ? { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }
                        : {}),
                    }}
                  >
                    {e.done && !eAtual ? (
                      <Icon node={check} color={p.page} size={16} strokeWidth={3} />
                    ) : (
                      <Text
                        className="text-sm font-extrabold"
                        style={{ color: eAtual ? p.on : p.ink }}
                      >
                        {i + 1}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <ExercicioAtual
              key={`${exercicio.position}-${exercicio.exerciseId}`}
              exercicio={exercicio}
              indice={atual}
              total={dados.exercises.length}
              somenteLeitura={somenteLeitura}
              p={p}
              onSerie={(setId, patch) => serie.mutate({ setId, patch })}
              onConcluir={(set, feito) => {
                serie.mutate({
                  setId: set.id,
                  patch: {
                    completed: feito,
                    // Concluir sem ter digitado usa o que estava na tela.
                    ...(feito && set.weightKg === null
                      ? { weight_kg: exercicio.suggestedWeightKg }
                      : {}),
                    ...(feito && set.reps === null ? { reps: exercicio.targetReps } : {}),
                  },
                });
                if (feito && !terminado) descanso.start(set.restSeconds ?? exercicio.restSeconds);
              }}
              onMaisSerie={() => maisSerie.mutate(exercicio)}
              onMenosSerie={(setId) => menosSerie.mutate(setId)}
              onTrocar={(novoId) => trocar.mutateAsync({ de: exercicio.exerciseId, para: novoId })}
            />

            <View className="mt-5 flex-row gap-3">
              <Pressable
                onPress={() => setAtual((i) => Math.max(0, i - 1))}
                disabled={atual === 0}
                className="h-14 flex-1 flex-row items-center justify-center gap-1 rounded-2xl border-2 active:scale-[0.98]"
                style={{ borderColor: comAlfaSeguro(p.ink, 0.25), opacity: atual === 0 ? 0.35 : 1 }}
              >
                <Icon node={chevronLeft} color={p.ink} size={20} />
                <Text className="font-bold" style={{ color: p.ink }}>
                  {t("Anterior")}
                </Text>
              </Pressable>
              {ultimo && !terminado ? (
                // No último exercício, o "Próximo" vira o fim do treino.
                <Pressable
                  onPress={() => terminar.current()}
                  disabled={finalizar.isPending}
                  className="h-14 flex-row items-center justify-center gap-2 rounded-2xl active:scale-[0.98]"
                  style={{
                    flex: 1.4,
                    backgroundColor: p.ink,
                    opacity: finalizar.isPending ? 0.5 : 1,
                  }}
                >
                  <Icon node={check} color={p.page} size={20} strokeWidth={3} />
                  <Text className="font-extrabold" style={{ color: p.page }}>
                    {t("Terminar treino")}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setAtual((i) => Math.min(dados.exercises.length - 1, i + 1))}
                  disabled={ultimo}
                  className="h-14 flex-1 flex-row items-center justify-center gap-1 rounded-2xl active:scale-[0.98]"
                  style={{ backgroundColor: p.ink, opacity: ultimo ? 0.35 : 1 }}
                >
                  <Text className="font-extrabold" style={{ color: p.page }}>
                    {t("Próximo")}
                  </Text>
                  <Icon node={chevronRight} color={p.page} size={20} />
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {!terminado ? <RestTimerBar timer={descanso} p={p} /> : null}

      <ConfirmDialog
        open={confirmarDescarte}
        onClose={() => setConfirmarDescarte(false)}
        title={t("Descartar este treino?")}
        description={t("As séries registradas até agora serão apagadas. Não dá para desfazer.")}
        confirmLabel={t("Descartar treino")}
        destructive
        onConfirm={() => descartar.mutate()}
      />
      <AlertDialog
        open={confirmarFim}
        onClose={() => setConfirmarFim(false)}
        title={t("Terminar o treino agora?")}
        description={t("{{pendentes}} {{v1}} e ficarão de fora do registro.", {
          pendentes,
          v1: pendentes === 1 ? "série ainda não foi marcada" : "séries ainda não foram marcadas",
        })}
        acoes={[{ label: t("Terminar"), onPress: () => finalizar.mutate() }]}
        cancelar="Continuar treinando"
      />
      <AlertDialog
        open={semSeries}
        onClose={() => setSemSeries(false)}
        title={t("Marque ao menos uma série")}
        description={t(
          "Para terminar o treino, toque no círculo ao lado de cada série que você fez. Se não treinou, descarte o treino na lixeira do topo.",
        )}
        acoes={[
          { label: t("Entendi"), onPress: () => undefined },
          {
            label: t("Descartar treino"),
            onPress: () => setConfirmarDescarte(true),
            variant: "outline",
          },
        ]}
        cancelar={null}
      />

      {celebrando ? (
        <CompletionOverlay
          p={p}
          durationSeconds={finalizar.data?.durationSeconds ?? dados.durationSeconds}
          volumeKg={finalizar.data?.volumeKg ?? dados.totalVolumeKg}
          kcal={finalizar.data?.kcal ?? null}
          comparisons={finalizar.data?.comparisons ?? []}
          records={recordes}
          onClose={() => router.replace("/stats")}
        />
      ) : null}
    </View>
  );
}

/** `comAlfa` aceita só `#rrggbb`; a página do tema já vem assim. */
function comAlfaSeguro(cor: string, alfa: number): string {
  return cor.startsWith("#") && cor.length === 7 ? comAlfa(cor, alfa) : cor;
}

function Circulo({
  cor,
  onPress,
  label,
  children,
}: {
  cor: string;
  onPress: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-full active:scale-90"
      style={{ backgroundColor: cor }}
    >
      {children}
    </Pressable>
  );
}

/** Aplica a edição de uma série no cache, recalculando "feito" do exercício. */
function aplicarSerie(board: WorkoutBoard, setId: string, patch: Patch): WorkoutBoard {
  const exercises = board.exercises.map((e) => {
    if (!e.sets.some((s) => s.id === setId)) return e;
    const sets = e.sets.map((s) =>
      s.id !== setId
        ? s
        : {
            ...s,
            ...(patch.weight_kg !== undefined ? { weightKg: patch.weight_kg } : {}),
            ...(patch.reps !== undefined ? { reps: patch.reps } : {}),
            ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
            ...(patch.rir !== undefined ? { rir: patch.rir } : {}),
          },
    );
    return { ...e, sets, done: sets.length > 0 && sets.every((s) => s.completed) };
  });
  const feitos = exercises.filter((e) => e.done).length;
  return { ...board, exercises, progress: exercises.length ? feitos / exercises.length : 0 };
}

function Cronometro({ dados, cor }: { dados: WorkoutBoard; cor: string }) {
  const decorridos = useElapsedSeconds(dados.startedAt, dados.endedAt !== null);
  return (
    <Text
      className="text-[28px] font-extrabold leading-[30px]"
      style={{ color: cor, fontVariant: ["tabular-nums"] }}
    >
      {formatStopwatch(dados.endedAt ? dados.durationSeconds : decorridos)}
    </Text>
  );
}

/** Passo do − / + de carga: barra e máquina sobem de 2,5; halter de 1. */
function passoDeCarga(equipment: string): number {
  return equipment === "dumbbell" || equipment === "kettlebell" ? 1 : 2.5;
}

function ExercicioAtual({
  exercicio,
  indice,
  total,
  somenteLeitura,
  p,
  onSerie,
  onConcluir,
  onMaisSerie,
  onMenosSerie,
  onTrocar,
}: {
  exercicio: BoardExercise;
  indice: number;
  total: number;
  somenteLeitura: boolean;
  p: PaletaTreino;
  onSerie: (setId: string, patch: Patch) => void;
  onConcluir: (set: BoardSet, feito: boolean) => void;
  onMaisSerie: () => void;
  onMenosSerie: (setId: string) => void;
  onTrocar: (exerciseId: string) => Promise<unknown>;
}) {
  const [opcoes, setOpcoes] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [rirDe, setRirDe] = useState<BoardSet | null>(null);
  const passo = passoDeCarga(exercicio.equipment);
  const cargaAtual =
    exercicio.sets.find((s) => !s.completed)?.weightKg ?? exercicio.suggestedWeightKg;
  const ultima = exercicio.lastTime;
  const pt = (n: number) => n.toLocaleString(LOCALE);
  const feitas = exercicio.sets.filter((s) => s.completed).length;

  // Dica de progressão (dupla progressão sobre a última vez).
  const minReps = exercicio.repMin ?? exercicio.targetReps ?? 8;
  const maxReps = exercicio.repMax ?? exercicio.targetReps ?? 12;
  const feitasAntes = (ultima?.sets ?? []).filter((s) => s.weightKg !== null && s.reps !== null);
  const sugestao =
    feitasAntes.length > 0
      ? nextDoubleProgression(
          feitasAntes.map((s) => ({ weightKg: s.weightKg!, reps: s.reps! })),
          {
            minReps,
            maxReps: Math.max(minReps, maxReps),
            incrementKg: passo,
            workingSets: Math.min(feitasAntes.length, exercicio.sets.length || 1),
          },
        )
      : null;

  const dicas: { icon: IconNode; texto: ReactNode; destaque?: boolean }[] = [];
  if (ultima && ultima.sets.length > 0) {
    dicas.push({
      icon: history,
      texto: (
        <>
          <Text className="font-semibold" style={{ color: p.on }}>
            {t("Última vez · {{v0}}", { v0: formatDate(ultima.date, "d MMM") })}
          </Text>{" "}
          {ultima.sets
            .map(
              (s) =>
                `${s.weightKg !== null ? `${pt(s.weightKg)}×` : ""}${s.reps ?? "–"}${s.rir !== null ? t(" (RIR {{rir}})", { rir: s.rir }) : ""}`,
            )
            .join(", ")}
        </>
      ),
    });
  }
  if (exercicio.equipment === "barbell" && cargaAtual !== null && cargaAtual > 20) {
    const placas = platesFor(cargaAtual).perSide;
    dicas.push({
      icon: disc3,
      texto: t("Barra 20 kg · {{v0}} kg por lado{{v1}}", {
        v0: pt((cargaAtual - 20) / 2),
        v1: placas.length > 0 ? ` (${placas.map(pt).join(" + ")})` : "",
      }),
    });
  }
  if (sugestao && sugestao.weightKg > 0) {
    dicas.push({
      icon: sugestao.advanced ? trendingUp : arrowRight,
      destaque: sugestao.advanced,
      texto: sugestao.advanced
        ? t("Bateu o topo da faixa — suba para {{v0}} kg.", { v0: pt(sugestao.weightKg) })
        : t("Mantenha {{v0}} kg e busque {{targetReps}} repetições.", {
            v0: pt(sugestao.weightKg),
            targetReps: sugestao.targetReps,
          }),
    });
  }
  if (exercicio.notes) dicas.push({ icon: lightbulb, texto: exercicio.notes });

  const sombra = {
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 24 },
    elevation: 8,
  };
  const colunas = { serie: 28, carga: 1.35, reps: 1.15, rir: 44, ok: 40 };

  return (
    <Animated.View entering={FadeInRight.duration(500)} className="mt-3">
      <View
        className="overflow-hidden rounded-[28px]"
        style={{ backgroundColor: p.surface, ...sombra }}
      >
        <View className="bg-white">
          <ExerciseDemo
            images={exercicio.images}
            name={exercicio.name}
            className="rounded-none bg-white"
          />
          <View
            className="absolute left-3 top-3 rounded-full px-3 py-1"
            style={{ backgroundColor: comAlfaSeguro(p.surface, 0.85) }}
          >
            <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: p.on }}>
              {t("{{v0}} de {{total}}", { v0: indice + 1, total })}
            </Text>
          </View>
        </View>

        <View className="p-5">
          <View className="flex-row items-start gap-3">
            <Text
              textBreakStrategy="balanced"
              className="min-w-0 flex-1 text-[27px] font-extrabold leading-tight"
              style={{ color: p.on }}
            >
              {exercicio.name}
            </Text>
            <Pressable
              onPress={() => setOpcoes(true)}
              accessibilityLabel={t("Opções de {{name}}", { name: exercicio.name })}
              className="h-11 w-11 items-center justify-center rounded-full active:scale-90"
              style={{ backgroundColor: p.raised }}
            >
              <Icon node={moreHorizontal} color={p.on} size={20} />
            </Pressable>
          </View>

          <View className="mt-3 flex-row flex-wrap gap-2">
            <Chip p={p}>{label(MUSCLE_LABELS, exercicio.primaryMuscle)}</Chip>
            <Chip p={p}>{label(EQUIPMENT_LABELS, exercicio.equipment)}</Chip>
            {exercicio.bestKg ? (
              <Chip p={p} destaque icon={trophy}>
                {t("{{v0}} kg", { v0: pt(exercicio.bestKg) })}
              </Chip>
            ) : null}
          </View>

          {dicas.length > 0 ? (
            <View className="mt-4 gap-2.5 border-t pt-4" style={{ borderColor: p.line }}>
              {dicas.map((d, i) => (
                <View key={i} className="flex-row items-start gap-3">
                  <View
                    className="mt-0.5 h-7 w-7 items-center justify-center rounded-lg"
                    style={{ backgroundColor: d.destaque ? p.accent : p.raised }}
                  >
                    <Icon
                      node={d.icon}
                      color={d.destaque ? p.accentFg : p.accent}
                      size={16}
                      strokeWidth={2.5}
                    />
                  </View>
                  <Text
                    className={cn("flex-1 text-[15px] leading-snug", d.destaque && "font-semibold")}
                    style={{ color: d.destaque ? p.on : p.onSoft }}
                  >
                    {d.texto}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {/* As séries. */}
      <View className="mt-3 rounded-[28px] p-4" style={{ backgroundColor: p.surface, ...sombra }}>
        <View className="mb-3 flex-row items-baseline justify-between px-1">
          <Text className="text-lg font-extrabold" style={{ color: p.on }}>
            {t("Séries")}
          </Text>
          <Text className="text-sm font-semibold" style={{ color: p.onSoft }}>
            {t("{{feitas}} de {{length}} feitas", { feitas, length: exercicio.sets.length })}
          </Text>
        </View>
        <View className="mb-2 flex-row items-center gap-1.5 px-1.5">
          <View style={{ width: colunas.serie }} />
          {([t("Carga (kg)"), t("Reps")] as const).map((item, i) => (
            <Text
              key={item}
              className="text-center text-[11px] font-bold uppercase tracking-wider"
              style={{ flex: i === 0 ? colunas.carga : colunas.reps, color: p.onSoft }}
            >
              {item}
            </Text>
          ))}
          <Text
            className="text-center text-[11px] font-bold uppercase tracking-wider"
            style={{ width: colunas.rir, color: p.onSoft }}
          >
            {t("RIR")}
          </Text>
          <View style={{ width: colunas.ok }} />
        </View>
        <View className="gap-1.5">
          {exercicio.sets.map((set) => (
            <View
              key={set.id}
              className="flex-row items-center gap-1.5 rounded-2xl p-1.5"
              style={set.completed ? { backgroundColor: comAlfaSeguro(p.accent, 0.12) } : undefined}
            >
              <View
                className="h-8 items-center justify-center rounded-full"
                style={{
                  width: colunas.serie + 4,
                  backgroundColor: set.completed ? p.accent : p.raised,
                }}
              >
                <Text
                  className="text-sm font-bold"
                  style={{ color: set.completed ? p.accentFg : p.onSoft }}
                >
                  {set.setIndex}
                </Text>
              </View>
              <View style={{ flex: colunas.carga }}>
                <Passo
                  valor={set.weightKg ?? exercicio.suggestedWeightKg}
                  passo={passo}
                  rotulo={t("Carga da série {{setIndex}}", { setIndex: set.setIndex })}
                  desabilitado={somenteLeitura}
                  p={p}
                  onChange={(v) => onSerie(set.id, { weight_kg: v })}
                />
              </View>
              <View style={{ flex: colunas.reps }}>
                <Passo
                  valor={set.reps ?? exercicio.targetReps}
                  passo={1}
                  inteiro
                  rotulo={t("Repetições da série {{setIndex}}", { setIndex: set.setIndex })}
                  desabilitado={somenteLeitura}
                  p={p}
                  onChange={(v) => onSerie(set.id, { reps: v })}
                />
              </View>
              <Pressable
                onPress={() => setRirDe(set)}
                disabled={somenteLeitura}
                accessibilityLabel={t("RIR da série {{setIndex}}{{v1}}", {
                  setIndex: set.setIndex,
                  v1: set.rir !== null ? `: ${set.rir}` : "",
                })}
                className="h-12 items-center justify-center rounded-xl"
                style={{ width: colunas.rir, backgroundColor: p.raised }}
              >
                <Text
                  className={cn("text-base", set.rir !== null && "font-bold")}
                  style={{ color: set.rir === null ? p.onSoft : p.on }}
                >
                  {set.rir === null ? "RIR" : set.rir >= 4 ? "4+" : set.rir}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onConcluir(set, !set.completed)}
                disabled={somenteLeitura}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: set.completed }}
                accessibilityLabel={t("{{v0}} a série {{setIndex}}", {
                  v0: set.completed ? "Desmarcar" : "Concluir",
                  setIndex: set.setIndex,
                })}
                className="h-11 w-11 items-center justify-center rounded-full border-2 active:scale-90"
                style={{
                  borderColor: set.completed ? "transparent" : comAlfaSeguro(p.accent, 0.55),
                  backgroundColor: set.completed ? p.accent : "transparent",
                }}
              >
                {set.completed ? (
                  <Animated.View entering={ZoomIn.duration(200)}>
                    <Icon node={check} color={p.accentFg} size={24} strokeWidth={3} />
                  </Animated.View>
                ) : null}
              </Pressable>
            </View>
          ))}
        </View>
        {!somenteLeitura ? (
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={onMaisSerie}
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl"
            >
              <Icon node={plus} color={p.accent} size={16} strokeWidth={2.75} />
              <Text className="font-bold" style={{ color: p.accent }}>
                {t("Série")}
              </Text>
            </Pressable>
            {exercicio.sets.length > 1 ? (
              <Pressable
                onPress={() => onMenosSerie(exercicio.sets.at(-1)!.id)}
                className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl"
              >
                <Icon node={minus} color={p.onSoft} size={16} strokeWidth={2.75} />
                <Text className="font-semibold" style={{ color: p.onSoft }}>
                  {t("Série")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <MenuSheet
        open={opcoes}
        onClose={() => setOpcoes(false)}
        title={exercicio.name}
        corIcone={p.accent}
        opcoes={[
          {
            label: t("Como executar"),
            icon: info,
            onPress: () =>
              router.push({ pathname: "/exercises/[id]", params: { id: exercicio.exerciseId } }),
          },
          {
            label: t("Vídeo"),
            icon: playCircle,
            onPress: () =>
              void Linking.openURL(exercicio.videoUrl ?? videoSearchUrl(exercicio.name)),
          },
          ...(somenteLeitura
            ? []
            : [{ label: t("Trocar exercício"), icon: repeat, onPress: () => setTrocando(true) }]),
        ]}
      />
      <SubstituteExerciseDialog
        open={trocando}
        onClose={() => setTrocando(false)}
        currentExerciseId={exercicio.exerciseId}
        currentExerciseName={exercicio.name}
        primaryMuscle={exercicio.primaryMuscle}
        currentEquipment={exercicio.equipment}
        onSubstitute={(alt) => onTrocar(alt.id)}
      />
      <MenuSheet
        open={rirDe !== null}
        onClose={() => setRirDe(null)}
        title={t("Repetições sobrando")}
        corIcone={p.accent}
        opcoes={[
          ...RIR_OPCOES.map((o) => ({
            label: o.texto,
            prefixo: o.valor === 4 ? "4+" : String(o.valor),
            onPress: () => rirDe && onSerie(rirDe.id, { rir: o.valor }),
          })),
          ...(rirDe?.rir !== null && rirDe?.rir !== undefined
            ? [{ label: t("Limpar"), onPress: () => rirDe && onSerie(rirDe.id, { rir: null }) }]
            : []),
        ]}
      />
    </Animated.View>
  );
}

function Chip({
  children,
  destaque = false,
  icon,
  p,
}: {
  children: string;
  destaque?: boolean;
  icon?: IconNode;
  p: PaletaTreino;
}) {
  const cor = destaque ? p.accent : p.onSoft;
  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full border px-3 py-1"
      style={{ borderColor: destaque ? comAlfaSeguro(p.accent, 0.5) : p.line }}
    >
      {icon ? <Icon node={icon} color={cor} size={14} /> : null}
      <Text className="text-sm font-medium" style={{ color: cor }}>
        {children}
      </Text>
    </View>
  );
}

/** − valor + : o número também é editável direto. */
function Passo({
  valor,
  passo,
  inteiro = false,
  rotulo,
  desabilitado,
  p,
  onChange,
}: {
  valor: number | null;
  passo: number;
  inteiro?: boolean;
  rotulo: string;
  desabilitado: boolean;
  p: PaletaTreino;
  onChange: (v: number | null) => void;
}) {
  const [rascunho, setRascunho] = useState(valor === null ? "" : String(valor));
  useEffect(() => setRascunho(valor === null ? "" : String(valor)), [valor]);

  const ajustar = (delta: number) => {
    const novo = Math.max(0, Math.round(((valor ?? 0) + delta) * 100) / 100);
    onChange(inteiro ? Math.round(novo) : novo);
  };

  return (
    <View className="h-12 flex-row items-center rounded-xl" style={{ backgroundColor: p.raised }}>
      <Pressable
        onPress={() => ajustar(-passo)}
        disabled={desabilitado || !valor}
        accessibilityLabel={t("Diminuir {{v0}}", { v0: rotulo.toLowerCase() })}
        className="h-full w-6 items-center justify-center"
        style={{ opacity: desabilitado || !valor ? 0.3 : 1 }}
      >
        <Icon node={minus} color={p.onSoft} size={16} />
      </Pressable>
      <TextInput
        value={rascunho}
        onChangeText={setRascunho}
        editable={!desabilitado}
        keyboardType="decimal-pad"
        accessibilityLabel={rotulo}
        selectTextOnFocus
        onBlur={() => {
          const item = rascunho.trim().replace(",", ".");
          const n = item === "" ? null : Number(item);
          if (n !== null && (!Number.isFinite(n) || n < 0)) {
            setRascunho(valor === null ? "" : String(valor));
            return;
          }
          if (n !== valor) onChange(n === null ? null : inteiro ? Math.round(n) : n);
        }}
        className="min-w-0 flex-1 p-0 text-center font-sans text-base font-bold"
        style={{ color: p.on }}
      />
      <Pressable
        onPress={() => ajustar(passo)}
        disabled={desabilitado}
        accessibilityLabel={t("Aumentar {{v0}}", { v0: rotulo.toLowerCase() })}
        className="h-full w-6 items-center justify-center"
        style={{ opacity: desabilitado ? 0.3 : 1 }}
      >
        <Icon node={plus} color={p.onSoft} size={16} />
      </Pressable>
    </View>
  );
}

function BoardSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-background px-4" style={{ paddingTop: insets.top + 20 }}>
      <Skeleton className="mb-4 h-14 w-full rounded-2xl" />
      <Skeleton className="mb-4 aspect-square w-full rounded-3xl" />
      <Skeleton className="mb-3 h-9 w-2/3 rounded-lg" />
      <Skeleton className="h-48 w-full rounded-3xl" />
    </View>
  );
}

/** Segundos desde o início, pela hora gravada no banco (sobrevive a fechar o app). */
function useElapsedSeconds(startedAt: string, parado: boolean): number {
  const inicio = useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (parado) return;
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [parado]);
  return Math.max(0, Math.floor((agora - inicio) / 1000));
}

/** `01:23:45` acima de uma hora, `23:45` abaixo. */
function formatStopwatch(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** A comemoração: dura o tempo de ser lida e sai do caminho. */
function CompletionOverlay({
  p,
  durationSeconds,
  volumeKg,
  kcal,
  comparisons,
  records,
  onClose,
}: {
  p: PaletaTreino;
  durationSeconds: number;
  volumeKg: number;
  kcal: number | null;
  comparisons: ExerciseComparison[];
  records: string[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const entra = (i: number) => FadeInDown.delay(150 + i * 110).duration(500);
  const numeros = [
    { rotulo: t("Tempo"), valor: formatDuration(durationSeconds) },
    {
      rotulo: t("Volume"),
      valor: t("{{v0}} kg", { v0: Math.round(volumeKg).toLocaleString(LOCALE) }),
    },
    ...(kcal !== null ? [{ rotulo: t("Gasto"), valor: `~${kcal} kcal` }] : []),
  ];
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      className="absolute inset-0"
      style={{ backgroundColor: p.page }}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6"
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        accessibilityRole="alert"
      >
        <Animated.View
          entering={ZoomIn.duration(400)}
          className="mx-auto h-28 w-28 items-center justify-center rounded-full"
          style={{
            backgroundColor: p.ink,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <Icon node={check} color={p.page} size={56} strokeWidth={3} />
        </Animated.View>

        <Animated.View entering={entra(1)}>
          <Text
            className="mt-7 text-center text-[36px] font-extrabold leading-[38px]"
            style={{ color: p.ink }}
          >
            {t("Treino concluído!")}
          </Text>
          <Text className="mt-2 text-center font-medium" style={{ color: p.inkSoft }}>
            {t("Salvo no seu histórico.")}
          </Text>
        </Animated.View>

        <Animated.View entering={entra(2)} className="mt-7 flex-row gap-2.5">
          {numeros.map((n) => (
            <View
              key={n.rotulo}
              className="flex-1 items-center rounded-2xl px-2 py-4"
              style={{ backgroundColor: p.surface }}
            >
              <Text
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: p.onSoft }}
              >
                {n.rotulo}
              </Text>
              <Text className="mt-1 text-lg font-extrabold" style={{ color: p.on }}>
                {n.valor}
              </Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={entra(3)}>
          <ComparisonList comparisons={comparisons} p={p} />
        </Animated.View>

        {records.length > 0 ? (
          <Animated.View
            entering={entra(4)}
            className="mt-3 rounded-2xl p-4"
            style={{ backgroundColor: p.surface }}
          >
            <View className="flex-row items-center gap-2">
              <Icon node={trophy} color={p.accent} size={20} />
              <Text className="font-bold" style={{ color: p.on }}>
                {records.length === 1 ? t("Novo recorde pessoal") : t("Novos recordes pessoais")}
              </Text>
            </View>
            <Text className="mt-1 text-sm" style={{ color: p.onSoft }}>
              {records.join(", ")}
            </Text>
          </Animated.View>
        ) : null}

        <Animated.View entering={entra(5)}>
          <Pressable
            onPress={onClose}
            className="mt-7 h-14 w-full items-center justify-center rounded-2xl active:scale-[0.98]"
            style={{ backgroundColor: p.ink }}
          >
            <Text className="text-lg font-extrabold" style={{ color: p.page }}>
              {t("Ver meu progresso")}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

/** Hoje × última vez, por exercício. Queda não é vermelha: dia ruim faz parte. */
function ComparisonList({
  comparisons,
  p,
}: {
  comparisons: ExerciseComparison[];
  p: PaletaTreino;
}) {
  const comMelhor = comparisons.filter((c) => c.best);
  if (comMelhor.length === 0) return null;
  const TREND = {
    up: { icon: arrowUp, text: "subiu", cor: p.accent },
    same: { icon: equal, text: "igual", cor: p.onSoft },
    down: { icon: arrowDown, text: "caiu", cor: p.onSoft },
    new: { icon: sparkles, text: t("primeira vez"), cor: p.accent },
  } as const;
  const serie = (s: ExerciseComparison["best"]) =>
    s
      ? s.weightKg
        ? t("{{v0}} kg × {{reps}}", { v0: s.weightKg.toLocaleString(LOCALE), reps: s.reps })
        : t("{{reps}} reps", { reps: s.reps })
      : "—";
  return (
    <View className="mt-3 rounded-2xl p-4" style={{ backgroundColor: p.surface }}>
      <Text className="text-[11px] font-bold uppercase tracking-wider" style={{ color: p.onSoft }}>
        {t("Comparado à última vez")}
      </Text>
      <View className="mt-2.5 gap-2">
        {comMelhor.map((c) => {
          const item = TREND[c.trend];
          return (
            <View
              key={c.exerciseId}
              className="flex-row items-center gap-2.5"
              accessibilityLabel={`${c.name} — ${item.text}`}
            >
              <Icon node={item.icon} color={item.cor} size={16} strokeWidth={2.5} />
              <Text
                numberOfLines={1}
                className="min-w-0 flex-1 text-sm font-medium"
                style={{ color: p.on }}
              >
                {c.name}
              </Text>
              <Text className="text-sm" style={{ color: p.onSoft }}>
                {serie(c.best)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
