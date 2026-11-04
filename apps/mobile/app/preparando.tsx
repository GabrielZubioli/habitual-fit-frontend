import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Circle, Svg } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { __iconNode as arrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { __iconNode as check } from "lucide-react/dist/esm/icons/check.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as flag } from "lucide-react/dist/esm/icons/flag.js";
import { __iconNode as moon } from "lucide-react/dist/esm/icons/moon.js";
import { __iconNode as triangleAlert } from "lucide-react/dist/esm/icons/triangle-alert.js";
import { __iconNode as user } from "lucide-react/dist/esm/icons/user.js";
import { __iconNode as utensils } from "lucide-react/dist/esm/icons/utensils.js";
import { type Weekday } from "@forja/domain";
import { errorMessage, num } from "@forja/app-core/data/supabase-helpers";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { fetchProfile } from "@forja/app-core/data/profile";
import { fetchWorkoutWeek } from "@forja/app-core/data/workout-week";
import { fetchActiveMealPlan } from "@forja/app-core/data/meal-plans";
import { splitDisplayName, startWithoutPlan } from "@forja/app-core/data/routines";
import {
  GENERATION_STAGES,
  generateEverything,
  hasCompletedOnboarding,
  type GenerationStage,
} from "@forja/app-core/data/onboarding";
import { isComplete, type Answers } from "@forja/app-core/lib/onboarding/schema";
import { derivedObjective } from "@forja/app-core/lib/onboarding/options";
import { MEAL_LABELS, label, WEEKDAY_LABELS } from "@forja/app-core/lib/labels";
import { supabase } from "@/lib/supabase";
import { clearDraft, loadDraft } from "@/lib/onboarding-storage";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { AvisoProfissional } from "@/ui/aviso-profissional";
import { BrandSymbol } from "@/ui/brand-symbol";
import { FadeUp, Glow } from "@/ui/glow";
import { Button } from "@/ui/button";
import { Icon, type IconNode } from "@/ui/icon";
import { RoutineIcon } from "@/ui/routine-icon";
import { Text } from "@/ui/text";
import { LOCALE } from "@forja/app-core/i18n";
import { t } from "@forja/app-core/i18n";
import { Skeleton } from "@/ui/skeleton";

/**
 * Onde o plano é montado — e depois apresentado. O `routes/preparando.tsx` do
 * web: as etapas acendem quando a operação termina no banco, não por relógio.
 */

const ETAPAS: { stage: GenerationStage; titulo: string; detalhe: string; icon: IconNode }[] = [
  {
    stage: "profile",
    titulo: t("Salvando seu perfil"),
    detalhe: t("Objetivo, experiência e rotina de treino"),
    icon: user,
  },
  {
    stage: "workout",
    titulo: t("Preparando seu treino"),
    detalhe: t("Os exercícios e os dias da sua semana"),
    icon: dumbbell,
  },
  {
    stage: "diet",
    titulo: t("Criando suas refeições"),
    detalhe: t("Vazias, prontas para você preencher"),
    icon: utensils,
  },
];

/** Tempo mínimo na tela de montagem: rápido demais parece que nada aconteceu. */
const MONTAGEM_MIN_MS = 3200;

type Status = "checking" | "generating" | "done" | "error";

export default function Preparando() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("checking");
  const [stage, setStage] = useState<GenerationStage>("profile");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [tentativa, setTentativa] = useState(0);
  // Sem a trava, a geração poderia disparar duas vezes e criar duas rotinas.
  const iniciada = useRef(-1);

  useEffect(() => {
    if (iniciada.current === tentativa) return;
    iniciada.current = tentativa;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const usuario = data.session?.user;
      if (!usuario) return router.replace("/auth?modo=cadastro");

      // Já gerado: voltar aqui não pode sobrescrever o plano em uso.
      if (await hasCompletedOnboarding()) return router.replace("/dashboard");

      // Sem respostas (outro aparelho, dados limpos): falta o questionário.
      const draft = await loadDraft();
      if (!isComplete(draft)) return router.replace("/");

      setAnswers(draft);
      setStatus("generating");
      const inicio = Date.now();
      try {
        const result = await generateEverything(usuario.id, draft, (p) => setStage(p.stage));
        setWarnings(result.warnings);
        setRoutineId(result.routineId);
        // O rascunho cumpriu seu papel.
        await clearDraft();
        await qc.invalidateQueries();

        const falta = MONTAGEM_MIN_MS - (Date.now() - inicio);
        if (falta > 0) await new Promise((r) => setTimeout(r, falta));
        setStage("done");
        await new Promise((r) => setTimeout(r, 700));
        setStatus("done");
      } catch (e) {
        setError(errorMessage(e));
        setStatus("error");
      }
    })();
  }, [qc, tentativa]);

  if (status === "done") {
    return (
      <PlanReady
        answers={answers}
        routineId={routineId}
        warnings={warnings}
        onContinue={() => router.replace("/dashboard")}
      />
    );
  }

  return (
    <View className="flex-1 items-center justify-center overflow-hidden bg-background px-6">
      <View className="w-full max-w-sm">
        {status === "error" ? (
          <ErrorState
            message={error}
            onRetry={() => {
              setStatus("checking");
              setTentativa((item) => item + 1);
            }}
          />
        ) : (
          <Building stage={stage} />
        )}
      </View>
    </View>
  );
}

