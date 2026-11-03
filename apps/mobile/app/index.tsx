import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { __iconNode as arrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { __iconNode as arrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { __iconNode as clock } from "lucide-react/dist/esm/icons/clock.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as shieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";
import { __iconNode as sliders } from "lucide-react/dist/esm/icons/sliders-horizontal.js";
import { __iconNode as utensils } from "lucide-react/dist/esm/icons/utensils-crossed.js";
import { answersSchema, type Answers } from "@forja/app-core/lib/onboarding/schema";
import { visibleSteps } from "@forja/app-core/lib/onboarding/steps";
import {
  CONSISTENCY_OPTIONS,
  DURATION_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  FOCUS_OPTIONS,
  INJURY_OPTIONS,
  DEFAULT_MEALS_PER_DAY,
  MEALS_PER_DAY_OPTIONS,
  OBJECTIVE_OPTIONS,
  PLACE_OPTIONS,
  RANGES,
  SEX_OPTIONS,
  bmiFeedback,
  derivedLevel,
  derivedObjective,
  recommendedDays,
  suggestWeekdays,
  weightGoalFeedback,
} from "@forja/app-core/lib/onboarding/options";
import { hasCompletedOnboarding } from "@forja/app-core/data/onboarding";
import { WEEKDAY_LABELS, type Weekday } from "@forja/domain";
import { supabase } from "@/lib/supabase";
import { loadDraft, loadStep, saveDraft, saveStep } from "@/lib/onboarding-storage";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { BrandSymbol } from "@/ui/brand-symbol";
import { Glow } from "@/ui/glow";
import { Icon, type IconNode } from "@/ui/icon";
import { Punho } from "@/ui/punho";
import { Text } from "@/ui/text";
import {
  ChipGroup,
  ChoiceList,
  Feedback,
  NextButton,
  NumberField,
  ProgressBar,
  Question,
  Stepper,
  WeekdayPicker,
} from "@/ui/onboarding";

/**
 * A raiz do app: boas-vindas e, para quem já tem conta, o questionário —
 * o `routes/index.tsx` do web. Sem sessão, só as boas-vindas; com plano
 * montado, vai direto para o Início.
 */

/** Etapa de escolha única → a resposta que ela preenche. */
const ESCOLHA_UNICA = {
  objective: "objective",
  sex: "sex",
  experience: "experience",
  consistency: "consistency",
  place: "place",
  duration: "duration",
  focus: "focus",
  mealsPerDay: "mealsPerDay",
} as const satisfies Record<string, keyof Answers>;

export default function OnboardingQuiz() {
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<Answers>(() => answersSchema.parse({}));
  const [stepIndex, setStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  /** `null` enquanto confere a sessão; sem conta, só as boas-vindas. */
  const [logado, setLogado] = useState<boolean | null>(null);

  useEffect(() => {
    void Promise.all([loadDraft(), loadStep()]).then(([a, s]) => {
      setAnswers(a);
      setStepIndex(s);
      setHydrated(true);
    });
  }, []);

  // Quem já montou o plano não refaz o questionário. Quem entrou mas ainda
  // não montou, fica: é exatamente o que falta.
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setLogado(false);
      if (await hasCompletedOnboarding()) return router.replace("/dashboard");
      setLogado(true);
    })();
  }, []);

  const steps = useMemo(() => visibleSteps(answers), [answers]);
  const safeIndex = logado === false ? 0 : Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex];

  const update = useCallback((patch: Partial<Answers>) => {
    setAnswers((prev) => {
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });
  }, []);

  const goTo = useCallback((index: number) => {
    setStepIndex(index);
    saveStep(index);
  }, []);

  const next = useCallback(
    () => goTo(Math.min(steps.length - 1, safeIndex + 1)),
    [goTo, safeIndex, steps.length],
  );
  const back = useCallback(() => goTo(Math.max(0, safeIndex - 1)), [goTo, safeIndex]);

  /** Marca a resposta e fica na pergunta: quem avança é o "Continuar". */
  const choose = useCallback((patch: Partial<Answers>) => update(patch), [update]);

  const toggle = useCallback((key: "equipment" | "injuries", value: string) => {
    setAnswers((prev) => {
      const list = (prev[key] ?? []) as string[];
      const nextList = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      const next = { ...prev, [key]: nextList } as Answers;
      saveDraft(next);
      return next;
    });
  }, []);

  const textoForte = useColor("foreground");

  if (!hydrated || !step || logado === null) return <QuizSkeleton />;

  if (step.id === "welcome") return <Welcome onStart={next} logado={logado} />;

  const level = derivedLevel(answers);
  const objective = derivedObjective(answers);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-5 pt-5"
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 flex-row items-center gap-3">
          {safeIndex > 0 ? (
            <Pressable
              onPress={back}
              accessibilityLabel="Voltar para a pergunta anterior"
              className="h-10 w-10 items-center justify-center rounded-full active:bg-accent"
            >
              <Icon node={arrowLeft} color={textoForte} size={20} />
            </Pressable>
          ) : (
            <BrandSymbol width={40} />
          )}
          <ProgressBar current={safeIndex + 1} total={steps.length} />
          <Text className="w-11 text-right text-xs font-medium text-muted-foreground">
            {safeIndex + 1}/{steps.length}
          </Text>
        </View>

        <View className="flex-1">
          {step.id === "objective" && (
            <Question
              title="Qual é o seu objetivo?"
              subtitle="Ele define o treino e as repetições do seu plano."
            >
              <ChoiceList
                options={OBJECTIVE_OPTIONS}
                selected={answers.objective}
                onSelect={(v) => choose({ objective: v as Answers["objective"] })}
              />
            </Question>
          )}

          {step.id === "sex" && (
            <Question
              title="Com qual gênero você se identifica?"
              subtitle="Usamos apenas para calcular seu gasto energético."
            >
              <ChoiceList
                options={SEX_OPTIONS}
                selected={answers.sex}
                onSelect={(v) => choose({ sex: v as Answers["sex"] })}
              />
            </Question>
          )}

          {step.id === "experience" && (
            <Question title="Qual sua experiência com musculação?">
              <ChoiceList
                options={EXPERIENCE_OPTIONS}
                selected={answers.experience}
                onSelect={(v) => choose({ experience: v as Answers["experience"] })}
              />
            </Question>
          )}

          {step.id === "consistency" && (
            <Question title="Como está sua rotina de treino hoje?">
              <ChoiceList
                options={CONSISTENCY_OPTIONS}
                selected={answers.consistency}
                onSelect={(v) => choose({ consistency: v as Answers["consistency"] })}
              />
            </Question>
          )}

          {step.id === "age" && (
            <Question title="Quantos anos você tem?">
              <NumberField
                value={answers.age ?? RANGES.age.default}
                min={RANGES.age.min}
                max={RANGES.age.max}
                unit="anos"
                label="Idade"
                onChange={(v) => update({ age: v })}
              />
              <NextButton
                onPress={() => {
                  update({ age: answers.age ?? RANGES.age.default });
                  next();
                }}
              />
            </Question>
          )}

          {step.id === "height" && (
            <Question title="Qual sua altura?">
              <NumberField
                value={answers.heightCm ?? RANGES.heightCm.default}
                min={RANGES.heightCm.min}
                max={RANGES.heightCm.max}
                unit="cm"
                label="Altura em centímetros"
                onChange={(v) => update({ heightCm: v })}
              />
              <NextButton
                onPress={() => {
                  update({ heightCm: answers.heightCm ?? RANGES.heightCm.default });
                  next();
                }}
              />
            </Question>
          )}

          {step.id === "weight" && <WeightStep answers={answers} update={update} onNext={next} />}

          {step.id === "goalWeight" && (
            <GoalWeightStep answers={answers} update={update} onNext={next} />
          )}

          {step.id === "place" && (
            <Question title="Onde você vai treinar?">
              <ChoiceList
                options={PLACE_OPTIONS}
                selected={answers.place}
                onSelect={(v) => {
                  const place = PLACE_OPTIONS.find((o) => o.value === v);
                  // Pré-marca o equipamento típico do local.
                  choose({ place: v as Answers["place"], equipment: place?.defaults ?? [] });
                }}
              />
            </Question>
          )}

          {step.id === "equipment" && (
            <Question
              title="O que você tem disponível?"
              subtitle="Já marcamos o mais comum para o lugar que você escolheu."
            >
              <ChipGroup
                options={EQUIPMENT_OPTIONS}
                selected={answers.equipment}
                onToggle={(v) => toggle("equipment", v)}
              />
              <Feedback>
                Só prescrevemos exercícios que você consegue fazer. Desmarcar algo troca o
                exercício, não remove o estímulo.
              </Feedback>
              <NextButton onPress={next} disabled={answers.equipment.length === 0} />
            </Question>
          )}

          {step.id === "daysPerWeek" && (
            <Question title="Quantos dias por semana você consegue treinar?">
              <Stepper
                value={answers.daysPerWeek ?? RANGES.daysPerWeek.default}
                min={RANGES.daysPerWeek.min}
                max={RANGES.daysPerWeek.max}
                unit="dias por semana"
                onChange={(v) => update({ daysPerWeek: v, weekdays: suggestWeekdays(v) })}
              />
              <Feedback>
                Para o seu nível e objetivo, {recommendedDays(level, objective.goal)} dias por
                semana costuma render mais. Prefira o que você consegue sustentar: consistência
                vence intensidade.
              </Feedback>
              <NextButton
                onPress={() => {
                  const dias = answers.daysPerWeek ?? RANGES.daysPerWeek.default;
                  update({
                    daysPerWeek: dias,
                    weekdays: answers.weekdays.length ? answers.weekdays : suggestWeekdays(dias),
                  });
                  next();
                }}
              />
            </Question>
          )}

          {step.id === "duration" && (
            <Question title="Quanto tempo você tem por treino?">
              <View className="gap-2.5">
                {DURATION_OPTIONS.map((o) => {
                  const ativo = answers.duration === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      onPress={() => choose({ duration: o.value })}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: ativo }}
                      className={cn(
                        "min-h-[56px] flex-row items-center justify-between gap-3 rounded-2xl border-2 p-4 active:scale-[0.985]",
                        ativo ? "border-primary bg-primary/10" : "border-border",
                      )}
                    >
                      <View className="min-w-0 flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="font-semibold">{o.label}</Text>
                          <Badge variante="secundario">{o.minutes}</Badge>
                        </View>
                        <Text className="mt-0.5 text-sm text-muted-foreground">{o.exercises}</Text>
                      </View>
                      {o.recommended ? <Badge>Recomendado</Badge> : null}
                    </Pressable>
                  );
                })}
              </View>
            </Question>
          )}

          {step.id === "weekdays" && (
            <Question title="Em quais dias?">
              <WeekdayPicker
                selected={answers.weekdays}
                onToggle={(dia) =>
                  update({
                    weekdays: answers.weekdays.includes(dia as Weekday)
                      ? answers.weekdays.filter((d) => d !== dia)
                      : ([...answers.weekdays, dia].sort((a, b) => a - b) as Answers["weekdays"]),
                  })
                }
              />
              <Feedback>
                {answers.weekdays.length === (answers.daysPerWeek ?? 0)
                  ? "Estes dias são um guia, não uma cobrança. A sequência A → B → C avança a cada treino concluído, não pela data: se você faltar na segunda, o treino A espera na quarta."
                  : `Escolha ${answers.daysPerWeek ?? 3} dias — você marcou ${answers.weekdays.length}.`}
              </Feedback>
              <NextButton
                onPress={next}
                disabled={answers.weekdays.length !== (answers.daysPerWeek ?? 3)}
              />
            </Question>
          )}

          {step.id === "focus" && (
            <Question
              title="Alguma região que você quer priorizar?"
              subtitle="O resto do corpo continua no plano. A região escolhida ganha mais volume e, conforme os dias, mais sessões."
            >
              <ChoiceList
                options={FOCUS_OPTIONS}
                selected={answers.focus}
                onSelect={(v) => choose({ focus: v as Answers["focus"] })}
                columns={2}
              />
            </Question>
          )}

          {step.id === "injuries" && (
            <Question
              title="Você tem alguma lesão ou dor?"
              subtitle="Deixamos de fora os exercícios que carregam essa região."
            >
              <ChipGroup
                options={INJURY_OPTIONS}
                selected={answers.injuries}
                onToggle={(v) => toggle("injuries", v)}
              />
              {answers.injuries.length > 0 ? (
                <Feedback title="Importante">
                  A seleção automática é só uma referência geral: não é avaliação clínica e não
                  garante que um exercício seja seguro para você. Antes de treinar com lesão ou dor,
                  procure orientação de um profissional de saúde e de educação física.
                </Feedback>
              ) : null}
              <NextButton
                onPress={next}
                label={answers.injuries.length ? "Continuar" : "Não tenho nenhuma"}
              />
            </Question>
          )}

          {step.id === "mealsPerDay" && (
            <Question
              title="Quantas refeições por dia você faz?"
              subtitle="Criamos essas refeições vazias na sua dieta, para você preencher como quiser."
            >
              <ChoiceList
                options={MEALS_PER_DAY_OPTIONS.map((n) => ({
                  value: String(n),
                  label: `${n} refeições`,
                  hint:
                    n === 3
                      ? "Café, almoço e jantar"
                      : n === 4
                        ? "Com um lanche"
                        : n === 5
                          ? "Com dois lanches"
                          : n === 6
                            ? "Refeições menores e mais frequentes"
                            : "O dia completo, com pré e pós-treino e ceia",
                }))}
                selected={answers.mealsPerDay ? String(answers.mealsPerDay) : undefined}
                onSelect={(v) => choose({ mealsPerDay: Number(v) })}
              />
            </Question>
          )}

          {/* Perguntas de escolha única: o "Continuar" libera depois de responder. */}
          {step.id in ESCOLHA_UNICA && (
            <NextButton
              onPress={next}
              disabled={!answers[ESCOLHA_UNICA[step.id as keyof typeof ESCOLHA_UNICA]]}
            />
          )}

          {step.id === "review" && (
            <Review
              answers={answers}
              onEdit={goTo}
              steps={steps}
              onConfirm={() => router.push("/preparando")}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Badge({
  children,
  variante = "padrao",
}: {
  children: string;
  variante?: "padrao" | "secundario";
}) {
  return (
    <View
      className={cn(
        "rounded-md px-2 py-0.5",
        variante === "padrao" ? "bg-primary" : "bg-secondary",
      )}
    >
      <Text
        className={cn(
          "text-xs",
          variante === "padrao"
            ? "font-semibold text-primary-foreground"
            : "font-normal text-secondary-foreground",
        )}
      >
        {children}
      </Text>
    </View>
  );
}

/** As cores do painel verde do login (`BRAND` e `INK` em auth.tsx). */
const BRAND = "#3ad598";
const INK = "#04261a";

/**
 * Boas-vindas: o painel verde da marca com a mão da tela Treinar ao fundo e
 * dois cartões flutuando — o treino e a dieta que a pessoa vai receber —, e
 * embaixo a promessa e um único botão.
 */
function Welcome({ onStart, logado }: { onStart: () => void; logado: boolean }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const primaria = useColor("primary");
  const alturaHero = Math.min(440, Math.max(280, Math.round(height * 0.44)));
  const alturaMao = (width * 870) / 1092;

  return (
    <View className="flex-1 bg-background">
      {/* Ícones escuros sobre o verde. */}
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 12 }}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="overflow-hidden rounded-b-[40px]"
          style={{ height: alturaHero, backgroundColor: BRAND }}
        >
          <Glow
            size={width * 1.3}
            color="#ffffff"
            opacity={0.45}
            style={{ top: -width * 0.75, left: -width * 0.15 }}
          />
          <Animated.View
            entering={FadeIn.duration(900)}
            pointerEvents="none"
            style={{ position: "absolute", left: 0, bottom: -alturaMao * 0.12, opacity: 0.14 }}
          >
            <Punho width={width} height={alturaMao} cor={INK} />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(500)}
            className="flex-row items-center justify-center gap-2"
            style={{ paddingTop: insets.top + 16 }}
          >
            <BrandSymbol width={34} escuro />
            <Text className="text-lg font-extrabold tracking-tight" style={{ color: INK }}>
              Habitual Fit
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(250).duration(600).springify()}
            style={{
              position: "absolute",
              left: 20,
              top: alturaHero * 0.36,
              transform: [{ rotate: "-4deg" }],
            }}
          >
            <CartaoFlutuante
              icon={dumbbell}
              titulo="Treino A · Peito"
              detalhe="6 exercícios · 45 min"
            />
          </Animated.View>
          <Animated.View
            entering={FadeInDown.delay(420).duration(600).springify()}
            style={{
              position: "absolute",
              right: 20,
              top: alturaHero * 0.62,
              transform: [{ rotate: "3deg" }],
            }}
          >
            <CartaoFlutuante
              icon={utensils}
              titulo="Dieta de hoje"
              detalhe="5 refeições · 2.150 kcal"
            />
          </Animated.View>
        </View>

        <View className="flex-1 justify-between px-6 pt-8">
          <View>
            <Animated.View entering={FadeInDown.delay(150).duration(500)}>
              <Text className="text-xs font-bold uppercase tracking-[2px] text-primary">
                Seu plano em 2 minutos
              </Text>
              <Text
                textBreakStrategy="balanced"
                className="mt-3 text-[34px] font-extrabold leading-[38px] tracking-tight"
              >
                Seu treino montado{" "}
                <Text className="text-[34px] font-extrabold leading-[38px] text-primary">
                  para você.
                </Text>
              </Text>
              <Text className="mt-3 text-base leading-6 text-muted-foreground">
                {logado
                  ? "Responda algumas perguntas rápidas e receba o treino da semana pronto e suas refeições organizadas."
                  : "Crie sua conta, responda algumas perguntas rápidas e receba o treino da semana pronto e suas refeições organizadas."}
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(300).duration(500)}
              className="mt-5 flex-row flex-wrap gap-2"
            >
              {(
                [
                  [clock, "Cerca de 2 min"],
                  [shieldCheck, "Salvo na sua conta"],
                  [sliders, "Ajuste quando quiser"],
                ] as const
              ).map(([icone, texto]) => (
                <View
                  key={texto}
                  className="flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2"
                >
                  <Icon node={icone} color={primaria} size={14} />
                  <Text className="text-xs font-semibold">{texto}</Text>
                </View>
              ))}
            </Animated.View>
          </View>

          <Animated.View entering={FadeInDown.delay(450).duration(500)} className="mt-8 gap-3">
            <Pressable
              onPress={logado ? onStart : () => router.push("/auth?modo=cadastro")}
              accessibilityRole="button"
              className="h-14 w-full flex-row items-center justify-center gap-2 rounded-2xl active:scale-[0.98]"
              style={{
                backgroundColor: BRAND,
                shadowColor: BRAND,
                shadowOpacity: 0.6,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
              }}
            >
              <Text className="text-base font-bold" style={{ color: INK }}>
                {logado ? "Montar meu plano" : "Criar minha conta"}
              </Text>
              <Icon node={arrowRight} color={INK} size={18} />
            </Pressable>

            {logado ? (
              <Text className="text-center text-xs text-muted-foreground">
                Você pode mudar tudo depois.
              </Text>
            ) : (
              <Pressable
                onPress={() => router.push("/auth")}
                accessibilityRole="link"
                className="h-11 items-center justify-center"
              >
                <Text className="text-sm text-muted-foreground">
                  Já tem conta? <Text className="text-sm font-bold text-primary">Entrar</Text>
                </Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

/** Um cartão branco que flutua sobre o verde: o que a pessoa vai receber. */
function CartaoFlutuante({
  icon,
  titulo,
  detalhe,
}: {
  icon: IconNode;
  titulo: string;
  detalhe: string;
}) {
  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl bg-white py-3 pl-3 pr-4"
      style={{
        shadowColor: INK,
        shadowOpacity: 0.25,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 10,
      }}
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: INK }}
      >
        <Icon node={icon} color={BRAND} size={20} />
      </View>
      <View>
        <Text className="text-sm font-bold" style={{ color: INK }}>
          {titulo}
        </Text>
        <Text className="text-xs" style={{ color: "#04261a99" }}>
          {detalhe}
        </Text>
      </View>
    </View>
  );
}

