import { useEffect, useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { __iconNode as arrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { __iconNode as chevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { __iconNode as save } from "lucide-react/dist/esm/icons/save.js";
import { __iconNode as trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
import { __iconNode as utensils } from "lucide-react/dist/esm/icons/utensils-crossed.js";
import { nutritionTotals, perServing, portionMacros } from "@forja/domain";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage, num } from "@forja/app-core/data/supabase-helpers";
import {
  addRecipeItem,
  fetchRecipe,
  fetchRecipeItems,
  logRecipeToDiary,
  recipeItemPortion,
  removeRecipeItem,
  saveRecipe,
  setRecipeItemGrams,
  type RecipeItem,
} from "@forja/app-core/data/recipes";
import { MEALS, MEAL_LABELS, label, type MealValue } from "@forja/app-core/lib/labels";
import { todayISO } from "@forja/app-core/lib/date";
import { cn } from "@/lib/cn";
import { useCurrentUserId } from "@/lib/session";
import { useColor } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Card, ErrorState } from "@/ui/card";
import { ConfirmDialog, Dialog, MenuSheet } from "@/ui/dialog";
import { FoodPicker } from "@/ui/food-picker";
import { Icon } from "@/ui/icon";
import { MACRO_COLORS, MacroTiles } from "@/ui/macro-rings";
import { PageScroll } from "@/ui/page-header";
import { Text } from "@/ui/text";
import { t } from "@forja/app-core/i18n";

/**
 * Editor de receita — o `recipes_.$id.tsx` do web: nome, porções, notas,
 * ingredientes com as gramas editáveis no lugar e os macros por porção. Lança
 * a receita no diário de hoje.
 */
export default function Tela() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // A tela fica montada entre uma receita e outra: o `key` zera o formulário.
  return <RecipeEditor key={id} id={id} />;
}

function RecipeEditor({ id }: { id: string }) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const insets = useSafeAreaInsets();
  const texto = useColor("foreground");
  const branco = useColor("primary-foreground");
  const apagada = useColor("muted-foreground");
  const [name, setName] = useState("");
  const [servings, setServings] = useState(1);
  const [notes, setNotes] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const falhou = (e: unknown) => setAviso({ texto: errorMessage(e), erro: true });

  const recipe = useQuery({
    queryKey: queryKeys.recipes.detail(id),
    queryFn: () => fetchRecipe(id),
  });
  const items = useQuery({
    queryKey: queryKeys.recipes.items(id),
    queryFn: () => fetchRecipeItems(id),
  });

  useEffect(() => {
    if (!recipe.data) return;
    setName(recipe.data.name);
    setServings(Math.max(1, recipe.data.servings));
    setNotes(recipe.data.notes ?? "");
  }, [recipe.data]);

  const invalidateItems = () => qc.invalidateQueries({ queryKey: queryKeys.recipes.items(id) });

  const salvar = useMutation({
    mutationFn: () => saveRecipe(id, { name, servings, notes }),
    onSuccess: () => {
      setAviso({ texto: t("Receita salva"), erro: false });
      void qc.invalidateQueries({ queryKey: queryKeys.recipes.all });
    },
    onError: falhou,
  });
  const addItem = useMutation({
    mutationFn: ({ foodId, grams }: { foodId: string; grams: number }) =>
      addRecipeItem(id, foodId, grams),
    onSuccess: () => void invalidateItems(),
    onError: falhou,
  });
  const updateItem = useMutation({
    mutationFn: ({ itemId, grams }: { itemId: string; grams: number }) =>
      setRecipeItemGrams(itemId, grams),
    onSuccess: () => void invalidateItems(),
    onError: falhou,
  });
  const removeItem = useMutation({
    mutationFn: removeRecipeItem,
    onSuccess: () => void invalidateItems(),
    onError: falhou,
  });

  const list = useMemo(() => items.data ?? [], [items.data]);
  const porPorcao = perServing(nutritionTotals(list.map(recipeItemPortion)), servings);

  const lancar = useMutation({
    mutationFn: ({ meal, portions }: { meal: MealValue; portions: number }) =>
      logRecipeToDiary({ userId, date: todayISO(), meal, name, servings, portions, items: list }),
    onSuccess: (dia) => {
      setAviso({ texto: t("Adicionado ao diário de hoje"), erro: false });
      void qc.invalidateQueries({ queryKey: queryKeys.diet.log(dia) });
      void qc.invalidateQueries({ queryKey: queryKeys.diet.all });
    },
    onError: falhou,
  });

  const voltar = () => (router.canGoBack() ? router.back() : router.navigate("/recipes"));

  return (
    <View className="flex-1 bg-background">
      <PageScroll
        header={
          // Topo: voltar à esquerda, lançar no diário à direita.
          <View
            className="flex-row items-center justify-between gap-3 px-4 pb-3"
            style={{ paddingTop: Math.max(24, insets.top) }}
          >
            <Pressable
              onPress={voltar}
              accessibilityLabel={t("Voltar para as receitas")}
              className="h-11 w-11 items-center justify-center rounded-full bg-card active:bg-elevated"
            >
              <Icon node={arrowLeft} color={texto} size={20} />
            </Pressable>
            <LogToDiary
              disabled={list.length === 0 || lancar.isPending}
              onLog={(meal, portions) => lancar.mutate({ meal, portions })}
            />
          </View>
        }
        contentContainerClassName="px-4 pb-48"
        keyboardShouldPersistTaps="handled"
      >
        {recipe.isError ? (
          <ErrorState message={errorMessage(recipe.error)} onRetry={() => void recipe.refetch()} />
        ) : (
          <>
            <Text className="text-[28px] font-extrabold leading-tight">
              {recipe.isPending ? t("Carregando…") : name || t("Receita")}
            </Text>
            <Text className="mb-4 mt-1 text-sm text-muted-foreground">
              {list.length === 1
                ? t("1 ingrediente")
                : t("{{length}} ingredientes", { length: list.length })}{" "}
              · {servings === 1 ? t("1 porção") : t("{{servings}} porções", { servings })}
            </Text>

            {aviso ? (
              <Pressable
                onPress={() => setAviso(null)}
                className={cn(
                  "mb-3 rounded-xl px-3.5 py-3",
                  aviso.erro ? "bg-destructive-soft" : "bg-primary/10",
                )}
              >
                <Text
                  className={cn(
                    "text-sm font-medium",
                    aviso.erro ? "text-destructive" : "text-primary",
                  )}
                >
                  {aviso.texto}
                </Text>
              </Pressable>
            ) : null}

            <Card>
              <View className="gap-3 p-4">
                <Campo rotulo={t("Nome")}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={t("Ex: Panqueca de banana")}
                    placeholderTextColor={apagada}
                    accessibilityLabel={t("Nome")}
                    className="h-10 rounded-md border border-input bg-background px-3 font-sans text-base"
                    style={{ color: texto }}
                  />
                </Campo>
                <Campo rotulo={t("Porções")}>
                  <TextInput
                    value={String(servings)}
                    onChangeText={(v) => setServings(Math.min(100, Math.max(1, Number(v) || 1)))}
                    keyboardType="number-pad"
                    accessibilityLabel={t("Porções")}
                    className="h-10 rounded-md border border-input bg-background px-3 font-sans text-base"
                    style={{ color: texto }}
                  />
                  <Text className="text-xs text-muted-foreground">
                    {t("Em quantas porções esta receita rende. Os macros abaixo são por porção.")}
                  </Text>
                </Campo>
                <Campo rotulo={t("Notas")}>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                    placeholder={t("Modo de preparo, observações…")}
                    placeholderTextColor={apagada}
                    accessibilityLabel={t("Notas")}
                    textAlignVertical="top"
                    className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 font-sans text-base"
                    style={{ color: texto }}
                  />
                </Campo>

                <View className="mt-1">
                  <View className="mb-2 flex-row items-baseline justify-between">
                    <Text className="text-xs font-bold uppercase tracking-[1.5px] text-muted-foreground">
                      {t("Por porção")}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {t("Fibra")}{" "}
                      {items.isPending ? "—" : t("{{v0}} g", { v0: porPorcao.fiberG.toFixed(1) })}
                    </Text>
                  </View>
                  <MacroTiles
                    className={items.isPending ? "opacity-40" : undefined}
                    kcal={porPorcao.kcal}
                    proteinG={porPorcao.proteinG}
                    carbsG={porPorcao.carbsG}
                    fatG={porPorcao.fatG}
                  />
                </View>
              </View>
            </Card>

            <Card className="mt-4">
              <View className="p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <Text className="font-semibold">{t("Ingredientes")}</Text>
                  <Button size="sm" onPress={() => setAdicionando(true)}>
                    <Icon node={plus} color={branco} size={16} />
                    <Text className="text-xs font-medium text-primary-foreground">
                      {t("Ingrediente")}
                    </Text>
                  </Button>
                </View>
                {items.isPending ? (
                  <View className="gap-3 py-2">
                    {[0, 1, 2].map((i) => (
                      <View key={i} className="h-9 rounded-md bg-muted" />
                    ))}
                  </View>
                ) : items.isError ? (
                  <ErrorState
                    message={errorMessage(items.error)}
                    onRetry={() => void items.refetch()}
                    compact
                  />
                ) : list.length === 0 ? (
                  <Text className="py-8 text-center text-sm text-muted-foreground">
                    {t("Adicione ingredientes para calcular os macros automaticamente.")}
                  </Text>
                ) : (
                  list.map((it, k) => (
                    <Ingrediente
                      key={it.id}
                      item={it}
                      primeiro={k === 0}
                      onGrams={(grams) => updateItem.mutate({ itemId: it.id, grams })}
                      onInvalid={() =>
                        setAviso({ texto: t("Informe um valor entre 0 e 10.000 g."), erro: true })
                      }
                      onRemove={() => removeItem.mutate(it.id)}
                    />
                  ))
                )}
              </View>
            </Card>
          </>
        )}
      </PageScroll>

      {/* Salvar fixo acima da barra de baixo, como no web. */}
      <View className="absolute inset-x-0 bottom-28 px-4" pointerEvents="box-none">
        <Button
          className="h-[52px] w-full rounded-2xl"
          onPress={() => salvar.mutate()}
          disabled={recipe.isPending}
          loading={salvar.isPending}
        >
          <Icon node={save} color={branco} size={20} />
          <Text className="text-base font-bold text-primary-foreground">{t("Salvar receita")}</Text>
        </Button>
      </View>

      <FoodPicker
        open={adicionando}
        onClose={() => setAdicionando(false)}
        title={t("Adicionar ingrediente")}
        onPick={(food, grams) => addItem.mutateAsync({ foodId: food.id, grams })}
      />
    </View>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium">{rotulo}</Text>
      {children}
    </View>
  );
}

