import { WEEKDAY_LABELS } from "@forja/app-core/lib/labels";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { __iconNode as arrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
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
import { type Weekday } from "@forja/domain";
import { supabase } from "@/lib/supabase";
import { loadDraft, loadStep, saveDraft, saveStep } from "@/lib/onboarding-storage";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { BrandSymbol } from "@/ui/brand-symbol";
import { Icon } from "@/ui/icon";
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
import { t } from "@forja/app-core/i18n";
import { Skeleton } from "@/ui/skeleton";

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
  const [logado, setLogado] = useState(false);

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
      if (!data.session) return router.replace("/auth");
      if (await hasCompletedOnboarding()) return router.replace("/dashboard");
      setLogado(true);
    })();
  }, []);

  const steps = useMemo(() => visibleSteps(answers), [answers]);
  const safeIndex = Math.min(stepIndex, steps.length - 1);
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

  if (!hydrated || !step || !logado) return <QuizSkeleton />;

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
              accessibilityLabel={t("Voltar para a pergunta anterior")}
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
              title={t("Qual é o seu objetivo?")}
              subtitle={t("Ele define o treino e as repetições do seu plano.")}
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
              title={t("Com qual gênero você se identifica?")}
              subtitle={t("Usamos apenas para calcular seu gasto energético.")}
            >
              <ChoiceList
                options={SEX_OPTIONS}
                selected={answers.sex}
                onSelect={(v) => choose({ sex: v as Answers["sex"] })}
              />
            </Question>
          )}

          {step.id === "experience" && (
            <Question title={t("Qual sua experiência com musculação?")}>
              <ChoiceList
                options={EXPERIENCE_OPTIONS}
                selected={answers.experience}
                onSelect={(v) => choose({ experience: v as Answers["experience"] })}
              />
            </Question>
          )}

          {step.id === "consistency" && (
            <Question title={t("Como está sua rotina de treino hoje?")}>
              <ChoiceList
                options={CONSISTENCY_OPTIONS}
                selected={answers.consistency}
                onSelect={(v) => choose({ consistency: v as Answers["consistency"] })}
              />
            </Question>
          )}

          {step.id === "age" && (
            <Question title={t("Quantos anos você tem?")}>
              <NumberField
                value={answers.age ?? RANGES.age.default}
                min={RANGES.age.min}
                max={RANGES.age.max}
                unit="anos"
                label={t("Idade")}
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
            <Question title={t("Qual sua altura?")}>
              <NumberField
                value={answers.heightCm ?? RANGES.heightCm.default}
                min={RANGES.heightCm.min}
                max={RANGES.heightCm.max}
                unit="cm"
                label={t("Altura em centímetros")}
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
            <Question title={t("Onde você vai treinar?")}>
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
              title={t("O que você tem disponível?")}
              subtitle={t("Já marcamos o mais comum para o lugar que você escolheu.")}
            >
              <ChipGroup
                options={EQUIPMENT_OPTIONS}
                selected={answers.equipment}
                onToggle={(v) => toggle("equipment", v)}
              />
              <Feedback>
                {t(
                  "Só prescrevemos exercícios que você consegue fazer. Desmarcar algo troca o exercício, não remove o estímulo.",
                )}
              </Feedback>
              <NextButton onPress={next} disabled={answers.equipment.length === 0} />
            </Question>
          )}

          {step.id === "daysPerWeek" && (
            <Question title={t("Quantos dias por semana você consegue treinar?")}>
              <Stepper
                value={answers.daysPerWeek ?? RANGES.daysPerWeek.default}
                min={RANGES.daysPerWeek.min}
                max={RANGES.daysPerWeek.max}
                unit={t("dias por semana")}
                onChange={(v) => update({ daysPerWeek: v, weekdays: suggestWeekdays(v) })}
              />
              <Feedback>
                {t(
                  "Para o seu nível e objetivo, {{v0}} dias por semana costuma render mais. Prefira o que você consegue sustentar: consistência vence intensidade.",
                  { v0: recommendedDays(level, objective.goal) },
                )}
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
            <Question title={t("Quanto tempo você tem por treino?")}>
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
                      {o.recommended ? <Badge>{t("Recomendado")}</Badge> : null}
                    </Pressable>
                  );
                })}
              </View>
            </Question>
          )}

          {step.id === "weekdays" && (
            <Question title={t("Em quais dias?")}>
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
                  ? t(
                      "Estes dias são um guia, não uma cobrança. A sequência A → B → C avança a cada treino concluído, não pela data: se você faltar na segunda, o treino A espera na quarta.",
                    )
                  : t("Escolha {{v0}} dias — você marcou {{length}}.", {
                      v0: answers.daysPerWeek ?? 3,
                      length: answers.weekdays.length,
                    })}
              </Feedback>
              <NextButton
                onPress={next}
                disabled={answers.weekdays.length !== (answers.daysPerWeek ?? 3)}
              />
            </Question>
          )}

          {step.id === "focus" && (
            <Question
              title={t("Alguma região que você quer priorizar?")}
              subtitle={t(
                "O resto do corpo continua no plano. A região escolhida ganha mais volume e, conforme os dias, mais sessões.",
              )}
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
              title={t("Você tem alguma lesão ou dor?")}
              subtitle={t("Deixamos de fora os exercícios que carregam essa região.")}
            >
              <ChipGroup
                options={INJURY_OPTIONS}
                selected={answers.injuries}
                onToggle={(v) => toggle("injuries", v)}
              />
              {answers.injuries.length > 0 ? (
                <Feedback title={t("Importante")}>
                  {t(
                    "A seleção automática é só uma referência geral: não é avaliação clínica e não garante que um exercício seja seguro para você. Antes de treinar com lesão ou dor, procure orientação de um profissional de saúde e de educação física.",
                  )}
                </Feedback>
              ) : null}
              <NextButton
                onPress={next}
                label={answers.injuries.length ? t("Continuar") : t("Não tenho nenhuma")}
              />
            </Question>
          )}

          {step.id === "mealsPerDay" && (
            <Question
              title={t("Quantas refeições por dia você faz?")}
              subtitle={t(
                "Criamos essas refeições vazias na sua dieta, para você preencher como quiser.",
              )}
            >
              <ChoiceList
                options={MEALS_PER_DAY_OPTIONS.map((n) => ({
                  value: String(n),
                  label: t("{{n}} refeições", { n }),
                  hint:
                    n === 3
                      ? t("Café, almoço e jantar")
                      : n === 4
                        ? t("Com um lanche")
                        : n === 5
                          ? t("Com dois lanches")
                          : n === 6
                            ? t("Refeições menores e mais frequentes")
                            : t("O dia completo, com pré e pós-treino e ceia"),
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
    <Question title={t("Qual seu peso atual?")}>
      <NumberField
        value={peso}
        min={RANGES.weightKg.min}
        max={RANGES.weightKg.max}
        step={RANGES.weightKg.step}
        decimals={1}
        unit="kg"
        label={t("Peso em quilos")}
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
      <Feedback title={t("IMC {{bmi}}", { bmi: imc.bmi })}>{imc.text}</Feedback>
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
    <Question title={t("Qual peso você quer alcançar?")}>
      <NumberField
        value={meta}
        min={RANGES.weightKg.min}
        max={RANGES.weightKg.max}
        step={RANGES.weightKg.step}
        decimals={1}
        unit="kg"
        label={t("Peso desejado em quilos")}
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
    { label: t("Objetivo"), value: objective.label, step: "objective" },
    {
      label: t("Perfil"),
      value: `${answers.age ?? "—"} anos · ${answers.heightCm ?? "—"} cm · ${answers.weightKg ?? "—"} kg`,
      step: "age",
    },
    {
      label: t("Treino"),
      value: `${answers.daysPerWeek ?? "—"}× por semana · ${
        DURATION_OPTIONS.find((d) => d.value === answers.duration)?.minutes ?? "duração livre"
      }`,
      step: "daysPerWeek",
    },
    {
      label: t("Dias"),
      value: answers.weekdays.length
        ? answers.weekdays.map((d) => WEEKDAY_LABELS[d as Weekday].slice(0, 3)).join(" · ")
        : t("a definir"),
      step: "weekdays",
    },
    {
      label: t("Local"),
      value: PLACE_OPTIONS.find((p) => p.value === answers.place)?.label ?? "—",
      step: "place",
    },
    {
      label: t("Refeições"),
      value: `${answers.mealsPerDay ?? DEFAULT_MEALS_PER_DAY} por dia`,
      step: "mealsPerDay",
    },
    ...(answers.injuries.length
      ? [
          {
            label: t("Cuidados"),
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
      title={t("É isso mesmo?")}
      subtitle={t("Confira antes de montarmos seu plano. Toque em qualquer linha para corrigir.")}
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

      <Feedback title={t("O que vem agora")}>
        {t(
          "Montamos o plano de treino sugerido para as suas respostas e criamos suas refeições, vazias. No fim, você escolhe se segue com o plano ou se começa sem um.",
        )}
      </Feedback>

      <NextButton onPress={onConfirm} label={t("Montar meu plano")} />
    </Question>
  );
}

function QuizSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 gap-6 bg-background px-5" style={{ paddingTop: insets.top + 20 }}>
      <Skeleton className="h-10 rounded-full" />
      <Skeleton className="h-9 w-3/4 rounded-lg" />
      <View className="gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </View>
    </View>
  );
}