function WeightStep({
  answers,
  update,
  onNext,
}: {
  answers: Answers;
  update: (patch: Partial<Answers>) => void;
  onNext: () => void;
}) {
  const peso = answers.weightKg ?? RANGES.weightKg.default;
  const altura = answers.heightCm ?? RANGES.heightCm.default;
  const imc = bmiFeedback(peso, altura);

  return (
    <Question title="Qual seu peso atual?">
      <NumberField
        value={peso}
        min={RANGES.weightKg.min}
        max={RANGES.weightKg.max}
        step={RANGES.weightKg.step}
        decimals={1}
        unit="kg"
        label="Peso em quilos"
        onChange={(v) =>
          update({
            weightKg: v,
            // A meta acompanha o peso enquanto o usuário não a tiver ajustado.
            ...(answers.goalWeightKg === undefined || answers.goalWeightKg === answers.weightKg
              ? { goalWeightKg: v }
              : {}),
          })
        }
      />
      <Feedback title={`IMC ${imc.bmi}`}>{imc.text}</Feedback>
      <NextButton
        onPress={() => {
          update({ weightKg: peso });
          onNext();
        }}
      />
    </Question>
  );
}

function GoalWeightStep({
  answers,
  update,
  onNext,
}: {
  answers: Answers;
  update: (patch: Partial<Answers>) => void;
  onNext: () => void;
}) {
  const atual = answers.weightKg ?? RANGES.weightKg.default;
  const meta = answers.goalWeightKg ?? atual;

  return (
    <Question title="Qual peso você quer alcançar?">
      <NumberField
        value={meta}
        min={RANGES.weightKg.min}
        max={RANGES.weightKg.max}
        step={RANGES.weightKg.step}
        decimals={1}
        unit="kg"
        label="Peso desejado em quilos"
        onChange={(v) => update({ goalWeightKg: v })}
      />
      <Feedback>{weightGoalFeedback(atual, meta)}</Feedback>
      <NextButton
        onPress={() => {
          update({ goalWeightKg: meta });
          onNext();
        }}
      />
    </Question>
  );
}