const CirculoAnimado = Animated.createAnimatedComponent(Circle);

function Building({ stage }: { stage: GenerationStage }) {
  const idx = GENERATION_STAGES.indexOf(stage);
  const pronto = stage === "done";
  // Meia etapa adiantada: o anel anda enquanto a etapa acontece.
  const progresso = pronto ? 1 : Math.min(0.95, (idx + 0.5) / ETAPAS.length);
  const atual = ETAPAS[Math.min(idx, ETAPAS.length - 1)]!;
  const primaria = useColor("primary");
  const elevada = useColor("elevated");
  const branco = useColor("primary-foreground");
  const apagada = useColor("muted-foreground");

  const R = 84;
  const C = 2 * Math.PI * R;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(progresso, { duration: 900, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [p, progresso]);
  const arco = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - p.value) }));

  return (
    <View accessibilityRole="progressbar" accessibilityLiveRegion="polite">
      <View className="mx-auto h-56 w-56">
        <Glow size={224} color={primaria} opacity={0.3} style={{ left: 0, top: 0 }} />
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 200 200"
          style={{ transform: [{ rotate: "-90deg" }] }}
        >
          <Circle cx="100" cy="100" r={R} fill="none" stroke={elevada} strokeWidth={6} />
          <CirculoAnimado
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={primaria}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={C}
            animatedProps={arco}
          />
        </Svg>
        <View className="absolute inset-0 items-center justify-center">
          {pronto ? (
            <View className="h-24 w-24 items-center justify-center rounded-full bg-primary">
              <Icon node={check} color={branco} size={48} strokeWidth={3} />
            </View>
          ) : (
            <BrandSymbol width={96} />
          )}
        </View>
      </View>

      <Text className="mt-8 text-center text-[28px] font-extrabold leading-tight tracking-tight">
        {pronto ? t("Plano pronto!") : t("Montando seu plano")}
      </Text>
      <Text className="mt-2 text-center text-muted-foreground">
        {pronto ? t("Preparando o resumo para você") : atual.detalhe}
      </Text>

      <View className="mt-8 gap-2">
        {ETAPAS.map((e, i) => {
          const feita = pronto || i < idx;
          const ativa = !pronto && i === idx;
          return (
            <View
              key={e.stage}
              className={cn(
                "flex-row items-center gap-3 rounded-2xl px-4 py-3",
                ativa ? "bg-card" : "bg-transparent",
              )}
            >
              <View
                className={cn(
                  "h-9 w-9 items-center justify-center rounded-xl",
                  feita ? "bg-primary" : ativa ? "bg-primary/15" : "bg-elevated",
                )}
              >
                <Icon
                  node={feita ? check : e.icon}
                  color={feita ? branco : ativa ? primaria : apagada}
                  size={20}
                  strokeWidth={feita ? 3 : 2}
                />
              </View>
              <Text
                className={cn(
                  "flex-1 font-medium",
                  feita || ativa ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {e.titulo}
              </Text>
              {ativa ? (
                <View className="flex-row gap-1">
                  {[0, 1, 2].map((d) => (
                    <View key={d} className="h-1.5 w-1.5 rounded-full bg-primary" />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Segunda primeiro. */
const ORDEM_SEMANA: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const kg = (n: number) => n.toLocaleString(LOCALE, { maximumFractionDigits: 1 });

/** Entrada em sequência: cada seção chega um pouco depois da anterior. */
const entra = (i: number) => FadeInDown.delay(120 + i * 110).duration(700);

function PlanReady({
  answers,
  routineId,
  warnings,
  onContinue,
}: {
  answers: Answers | null;
  routineId: string | null;
  warnings: string[];
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  const primaria = useColor("primary");
  const apagada = useColor("muted-foreground");
  const aviso = useColor("warning");
  const branco = useColor("primary-foreground");
  const fundo = useColor("background");
  const profile = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: fetchProfile,
  });
  const semana = useQuery({
    queryKey: [...queryKeys.workouts.all, "week"],
    queryFn: fetchWorkoutWeek,
  });
  const cardapio = useQuery({
    queryKey: queryKeys.diet.activePlan(),
    queryFn: fetchActiveMealPlan,
  });

  // Sem o sugerido: plano em branco e direto para a tela Plano.
  const qc = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const semPlano = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sessão expirada. Entre de novo.");
      await startWithoutPlan(data.user.id, routineId);
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      router.replace("/plan");
    },
    onError: (e) => setErro(errorMessage(e)),
  });

  const p = profile.data;
  const objetivo = answers ? derivedObjective(answers) : null;
  const nome = p?.display_name?.trim().split(/\s+/)[0];
  const pesoAtual = answers?.weightKg ?? null;
  const pesoMeta = p?.goal_weight_kg != null ? num(p.goal_weight_kg) : null;
  const splits = semana.data?.splits ?? [];
  const diasTreino = splits.reduce((n, s) => n + s.weekdays.length, 0);

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-4 pb-48"
        contentContainerStyle={{ paddingTop: insets.top + 40 }}
      >
        <Animated.View entering={entra(0)} className="items-center">
          <Glow size={260} color={primaria} opacity={0.25} style={{ top: -60 }} />
          <BrandSymbol width={80} />
          <Text className="mt-6 text-center text-[36px] font-extrabold leading-[38px] tracking-tight">
            {nome ? t("{{nome}}, seu plano está pronto", { nome }) : t("Seu plano está pronto")}
          </Text>
          <Text className="mt-3 text-center text-muted-foreground">
            {t("Seu treino foi montado a partir das suas respostas.")}
          </Text>
          <View className="mt-4 flex-row flex-wrap justify-center gap-2">
            {objetivo ? (
              <View className="rounded-full bg-primary/15 px-3 py-1.5">
                <Text className="text-sm font-semibold text-primary">
                  {objetivo.emoji} {objetivo.label}
                </Text>
              </View>
            ) : null}
            {diasTreino > 0 ? (
              <View className="rounded-full bg-card px-3 py-1.5">
                <Text className="text-sm text-muted-foreground">
                  {t("{{diasTreino}}× por semana", { diasTreino })}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {pesoAtual && pesoMeta && Math.abs(pesoAtual - pesoMeta) >= 0.1 ? (
          <Secao titulo={t("Sua jornada")} i={2}>
            <View className="flex-row items-center gap-4 rounded-3xl bg-card p-5">
              <View className="items-center">
                <Text className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("Hoje")}
                </Text>
                <Text className="text-2xl font-extrabold">
                  {kg(pesoAtual)}
                  <Text className="text-sm font-semibold text-muted-foreground"> {t("kg")}</Text>
                </Text>
              </View>
              <View className="flex-1 flex-row items-center">
                <View className="h-0 flex-1 border-t-2 border-dashed border-primary/50" />
                <Icon node={arrowRight} color={primaria} size={20} />
              </View>
              <View className="items-center">
                <View className="flex-row items-center gap-1">
                  <Icon node={flag} color={primaria} size={12} />
                  <Text className="text-xs uppercase tracking-wide text-primary">{t("Meta")}</Text>
                </View>
                <Text className="text-2xl font-extrabold">
                  {kg(pesoMeta)}
                  <Text className="text-sm font-semibold text-muted-foreground"> {t("kg")}</Text>
                </Text>
              </View>
            </View>
          </Secao>
        ) : null}

        <Secao titulo={t("Sua semana de treino")} i={3}>
          {semana.isPending ? (
            <Skeleton className="h-64 rounded-3xl" />
          ) : splits.length === 0 ? (
            <Vazio
              texto={t(
                "Não conseguimos montar o treino agora. Na tela Plano você pode tentar de novo ou montar o seu.",
              )}
            />
          ) : (
            <>
              <View className="flex-row gap-1.5 rounded-3xl bg-card p-3">
                {ORDEM_SEMANA.map((dia) => {
                  const s = splits.find((x) => x.weekdays.includes(dia));
                  return (
                    <View key={dia} className="flex-1 items-center gap-1.5">
                      <Text className="text-[11px] font-medium uppercase text-muted-foreground">
                        {WEEKDAY_LABELS[dia].slice(0, 3)}
                      </Text>
                      {s ? (
                        <RoutineIcon icon={s.icon} name={s.name} pequeno />
                      ) : (
                        <View
                          className="h-10 w-10 items-center justify-center rounded-xl bg-elevated"
                          accessibilityLabel="descanso"
                        >
                          <Icon node={moon} color={apagada} size={16} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
              <View className="mt-3 gap-3">
                {splits.map((s) => (
                  <View key={s.templateId} className="rounded-3xl bg-card p-4">
                    <View className="flex-row items-center gap-3">
                      <RoutineIcon icon={s.icon} name={s.name} />
                      <View className="min-w-0 flex-1">
                        <Text numberOfLines={1} className="text-lg font-bold">
                          {splitDisplayName(s.name)}
                        </Text>
                        <Text className="text-sm text-muted-foreground">
                          {t("{{v0}} · {{length}} exercícios", {
                            v0:
                              [...s.weekdays]
                                .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
                                .map((d) => WEEKDAY_LABELS[d as Weekday].slice(0, 3))
                                .join(" · ") || t("Sem dia fixo"),
                            length: s.exercises.length,
                          })}
                        </Text>
                      </View>
                    </View>
                    <View className="mt-3 gap-1.5 border-t border-border/60 pt-3">
                      {s.exercises.slice(0, 4).map((e) => (
                        <View
                          key={e.itemId}
                          className="flex-row items-center justify-between gap-3"
                        >
                          <Text numberOfLines={1} className="flex-1 text-sm">
                            {e.name}
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            {e.targetSets} ×{" "}
                            {e.targetRepMin && e.targetRepMax
                              ? t("{{targetRepMin}}–{{targetRepMax}}", {
                                  targetRepMin: e.targetRepMin,
                                  targetRepMax: e.targetRepMax,
                                })
                              : e.targetReps}
                          </Text>
                        </View>
                      ))}
                      {s.exercises.length > 4 ? (
                        <Text className="text-sm text-primary">
                          {t("+ {{v0}} exercícios", { v0: s.exercises.length - 4 })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </Secao>

        <Secao titulo={t("Suas refeições")} i={4}>
          {cardapio.isPending ? (
            <Skeleton className="h-40 rounded-3xl" />
          ) : !cardapio.data || cardapio.data.meals.length === 0 ? (
            <Vazio
              texto={t("Suas refeições aparecem na tela Dieta, prontas para você preencher.")}
            />
          ) : (
            <>
              <View className="rounded-3xl bg-card">
                {cardapio.data.meals.map((m, i) => (
                  <View
                    key={m.id}
                    className={cn(
                      "flex-row items-center gap-3 px-5 py-3.5",
                      i > 0 && "border-t border-border/60",
                    )}
                  >
                    <Icon node={utensils} color={primaria} size={16} />
                    <Text className="min-w-0 flex-1 font-semibold">
                      {m.label?.trim() || label(MEAL_LABELS, m.slot)}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {m.items.length === 0
                        ? "vazia"
                        : t("{{length}} itens", { length: m.items.length })}
                    </Text>
                  </View>
                ))}
              </View>
              <Text className="mt-3 px-1 text-sm text-muted-foreground">
                {t(
                  "Dê nomes, horários e adicione os alimentos na tela Dieta — por conta própria ou com a orientação de um nutricionista.",
                )}
              </Text>
            </>
          )}
        </Secao>

        <Animated.View entering={entra(5)}>
          <AvisoProfissional
            tipos={answers?.injuries.length ? ["lesao", "treino", "dieta"] : ["treino", "dieta"]}
            className="mt-6"
          />
        </Animated.View>

        {warnings.length > 0 ? (
          <Animated.View
            entering={entra(5)}
            className="mt-6 rounded-3xl border border-border bg-card p-4"
          >
            <View className="mb-2 flex-row items-center gap-2">
              <Icon node={triangleAlert} color={aviso} size={16} />
              <Text className="text-sm font-semibold">{t("Vale saber")}</Text>
            </View>
            <View className="gap-1.5">
              {warnings.map((w) => (
                <Text key={w} className="text-sm leading-relaxed text-muted-foreground">
                  {w}
                </Text>
              ))}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={entra(6)}>
          <Text className="mt-6 text-center text-sm text-muted-foreground">
            {t("Tudo isso pode ser ajustado depois, no Plano e na Dieta.")}
          </Text>
          {erro ? <Text className="mt-2 text-center text-sm text-destructive">{erro}</Text> : null}
        </Animated.View>
      </ScrollView>

      {/* O botão fica sempre à mão, por cima do fim da página. */}
      <Animated.View
        entering={FadeInDown.delay(700).duration(700)}
        className="absolute inset-x-0 bottom-0 px-4 pt-10"
        style={{ paddingBottom: Math.max(20, insets.bottom) }}
      >
        <FadeUp color={fundo} />
        <Button
          size="lg"
          className="h-14 w-full rounded-2xl"
          onPress={onContinue}
          disabled={semPlano.isPending}
        >
          <Text className="text-lg font-bold text-primary-foreground">{t("Ir para o app")}</Text>
          <Icon node={arrowRight} color={branco} size={20} />
        </Button>
        <Button
          variant="ghost"
          className="mt-1 h-11 w-full rounded-2xl"
          textClassName="font-semibold text-muted-foreground"
          onPress={() => semPlano.mutate()}
          loading={semPlano.isPending}
        >
          {t("Começar sem um plano")}
        </Button>
      </Animated.View>
    </View>
  );
}

function Secao({ titulo, i, children }: { titulo: string; i: number; children: ReactNode }) {
  return (
    <Animated.View entering={entra(i)} className="mt-8" accessibilityLabel={titulo}>
      <Text className="mb-3 px-1 text-lg font-semibold">{titulo}</Text>
      {children}
    </Animated.View>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <View className="rounded-3xl bg-card p-5">
      <Text className="text-center text-sm text-muted-foreground">{texto}</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  const destrutiva = useColor("destructive");
  return (
    <View className="items-center">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <Icon node={triangleAlert} color={destrutiva} size={32} />
      </View>
      <Text className="mt-6 text-center text-xl font-bold tracking-tight">
        {t("Não conseguimos montar seu plano")}
      </Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">{message}</Text>
      <Text className="mt-4 text-center text-sm text-muted-foreground">
        {t("Sua conta foi criada e suas respostas estão salvas — nada se perdeu.")}
      </Text>
      <Button className="mt-6 h-12 w-full rounded-xl" onPress={onRetry}>
        {t("Tentar de novo")}
      </Button>
    </View>
  );
}
