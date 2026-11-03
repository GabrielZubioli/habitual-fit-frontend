import { useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { __iconNode as copy } from "lucide-react/dist/esm/icons/copy.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { __iconNode as alertTriangle } from "lucide-react/dist/esm/icons/triangle-alert.js";
import { __iconNode as x } from "lucide-react/dist/esm/icons/x.js";
import {
  KCAL_TOLERANCE,
  nutritionTotals,
  portionMacros,
  toleranceStatus,
  weekdayOf,
  type Weekday,
} from "@forja/domain";
import { ensureActiveMealPlan, type ActiveMealPlan } from "@forja/app-core/data/meal-plans";
import {
  addPlanItem,
  copyDay,
  itensDoDia,
  refreshFutureDays,
  removePlanItem,
} from "@forja/app-core/data/diet-week";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { CATEGORY_EMOJI } from "@forja/app-core/lib/food-emoji";
import { MEAL_LABELS, label, WEEKDAY_LABELS, WEEKDAY_SHORT } from "@forja/app-core/lib/labels";
import { todayISO } from "@forja/app-core/lib/date";
import { cn } from "@/lib/cn";
import { useCurrentUserId } from "@/lib/session";
import { useColor } from "@/theme/theme";
import { ErrorState } from "./card";
import { AlertDialog, MenuSheet } from "./dialog";
import { FoodPicker } from "./food-picker";
import { Icon } from "./icon";
import { MACRO_COLORS, MacroRing } from "./macro-rings";
import { Text } from "./text";
import { LOCALE } from "@forja/app-core/i18n";
import { t } from "@forja/app-core/i18n";

/**
 * O cardápio da semana — o `diet/weekly-menu.tsx` do web: um dia de cada vez.
 * O que vale para todo dia aparece em todos; o resto é só daquele dia.
 * Mudanças valem dos próximos dias em diante.
 */
const ORDEM: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const SIGLA = WEEKDAY_SHORT;

type Meal = ActiveMealPlan["meals"][number];
type Item = Meal["items"][number];

const macrosDe = (i: Item) => portionMacros({ food: i.food, grams: i.grams, servings: 1 });

const totais = (plan: ActiveMealPlan, dia: number) =>
  nutritionTotals(
    plan.meals.flatMap((m) =>
      itensDoDia(m.items, dia).map((i) => ({ food: i.food, grams: i.grams, servings: 1 })),
    ),
  );

function situacao(total: number, meta: number): { texto: string; tom: "ok" | "neutro" | "fora" } {
  const d = Math.round(total - meta);
  const sinal = d > 0 ? "+" : "";
  switch (toleranceStatus(total, meta)) {
    case "ideal":
      return {
        texto: t("Dentro da meta (±{{ideal}} kcal)", { ideal: KCAL_TOLERANCE.ideal }),
        tom: "ok",
      };
    case "acceptable":
      return { texto: t("Perto da meta: {{sinal}}{{d}} kcal", { sinal, d }), tom: "neutro" };
    default:
      return { texto: t("Fora da meta: {{sinal}}{{d}} kcal", { sinal, d }), tom: "fora" };
  }
}

export function WeeklyMenu({ onError }: { onError: (mensagem: string) => void }) {
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  const hoje = weekdayOf(todayISO());
  const [dia, setDia] = useState<Weekday>(hoje);
  const [remover, setRemover] = useState<{ item: Item; meal: Meal } | null>(null);
  const [copiando, setCopiando] = useState(false);
  const [adicionando, setAdicionando] = useState<Meal | null>(null);
  const texto = useColor("foreground");
  const primaria = useColor("primary");
  const apagada = useColor("muted-foreground");
  const destrutiva = useColor("destructive");

  const plan = useQuery({
    queryKey: queryKeys.diet.activePlan(),
    queryFn: () => ensureActiveMealPlan(userId),
    enabled: Boolean(userId),
  });

  const salvar = useMutation({
    mutationFn: async ({ acao, afeta }: { acao: () => Promise<void>; afeta: number | null }) => {
      await acao();
      await refreshFutureDays(userId, afeta);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.diet.activePlan() });
      void qc.invalidateQueries({ queryKey: queryKeys.diet.all });
    },
    onError: (e) => onError(errorMessage(e)),
  });

  if (plan.isPending) return <View className="h-96 w-full rounded-3xl bg-muted" />;
  if (plan.isError)
    return <ErrorState message={errorMessage(plan.error)} onRetry={() => void plan.refetch()} />;
  const p = plan.data;
  if (!p) return null;

  const item2 = totais(p, dia);
  const metaKcal = p.kcalTarget;
  const semMeta = metaKcal <= 0;
  const status = semMeta ? null : situacao(item2.kcal, metaKcal);
  const nomeDia = WEEKDAY_LABELS[dia];
  const nomeDe = (m: Meal) => m.label?.trim() || label(MEAL_LABELS, m.slot);

  return (
    <View>
      <View accessibilityRole="tablist" className="flex-row gap-1.5">
        {ORDEM.map((d) => {
          const ativo = d === dia;
          return (
            <Pressable
              key={d}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={WEEKDAY_LABELS[d]}
              onPress={() => setDia(d)}
              className={cn(
                "h-12 min-w-0 flex-1 items-center justify-center rounded-xl border active:scale-95",
                ativo
                  ? "border-primary bg-primary"
                  : d === hoje
                    ? "border-primary/60 bg-primary/10"
                    : "border-primary/15 bg-primary/5",
              )}
            >
              <Text
                className={cn(
                  "text-xs font-extrabold tracking-wide",
                  ativo
                    ? "text-primary-foreground"
                    : d === hoje
                      ? "text-primary"
                      : "text-muted-foreground",
                )}
              >
                {SIGLA[d]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-3 rounded-3xl border border-border/60 bg-card p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-xs font-bold uppercase tracking-[1.7px] text-muted-foreground">
              {dia === hoje ? t("Hoje · ") : ""}
              {nomeDia}
            </Text>
            <View className="mt-1 flex-row items-baseline gap-1.5">
              <Text className="text-4xl font-extrabold leading-none">
                {Math.round(item2.kcal).toLocaleString(LOCALE)}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {semMeta ? "kcal" : `/ ${Math.round(metaKcal).toLocaleString(LOCALE)} kcal`}
              </Text>
            </View>
            {status ? (
              <View className="mt-1.5 flex-row items-center gap-1">
                {status.tom === "fora" ? (
                  <Icon node={alertTriangle} color={destrutiva} size={14} />
                ) : null}
                <Text
                  className={cn(
                    "text-xs font-semibold",
                    status.tom === "ok"
                      ? "text-primary"
                      : status.tom === "fora"
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {status.texto}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => setCopiando(true)}
            className="flex-row items-center gap-1.5 rounded-full border border-border px-3 py-2 active:bg-elevated"
          >
            <Icon node={copy} color={texto} size={16} />
            <Text className="text-sm font-semibold">{t("Copiar")}</Text>
          </Pressable>
        </View>
        <View className="mt-5 flex-row gap-2">
          <MacroRing
            nome={t("Proteína")}
            icone="🥩"
            valor={item2.proteinG}
            meta={p.proteinTarget}
            cor={MACRO_COLORS.protein}
          />
          <MacroRing
            nome={t("Carbo")}
            icone="🫘"
            valor={item2.carbsG}
            meta={p.carbsTarget}
            cor={MACRO_COLORS.carbs}
          />
          <MacroRing
            nome={t("Gordura")}
            icone="🥑"
            valor={item2.fatG}
            meta={p.fatTarget}
            cor={MACRO_COLORS.fat}
          />
        </View>
        {p.generation && p.generation.warnings.length > 0 ? (
          <View className="mt-3 gap-1 rounded-xl bg-elevated px-3 py-2">
            {p.generation.warnings.map((w) => (
              <Text key={w} className="text-xs text-muted-foreground">
                • {w}
              </Text>
            ))}
          </View>
        ) : null}
        <Text className="mt-3 text-[11px] text-muted-foreground">
          {t(
            "O app não prescreve dietas: monte o cardápio por conta própria ou com a orientação de um nutricionista.",
          )}
        </Text>
      </View>

      <View className="mt-3 gap-3">
        {p.meals.map((m) => {
          const itens = itensDoDia(m.items, dia);
          const kcalRefeicao = itens.reduce((n, i) => n + macrosDe(i).kcal, 0);
          const nome = nomeDe(m);
          const receita = [...new Set(itens.map((i) => i.prepNotes).filter(Boolean))].join(" · ");
          return (
            <View key={m.id} className="rounded-3xl border border-border/60 bg-card p-4">
              <View className="mb-2 flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-xl font-bold">
                    {nome}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t("{{v0}} kcal", { v0: Math.round(kcalRefeicao) })}
                    {receita ? ` · ${receita}` : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setAdicionando(m)}
                  accessibilityLabel={t("Adicionar em {{nome}} de {{v1}}", {
                    nome,
                    v1: nomeDia.toLowerCase(),
                  })}
                  className="h-10 w-10 items-center justify-center rounded-full bg-primary/10 active:bg-primary/20"
                >
                  <Icon node={plus} color={primaria} size={20} />
                </Pressable>
              </View>

              {itens.length === 0 ? (
                <View className="rounded-xl border border-dashed border-border px-3 py-4">
                  <Text className="text-center text-sm text-muted-foreground">
                    {t("Nada em {{v0}} na {{v1}}.", {
                      v0: nome.toLowerCase(),
                      v1: nomeDia.toLowerCase(),
                    })}
                  </Text>
                </View>
              ) : (
                itens.map((i, k) => (
                  <View
                    key={i.id}
                    className={cn(
                      "flex-row items-center gap-3 py-2.5",
                      k > 0 && "border-t border-border/60",
                    )}
                  >
                    <View className="h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-elevated">
                      <Text className="text-lg">
                        {CATEGORY_EMOJI[i.food.category ?? "other"] ?? CATEGORY_EMOJI.other}
                      </Text>
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="text-[15px] font-semibold">
                        {i.name}
                      </Text>
                      <View className="flex-row items-center">
                        <Text className="text-xs text-muted-foreground">
                          {t("{{v0}} g · {{v1}} kcal", {
                            v0: Math.round(i.grams),
                            v1: Math.round(macrosDe(i).kcal),
                          })}
                        </Text>
                        {i.weekday !== null ? (
                          <View className="ml-1.5 rounded-full bg-primary/10 px-1.5">
                            <Text className="text-[10px] font-bold text-primary">
                              {t("só {{v0}}", { v0: SIGLA[i.weekday as Weekday].toLowerCase() })}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Pressable
                      onPress={() =>
                        i.weekday === null
                          ? setRemover({ item: i, meal: m })
                          : salvar.mutate({
                              acao: () => removePlanItem(i, m.id, dia, false),
                              afeta: dia,
                            })
                      }
                      accessibilityLabel={t("Tirar {{name}}", { name: i.name })}
                      className="h-9 w-9 items-center justify-center rounded-full active:bg-elevated"
                    >
                      <Icon node={x} color={apagada} size={16} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          );
        })}
      </View>

      <Text className="mt-4 px-1 text-center text-xs text-muted-foreground">
        {t(
          "Itens marcados com “só” valem apenas naquele dia; os demais, a semana toda. As mudanças valem a partir de hoje — o que já foi marcado como comido não muda.",
        )}
      </Text>

      <FoodPicker
        open={adicionando !== null}
        onClose={() => setAdicionando(null)}
        title={adicionando ? `${nomeDe(adicionando)} · ${nomeDia.toLowerCase()}` : undefined}
        onPick={(food, grams) => {
          const m = adicionando;
          if (!m) return;
          return salvar.mutateAsync({
            acao: () => addPlanItem(m.id, food.id, grams, dia, m.items.length),
            afeta: dia,
          });
        }}
      />

      <MenuSheet
        open={copiando}
        onClose={() => setCopiando(false)}
        title={t("Copiar {{v0}} para…", { v0: nomeDia.toLowerCase() })}
        corIcone={texto}
        opcoes={ORDEM.filter((d) => d !== dia).map((d) => ({
          label: WEEKDAY_LABELS[d],
          onPress: () => salvar.mutate({ acao: () => copyDay(p, dia, d), afeta: d }),
        }))}
      />

      <AlertDialog
        open={remover !== null}
        onClose={() => setRemover(null)}
        title={t("Tirar {{v0}}?", { v0: remover?.item.name ?? "" })}
        description={t("Este alimento está no cardápio de toda a semana.")}
        acoes={[
          {
            label: t("Só de {{v0}}", { v0: nomeDia.toLowerCase() }),
            onPress: () =>
              remover &&
              salvar.mutate({
                acao: () => removePlanItem(remover.item, remover.meal.id, dia, false),
                afeta: dia,
              }),
          },
          {
            label: t("Da semana toda"),
            variant: "outline",
            onPress: () =>
              remover &&
              salvar.mutate({
                acao: () => removePlanItem(remover.item, remover.meal.id, dia, true),
                afeta: null,
              }),
          },
        ]}
      />
    </View>
  );
}
