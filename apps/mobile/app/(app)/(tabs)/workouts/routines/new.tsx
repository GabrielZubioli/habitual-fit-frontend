import { useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Defs, LinearGradient, Rect, Stop, Svg } from "react-native-svg";
import { __iconNode as arrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { __iconNode as arrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { __iconNode as check } from "lucide-react/dist/esm/icons/check.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as info } from "lucide-react/dist/esm/icons/info.js";
import { __iconNode as sparkles } from "lucide-react/dist/esm/icons/sparkles.js";
import { __iconNode as triangleAlert } from "lucide-react/dist/esm/icons/triangle-alert.js";
import { __iconNode as xIcon } from "lucide-react/dist/esm/icons/x.js";
import {
  WEEKDAYS,
  WEEKDAY_INITIALS,
  WEEKDAY_LABELS,
  findProgram,
  findVolumeOutliers,
  suggestWeekdays,
  sumWeeklySetsByGroup,
  type EquipmentProfile,
  type PlanInput,
  type TrainingGoal,
  type TrainingLevel,
} from "@forja/domain";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { buildRoutineDraft, createRoutine } from "@forja/app-core/data/routines";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { MUSCLE_LABELS, label } from "@forja/app-core/lib/labels";
import { useCurrentUserId } from "@/lib/session";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, ErrorState } from "@/ui/card";
import { Icon } from "@/ui/icon";
import { PageHeader, PageScroll } from "@/ui/page-header";
import { Text } from "@/ui/text";

/**
 * Assistente de criação do plano — o `workouts_.routines.new.tsx` do web.
 * Quatro perguntas (nível, objetivo, equipamento, frequência), os dias e a
 * prévia. `?programa=<slug>` chega dos programas prontos e abre nos dias.
 */
type Step = 0 | 1 | 2 | 3 | 4 | 5;

const LEVEL_OPTIONS: { value: TrainingLevel; label: string; hint: string }[] = [
  { value: "beginner", label: "Iniciante", hint: "Menos de 6 meses treinando com consistência" },
  {
    value: "intermediate",
    label: "Intermediário",
    hint: "6 meses a 2 anos, técnica já consolidada",
  },
  { value: "advanced", label: "Avançado", hint: "Mais de 2 anos, progressão já lenta" },
];
const GOAL_OPTIONS: { value: TrainingGoal; label: string; hint: string }[] = [
  { value: "hypertrophy", label: "Ganhar massa", hint: "8–12 repetições, descanso médio" },
  { value: "strength", label: "Ganhar força", hint: "4–6 repetições, descanso longo" },
  { value: "endurance", label: "Resistência", hint: "12–20 repetições, descanso curto" },
];
const EQUIPMENT_OPTIONS: { value: EquipmentProfile; label: string; hint: string }[] = [
  { value: "full_gym", label: "Academia completa", hint: "Barras, halteres, máquinas e polias" },
  { value: "home_basic", label: "Casa com halteres", hint: "Halteres, elásticos e peso corporal" },
  { value: "bodyweight", label: "Só peso corporal", hint: "Sem nenhum equipamento" },
];
const FREQUENCY_OPTIONS = [2, 3, 4, 5, 6] as const;
const FREQUENCY_HINT: Record<number, string> = {
  2: "Corpo inteiro, duas vezes por semana",
  3: "Empurrar / Puxar / Pernas",
  4: "Superiores e inferiores, duas vezes cada",
  5: "Divisão completa com maior volume",
  6: "Empurrar / Puxar / Pernas, duas vezes",
};
const STEP_TITLES = [
  "Seu nível",
  "Seu objetivo",
  "Onde você treina",
  "Quantos dias",
  "Quais dias",
  "Seu plano",
];

export default function RoutineWizard() {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const params = useLocalSearchParams<{ programa?: string }>();
  const programa = findProgram(params.programa);
  const preset = programa?.input;
  const texto = useColor("foreground");
  const branco = useColor("primary-foreground");
  const apagada = useColor("muted-foreground");

  const [step, setStep] = useState<Step>(preset ? 4 : 0);
  const [level, setLevel] = useState<TrainingLevel | null>(preset?.level ?? null);
  const [goal, setGoal] = useState<TrainingGoal | null>(preset?.goal ?? null);
  const [equipment, setEquipment] = useState<EquipmentProfile | null>(preset?.equipment ?? null);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(preset?.daysPerWeek ?? null);
  const [weekdays, setWeekdays] = useState<number[]>(() =>
    preset ? suggestWeekdays(preset.daysPerWeek) : [],
  );
  const [erro, setErro] = useState<string | null>(null);

  const input: PlanInput | null =
    level && goal && equipment && daysPerWeek
      ? { level, goal, equipment, daysPerWeek, focus: preset?.focus, duration: preset?.duration }
      : null;

  // Só monta a prévia no último passo, quando todas as respostas existem.
  const draft = useQuery({
    queryKey: ["routine-draft", input],
    enabled: step === 5 && input !== null,
    queryFn: () => buildRoutineDraft(input!),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!input || !draft.data) throw new Error("Plano ainda não está pronto.");
      const nome =
        programa?.name ??
        `${GOAL_OPTIONS.find((g) => g.value === input.goal)?.label ?? "Treino"} · ${input.daysPerWeek}× por semana`;
      return createRoutine(userId, input, draft.data, nome, weekdays);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.workouts.all });
      router.navigate("/plan");
    },
    onError: (e) => setErro(errorMessage(e)),
  });

  const canAdvance =
    (step === 0 && level) ||
    (step === 1 && goal) ||
    (step === 2 && equipment) ||
    (step === 3 && daysPerWeek) ||
    (step === 4 && weekdays.length === daysPerWeek);

  return (
    <PageScroll
      className="flex-1 bg-background"
      contentContainerClassName="pb-28"
      header={
        <PageHeader
          title="Montar meu plano"
          description="Quatro perguntas e sua divisão de treino fica pronta."
          topo={
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onPress={() => router.navigate("/plan")}
            >
              <Text className="text-xs font-medium text-muted-foreground">Agora não</Text>
              <Icon node={xIcon} color={apagada} size={16} />
            </Button>
          }
        />
      }
    >
      <View className="px-4 py-4">
        <View
          className="mb-6 flex-row items-center gap-2"
          accessibilityLabel="Progresso do assistente"
        >
          {STEP_TITLES.map((titulo, i) => (
            <View
              key={titulo}
              className={cn("flex-row items-center gap-2", i < STEP_TITLES.length - 1 && "flex-1")}
            >
              <View
                className={cn(
                  "h-7 w-7 items-center justify-center rounded-full",
                  i <= step ? "bg-primary" : "bg-muted",
                  i === step && "border-4 border-primary/20",
                )}
              >
                {i < step ? (
                  <Icon node={check} color={branco} size={14} />
                ) : (
                  <Text
                    className={cn(
                      "text-xs font-semibold",
                      i <= step ? "text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              {i < STEP_TITLES.length - 1 ? (
                <View
                  className={cn("h-0.5 flex-1 rounded", i < step ? "bg-primary" : "bg-muted")}
                />
              ) : null}
            </View>
          ))}
        </View>

        <Text className="mb-4 text-xl font-semibold tracking-tight">{STEP_TITLES[step]}</Text>

        {step === 0 ? (
          <OptionList options={LEVEL_OPTIONS} selected={level} onSelect={setLevel} />
        ) : null}
        {step === 1 ? (
          <OptionList options={GOAL_OPTIONS} selected={goal} onSelect={setGoal} />
        ) : null}
        {step === 2 ? (
          <OptionList options={EQUIPMENT_OPTIONS} selected={equipment} onSelect={setEquipment} />
        ) : null}
        {step === 3 ? (
          <View className="flex-row flex-wrap gap-3">
            {FREQUENCY_OPTIONS.map((dias) => (
              <Pressable
                key={dias}
                onPress={() => {
                  setDaysPerWeek(dias);
                  // Pré-seleciona dias espalhados; ajustáveis no passo seguinte.
                  setWeekdays(suggestWeekdays(dias));
                }}
                className={cn(
                  "w-[47.5%] items-center rounded-xl border p-4 active:bg-accent",
                  daysPerWeek === dias ? "border-primary bg-accent" : "border-border",
                )}
              >
                <Text className="text-2xl font-bold">{dias}</Text>
                <Text className="text-xs text-muted-foreground">dias/semana</Text>
              </Pressable>
            ))}
            {daysPerWeek ? (
              <Text className="w-full text-sm text-muted-foreground">
                {FREQUENCY_HINT[daysPerWeek]}
              </Text>
            ) : null}
          </View>
        ) : null}
        {step === 4 && daysPerWeek ? (
          <WeekdayPicker
            selected={weekdays}
            required={daysPerWeek}
            onToggle={(dia) =>
              setWeekdays((atual) =>
                atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia].sort(),
              )
            }
          />
        ) : null}
        {step === 5 ? (
          <PlanPreview query={draft} onConfirm={() => save.mutate()} isSaving={save.isPending} />
        ) : null}
        {erro ? <Text className="mt-3 text-sm text-destructive">{erro}</Text> : null}

        <View className="mt-6 flex-row justify-between">
          <Button
            variant="ghost"
            onPress={() => setStep((s) => Math.max(0, s - 1) as Step)}
            disabled={step === 0}
          >
            <Icon node={arrowLeft} color={texto} size={16} />
            <Text className="text-sm font-medium">Voltar</Text>
          </Button>
          {step < 5 ? (
            <Button
              onPress={() => setStep((s) => Math.min(5, s + 1) as Step)}
              disabled={!canAdvance}
            >
              <Text className="text-sm font-medium text-primary-foreground">Continuar</Text>
              <Icon node={arrowRight} color={branco} size={16} />
            </Button>
          ) : null}
        </View>
      </View>
    </PageScroll>
  );
}

