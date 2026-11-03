import { WEEKDAY_LABELS } from "@forja/app-core/lib/labels";
import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn } from "react-native-reanimated";
import { __iconNode as calendarCog } from "lucide-react/dist/esm/icons/calendar-cog.js";
import { __iconNode as chevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import { __iconNode as chevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
import { __iconNode as pencil } from "lucide-react/dist/esm/icons/pencil.js";
import { __iconNode as pencilRuler } from "lucide-react/dist/esm/icons/pencil-ruler.js";
import { __iconNode as play } from "lucide-react/dist/esm/icons/play.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { __iconNode as sparkles } from "lucide-react/dist/esm/icons/sparkles.js";
import { __iconNode as trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
import { __iconNode as wand2 } from "lucide-react/dist/esm/icons/wand-sparkles.js";
import { __iconNode as xIcon } from "lucide-react/dist/esm/icons/x.js";
import { TRAINING_PROGRAMS, weekdayOf, type Weekday } from "@forja/domain";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import {
  createEmptyRoutine,
  createTemplate,
  deleteTemplate,
  saveSuggestedRoutine,
  renameTemplate,
  setTemplateIcon,
  setTemplateWeekdays,
  splitDisplayName,
} from "@forja/app-core/data/routines";
import {
  addTemplateItem,
  fetchWorkoutWeek,
  type WorkoutWeek,
} from "@forja/app-core/data/workout-week";
import { openWorkoutForTemplate } from "@forja/app-core/data/workout-session";
import { exerciseImages } from "@forja/app-core/data/exercise-media";
import { aggregateMuscleIntensities } from "@forja/app-core/lib/body-map/intensity";
import { todayISO } from "@forja/app-core/lib/date";
import { useCurrentUserId } from "@/lib/session";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { AvisoProfissional } from "@/ui/aviso-profissional";
import { BodyMap } from "@/ui/body-map";
import { Button } from "@/ui/button";
import { ErrorState } from "@/ui/card";
import { ConfirmDialog, Dialog, MenuSheet, type OpcaoMenu } from "@/ui/dialog";
import { ExerciseDemo } from "@/ui/exercise-demo";
import { ExercisePicker } from "@/ui/exercise-picker";
import { Icon } from "@/ui/icon";
import { HeaderIconButton, PageHeader, PageScroll } from "@/ui/page-header";
import { RoutineExerciseRow, estimarDuracao } from "@/ui/routine-exercise-row";
import { RoutineIconPicker } from "@/ui/routine-icon";
import { Text } from "@/ui/text";

/**
 * O Plano — o `plan.tsx` do web: a semana e as rotinas, em duas abas. Agenda
 * mostra um dia por vez (o boneco, os exercícios, iniciar); Rotinas, o
 * conteúdo de cada uma.
 */

/** Segunda primeiro, domingo por último. */
const ORDEM_SEMANA: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
/** Cores da agenda no web (o verde da tela de entrada). */
const VERDE = "#3AD598";
const TINTA = "#04261a";

export default function PlanPage() {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const [aba, setAba] = useState<"agenda" | "rotinas">("agenda");
  const [aberta, setAberta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nomeando, setNomeando] = useState<
    | { tipo: "rotina"; templateId: string; letter: string | null; atual: string }
    | { tipo: "nova" }
    | null
  >(null);
  const [adicionandoEm, setAdicionandoEm] = useState<{ templateId: string; total: number } | null>(
    null,
  );
  const primaria = useColor("primary");
  const apagada = useColor("muted-foreground");
  const branco = useColor("primary-foreground");
  const destrutiva = useColor("destructive");
  const falhou = (e: unknown) => setErro(errorMessage(e));

  // Nunca remonta sozinho: um plano vazio pode ser a escolha da pessoa.
  const week = useQuery({
    queryKey: [...queryKeys.workouts.all, "week"],
    queryFn: fetchWorkoutWeek,
  });
  const invalidar = () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all });

  const abrir = useMutation({
    mutationFn: (templateId: string) => openWorkoutForTemplate(userId, templateId),
    onSuccess: (id) => {
      void invalidar();
      router.push({ pathname: "/workouts/session/[id]", params: { id } });
    },
    onError: falhou,
  });

  // Começar um treino abre uma sessão: pergunta antes.
  const [iniciar, setIniciar] = useState<{ templateId: string; nome: string } | null>(null);
  const pedirInicio = (templateId: string) => {
    const s = week.data?.splits.find((x) => x.templateId === templateId);
    setIniciar({ templateId, nome: s ? splitDisplayName(s.name) : "este treino" });
  };

  const [excluindo, setExcluindo] = useState<{ templateId: string; nome: string } | null>(null);
  const excluir = useMutation({
    mutationFn: (templateId: string) => deleteTemplate(templateId),
    onSuccess: () => {
      setAberta(null);
      void invalidar();
    },
    onError: falhou,
  });

  const [trocando, setTrocando] = useState<"sugerido" | "zero" | null>(null);
  const trocar = useMutation({
    mutationFn: (para: "sugerido" | "zero") =>
      para === "sugerido" ? saveSuggestedRoutine(userId) : createEmptyRoutine(userId),
    onSuccess: (_, para) => {
      setAberta(null);
      setAba(para === "sugerido" ? "agenda" : "rotinas");
      void invalidar();
    },
    onError: falhou,
  });

  const salvar = useMutation({
    mutationFn: (acao: () => Promise<void>) => acao(),
    onSuccess: () => void invalidar(),
    onError: falhou,
  });

  if (week.isPending) return <PlanSkeleton />;
  if (week.isError) {
    return (
      <View className="flex-1 bg-background px-4 pt-20">
        <ErrorState message={errorMessage(week.error)} onRetry={() => void week.refetch()} />
      </View>
    );
  }

  const header = (
    <PageHeader
      title="Plano"
      description={week.data?.routineName ?? "Sua rotina semanal"}
      action={
        <HeaderIconButton
          icon={wand2}
          label="Montar um plano novo"
          onPress={() => router.push("/workouts/routines/new")}
        />
      }
    />
  );

  const avisoErro = erro ? (
    <Pressable
      onPress={() => setErro(null)}
      className="mb-4 rounded-xl bg-destructive-soft px-3.5 py-3"
    >
      <Text className="text-sm font-medium text-destructive">{erro}</Text>
    </Pressable>
  ) : null;

  if (!week.data) {
    return (
      <PageScroll
        header={header}
        className="flex-1 bg-background"
        contentContainerClassName="pb-28"
      >
        <View className="px-4 py-4">
          {avisoErro}
          {/* Sem plano nenhum: as mesmas duas saídas do fim do questionário. */}
          <View className="rounded-[20px] border border-dashed border-primary/40 bg-primary/5 p-5">
            <Text className="text-lg font-bold">Você ainda não tem um plano de treino</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Use o plano sugerido para as suas respostas ou comece um plano em branco e monte tudo
              do seu jeito.
            </Text>
            <View className="mt-4 gap-2">
              <Button
                className="h-12 rounded-xl"
                disabled={trocar.isPending}
                onPress={() => trocar.mutate("sugerido")}
              >
                <Icon node={sparkles} color={branco} size={16} />
                <Text className="text-sm font-medium text-primary-foreground">
                  Usar o plano sugerido
                </Text>
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-xl"
                disabled={trocar.isPending}
                onPress={() => trocar.mutate("zero")}
              >
                <Icon node={pencilRuler} color={apagada} size={16} />
                <Text className="text-sm font-medium">Começar do zero</Text>
              </Button>
            </View>
          </View>
          <AvisoProfissional tipos={["treino"]} className="mt-4" />
        </View>
      </PageScroll>
    );
  }

  const dados = week.data;
  const salvarNome = async (nome: string) => {
    if (!nomeando) return;
    if (nomeando.tipo === "rotina")
      await renameTemplate(nomeando.templateId, nomeando.letter, nome);
    else {
      const id = await createTemplate(userId, dados.routineId, dados.splits, nome);
      setAba("rotinas");
      setAberta(id);
    }
    await invalidar();
    setNomeando(null);
  };
  const hoje = weekdayOf(todayISO());
  const emBranco = dados.splits.length === 0;

  return (
    <View className="flex-1 bg-background">
      <PageScroll
        header={header}
        contentContainerClassName="pb-28"
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-4 py-4">
          {avisoErro}
          <Segmented
            value={aba}
            onChange={setAba}
            options={[
              { value: "agenda", label: "Agenda" },
              { value: "rotinas", label: "Rotinas" },
            ]}
          />

          {emBranco ? (
            <View className="mt-5 rounded-[20px] border border-dashed border-primary/40 bg-primary/5 p-5">
              <Text className="text-lg font-bold">Seu plano está em branco</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Crie suas rotinas, escolha os exercícios e vincule cada uma aos dias da semana. Se
                preferir, use o plano sugerido para as suas respostas.
              </Text>
              <View className="mt-4 gap-2">
                <Button className="h-12 rounded-xl" onPress={() => setNomeando({ tipo: "nova" })}>
                  <Icon node={plus} color={branco} size={16} />
                  <Text className="text-sm font-medium text-primary-foreground">Criar rotina</Text>
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl"
                  onPress={() => setTrocando("sugerido")}
                >
                  <Icon node={sparkles} color={apagada} size={16} />
                  <Text className="text-sm font-medium">Usar o plano sugerido</Text>
                </Button>
              </View>
            </View>
          ) : null}

          {aba === "agenda" ? (
            <AgendaDia
              dados={dados}
              hoje={hoje}
              iniciando={abrir.isPending}
              onStart={pedirInicio}
              onAdd={(templateId, dias, dia) =>
                salvar.mutate(() => setTemplateWeekdays(templateId, [...dias, dia]))
              }
              onRemove={(templateId, dias, dia) =>
                salvar.mutate(() =>
                  setTemplateWeekdays(
                    templateId,
                    dias.filter((d) => d !== dia),
                  ),
                )
              }
            />
          ) : (
            <View className="mt-5" accessibilityLabel="Rotinas">
              <View className="gap-3">
                {dados.splits.map((split) => {
                  const expandida = aberta === split.templateId;
                  return (
                    <View key={split.templateId} className="rounded-[20px] bg-card">
                      <View className="flex-row items-center gap-2 p-4">
                        <RoutineIconPicker
                          icon={split.icon}
                          name={splitDisplayName(split.name)}
                          onChange={(icon) =>
                            salvar.mutate(() => setTemplateIcon(split.templateId, icon))
                          }
                        />
                        <Pressable
                          onPress={() => setAberta(expandida ? null : split.templateId)}
                          accessibilityState={{ expanded: expandida }}
                          className="min-w-0 flex-1"
                        >
                          <Text numberOfLines={1} className="text-lg font-semibold">
                            {split.name.replace(/^[A-Z]\s*—\s*/, "")}
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            {split.exercises.length}{" "}
                            {split.exercises.length === 1 ? "exercício" : "exercícios"} ·{" "}
                            {estimarDuracao(split)}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            setNomeando({
                              tipo: "rotina",
                              templateId: split.templateId,
                              letter: split.letter,
                              atual: splitDisplayName(split.name),
                            })
                          }
                          accessibilityLabel={`Renomear ${splitDisplayName(split.name)}`}
                          className="h-9 w-9 items-center justify-center rounded-full active:bg-elevated"
                        >
                          <Icon node={pencil} color={apagada} size={16} />
                        </Pressable>
                        <Pressable
                          onPress={() => pedirInicio(split.templateId)}
                          disabled={abrir.isPending || split.exercises.length === 0}
                          accessibilityLabel={`Começar ${splitDisplayName(split.name)}`}
                          className="h-10 w-10 items-center justify-center rounded-full bg-primary"
                          style={{
                            opacity: abrir.isPending || split.exercises.length === 0 ? 0.5 : 1,
                          }}
                        >
                          <Icon node={play} color={branco} size={16} preenchido />
                        </Pressable>
                        <Pressable
                          onPress={() => setAberta(expandida ? null : split.templateId)}
                          accessibilityLabel={expandida ? "Fechar rotina" : "Editar rotina"}
                          className="h-9 w-9 items-center justify-center rounded-full"
                          style={{ transform: [{ rotate: expandida ? "180deg" : "0deg" }] }}
                        >
                          <Icon node={chevronDown} color={apagada} size={20} />
                        </Pressable>
                      </View>

                      {expandida ? (
                        <View className="border-t border-border/60 p-3">
                          <View className="gap-2.5">
                            {split.exercises.map((exercise, i) => (
                              <RoutineExerciseRow
                                key={exercise.itemId}
                                exercise={exercise}
                                index={i}
                                templateId={split.templateId}
                                onOpenDetail={() =>
                                  router.push({
                                    pathname: "/exercises/[id]",
                                    params: { id: exercise.exerciseId },
                                  })
                                }
                                onChanged={invalidar}
                                onError={setErro}
                              />
                            ))}
                          </View>
                          <Button
                            variant="ghost"
                            className="mt-2 w-full"
                            onPress={() =>
                              setAdicionandoEm({
                                templateId: split.templateId,
                                total: split.exercises.length,
                              })
                            }
                          >
                            <Icon node={plus} color={primaria} size={16} />
                            <Text className="text-sm font-medium text-primary">
                              Adicionar exercício
                            </Text>
                          </Button>
                          <Button
                            variant="ghost"
                            className="mt-1 w-full"
                            onPress={() =>
                              setExcluindo({
                                templateId: split.templateId,
                                nome: splitDisplayName(split.name),
                              })
                            }
                          >
                            <Icon node={trash2} color={destrutiva} size={16} />
                            <Text className="text-sm font-medium text-destructive">
                              Excluir rotina
                            </Text>
                          </Button>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <Pressable
                onPress={() => setNomeando({ tipo: "nova" })}
                className="mt-3 flex-row items-center gap-3 rounded-[20px] border border-dashed border-border p-4 active:bg-card"
              >
                <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
                  <Icon node={plus} color={primaria} size={24} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-lg font-semibold text-primary">
                    Criar rotina personalizada
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    Dê um nome e escolha os exercícios
                  </Text>
                </View>
              </Pressable>

              {!emBranco ? (
                <>
                  <Text className="mb-1 mt-8 px-1 text-lg font-semibold">Trocar de plano</Text>
                  <Text className="mb-3 px-1 text-sm text-muted-foreground">
                    As rotinas atuais saem do plano; os treinos que você já fez continuam no
                    histórico.
                  </Text>
                  <View className="gap-2">
                    <LinhaOpcao
                      icon={sparkles}
                      titulo="Usar o plano sugerido"
                      detalhe="Montado a partir das suas respostas do questionário"
                      onPress={() => setTrocando("sugerido")}
                    />
                    <LinhaOpcao
                      icon={pencilRuler}
                      titulo="Começar do zero"
                      detalhe="Um plano em branco, sem rotinas nem exercícios"
                      onPress={() => setTrocando("zero")}
                    />
                  </View>
                </>
              ) : null}

              <Text className="mb-3 mt-8 px-1 text-lg text-muted-foreground">
                Programas prontos
              </Text>
              <View className="gap-3">
                {TRAINING_PROGRAMS.map((p) => (
                  <Pressable
                    key={p.slug}
                    onPress={() =>
                      router.push({
                        pathname: "/workouts/routines/new",
                        params: { programa: p.slug },
                      })
                    }
                    className="flex-row items-center gap-3 rounded-[20px] bg-card p-4 active:bg-elevated"
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold">{p.name}</Text>
                      <Text className="text-sm text-muted-foreground">
                        {p.input.daysPerWeek}× por semana · {p.weeks} semanas
                      </Text>
                    </View>
                    <Icon node={chevronRight} color={apagada} size={20} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      </PageScroll>

      <ConfirmDialog
        open={iniciar !== null}
        onClose={() => setIniciar(null)}
        title="Deseja iniciar esse treino?"
        description={
          iniciar ? `${iniciar.nome} começa agora e o cronômetro passa a contar.` : undefined
        }
        confirmLabel="Iniciar treino"
        onConfirm={() => iniciar && abrir.mutate(iniciar.templateId)}
      />
      <ConfirmDialog
        open={excluindo !== null}
        onClose={() => setExcluindo(null)}
        title="Excluir esta rotina?"
        description={
          excluindo
            ? `“${excluindo.nome}” sai do plano e dos dias da semana. Os treinos que você já fez com ela continuam no histórico.`
            : undefined
        }
        confirmLabel="Excluir rotina"
        destructive
        onConfirm={() => excluindo && excluir.mutate(excluindo.templateId)}
      />
      <ConfirmDialog
        open={trocando !== null}
        onClose={() => setTrocando(null)}
        title={trocando === "zero" ? "Começar um plano do zero?" : "Usar o plano sugerido?"}
        description={
          trocando === "zero"
            ? "Suas rotinas atuais saem do plano e você começa com um plano em branco. Os treinos que você já fez continuam no histórico."
            : emBranco
              ? "Montamos as rotinas, os exercícios e os dias a partir das suas respostas do questionário. Você pode ajustar tudo depois. Lembre: é uma referência geral, que não substitui a orientação de um profissional de educação física."
              : "Suas rotinas atuais saem do plano e dão lugar às sugeridas para as suas respostas. Os treinos que você já fez continuam no histórico. O plano sugerido é uma referência geral, que não substitui a orientação de um profissional de educação física."
        }
        confirmLabel={trocando === "zero" ? "Começar do zero" : "Usar o plano sugerido"}
        destructive={trocando === "zero" || !emBranco}
        onConfirm={() => trocando && trocar.mutate(trocando)}
      />
      <NomeDialog
        key={nomeando ? JSON.stringify(nomeando) : "fechado"}
        open={nomeando !== null}
        onClose={() => setNomeando(null)}
        titulo={nomeando?.tipo === "nova" ? "Nova rotina" : "Nome da rotina"}
        inicial={nomeando?.tipo === "rotina" ? nomeando.atual : ""}
        confirmar={nomeando?.tipo === "nova" ? "Criar" : "Salvar"}
        onSave={salvarNome}
      />
      <ExercisePicker
        open={adicionandoEm !== null}
        onClose={() => setAdicionandoEm(null)}
        title="Adicionar exercício"
        onPick={async (exercise) => {
          if (!adicionandoEm) return;
          await addTemplateItem(adicionandoEm.templateId, exercise.id, adicionandoEm.total + 1);
          await invalidar();
        }}
      />
    </View>
  );
}

function LinhaOpcao({
  icon,
  titulo,
  detalhe,
  onPress,
}: {
  icon: import("@/ui/icon").IconNode;
  titulo: string;
  detalhe: string;
  onPress: () => void;
}) {
  const primaria = useColor("primary");
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-[20px] bg-card p-4 active:bg-elevated"
    >
      <Icon node={icon} color={primaria} size={20} />
      <View className="min-w-0 flex-1">
        <Text className="font-semibold">{titulo}</Text>
        <Text className="text-sm text-muted-foreground">{detalhe}</Text>
      </View>
    </Pressable>
  );
}

/** Agenda: o treino de um dia da programação por vez (Dia 1 = segunda). */
function AgendaDia({
  dados,
  hoje,
  iniciando,
  onStart,
  onAdd,
  onRemove,
}: {
  dados: WorkoutWeek;
  hoje: Weekday;
  iniciando: boolean;
  onStart: (templateId: string) => void;
  onAdd: (templateId: string, diasAtuais: number[], dia: Weekday) => void;
  onRemove: (templateId: string, diasAtuais: number[], dia: Weekday) => void;
}) {
  const [dia, setDia] = useState<Weekday>(hoje);
  // Mais de uma rotina no dia: qual está à vista (pelo id).
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState(false);
  const apagada = useColor("muted-foreground");
  const texto = useColor("foreground");

  const doDia = dados.splits.filter((s) => s.weekdays.includes(dia));
  const outras = dados.splits.filter((s) => !s.weekdays.includes(dia));
  const split = doDia.find((s) => s.templateId === escolhida) ?? doDia[0] ?? null;
  const numero = ORDEM_SEMANA.indexOf(dia) + 1;
  const musculos = useMemo(
    () => (split ? aggregateMuscleIntensities(split.exercises.flatMap((e) => e.muscles)) : []),
    [split],
  );
  const status: "treino" | "vazio" | "descanso" = !split
    ? "descanso"
    : split.exercises.length > 0
      ? "treino"
      : "vazio";
  const nomeDia = WEEKDAY_LABELS[dia].toLowerCase();

  const opcoesAjuste: OpcaoMenu[] = [
    ...(dados.splits.length === 0
      ? [{ label: "Crie uma rotina na aba Rotinas primeiro", onPress: () => undefined }]
      : []),
    ...outras.map((s) => ({
      label: splitDisplayName(s.name),
      icon: plus,
      onPress: () => onAdd(s.templateId, s.weekdays, dia),
    })),
    ...doDia.map((s) => ({
      label: `Tirar ${splitDisplayName(s.name)} deste dia`,
      icon: xIcon,
      destrutiva: true,
      onPress: () => onRemove(s.templateId, s.weekdays, dia),
    })),
  ];

  return (
    <View className="mt-5" accessibilityLabel="Agenda">
      {/* Seletor dos sete dias: sete colunas iguais. */}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Dia da programação"
        className="flex-row gap-1.5"
      >
        {ORDEM_SEMANA.map((d, i) => {
          const ativo = d === dia;
          const ehHoje = d === hoje;
          const temTreino = dados.splits.some(
            (s) => s.weekdays.includes(d) && s.exercises.length > 0,
          );
          const corTexto = ativo ? TINTA : undefined;
          return (
            <Pressable
              key={d}
              accessibilityRole="radio"
              accessibilityState={{ checked: ativo }}
              accessibilityLabel={`Dia ${i + 1}, ${WEEKDAY_LABELS[d]}${ehHoje ? ", hoje" : ""}${temTreino ? "" : ", descanso"}`}
              onPress={() => {
                setDia(d);
                setEscolhida(null);
              }}
              className={cn(
                "flex-1 items-center gap-0.5 rounded-xl border py-2",
                ativo
                  ? "border-transparent"
                  : ehHoje
                    ? "border-primary/60 bg-card"
                    : "border-border/70 bg-card",
              )}
              style={
                ativo
                  ? {
                      backgroundColor: VERDE,
                      shadowColor: VERDE,
                      shadowOpacity: 0.9,
                      shadowRadius: 8,
                      elevation: 6,
                    }
                  : undefined
              }
            >
              <Text
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide opacity-80",
                  !ativo && !ehHoje && "text-muted-foreground",
                )}
                style={corTexto ? { color: corTexto } : undefined}
              >
                Dia
              </Text>
              <Text
                className={cn(
                  "text-lg font-bold leading-none",
                  !ativo && !ehHoje && "text-muted-foreground",
                )}
                style={corTexto ? { color: corTexto } : undefined}
              >
                {i + 1}
              </Text>
              <Text
                className={cn(
                  "text-[11px] font-medium",
                  !ativo && !ehHoje && "text-muted-foreground",
                )}
                style={corTexto ? { color: corTexto } : undefined}
              >
                {ehHoje ? "hoje" : WEEKDAY_LABELS[d].slice(0, 3)}
              </Text>
              {/* Ponto: dia com treino. Sem ponto: descanso. */}
              <View
                className={cn(
                  "mt-0.5 h-1.5 w-1.5 rounded-full",
                  temTreino && !ativo && "bg-primary",
                )}
                style={temTreino && ativo ? { backgroundColor: TINTA } : undefined}
              />
            </Pressable>
          );
        })}
      </View>

      <Animated.View
        key={`${dia}-${split?.templateId ?? "nada"}`}
        entering={FadeIn.duration(200)}
        className="mt-6"
      >
        <View className="flex-row items-start gap-3 px-1">
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-medium text-muted-foreground">
              Dia {numero} · {WEEKDAY_LABELS[dia]}
              {dia === hoje ? " · hoje" : ""}
            </Text>
            <Text
              textBreakStrategy="balanced"
              className="mt-0.5 text-2xl font-bold leading-tight tracking-tight"
            >
              {split ? splitDisplayName(split.name) : "Dia de descanso"}
            </Text>
            <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <View
                className={cn(
                  "rounded-full px-2.5 py-0.5",
                  status === "treino" && "bg-primary/15",
                  status === "vazio" && "bg-chart-4/15",
                  status === "descanso" && "bg-elevated",
                )}
              >
                <Text
                  className={cn(
                    "text-xs font-bold",
                    status === "treino" && "text-primary",
                    status === "vazio" && "text-chart-4",
                    status === "descanso" && "text-muted-foreground",
                  )}
                >
                  {status === "treino"
                    ? "Treino programado"
                    : status === "vazio"
                      ? "Sem exercícios"
                      : "Descanso"}
                </Text>
              </View>
              {split && status === "treino" ? (
                <Text className="text-sm text-muted-foreground">
                  {split.exercises.length}{" "}
                  {split.exercises.length === 1 ? "exercício" : "exercícios"} ·{" "}
                  {estimarDuracao(split)}
                </Text>
              ) : null}
            </View>
          </View>
          <Pressable
            onPress={() => setAjustando(true)}
            accessibilityLabel={`Ajustar as rotinas de ${nomeDia}`}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-accent"
          >
            <Icon node={calendarCog} color={texto} size={20} />
          </Pressable>
        </View>

        {doDia.length > 1 ? (
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Rotina do dia"
            className="mt-3 flex-row flex-wrap gap-2 px-1"
          >
            {doDia.map((s) => {
              const ativa = s.templateId === split?.templateId;
              return (
                <Pressable
                  key={s.templateId}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: ativa }}
                  onPress={() => setEscolhida(s.templateId)}
                  className={cn(
                    "rounded-full border px-3 py-1.5",
                    ativa ? "border-primary bg-primary/15" : "border-border",
                  )}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium",
                      ativa ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {splitDisplayName(s.name)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {status === "treino" && split ? (
          <View className="mt-5 gap-6">
            <View className="rounded-3xl bg-card px-4 pb-5 pt-6">
              {musculos.length > 0 ? (
                <BodyMap key={split.templateId} muscles={musculos} enquadrar />
              ) : (
                <>
                  <BodyMap muscles={[]} size="lg" showToggle={false} />
                  <Text className="mt-3 text-center text-sm text-muted-foreground">
                    Os exercícios deste treino ainda não têm os músculos cadastrados.
                  </Text>
                </>
              )}
            </View>

            <View>
              <Text className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
                Exercícios
              </Text>
              <View className="overflow-hidden rounded-3xl bg-card">
                {split.exercises.map((e, i) => (
                  <Pressable
                    key={e.itemId}
                    onPress={() =>
                      router.push({ pathname: "/exercises/[id]", params: { id: e.exerciseId } })
                    }
                    className={cn(
                      "flex-row items-center gap-3 p-3 active:bg-elevated",
                      i > 0 && "border-t border-border/60",
                    )}
                  >
                    <View className="w-16">
                      <ExerciseDemo
                        images={exerciseImages(e.name, e.imageUrls)}
                        name={e.name}
                        autoPlay={false}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text textBreakStrategy="balanced" className="font-semibold leading-snug">
                        <Text className="text-muted-foreground">{i + 1}. </Text>
                        {e.name}
                      </Text>
                      <Text className="mt-0.5 text-sm text-muted-foreground">
                        {e.targetSets} ×{" "}
                        {e.targetRepMin && e.targetRepMax
                          ? `${e.targetRepMin}–${e.targetRepMax}`
                          : e.targetReps}{" "}
                        · descanso {e.restSeconds} s
                        {e.targetRpe !== null ? ` · RPE ${e.targetRpe}` : ""}
                      </Text>
                    </View>
                    <Icon node={chevronRight} color={apagada} size={16} />
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => onStart(split.templateId)}
                disabled={iniciando}
                className="mt-4 h-14 w-full flex-row items-center justify-center gap-2 rounded-2xl active:opacity-90"
                style={{ backgroundColor: VERDE, opacity: iniciando ? 0.5 : 1 }}
              >
                <Icon node={play} color={TINTA} size={20} preenchido />
                <Text className="text-base font-bold" style={{ color: TINTA }}>
                  Iniciar treino
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="mt-5 items-center rounded-3xl bg-card px-6 pb-8 pt-6">
            <BodyMap muscles={[]} size="md" showToggle={false} showLegend={false} />
            <Text className="mt-5 text-center text-lg font-semibold">
              {status === "vazio" ? "Nenhum exercício nesta rotina" : "Nenhum treino programado"}
            </Text>
            <Text className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              {status === "vazio"
                ? "Adicione exercícios a ela na aba Rotinas para poder iniciar o treino deste dia."
                : `${WEEKDAY_LABELS[dia]} é dia de descanso. Para treinar neste dia, vincule uma rotina pelo botão de ajustar.`}
            </Text>
          </View>
        )}
      </Animated.View>

      <MenuSheet
        open={ajustando}
        onClose={() => setAjustando(false)}
        title={`Rotinas de ${nomeDia}`}
        corIcone={texto}
        opcoes={opcoesAjuste}
      />
    </View>
  );
}

/** Diálogo com um campo de nome — renomear uma rotina ou criar uma. */
function NomeDialog({
  open,
  onClose,
  titulo,
  inicial,
  confirmar,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  inicial: string;
  confirmar: string;
  onSave: (nome: string) => Promise<void>;
}) {
  const [nome, setNome] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const apagada = useColor("muted-foreground");
  const texto = useColor("foreground");
  const salvar = useMutation({
    mutationFn: () => onSave(nome),
    onError: (e) => setErro(errorMessage(e)),
  });
  return (
    <Dialog open={open} onClose={onClose} title={titulo}>
      <TextInput
        autoFocus
        value={nome}
        onChangeText={setNome}
        maxLength={60}
        placeholder="Ex.: Peito e tríceps"
        placeholderTextColor={apagada}
        accessibilityLabel={titulo}
        onSubmitEditing={() => nome.trim() && salvar.mutate()}
        className="h-12 rounded-md border border-input bg-background px-3 font-sans text-lg"
        style={{ color: texto }}
      />
      {erro ? <Text className="text-sm text-destructive">{erro}</Text> : null}
      <Button
        className="w-full"
        disabled={!nome.trim()}
        loading={salvar.isPending}
        onPress={() => salvar.mutate()}
      >
        {confirmar}
      </Button>
    </Dialog>
  );
}

/** Controle segmentado (duas opções lado a lado). */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      className="flex-row rounded-2xl border border-primary/20 bg-card p-1"
    >
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === o.value }}
          onPress={() => value !== o.value && onChange(o.value)}
          className={cn("flex-1 items-center rounded-xl py-3", value === o.value && "bg-primary")}
        >
          <Text
            className={cn(
              "text-base",
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

function PlanSkeleton() {
  return (
    <View className="flex-1 bg-background">
      <PageHeader title="Plano" description="Sua rotina semanal" />
      <View className="px-4 py-4">
        <View className="mb-6 h-24 w-full rounded-3xl bg-muted" />
        <View className="gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <View key={i} className="h-20 w-full rounded-[20px] bg-muted" />
          ))}
        </View>
      </View>
    </View>
  );
}
