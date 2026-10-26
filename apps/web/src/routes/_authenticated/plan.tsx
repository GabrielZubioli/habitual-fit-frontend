import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarCog,
  ChevronDown,
  ChevronRight,
  Loader2,
  PencilRuler,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { TRAINING_PROGRAMS, WEEKDAY_LABELS, weekdayOf, type Weekday } from "@forja/domain";
import { queryKeys } from "@/data/query-keys";
import { errorMessage } from "@/data/supabase-helpers";
import {
  createEmptyRoutine,
  createTemplate,
  deleteTemplate,
  saveSuggestedRoutine,
  renameTemplate,
  setTemplateIcon,
  setTemplateWeekdays,
  splitDisplayName,
} from "@/data/routines";
import { addTemplateItem, fetchWorkoutWeek, type WorkoutWeek } from "@/data/workout-week";
import { openWorkoutForTemplate } from "@/data/workout-session";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { PageBody, PageHeader, headerIconClass } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/query-boundary";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AvisoProfissional } from "@/components/aviso-profissional";
import { ExercisePicker } from "@/components/pickers/exercise-picker";
import { RoutineExerciseRow, estimarDuracao } from "@/components/workouts/routine-exercise-row";
import { RoutineIconPicker } from "@/components/workouts/routine-icon";
import { ExerciseDemo } from "@/components/workouts/exercise-demo-images";
import { BodyMap, aggregateMuscleIntensities } from "@/components/body-map/body-map";
import { exerciseImages } from "@/data/exercise-media";
import { todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * O Plano: a semana e as rotinas.
 *
 * Duas abas, como nos apps de academia que se usa com uma mão:
 *
 * - **Agenda** — o treino de um dia por vez (Dia 1 a Dia 7): os músculos no
 *   boneco, os exercícios e o botão de iniciar. Cada rotina tem os seus dias
 *   (segunda = Peito, quarta = Costas…). Dia sem rotina é descanso.
 * - **Rotinas** — o conteúdo de cada uma: exercícios, séries, descanso.
 */
export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Plano — Habitual Fit" },
      { name: "description", content: "Sua rotina semanal e as rotinas de treino." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlanPage,
});

/** Segunda primeiro, domingo por último. */
const ORDEM_SEMANA: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

function PlanPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const userId = useCurrentUserId();
  const [aba, setAba] = useState<"agenda" | "rotinas">("agenda");
  const [aberta, setAberta] = useState<string | null>(null);
  /** Diálogo de nome aberto: renomear uma rotina ou criar uma. */
  const [nomeando, setNomeando] = useState<
    | { tipo: "rotina"; templateId: string; letter: string | null; atual: string }
    | { tipo: "nova" }
    | null
  >(null);

  const week = useQuery({
    queryKey: [...queryKeys.workouts.all, "week"],
    // Nunca remonta sozinho: um plano vazio pode ser a escolha da pessoa. Trocar
    // pelo sugerido é uma ação explícita, mais abaixo.
    queryFn: fetchWorkoutWeek,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: queryKeys.workouts.all });

  const abrir = useMutation({
    mutationFn: (templateId: string) => openWorkoutForTemplate(userId, templateId),
    onSuccess: (id) => {
      void invalidar();
      void navigate({ to: "/workouts/session/$id", params: { id } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  // Começar um treino abre uma sessão: pergunta antes, para um toque sem querer
  // na agenda não virar treino iniciado.
  const [iniciar, setIniciar] = useState<{ templateId: string; nome: string } | null>(null);
  const pedirInicio = (templateId: string) => {
    const s = week.data?.splits.find((x) => x.templateId === templateId);
    setIniciar({ templateId, nome: s ? splitDisplayName(s.name) : "este treino" });
  };

  /** Rotina com a exclusão pedida, aguardando confirmação. */
  const [excluindo, setExcluindo] = useState<{ templateId: string; nome: string } | null>(null);
  const excluir = useMutation({
    mutationFn: (templateId: string) => deleteTemplate(templateId),
    onSuccess: () => {
      setAberta(null);
      toast.success("Rotina excluída");
      void invalidar();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  /** Troca de plano pedida ("sugerido" ou "zero"), aguardando confirmação. */
  const [trocando, setTrocando] = useState<"sugerido" | "zero" | null>(null);
  const trocar = useMutation({
    mutationFn: (para: "sugerido" | "zero") =>
      para === "sugerido" ? saveSuggestedRoutine(userId) : createEmptyRoutine(userId),
    onSuccess: (_, para) => {
      setAberta(null);
      setAba(para === "sugerido" ? "agenda" : "rotinas");
      toast.success(para === "sugerido" ? "Plano sugerido ativado" : "Plano em branco criado");
      void invalidar();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const salvar = useMutation({
    mutationFn: (acao: () => Promise<void>) => acao(),
    onSuccess: () => void invalidar(),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (week.isPending) return <PlanSkeleton />;
  if (week.isError) {
    return (
      <PageBody>
        <ErrorState message={errorMessage(week.error)} onRetry={week.refetch} />
      </PageBody>
    );
  }

  const header = (
    <PageHeader
      title="Plano"
      description={week.data?.routineName ?? "Sua rotina semanal"}
      action={
        <Link
          to="/workouts/routines/new"
          className={headerIconClass}
          aria-label="Montar um plano novo"
        >
          <Wand2 />
        </Link>
      }
    />
  );

  if (!week.data) {
    return (
      <>
        {header}
        <PageBody>
          {/* Sem plano nenhum: as mesmas duas saídas do fim do questionário. */}
          <section className="rounded-[1.25rem] border border-dashed border-primary/40 bg-primary/5 p-5">
            <h2 className="text-lg font-bold">Você ainda não tem um plano de treino</h2>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              Use o plano sugerido para as suas respostas ou comece um plano em branco e monte tudo
              do seu jeito.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button
                className="h-12 rounded-xl"
                disabled={trocar.isPending}
                onClick={() => trocar.mutate("sugerido")}
              >
                <Sparkles className="mr-1.5 size-4" aria-hidden />
                Usar o plano sugerido
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-xl"
                disabled={trocar.isPending}
                onClick={() => trocar.mutate("zero")}
              >
                <PencilRuler className="mr-1.5 size-4" aria-hidden />
                Começar do zero
              </Button>
            </div>
          </section>
          <AvisoProfissional tipos={["treino"]} className="mt-4" />
        </PageBody>
      </>
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
      toast.success("Rotina criada. Adicione os exercícios.");
    }
    await invalidar();
    setNomeando(null);
  };
  const hoje = weekdayOf(todayISO());
  const emBranco = dados.splits.length === 0;

  return (
    <>
      {header}
      <PageBody>
        <Segmented
          value={aba}
          onChange={setAba}
          options={[
            { value: "agenda", label: "Agenda" },
            { value: "rotinas", label: "Rotinas" },
          ]}
          label="Seção do plano"
        />

        {emBranco && (
          <section className="mt-5 rounded-[1.25rem] border border-dashed border-primary/40 bg-primary/5 p-5">
            <h2 className="text-lg font-bold">Seu plano está em branco</h2>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              Crie suas rotinas, escolha os exercícios e vincule cada uma aos dias da semana. Se
              preferir, use o plano sugerido para as suas respostas.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button className="h-12 rounded-xl" onClick={() => setNomeando({ tipo: "nova" })}>
                <Plus className="mr-1.5 size-4" aria-hidden />
                Criar rotina
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-xl"
                onClick={() => setTrocando("sugerido")}
              >
                <Sparkles className="mr-1.5 size-4" aria-hidden />
                Usar o plano sugerido
              </Button>
            </div>
          </section>
        )}

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
          <section aria-label="Rotinas" className="mt-5">
            <ul className="space-y-3">
              {dados.splits.map((split) => {
                const expandida = aberta === split.templateId;
                return (
                  <li key={split.templateId} className="rounded-[1.25rem] bg-card">
                    <div className="flex items-center gap-2 p-4">
                      <RoutineIconPicker
                        icon={split.icon}
                        name={splitDisplayName(split.name)}
                        onChange={(icon) =>
                          salvar.mutate(() => setTemplateIcon(split.templateId, icon))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setAberta(expandida ? null : split.templateId)}
                        aria-expanded={expandida}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-lg font-semibold">
                          {split.name.replace(/^[A-Z]\s*—\s*/, "")}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {split.exercises.length}{" "}
                          {split.exercises.length === 1 ? "exercício" : "exercícios"} ·{" "}
                          {estimarDuracao(split)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setNomeando({
                            tipo: "rotina",
                            templateId: split.templateId,
                            letter: split.letter,
                            atual: splitDisplayName(split.name),
                          })
                        }
                        aria-label={`Renomear ${splitDisplayName(split.name)}`}
                        className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-elevated"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <Button
                        size="icon"
                        className="shrink-0 rounded-full"
                        onClick={() => pedirInicio(split.templateId)}
                        disabled={abrir.isPending || split.exercises.length === 0}
                        aria-label={`Começar ${splitDisplayName(split.name)}`}
                      >
                        <Play className="size-4 fill-current" aria-hidden />
                      </Button>
                      <button
                        type="button"
                        onClick={() => setAberta(expandida ? null : split.templateId)}
                        aria-label={expandida ? "Fechar rotina" : "Editar rotina"}
                        className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-elevated"
                      >
                        <ChevronDown
                          className={cn("size-5 transition-transform", expandida && "rotate-180")}
                        />
                      </button>
                    </div>

                    {expandida && (
                      <div className="border-t border-border/60 p-3">
                        <ul className="space-y-2.5">
                          {split.exercises.map((exercise, i) => (
                            <RoutineExerciseRow
                              key={exercise.itemId}
                              exercise={exercise}
                              index={i}
                              templateId={split.templateId}
                              onOpenDetail={() =>
                                void navigate({
                                  to: "/exercises/$id",
                                  params: { id: exercise.exerciseId },
                                })
                              }
                              onChanged={invalidar}
                            />
                          ))}
                        </ul>
                        <ExercisePicker
                          title="Adicionar exercício"
                          onPick={async (exercise) => {
                            await addTemplateItem(
                              split.templateId,
                              exercise.id,
                              split.exercises.length + 1,
                            );
                            toast.success("Exercício adicionado");
                            await invalidar();
                          }}
                          trigger={
                            <Button variant="ghost" className="mt-2 w-full text-primary">
                              <Plus className="mr-1.5 size-4" aria-hidden />
                              Adicionar exercício
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          className="mt-1 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() =>
                            setExcluindo({
                              templateId: split.templateId,
                              nome: splitDisplayName(split.name),
                            })
                          }
                        >
                          <Trash2 className="mr-1.5 size-4" aria-hidden />
                          Excluir rotina
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={() => setNomeando({ tipo: "nova" })}
              className="mt-3 flex w-full items-center gap-3 rounded-[1.25rem] border border-dashed border-border p-4 text-left text-primary transition-colors hover:bg-card"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/15">
                <Plus className="size-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold">Criar rotina personalizada</span>
                <span className="block text-sm text-muted-foreground">
                  Dê um nome e escolha os exercícios
                </span>
              </span>
            </button>

            {!emBranco && (
              <>
                <h2 className="mb-1 mt-8 px-1 text-lg font-semibold">Trocar de plano</h2>
                <p className="mb-3 px-1 text-sm text-muted-foreground">
                  As rotinas atuais saem do plano; os treinos que você já fez continuam no
                  histórico.
                </p>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => setTrocando("sugerido")}
                    className="flex items-center gap-3 rounded-[1.25rem] bg-card p-4 text-left transition-colors hover:bg-elevated"
                  >
                    <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">Usar o plano sugerido</span>
                      <span className="block text-sm text-muted-foreground">
                        Montado a partir das suas respostas do questionário
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrocando("zero")}
                    className="flex items-center gap-3 rounded-[1.25rem] bg-card p-4 text-left transition-colors hover:bg-elevated"
                  >
                    <PencilRuler className="size-5 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">Começar do zero</span>
                      <span className="block text-sm text-muted-foreground">
                        Um plano em branco, sem rotinas nem exercícios
                      </span>
                    </span>
                  </button>
                </div>
              </>
            )}

            <h2 className="mb-3 mt-8 px-1 text-lg text-muted-foreground">Programas prontos</h2>
            <ul className="space-y-3">
              {TRAINING_PROGRAMS.map((p) => (
                <li key={p.slug}>
                  <Link
                    to="/workouts/routines/new"
                    search={{ programa: p.slug }}
                    className="flex items-center gap-3 rounded-[1.25rem] bg-card p-4 transition-colors hover:bg-elevated"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{p.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {p.input.daysPerWeek}× por semana · {p.weeks} semanas
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </PageBody>

      <ConfirmDialog
        open={iniciar !== null}
        onOpenChange={(o) => !o && setIniciar(null)}
        title="Deseja iniciar esse treino?"
        description={
          iniciar ? `${iniciar.nome} começa agora e o cronômetro passa a contar.` : undefined
        }
        confirmLabel="Iniciar treino"
        onConfirm={() => iniciar && abrir.mutate(iniciar.templateId)}
      />

      <ConfirmDialog
        open={excluindo !== null}
        onOpenChange={(o) => !o && setExcluindo(null)}
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
        onOpenChange={(o) => !o && setTrocando(null)}
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
        onOpenChange={(o) => !o && setNomeando(null)}
        titulo={nomeando?.tipo === "nova" ? "Nova rotina" : "Nome da rotina"}
        inicial={nomeando?.tipo === "rotina" ? nomeando.atual : ""}
        confirmar={nomeando?.tipo === "nova" ? "Criar" : "Salvar"}
        onSave={salvarNome}
      />
    </>
  );
}

/**
 * Agenda: o treino de um dia da programação por vez.
 *
 * Dia 1 a Dia 7 seguem o vínculo que já existe entre rotina e dia da semana
 * (`weekdays` de cada rotina): Dia 1 é segunda, Dia 7 é domingo — a mesma
 * ordem da agenda de sempre, com o dia da semana escrito em cada botão.
 *
 * Trocar de dia é só consulta: não abre treino, não mexe na agenda. Iniciar é
 * o botão do dia, que passa pela mesma confirmação de antes.
 */
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
  const navigate = useNavigate();
  const [dia, setDia] = useState<Weekday>(hoje);
  // Mais de uma rotina no dia: qual está à vista. Guardada pelo id, e não pela
  // posição, para sobreviver a uma rotina tirada do dia.
  const [escolhida, setEscolhida] = useState<string | null>(null);

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

  return (
    <section aria-label="Agenda" className="mt-5">
      {/* Seletor dos sete dias: sete colunas iguais, sem rolagem lateral. */}
      <div role="radiogroup" aria-label="Dia da programação" className="grid grid-cols-7 gap-1.5">
        {ORDEM_SEMANA.map((d, i) => {
          const ativo = d === dia;
          const ehHoje = d === hoje;
          const temTreino = dados.splits.some(
            (s) => s.weekdays.includes(d) && s.exercises.length > 0,
          );
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={ativo}
              aria-label={`Dia ${i + 1}, ${WEEKDAY_LABELS[d]}${ehHoje ? ", hoje" : ""}${temTreino ? "" : ", descanso"}`}
              onClick={() => {
                setDia(d);
                setEscolhida(null);
              }}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-xl border py-2 transition-colors",
                ativo
                  ? "border-transparent bg-[#3AD598] text-[#04261a] shadow-[0_6px_16px_-8px_rgb(58_213_152/0.9)]"
                  : ehHoje
                    ? "border-primary/60 bg-card text-foreground"
                    : "border-border/70 bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                Dia
              </span>
              <span className="text-lg font-bold leading-none tabular-nums">{i + 1}</span>
              <span className="text-[11px] font-medium">
                {ehHoje ? "hoje" : WEEKDAY_LABELS[d].slice(0, 3)}
              </span>
              {/* Ponto: dia com treino. Sem ponto: descanso. */}
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 size-1.5 rounded-full",
                  temTreino ? (ativo ? "bg-[#04261a]" : "bg-primary") : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      <div
        key={`${dia}-${split?.templateId ?? "nada"}`}
        className="mt-6 animate-in fade-in duration-200 motion-reduce:animate-none"
      >
        {/* A — identificação */}
        <header className="flex items-start gap-3 px-1">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">
              Dia {numero} · {WEEKDAY_LABELS[dia]}
              {dia === hoje && " · hoje"}
            </p>
            <h2 className="mt-0.5 text-balance text-2xl font-bold leading-tight tracking-tight">
              {split ? splitDisplayName(split.name) : "Dia de descanso"}
            </h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-bold",
                  status === "treino" && "bg-primary/15 text-primary",
                  status === "vazio" && "bg-chart-4/15 text-chart-4",
                  status === "descanso" && "bg-elevated text-muted-foreground",
                )}
              >
                {status === "treino"
                  ? "Treino programado"
                  : status === "vazio"
                    ? "Sem exercícios"
                    : "Descanso"}
              </span>
              {split && status === "treino" && (
                <span>
                  {split.exercises.length}{" "}
                  {split.exercises.length === 1 ? "exercício" : "exercícios"} ·{" "}
                  {estimarDuracao(split)}
                </span>
              )}
            </p>
          </div>

          {/* Vincular e tirar rotinas do dia — o que a agenda sempre permitiu. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full"
                aria-label={`Ajustar as rotinas de ${nomeDia}`}
              >
                <CalendarCog className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Rotinas de {nomeDia}</DropdownMenuLabel>
              {dados.splits.length === 0 && (
                <DropdownMenuItem disabled>
                  Crie uma rotina na aba Rotinas primeiro
                </DropdownMenuItem>
              )}
              {outras.map((s) => (
                <DropdownMenuItem
                  key={`add-${s.templateId}`}
                  onSelect={() => onAdd(s.templateId, s.weekdays, dia)}
                >
                  <Plus className="mr-2 size-4" aria-hidden />
                  {splitDisplayName(s.name)}
                </DropdownMenuItem>
              ))}
              {doDia.map((s) => (
                <DropdownMenuItem
                  key={`rm-${s.templateId}`}
                  onSelect={() => onRemove(s.templateId, s.weekdays, dia)}
                  className="text-destructive focus:text-destructive"
                >
                  <X className="mr-2 size-4" aria-hidden />
                  Tirar {splitDisplayName(s.name)} deste dia
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Duas ou mais rotinas no mesmo dia: escolha qual ver. */}
        {doDia.length > 1 && (
          <div
            role="radiogroup"
            aria-label="Rotina do dia"
            className="mt-3 flex flex-wrap gap-2 px-1"
          >
            {doDia.map((s) => {
              const ativa = s.templateId === split?.templateId;
              return (
                <button
                  key={s.templateId}
                  type="button"
                  role="radio"
                  aria-checked={ativa}
                  onClick={() => setEscolhida(s.templateId)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    ativa
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {splitDisplayName(s.name)}
                </button>
              );
            })}
          </div>
        )}

        {status === "treino" && split ? (
          <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:items-start">
            {/* B — a região trabalhada no dia, pelo que os exercícios realmente trabalham */}
            <div className="rounded-[1.5rem] bg-card px-4 pb-5 pt-6 md:sticky md:top-4">
              {musculos.length > 0 ? (
                <BodyMap key={split.templateId} muscles={musculos} enquadrar className="w-full" />
              ) : (
                <>
                  <BodyMap muscles={[]} size="lg" showToggle={false} />
                  <p className="mt-3 text-center text-sm text-muted-foreground">
                    Os exercícios deste treino ainda não têm os músculos cadastrados.
                  </p>
                </>
              )}
            </div>

            {/* C — exercícios do dia, na ordem da rotina */}
            <div>
              <h3 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Exercícios</h3>
              <ol className="divide-y divide-border/60 overflow-hidden rounded-[1.5rem] bg-card">
                {split.exercises.map((e, i) => (
                  <li key={e.itemId}>
                    <button
                      type="button"
                      onClick={() =>
                        void navigate({ to: "/exercises/$id", params: { id: e.exerciseId } })
                      }
                      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-elevated"
                    >
                      <ExerciseDemo
                        images={exerciseImages(e.name, e.imageUrls)}
                        name={e.name}
                        autoPlay={false}
                        interactive={false}
                        className="w-16 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-balance font-semibold leading-snug">
                          <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                          {e.name}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {e.targetSets} ×{" "}
                          {e.targetRepMin && e.targetRepMax
                            ? `${e.targetRepMin}–${e.targetRepMax}`
                            : e.targetReps}{" "}
                          · descanso {e.restSeconds} s
                          {e.targetRpe !== null && ` · RPE ${e.targetRpe}`}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>

              {/* D — iniciar: o fluxo de sempre, com a confirmação */}
              <Button
                className="mt-4 h-14 w-full rounded-2xl bg-[#3AD598] text-base font-bold text-[#04261a] hover:bg-[#3AD598]/90"
                disabled={iniciando}
                onClick={() => onStart(split.templateId)}
              >
                {iniciando ? (
                  <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
                ) : (
                  <Play className="mr-2 size-5 fill-current" aria-hidden />
                )}
                Iniciar treino
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-center rounded-[1.5rem] bg-card px-6 pb-8 pt-6 text-center">
            <BodyMap muscles={[]} size="md" showToggle={false} showLegend={false} />
            <p className="mt-5 text-lg font-semibold">
              {status === "vazio" ? "Nenhum exercício nesta rotina" : "Nenhum treino programado"}
            </p>
            <p className="mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
              {status === "vazio"
                ? "Adicione exercícios a ela na aba Rotinas para poder iniciar o treino deste dia."
                : `${WEEKDAY_LABELS[dia]} é dia de descanso. Para treinar neste dia, vincule uma rotina pelo botão de ajustar.`}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/** Diálogo com um campo de nome — renomear uma rotina ou criar uma. */
function NomeDialog({
  open,
  onOpenChange,
  titulo,
  inicial,
  confirmar,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titulo: string;
  inicial: string;
  confirmar: string;
  onSave: (nome: string) => Promise<void>;
}) {
  const [nome, setNome] = useState(inicial);
  const salvar = useMutation({
    mutationFn: () => onSave(nome),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            salvar.mutate();
          }}
        >
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={60}
            placeholder="Ex.: Peito e tríceps"
            aria-label={titulo}
            className="h-12 text-lg"
          />
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={!nome.trim() || salvar.isPending} className="w-full">
              {confirmar}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Controle segmentado (duas ou três opções lado a lado). */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  small = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  small?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-2xl border border-primary/20 bg-card p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => value !== o.value && onChange(o.value)}
          className={cn(
            "flex-1 rounded-xl font-medium transition-all duration-300",
            small ? "py-2 text-sm" : "py-3 text-base",
            value === o.value
              ? "bg-primary font-bold text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PlanSkeleton() {
  return (
    <>
      <PageHeader title="Plano" description="Sua rotina semanal" />
      <PageBody>
        <Skeleton className="mb-6 h-24 w-full rounded-[1.5rem]" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-[1.25rem]" />
          ))}
        </div>
      </PageBody>
    </>
  );
}