/** Revisão antes de montar o plano: a última chance barata de corrigir. */
function Review({
  answers,
  onEdit,
  steps,
  onConfirm,
}: {
  answers: Answers;
  onEdit: (index: number) => void;
  steps: readonly { id: string }[];
  onConfirm: () => void;
}) {
  const objective = derivedObjective(answers);
  const indexOf = (id: string) => steps.findIndex((s) => s.id === id);

  const linhas = [
    { label: "Objetivo", value: objective.label, step: "objective" },
    {
      label: "Perfil",
      value: `${answers.age ?? "—"} anos · ${answers.heightCm ?? "—"} cm · ${answers.weightKg ?? "—"} kg`,
      step: "age",
    },
    {
      label: "Treino",
      value: `${answers.daysPerWeek ?? "—"}× por semana · ${
        DURATION_OPTIONS.find((d) => d.value === answers.duration)?.minutes ?? "duração livre"
      }`,
      step: "daysPerWeek",
    },
    {
      label: "Dias",
      value: answers.weekdays.length
        ? answers.weekdays.map((d) => WEEKDAY_LABELS[d as Weekday].slice(0, 3)).join(" · ")
        : "a definir",
      step: "weekdays",
    },
    {
      label: "Local",
      value: PLACE_OPTIONS.find((p) => p.value === answers.place)?.label ?? "—",
      step: "place",
    },
    {
      label: "Refeições",
      value: `${answers.mealsPerDay ?? DEFAULT_MEALS_PER_DAY} por dia`,
      step: "mealsPerDay",
    },
    ...(answers.injuries.length
      ? [
          {
            label: "Cuidados",
            value: answers.injuries
              .map((i) => INJURY_OPTIONS.find((o) => o.value === i)?.label ?? i)
              .join(" · "),
            step: "injuries",
          },
        ]
      : []),
  ];

  return (
    <Question
      title="É isso mesmo?"
      subtitle="Confira antes de montarmos seu plano. Toque em qualquer linha para corrigir."
    >
      <View className="overflow-hidden rounded-2xl border border-border">
        {linhas.map((l, i) => {
          const idx = indexOf(l.step);
          return (
            <Pressable
              key={l.label}
              onPress={() => idx >= 0 && onEdit(idx)}
              className={cn(
                "flex-row items-center justify-between gap-4 p-4 active:bg-accent/50",
                i > 0 && "border-t border-border",
              )}
            >
              <Text className="text-sm text-muted-foreground">{l.label}</Text>
              <Text numberOfLines={1} className="min-w-0 flex-1 text-right text-sm font-medium">
                {l.value}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Feedback title="O que vem agora">
        Montamos o plano de treino sugerido para as suas respostas e criamos suas refeições, vazias.
        No fim, você escolhe se segue com o plano ou se começa sem um.
      </Feedback>

      <NextButton onPress={onConfirm} label="Montar meu plano" />
    </Question>
  );
}

function QuizSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 gap-6 bg-background px-5" style={{ paddingTop: insets.top + 20 }}>
      <View className="h-10 rounded-full bg-muted" />
      <View className="h-9 w-3/4 rounded-lg bg-muted" />
      <View className="gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="h-14 rounded-2xl bg-muted" />
        ))}
      </View>
    </View>
  );
}