/** Escolha dos dias: um guia, não uma cobrança (a sequência avança por treino feito). */
function WeekdayPicker({
  selected,
  required,
  onToggle,
}: {
  selected: number[];
  required: number;
  onToggle: (weekday: number) => void;
}) {
  const faltam = required - selected.length;
  const apagada = useColor("muted-foreground");
  return (
    <View className="gap-4">
      <View className="flex-row gap-1.5">
        {WEEKDAYS.map((dia) => {
          const ativo = selected.includes(dia);
          return (
            <Pressable
              key={dia}
              onPress={() => onToggle(dia)}
              accessibilityState={{ checked: ativo }}
              accessibilityLabel={WEEKDAY_LABELS[dia]}
              className={cn(
                "flex-1 items-center gap-1 rounded-xl border py-3",
                ativo ? "border-primary bg-primary" : "border-border",
              )}
            >
              <Text className={cn("text-base font-bold", ativo && "text-primary-foreground")}>
                {WEEKDAY_INITIALS[dia]}
              </Text>
              <Text className={cn("text-[10px] opacity-80", ativo && "text-primary-foreground")}>
                {WEEKDAY_LABELS[dia].slice(0, 3).toLowerCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="text-sm text-muted-foreground">
        {faltam > 0
          ? `Escolha mais ${faltam} ${faltam === 1 ? "dia" : "dias"}.`
          : faltam < 0
            ? `Você escolheu ${-faltam} ${-faltam === 1 ? "dia a mais" : "dias a mais"} do que a frequência definida.`
            : "Agenda definida."}
      </Text>
      <View className="flex-row gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <View className="mt-px">
          <Icon node={info} color={apagada} size={14} />
        </View>
        <Text className="flex-1 text-xs text-muted-foreground">
          Estes dias são um guia, não uma cobrança. A sequência A → B → C avança a cada treino
          concluído: se você faltar numa segunda, o treino A continua esperando por você na quarta.
        </Text>
      </View>
    </View>
  );
}

function OptionList<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string; hint: string }[];
  selected: T | null;
  onSelect: (value: T) => void;
}) {
  const primaria = useColor("primary");
  return (
    <View className="gap-2">
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onSelect(option.value)}
          accessibilityState={{ selected: selected === option.value }}
          className={cn(
            "flex-row items-center justify-between gap-3 rounded-xl border p-4 active:bg-accent",
            selected === option.value ? "border-primary bg-accent" : "border-border",
          )}
        >
          <View className="flex-1">
            <Text className="font-medium">{option.label}</Text>
            <Text className="text-sm text-muted-foreground">{option.hint}</Text>
          </View>
          {selected === option.value ? <Icon node={check} color={primaria} size={20} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

function PlanPreview({
  query,
  onConfirm,
  isSaving,
}: {
  query: UseQueryResult<Awaited<ReturnType<typeof buildRoutineDraft>>>;
  onConfirm: () => void;
  isSaving: boolean;
}) {
  const vivo = useColor("primary-vivid");
  const primaria = useColor("primary");
  const branco = useColor("primary-foreground");
  const aviso = useColor("warning");

  if (query.isPending) {
    return (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <View key={i} className="h-40 w-full rounded-xl bg-muted" />
        ))}
      </View>
    );
  }
  if (query.isError)
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;

  const draft = query.data;
  const semanal = sumWeeklySetsByGroup(draft.plan.weeklySetsByMuscle);
  const alertas = findVolumeOutliers(draft.plan);
  const semExercicio = draft.splits.flatMap((s) => s.unmatched);

  return (
    <View className="gap-4">
      <Card className="border-primary/30">
        <View className="flex-row items-center gap-3 p-4">
          <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
            <Svg width={40} height={40} style={{ position: "absolute" }}>
              <Defs>
                <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={vivo} />
                  <Stop offset="1" stopColor={primaria} />
                </LinearGradient>
              </Defs>
              <Rect width={40} height={40} fill="url(#g)" />
            </Svg>
            <Icon node={sparkles} color={branco} size={20} />
          </View>
          <View className="flex-1">
            <Text className="font-semibold">{draft.splits.length} treinos na sequência</Text>
            <Text className="text-sm text-muted-foreground">
              Você treina A, B, C… na ordem. Faltou um dia? O próximo continua de onde parou.
            </Text>
          </View>
        </View>
      </Card>

      {alertas.length > 0 ? (
        <Card className="border-warning/40 bg-warning-soft/40">
          <View className="flex-row gap-3 p-4">
            <View className="mt-0.5">
              <Icon node={triangleAlert} color={aviso} size={16} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium">Atenção ao volume</Text>
              {alertas.map((a) => (
                <Text key={a.muscle} className="mt-0.5 text-sm text-muted-foreground">
                  <Text className="text-sm font-bold capitalize">{a.muscle}</Text>: {a.sets} séries
                  por semana — {a.status === "low" ? "abaixo" : "acima"} do ideal para o seu nível.
                  {a.status === "low" ? " Considere treinar mais dias." : ""}
                </Text>
              ))}
            </View>
          </View>
        </Card>
      ) : null}

      {semExercicio.length > 0 ? (
        <Card className="border-warning/40 bg-warning-soft/40">
          <View className="p-4">
            <Text className="text-sm font-medium">
              {semExercicio.length} exercício(s) sem correspondência no catálogo
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              O plano foi criado assim mesmo. Você pode adicionar os movimentos que faltarem
              editando a divisão depois.
            </Text>
          </View>
        </Card>
      ) : null}

      {draft.splits.map((split) => {
        const totalSeries = split.items.reduce((n, i) => n + i.slot.sets, 0);
        return (
          <Card key={split.letter}>
            <View className="flex-row items-center justify-between p-4 pb-3">
              <View className="flex-row items-center gap-2">
                <View className="h-7 w-7 items-center justify-center rounded-lg bg-primary">
                  <Text className="text-sm font-bold text-primary-foreground">{split.letter}</Text>
                </View>
                <Text className="text-base font-semibold">{split.name}</Text>
              </View>
              <Text className="text-xs text-muted-foreground">{totalSeries} séries</Text>
            </View>
            {split.items.map((item, i) => (
              <View
                key={`${item.exercise.id}-${i}`}
                className="flex-row items-center justify-between gap-3 border-t border-border px-4 py-2.5"
              >
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm font-medium">
                    {item.exercise.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {label(MUSCLE_LABELS, item.slot.primaryMuscle)}
                  </Text>
                </View>
                <Badge variante="secundario">{`${item.slot.sets}×${item.slot.repMin}-${item.slot.repMax}`}</Badge>
              </View>
            ))}
          </Card>
        );
      })}

      <Card>
        <Text className="p-4 pb-3 text-base font-semibold">Volume semanal</Text>
        <View className="flex-row flex-wrap gap-2 px-4 pb-4">
          {Object.entries(semanal).map(([grupo, series]) => (
            <View key={grupo} className="w-[48%] rounded-lg border border-border p-2.5">
              <Text className="text-xs capitalize text-muted-foreground">{grupo}</Text>
              <Text className="text-sm font-semibold">{series} séries</Text>
            </View>
          ))}
        </View>
      </Card>

      <Button size="lg" className="w-full" onPress={onConfirm} disabled={isSaving}>
        <Icon node={dumbbell} color={branco} size={16} />
        <Text className="text-[15px] font-medium text-primary-foreground">
          {isSaving ? "Criando…" : "Usar este plano"}
        </Text>
      </Button>
    </View>
  );
}