function MacroChip({ valor, cor }: { valor: string; cor: string }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-elevated px-2 py-0.5">
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cor }} />
      <Text className="text-[11px] font-semibold tabular-nums">{valor}</Text>
    </View>
  );
}

function Ingrediente({
  item,
  primeiro,
  onGrams,
  onInvalid,
  onRemove,
}: {
  item: RecipeItem;
  primeiro: boolean;
  onGrams: (grams: number) => void;
  onInvalid: () => void;
  onRemove: () => void;
}) {
  const [rascunho, setRascunho] = useState(String(num(item.grams)));
  const [confirmar, setConfirmar] = useState(false);
  const texto = useColor("foreground");
  const apagada = useColor("muted-foreground");
  const macros = portionMacros(recipeItemPortion(item));
  const kcalCor = useColor("primary");
  const protCor = useColor(MACRO_COLORS.protein);
  const carbCor = useColor(MACRO_COLORS.carbs);
  const gordCor = useColor(MACRO_COLORS.fat);
  const nome = item.foods?.name ?? t("Alimento removido");
  return (
    <View className={cn("py-3", !primeiro && "border-t border-border")}>
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-elevated">
          <Icon node={utensils} color={apagada} size={16} />
        </View>
        <Text numberOfLines={2} className="min-w-0 flex-1 font-medium leading-tight">
          {nome}
        </Text>
        <View className="flex-row items-center gap-1">
          <TextInput
            value={rascunho}
            onChangeText={setRascunho}
            keyboardType="number-pad"
            accessibilityLabel={t("Gramas de {{v0}}", { v0: item.foods?.name ?? "ingrediente" })}
            onBlur={() => {
              const grams = Number(rascunho);
              if (
                !Number.isFinite(grams) ||
                grams < 0 ||
                grams > 10_000 ||
                rascunho.trim() === ""
              ) {
                onInvalid();
                setRascunho(String(num(item.grams)));
                return;
              }
              if (grams !== num(item.grams)) onGrams(grams);
            }}
            className="h-10 w-16 rounded-xl border border-input bg-background px-2 text-center font-sans text-base"
            style={{ color: texto }}
          />
          <Text className="text-xs text-muted-foreground">{t("g")}</Text>
        </View>
        <Pressable
          onPress={() => setConfirmar(true)}
          accessibilityLabel={t("Remover {{v0}} da receita", {
            v0: item.foods?.name ?? "ingrediente",
          })}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-elevated"
        >
          <Icon node={trash2} color={apagada} size={16} />
        </Pressable>
      </View>
      <View className="mt-2 flex-row flex-wrap gap-1.5 pl-12">
        <MacroChip valor={t("{{v0}} kcal", { v0: Math.round(macros.kcal) })} cor={kcalCor} />
        <MacroChip valor={t("P {{v0}} g", { v0: macros.proteinG.toFixed(1) })} cor={protCor} />
        <MacroChip valor={t("C {{v0}} g", { v0: macros.carbsG.toFixed(1) })} cor={carbCor} />
        <MacroChip valor={t("G {{v0}} g", { v0: macros.fatG.toFixed(1) })} cor={gordCor} />
      </View>
      <ConfirmDialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title={t("Remover ingrediente?")}
        description={t("Os macros da receita serão recalculados.")}
        confirmLabel={t("Remover")}
        destructive
        onConfirm={onRemove}
      />
    </View>
  );
}

