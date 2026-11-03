import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
} from "@/components/onboarding/controls";
import { answersSchema, type Answers } from "@forja/app-core/lib/onboarding/schema";
import { loadDraft, loadStep, saveDraft, saveStep } from "@/lib/onboarding/storage";
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
import { WEEKDAY_LABELS, type Weekday } from "@forja/domain";
import { BrandSymbol } from "@/components/brand-logo";
import { hasCompletedOnboarding } from "@forja/app-core/data/onboarding";
import { t } from "@forja/app-core/i18n";

/**
 * A raiz do app: boas-vindas e, para quem já tem conta, o questionário.
 *
 * A conta vem primeiro: quem chega sem sessão vê só as boas-vindas, com
 * "Criar conta". O link de confirmação do e-mail traz a pessoa de volta para
 * cá já logada, e as respostas viram o plano salvo na conta dela.
 *
 * `ssr: false` porque a primeira coisa que a tela faz é ler o rascunho do
 * `localStorage`: renderizar no servidor produziria um passo diferente do que o
 * cliente mostraria em seguida.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: t("Habitual Fit — seu treino montado para você") },
      {
        name: "description",
        content: t(
          "Responda algumas perguntas e receba um plano de treino feito para a sua rotina e os seus objetivos — e organize sua dieta no mesmo app.",
        ),
      },
      {
        property: "og:title",
        content: t("Habitual Fit — treino personalizado e dieta organizada"),
      },
      {
        property: "og:description",
        content: t(
          "Um plano de musculação montado a partir das suas respostas, e um lugar para organizar suas refeições.",
        ),
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  ssr: false,
  component: OnboardingQuiz,
});

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

function OnboardingQuiz() {
  const navigate = useNavigate();

  const [answers, setAnswers] = useState<Answers>(() => answersSchema.parse({}));
  const [stepIndex, setStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  /** `null` enquanto confere a sessão; sem conta, vai direto para o login. */
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    setAnswers(loadDraft());
    setStepIndex(loadStep());
    setHydrated(true);
  }, []);

  // Quem já montou o plano não refaz o questionário. Quem entrou (pelo
  // Google, por exemplo) mas ainda não montou, fica: é exatamente o que falta.
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return void navigate({ to: "/auth", replace: true });
      if (await hasCompletedOnboarding()) return void navigate({ to: "/dashboard", replace: true });
      setLogado(true);
    })();
  }, [navigate]);

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

  /**
   * Marca a resposta e fica na pergunta: a pessoa confere e avança no
   * "Continuar" — tocar numa opção por engano não pula a etapa.
   */
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

  if (!hydrated || !step || !logado) return <QuizSkeleton />;

  const level = derivedLevel(answers);
  const objective = derivedObjective(answers);

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-4 pt-5">
        <header className="mb-6 flex items-center gap-3">
          {safeIndex > 0 ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={back}
              aria-label={t("Voltar para a pergunta anterior")}
              className="size-10 shrink-0 rounded-full"
            >
              <ArrowLeft className="size-5" />
            </Button>
          ) : (
            <BrandSymbol className="w-10" />
          )}
          <ProgressBar current={safeIndex + 1} total={steps.length} />
          <span className="w-11 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
            {safeIndex + 1}/{steps.length}
          </span>
        </header>

        <main className="flex flex-1 flex-col">
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
                onClick={() => {
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
                onClick={() => {
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
                  // Pré-marca o equipamento típico do local: o passo seguinte
                  // vira conferência rápida em vez de formulário em branco.
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
              <NextButton onClick={next} disabled={answers.equipment.length === 0} />
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
                onClick={() => {
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
              <div className="space-y-2.5">
                {DURATION_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => choose({ duration: o.value })}
                    aria-pressed={answers.duration === o.value}
                    className={cn(
                      "flex min-h-[3.5rem] w-full items-center justify-between gap-3 rounded-2xl border-2 p-4 text-left",
                      "transition-all active:scale-[0.985] motion-reduce:transition-none",
                      answers.duration === o.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40 hover:bg-accent/50",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-semibold">
                        {o.label}
                        <Badge variant="secondary" className="font-normal">
                          {o.minutes}
                        </Badge>
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {o.exercises}
                      </span>
                    </span>
                    {o.recommended && <Badge className="shrink-0">{t("Recomendado")}</Badge>}
                  </button>
                ))}
              </div>
            </Question>
          )}

          {step.id === "weekdays" && (
            <Question title={t("Em quais dias?")}>
              <WeekdayPicker
                selected={answers.weekdays}
                onToggle={(dia) =>
                  update({
                    weekdays: answers.weekdays.includes(dia)
                      ? answers.weekdays.filter((d) => d !== dia)
                      : [...answers.weekdays, dia].sort((a, b) => a - b),
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
                onClick={next}
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
              {answers.injuries.length > 0 && (
                <Feedback title={t("Importante")}>
                  {t(
                    "A seleção automática é só uma referência geral: não é avaliação clínica e não garante que um exercício seja seguro para você. Antes de treinar com lesão ou dor, procure orientação de um profissional de saúde e de educação física.",
                  )}
                </Feedback>
              )}
              <NextButton
                onClick={next}
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
              onClick={next}
              disabled={!answers[ESCOLHA_UNICA[step.id as keyof typeof ESCOLHA_UNICA]]}
            />
          )}

          {step.id === "review" && (
            <Review
              answers={answers}
              onEdit={goTo}
              steps={steps}
              onConfirm={() => void navigate({ to: "/preparando" })}
            />
          )}
        </main>
      </div>
    </div>
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
        onClick={() => {
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
        onClick={() => {
          update({ goalWeightKg: meta });
          onNext();
        }}
      />
    </Question>
  );
}

/**
 * Revisão antes do cadastro.
 *
 * Mostrar o que foi entendido, em vez de só um "tudo pronto!", é o que dá
 * confiança de que valeu responder — e a última chance barata de corrigir um
 * deslize antes de o plano ser montado em cima dele.
 */
function Review({
  answers,
  onEdit,
  steps,
  onConfirm,
}: {
  answers: Answers;
  onEdit: (index: number) => void;
  steps: { id: string }[];
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
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {linhas.map((l) => {
          const idx = indexOf(l.step);
          return (
            <li key={l.label}>
              <button
                type="button"
                onClick={() => idx >= 0 && onEdit(idx)}
                className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-accent/50"
              >
                <span className="shrink-0 text-sm text-muted-foreground">{l.label}</span>
                <span className="min-w-0 flex-1 truncate text-right text-sm font-medium">
                  {l.value}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Feedback title={t("O que vem agora")}>
        {t(
          "Montamos o plano de treino sugerido para as suas respostas e criamos suas refeições, vazias. No fim, você escolhe se segue com o plano ou se começa sem um.",
        )}
      </Feedback>

      <NextButton onClick={onConfirm} label={t("Montar meu plano")} />
    </Question>
  );
}

function QuizSkeleton() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 pt-5">
        <div className="h-10 animate-pulse rounded-full bg-muted" />
        <div className="h-9 w-3/4 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
