import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, TextInput, View } from "react-native";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { __iconNode as arrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { __iconNode as chevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import { __iconNode as chevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
import { __iconNode as minus } from "lucide-react/dist/esm/icons/minus.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { queryKeys } from "@forja/app-core/data/query-keys";
import {
  FOOD_SEARCH_LIMIT,
  searchFoods,
  type FoodOption,
  type PickedFood,
} from "@forja/app-core/data/foods";
import {
  RECIPE_CATEGORIES,
  fetchRecipes,
  recipeCategoryOf,
  type RecipeSummary,
} from "@forja/app-core/data/recipes";
import { useDebouncedValue } from "@forja/app-core/hooks/use-debounced-value";
import { searchWords } from "@forja/app-core/lib/search";
import { CATEGORY_EMOJI } from "@forja/app-core/lib/food-emoji";
import { cn } from "@/lib/cn";
import { urlDoSite } from "@/lib/site";
import { useColor } from "@/theme/theme";
import { Button } from "./button";
import { ErrorState } from "./card";
import { MenuSheet } from "./dialog";
import { Icon } from "./icon";
import {
  ResultRow,
  ResultsEmpty,
  ResultsLoading,
  SearchDialog,
  SearchField,
} from "./search-dialog";
import { Text } from "./text";
import { LOCALE } from "@forja/app-core/i18n";
import { t } from "@forja/app-core/i18n";

/**
 * Seletor de alimento com quantidade — o `pickers/food-picker.tsx` do web.
 * Buscar no catálogo e, ao tocar, escolher a quantidade vendo os valores da
 * porção. Com `onPickRecipe`, ganha a aba Receitas. Valor ausente no catálogo
 * aparece como "—", nunca como zero.
 */
const QUICK_GRAMS = [50, 100, 150, 200, 300];
const PORCOES = [0.5, 1, 1.5, 2, 3];

const kcalFmt = (n: number) => Math.round(n).toLocaleString(LOCALE);
const gFmt = (n: number) => n.toLocaleString(LOCALE, { maximumFractionDigits: n < 10 ? 1 : 0 });
const porcaoFmt = (n: number) => (n === 0.5 ? "½" : n.toLocaleString(LOCALE));

export function FoodPicker({
  open,
  onClose,
  title = t("Adicionar alimento"),
  confirmLabel = t("Adicionar alimento"),
  defaultGrams = 100,
  onPick,
  onPickRecipe,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  confirmLabel?: string;
  defaultGrams?: number;
  /** Recebe o alimento e a quantidade em gramas; o seletor fecha quando a promise resolve. */
  onPick: (food: PickedFood, grams: number) => void | Promise<unknown>;
  onPickRecipe?: (recipe: RecipeSummary, portions: number) => void | Promise<unknown>;
}) {
  const [aba, setAba] = useState<"alimentos" | "receitas">("alimentos");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<FoodOption | null>(null);
  const [grams, setGrams] = useState(String(defaultGrams));
  const [receita, setReceita] = useState<RecipeSummary | null>(null);
  const [porcoes, setPorcoes] = useState(1);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [escolhendoCategoria, setEscolhendoCategoria] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const apagada = useColor("muted-foreground");
  const primaria = useColor("primary");
  const debouncedTerm = useDebouncedValue(term.trim(), 300);

  // Reabrir o seletor começa limpo.
  useEffect(() => {
    if (open) return;
    const reset = setTimeout(() => {
      setTerm("");
      setSelected(null);
      setGrams(String(defaultGrams));
      setReceita(null);
      setPorcoes(1);
      setCategoria(null);
      setAba("alimentos");
    }, 150);
    return () => clearTimeout(reset);
  }, [open, defaultGrams]);

  const foods = useQuery({
    queryKey: queryKeys.foods.search(debouncedTerm),
    enabled: open && aba === "alimentos" && !selected,
    placeholderData: keepPreviousData,
    queryFn: () => searchFoods(debouncedTerm),
  });

  const receitas = useQuery({
    queryKey: [...queryKeys.recipes.all, "com-prontas"],
    enabled: open && Boolean(onPickRecipe) && aba === "receitas",
    queryFn: fetchRecipes,
  });

  const receitasFiltradas = useMemo(() => {
    const ws = searchWords(debouncedTerm);
    return (receitas.data ?? []).filter(
      (r) =>
        (!categoria || (categoria === "minhas" ? !r.isSystem : r.category === categoria)) &&
        ws.every((w) => r.name.toLowerCase().includes(w)),
    );
  }, [receitas.data, categoria, debouncedTerm]);

  const gramsValue = Number(grams.replace(",", "."));
  const gramsInvalid = !Number.isFinite(gramsValue) || gramsValue <= 0 || gramsValue > 10_000;

  /** Grava e fecha; trava no primeiro toque. Se falhar, fica aberto (quem chamou mostra o erro). */
  const gravar = async (acao: () => void | Promise<unknown>) => {
    if (salvando) return;
    setSalvando(true);
    try {
      await acao();
      onClose();
    } catch {
      // O erro já foi exibido por quem chamou.
    } finally {
      setSalvando(false);
    }
  };

  const lista = !selected && !receita;
  const rotuloCategoria =
    categoria === null
      ? t("Todas as categorias")
      : categoria === "minhas"
        ? t("Minhas receitas")
        : `${recipeCategoryOf(categoria)?.emoji ?? ""} ${recipeCategoryOf(categoria)?.label ?? ""}`;

  return (
    <SearchDialog
      open={open}
      onClose={onClose}
      title={receita?.name ?? title}
      description={selected ? t("Escolha a quantidade e confira os valores.") : undefined}
      top={
        lista ? (
          <>
            {onPickRecipe ? (
              <View className="flex-row rounded-2xl bg-card p-1">
                {(["alimentos", "receitas"] as const).map((a) => (
                  <Pressable
                    key={a}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: aba === a }}
                    onPress={() => setAba(a)}
                    className={cn(
                      "flex-1 items-center rounded-xl py-2.5",
                      aba === a && "bg-primary",
                    )}
                  >
                    <Text
                      className={cn(
                        "text-sm font-semibold",
                        aba === a ? "text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {a === "alimentos" ? t("Alimentos") : t("Receitas")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <SearchField
              value={term}
              onChange={setTerm}
              placeholder={
                aba === "alimentos" ? t("Buscar alimento pelo nome…") : t("Buscar receita…")
              }
              loading={foods.isFetching || receitas.isFetching}
            />
            {aba === "receitas" ? (
              <Pressable
                onPress={() => setEscolhendoCategoria(true)}
                accessibilityLabel={t("Categoria")}
                className={cn(
                  "h-11 flex-row items-center justify-between rounded-2xl border bg-card px-4",
                  categoria ? "border-primary/50" : "border-transparent",
                )}
              >
                <Text className={cn("text-sm font-semibold", categoria && "text-primary")}>
                  {rotuloCategoria}
                </Text>
                <Icon node={chevronDown} color={apagada} size={16} />
              </Pressable>
            ) : null}
          </>
        ) : undefined
      }
    >
      {selected ? (
        <EscolherGramas
          food={selected}
          grams={grams}
          setGrams={setGrams}
          invalid={gramsInvalid}
          onBack={() => setSelected(null)}
          onConfirm={() => !gramsInvalid && void gravar(() => onPick(selected, gramsValue))}
          confirmLabel={confirmLabel}
          isPending={salvando}
        />
      ) : receita ? (
        <EscolherPorcoes
          receita={receita}
          porcoes={porcoes}
          setPorcoes={setPorcoes}
          onBack={() => setReceita(null)}
          onConfirm={() => onPickRecipe && void gravar(() => onPickRecipe(receita, porcoes))}
          isPending={salvando}
        />
      ) : aba === "alimentos" ? (
        foods.isPending || (foods.isPlaceholderData && foods.data.length === 0) ? (
          <ResultsLoading />
        ) : foods.isError ? (
          <ErrorState
            message={t(
              "Não foi possível buscar os alimentos. Verifique a conexão e tente de novo.",
            )}
            onRetry={() => void foods.refetch()}
            compact
          />
        ) : foods.data.length === 0 ? (
          <ResultsEmpty>
            {debouncedTerm
              ? t(
                  "Nenhum alimento encontrado para “{{debouncedTerm}}”.\nTente outro nome ou uma palavra mais curta.",
                  { debouncedTerm },
                )
              : t("Nenhum alimento no catálogo.")}
          </ResultsEmpty>
        ) : (
          <View className={cn(foods.isPlaceholderData && "opacity-60")}>
            <Text className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {!debouncedTerm
                ? t("Catálogo de alimentos")
                : foods.data.length >= FOOD_SEARCH_LIMIT
                  ? t("Primeiros {{FOOD_SEARCH_LIMIT}} resultados — refine a busca", {
                      FOOD_SEARCH_LIMIT,
                    })
                  : `${foods.data.length} ${foods.data.length === 1 ? "resultado" : "resultados"}`}
            </Text>
            <View className="gap-2">
              {foods.data.map((f) => (
                <ResultRow
                  key={f.id}
                  thumb={<FoodThumb food={f} />}
                  title={f.name}
                  detail={t("{{v0}} kcal em {{v1}} g{{v2}}", {
                    v0: kcalFmt(f.kcal),
                    v1: gFmt(f.servingSizeG),
                    v2: f.brand ? ` · ${f.brand}` : "",
                  })}
                  aside={<Icon node={chevronRight} color={apagada} size={20} />}
                  onPress={() => setSelected(f)}
                >
                  <MacrosLinha food={f} />
                </ResultRow>
              ))}
            </View>
          </View>
        )
      ) : receitas.isPending ? (
        <ResultsLoading />
      ) : receitas.isError ? (
        <ErrorState
          message={t("Falha ao carregar receitas.")}
          onRetry={() => void receitas.refetch()}
          compact
        />
      ) : receitasFiltradas.length === 0 ? (
        <ResultsEmpty>{t("Nenhuma receita encontrada.")}</ResultsEmpty>
      ) : (
        <View className="gap-2">
          {receitasFiltradas.map((r) => (
            <ResultRow
              key={r.id}
              thumb={<RecipeThumb recipe={r} />}
              title={r.name}
              detail={t("{{v0}} kcal · P {{v1}} g{{v2}}{{v3}}", {
                v0: kcalFmt(r.perServing.kcal),
                v1: Math.round(r.perServing.proteinG),
                v2: r.prepMinutes ? ` · ${r.prepMinutes} min` : "",
                v3: !r.isSystem ? " · sua" : "",
              })}
              aside={<Icon node={chevronRight} color={apagada} size={20} />}
              onPress={() => setReceita(r)}
            />
          ))}
        </View>
      )}

      <MenuSheet
        open={escolhendoCategoria}
        onClose={() => setEscolhendoCategoria(false)}
        title={t("Categoria")}
        corIcone={primaria}
        opcoes={[
          { label: t("Todas as categorias"), onPress: () => setCategoria(null) },
          ...RECIPE_CATEGORIES.map((c) => ({
            label: `${c.emoji} ${c.label}`,
            onPress: () => setCategoria(c.key),
          })),
          { label: t("Minhas receitas"), onPress: () => setCategoria("minhas") },
        ]}
      />
    </SearchDialog>
  );
}

/** A foto da receita, ou o símbolo da categoria. */
export function RecipeThumb({ recipe, className }: { recipe: RecipeSummary; className?: string }) {
  const [quebrada, setQuebrada] = useState(false);
  if (recipe.imageUrl && !quebrada) {
    return (
      <Image
        source={{ uri: urlDoSite(recipe.imageUrl) }}
        onError={() => setQuebrada(true)}
        className={cn("h-14 w-14 rounded-xl", className)}
      />
    );
  }
  return (
    <View className={cn("h-14 w-14 items-center justify-center rounded-xl bg-elevated", className)}>
      <Text className="text-2xl">{recipeCategoryOf(recipe.category)?.emoji ?? "🍽️"}</Text>
    </View>
  );
}

/** Foto do alimento quando o catálogo tem; senão, o símbolo da categoria. */
function FoodThumb({ food, grande }: { food: FoodOption; grande?: boolean }) {
  const [quebrada, setQuebrada] = useState(false);
  const tamanho = grande ? "h-16 w-16 rounded-2xl" : "h-12 w-12 rounded-xl";
  if (food.imageUrl && !quebrada) {
    return (
      <Image
        source={{ uri: food.imageUrl }}
        onError={() => setQuebrada(true)}
        className={tamanho}
      />
    );
  }
  return (
    <View className={cn("items-center justify-center bg-primary/10", tamanho)}>
      <Text className={grande ? "text-3xl" : "text-xl"}>
        {CATEGORY_EMOJI[food.category ?? "other"] ?? CATEGORY_EMOJI.other}
      </Text>
    </View>
  );
}

/** Proteína, carboidrato e gordura por porção do catálogo — só os que existem. */
function MacrosLinha({ food }: { food: FoodOption }) {
  const macros = (
    [
      ["P", food.proteinG],
      ["C", food.carbsG],
      ["G", food.fatG],
    ] as const
  ).filter((m): m is readonly ["P" | "C" | "G", number] => m[1] !== null);
  if (macros.length === 0) return null;
  return (
    <View className="mt-1.5 flex-row flex-wrap gap-1">
      {macros.map(([rotulo, v]) => (
        <View key={rotulo} className="rounded-full bg-muted px-2 py-0.5">
          <Text className="text-[11px] font-medium text-muted-foreground">
            {t("{{rotulo}} {{v1}} g", { rotulo, v1: gFmt(v) })}
          </Text>
        </View>
      ))}
    </View>
  );
}

function EscolherGramas({
  food,
  grams,
  setGrams,
  invalid,
  onBack,
  onConfirm,
  confirmLabel,
  isPending,
}: {
  food: FoodOption;
  grams: string;
  setGrams: (g: string) => void;
  invalid: boolean;
  onBack: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  isPending: boolean;
}) {
  const texto = useColor("foreground");
  const branco = useColor("primary-foreground");
  const valor = Number(grams.replace(",", "."));
  const fator = invalid ? 0 : valor / (food.servingSizeG || 100);
  const passo = (delta: number) =>
    setGrams(String(Math.min(10_000, Math.max(1, (invalid ? 0 : valor) + delta))));
  const atalhos = [
    ...(food.measure && food.measureG
      ? [
          {
            g: food.measureG,
            rotulo: t("1 {{measure}} · {{v1}} g", {
              measure: food.measure,
              v1: gFmt(food.measureG),
            }),
          },
        ]
      : []),
    ...QUICK_GRAMS.map((g) => ({ g, rotulo: t("{{g}} g", { g }) })),
  ];
  const valores: [string, number | null][] = [
    [t("Proteína"), food.proteinG],
    [t("Carbo"), food.carbsG],
    [t("Gordura"), food.fatG],
  ];

  return (
    <View className="gap-5">
      <View className="flex-row items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
        <FoodThumb food={food} grande />
        <View className="min-w-0 flex-1">
          <Text className="font-bold leading-snug">{food.name}</Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            {t("{{v0}} kcal em {{v1}} g", { v0: kcalFmt(food.kcal), v1: gFmt(food.servingSizeG) })}
            {food.brand ? ` · ${food.brand}` : ""}
          </Text>
        </View>
        <Pressable onPress={onBack} className="rounded-full px-3 py-1.5 active:bg-primary/10">
          <Text className="text-xs font-semibold text-primary">{t("Trocar")}</Text>
        </Pressable>
      </View>

      <View className="gap-2.5">
        <Text className="text-sm font-medium">{t("Quantidade")}</Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => passo(-10)}
            disabled={invalid || valor <= 1}
            accessibilityLabel={t("Diminuir 10 g")}
            className={cn(
              "h-14 w-14 items-center justify-center rounded-2xl bg-card active:bg-elevated",
              (invalid || valor <= 1) && "opacity-40",
            )}
          >
            <Icon node={minus} color={texto} size={20} />
          </Pressable>
          <View className="min-w-0 flex-1 justify-center">
            <TextInput
              value={grams}
              onChangeText={setGrams}
              keyboardType="decimal-pad"
              accessibilityLabel={t("Quantidade em gramas")}
              onSubmitEditing={onConfirm}
              className={cn(
                "h-14 rounded-2xl border bg-background pr-10 text-center font-sans text-2xl font-bold",
                invalid ? "border-destructive" : "border-input",
              )}
              style={{ color: texto }}
            />
            <Text className="absolute right-4 text-sm font-semibold text-muted-foreground">
              {t("g")}
            </Text>
          </View>
          <Pressable
            onPress={() => passo(10)}
            disabled={!invalid && valor >= 10_000}
            accessibilityLabel={t("Aumentar 10 g")}
            className="h-14 w-14 items-center justify-center rounded-2xl bg-card active:bg-elevated"
          >
            <Icon node={plus} color={texto} size={20} />
          </Pressable>
        </View>
        {invalid ? (
          <Text className="text-xs text-destructive">
            {t("Informe um valor entre 1 e 10.000 g.")}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-1.5">
          {atalhos.map((a) => (
            <Pressable
              key={a.rotulo}
              onPress={() => setGrams(String(a.g))}
              accessibilityState={{ selected: valor === a.g }}
              className={cn("rounded-full px-3 py-1.5", valor === a.g ? "bg-primary" : "bg-card")}
            >
              <Text
                className={cn(
                  "text-sm font-medium",
                  valor === a.g ? "text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {a.rotulo}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="rounded-2xl bg-card p-4">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text className="text-sm text-muted-foreground">{t("Nesta quantidade")}</Text>
          <Text className="text-2xl font-extrabold text-primary">
            {invalid ? "—" : kcalFmt(food.kcal * fator)}
            <Text className="text-sm font-semibold text-primary"> {t("kcal")}</Text>
          </Text>
        </View>
        <View className="mt-3 flex-row gap-2">
          {valores.map(([rotulo, v]) => (
            <View
              key={rotulo}
              className="flex-1 items-center rounded-xl bg-background/60 px-1 py-2"
            >
              <Text className="text-[11px] text-muted-foreground">{rotulo}</Text>
              <Text className="font-bold">
                {v === null || invalid ? "—" : t("{{v0}} g", { v0: gFmt(v * fator) })}
              </Text>
            </View>
          ))}
        </View>
        {valores.some(([, v]) => v === null) ? (
          <Text className="mt-2 text-[11px] text-muted-foreground">
            {t("— sem dado no catálogo")}
          </Text>
        ) : null}
      </View>

      <View className="flex-row gap-2 border-t border-border/60 pt-3">
        <Button variant="outline" className="h-12 rounded-xl" onPress={onBack}>
          <Icon node={arrowLeft} color={texto} size={16} />
          <Text className="text-sm font-medium">{t("Voltar")}</Text>
        </Button>
        <Button
          className="h-12 flex-1 rounded-xl"
          onPress={onConfirm}
          disabled={invalid}
          loading={isPending}
        >
          <Icon node={plus} color={branco} size={16} />
          <Text className="text-base font-bold text-primary-foreground">{confirmLabel}</Text>
        </Button>
      </View>
    </View>
  );
}

function EscolherPorcoes({
  receita,
  porcoes,
  setPorcoes,
  onBack,
  onConfirm,
  isPending,
}: {
  receita: RecipeSummary;
  porcoes: number;
  setPorcoes: (p: number) => void;
  onBack: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const texto = useColor("foreground");
  const fator = porcoes / receita.servings;
  const m = receita.perServing;
  const idx = PORCOES.indexOf(porcoes);
  return (
    <View className="gap-4">
      <Text className="text-sm text-muted-foreground">
        {t("{{v0}} · rende {{servings}}", {
          v0: recipeCategoryOf(receita.category)?.label ?? "Sua receita",
          servings: receita.servings,
        })}
        {receita.servings === 1 ? t("porção") : t("porções")}
        {receita.prepMinutes ? ` · ${receita.prepMinutes} min` : ""}
      </Text>

      <View className="flex-row items-center justify-between rounded-2xl bg-card p-2">
        <Pressable
          onPress={() => setPorcoes(PORCOES[Math.max(0, idx - 1)]!)}
          disabled={idx <= 0}
          accessibilityLabel={t("Menos")}
          className={cn(
            "h-11 w-11 items-center justify-center rounded-xl bg-elevated",
            idx <= 0 && "opacity-40",
          )}
        >
          <Icon node={minus} color={texto} size={20} />
        </Pressable>
        <View className="items-center">
          <Text className="text-2xl font-extrabold">{porcaoFmt(porcoes)}</Text>
          <Text className="text-xs text-muted-foreground">
            {porcoes <= 1 ? t("porção") : t("porções")}
          </Text>
        </View>
        <Pressable
          onPress={() => setPorcoes(PORCOES[Math.min(PORCOES.length - 1, idx + 1)]!)}
          disabled={idx >= PORCOES.length - 1}
          accessibilityLabel={t("Mais")}
          className={cn(
            "h-11 w-11 items-center justify-center rounded-xl bg-elevated",
            idx >= PORCOES.length - 1 && "opacity-40",
          )}
        >
          <Icon node={plus} color={texto} size={20} />
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        {(
          [
            ["kcal", m.kcal * porcoes],
            [t("Prot."), m.proteinG * porcoes],
            [t("Carbo"), m.carbsG * porcoes],
            [t("Gord."), m.fatG * porcoes],
          ] as const
        ).map(([rotulo, valor]) => (
          <View key={rotulo} className="flex-1 items-center rounded-2xl bg-card px-1 py-2.5">
            <Text className="font-bold">{Math.round(valor)}</Text>
            <Text className="text-[11px] text-muted-foreground">{rotulo}</Text>
          </View>
        ))}
      </View>

      <View>
        <Text className="mb-2 text-sm font-semibold">{t("Ingredientes")}</Text>
        <View className="rounded-2xl bg-card">
          {receita.items.map((i, k) => (
            <View
              key={i.foodId + i.grams}
              className={cn(
                "flex-row items-start justify-between gap-3 px-4 py-2.5",
                k > 0 && "border-t border-border/50",
              )}
            >
              <Text className="min-w-0 flex-1 text-sm">{i.name}</Text>
              <Text className="text-sm text-muted-foreground">
                {t("{{v0}} g", { v0: Math.round(i.grams * fator) })}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {receita.instructions ? (
        <View>
          <Text className="mb-1 text-sm font-semibold">{t("Modo de preparo")}</Text>
          <Text className="text-sm leading-relaxed text-muted-foreground">
            {receita.instructions}
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-2 pt-2">
        <Button variant="outline" className="h-12" onPress={onBack}>
          <Icon node={arrowLeft} color={texto} size={16} />
          <Text className="text-sm font-medium">{t("Voltar")}</Text>
        </Button>
        <Button className="h-12 flex-1" onPress={onConfirm} loading={isPending}>
          {t("Adicionar receita")}
        </Button>
      </View>
    </View>
  );
}