function LogToDiary({
  onLog,
  disabled,
}: {
  onLog: (meal: MealValue, portions: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [meal, setMeal] = useState<MealValue>("lunch");
  const [escolhendo, setEscolhendo] = useState(false);
  const [portions, setPortions] = useState("1");
  const texto = useColor("foreground");
  const apagada = useColor("muted-foreground");
  const value = Number(portions.replace(",", "."));
  const invalid = !Number.isFinite(value) || value <= 0 || value > 50;

  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        className="h-11 rounded-full px-4"
        onPress={() => setOpen(true)}
      >
        <Icon node={plus} color={texto} size={16} />
        <Text className="text-sm font-medium">{t("Diário")}</Text>
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("Adicionar ao diário de hoje")}>
        <View className="gap-1.5">
          <Text className="text-sm font-medium">{t("Refeição")}</Text>
          <Pressable
            onPress={() => setEscolhendo(true)}
            accessibilityLabel={t("Refeição")}
            className="h-10 flex-row items-center justify-between rounded-md border border-input bg-background px-3"
          >
            <Text className="text-base">{label(MEAL_LABELS, meal)}</Text>
            <Icon node={chevronDown} color={apagada} size={16} />
          </Pressable>
        </View>
        <View className="gap-1.5">
          <Text className="text-sm font-medium">{t("Porções")}</Text>
          <TextInput
            value={portions}
            onChangeText={setPortions}
            keyboardType="decimal-pad"
            accessibilityLabel={t("Porções")}
            className={cn(
              "h-10 rounded-md border bg-background px-3 font-sans text-base",
              invalid ? "border-destructive" : "border-input",
            )}
            style={{ color: texto }}
          />
          {invalid ? (
            <Text className="text-xs text-destructive">
              {t("Informe um valor entre 0,25 e 50.")}
            </Text>
          ) : null}
        </View>
        <Button
          className="w-full"
          disabled={invalid}
          onPress={() => {
            onLog(meal, value);
            setOpen(false);
          }}
        >
          {t("Adicionar")}
        </Button>
        <MenuSheet
          open={escolhendo}
          onClose={() => setEscolhendo(false)}
          title={t("Refeição")}
          corIcone={texto}
          opcoes={MEALS.map((m) => ({ label: m.label, onPress: () => setMeal(m.key) }))}
        />
      </Dialog>
    </>
  );
}
