import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "@forja/app-core/data/recipes";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { PageBody, PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmButton } from "@/components/confirm-button";
import { ErrorState } from "@/components/query-boundary";
import { FoodPicker } from "@/components/pickers/food-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, UtensilsCrossed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MEALS, type MealValue } from "@forja/app-core/lib/labels";
import { todayISO } from "@forja/app-core/lib/date";
import { nutritionTotals, perServing, portionMacros } from "@forja/domain";
import { t } from "@forja/app-core/i18n";

export const Route = createFileRoute("/_authenticated/recipes_/$id")({
  head: () => ({
    meta: [
      { title: t("Editar receita — Habitual Fit") },
      { name: "description", content: t("Ajuste ingredientes e porções.") },
      { property: "og:title", content: t("Editar receita — Habitual Fit") },
      { property: "og:description", content: t("Cálculo automático de macros por porção.") },
    ],
  }),
  component: RecipeEditor,
});

function RecipeEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const userId = useCurrentUserId();

  const [name, setName] = useState("");
  const [servings, setServings] = useState(1);
  const [notes, setNotes] = useState("");

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

  const save = useMutation({
    mutationFn: () => saveRecipe(id, { name, servings, notes }),
    onSuccess: () => {
      toast.success(t("Receita salva"));
      void qc.invalidateQueries({ queryKey: queryKeys.recipes.all });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const addItem = useMutation({
    mutationFn: ({ foodId, grams }: { foodId: string; grams: number }) =>
      addRecipeItem(id, foodId, grams),
    onSuccess: () => void invalidateItems(),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, grams }: { itemId: string; grams: number }) =>
      setRecipeItemGrams(itemId, grams),
    onSuccess: () => void invalidateItems(),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const removeItem = useMutation({
    mutationFn: removeRecipeItem,
    onSuccess: () => void invalidateItems(),
    onError: (e) => toast.error(errorMessage(e)),
  });

  // `items.data ?? []` criaria um array novo a cada render, invalidando o memo.
  const list = useMemo(() => items.data ?? [], [items.data]);
  const totals = useMemo(() => nutritionTotals(list.map(recipeItemPortion)), [list]);
  const porPorcao = perServing(totals, servings);

  const logToDiary = useMutation({
    mutationFn: ({ meal, portions }: { meal: MealValue; portions: number }) =>
      logRecipeToDiary({
        userId,
        date: todayISO(),
        meal,
        name,
        servings,
        portions,
        items: list,
      }),
    onSuccess: (today) => {
      toast.success(t("Adicionado ao diário de hoje"));
      // Antes o cache do diário não era invalidado: ao navegar para /diet o
      // usuário via os dados antigos até o refetch.
      void qc.invalidateQueries({ queryKey: queryKeys.diet.log(today) });
      void qc.invalidateQueries({ queryKey: queryKeys.diet.all });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (recipe.isError) {
    return (
      <>
        <PageHeader title={t("Receita")} description="" />
        <PageBody>
          <ErrorState message={errorMessage(recipe.error)} onRetry={recipe.refetch} />
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageBody>
        {/* Topo: voltar (só a seta) à esquerda, lançar no diário à direita. */}
        <div className="flex items-center justify-between gap-3 pb-3 pt-2">
          <Link
            to="/recipes"
            aria-label={t("Voltar para as receitas")}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-card transition-colors hover:bg-elevated"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <LogToDiary
            disabled={list.length === 0 || logToDiary.isPending}
            onLog={(meal, portions) => logToDiary.mutate({ meal, portions })}
          />
        </div>
        <h1 className="break-words text-[1.75rem] font-extrabold leading-tight">
          {recipe.isPending ? t("Carregando…") : name || t("Receita")}
        </h1>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          {list.length === 1
            ? t("1 ingrediente")
            : t("{{length}} ingredientes", { length: list.length })}{" "}
          · {servings === 1 ? t("1 porção") : t("{{servings}} porções", { servings })}
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="recipe-name">{t("Nome")}</Label>
                <Input
                  id="recipe-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("Ex: Panqueca de banana")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe-servings">{t("Porções")}</Label>
                <Input
                  id="recipe-servings"
                  type="number"
                  min={1}
                  max={100}
                  value={servings}
                  onChange={(e) => setServings(Math.max(1, Number(e.target.value) || 1))}
                />
                <p className="text-xs text-muted-foreground">
                  {t("Em quantas porções esta receita rende. Os macros abaixo são por porção.")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe-notes">{t("Notas")}</Label>
                <Textarea
                  id="recipe-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={t("Modo de preparo, observações…")}
                />
              </div>

              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="mb-2 font-semibold">{t("Por porção")}</p>
                {items.isPending ? (
                  <div className="space-y-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-3 w-full" />
                    ))}
                  </div>
                ) : (
                  <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <dt>{t("Calorias")}</dt>
                    <dd className="text-right font-medium text-foreground">
                      {t("{{v0}} kcal", { v0: Math.round(porPorcao.kcal) })}
                    </dd>
                    <dt>{t("Proteína")}</dt>
                    <dd className="text-right font-medium text-foreground">
                      {t("{{v0}} g", { v0: porPorcao.proteinG.toFixed(1) })}
                    </dd>
                    <dt>{t("Carboidrato")}</dt>
                    <dd className="text-right font-medium text-foreground">
                      {t("{{v0}} g", { v0: porPorcao.carbsG.toFixed(1) })}
                    </dd>
                    <dt>{t("Gordura")}</dt>
                    <dd className="text-right font-medium text-foreground">
                      {t("{{v0}} g", { v0: porPorcao.fatG.toFixed(1) })}
                    </dd>
                    <dt>{t("Fibra")}</dt>
                    <dd className="text-right font-medium text-foreground">
                      {t("{{v0}} g", { v0: porPorcao.fiberG.toFixed(1) })}
                    </dd>
                  </dl>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">{t("Ingredientes")}</h2>
                <FoodPicker
                  title={t("Adicionar ingrediente")}
                  isPending={addItem.isPending}
                  onPick={(food, grams) => addItem.mutateAsync({ foodId: food.id, grams })}
                  trigger={
                    <Button size="sm">
                      <Plus className="mr-1 size-4" />
                      {t("Ingrediente")}
                    </Button>
                  }
                />
              </div>

              {items.isPending ? (
                <div className="space-y-3 py-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="size-4 rounded" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-9 w-20" />
                    </div>
                  ))}
                </div>
              ) : items.isError ? (
                <ErrorState message={errorMessage(items.error)} onRetry={items.refetch} compact />
              ) : list.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("Adicione ingredientes para calcular os macros automaticamente.")}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {list.map((it) => {
                    const macros = portionMacros(recipeItemPortion(it));
                    return (
                      <li key={it.id} className="flex items-center gap-3 py-3">
                        <UtensilsCrossed
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {it.foods?.name ?? t("Alimento removido")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("{{v0}} kcal · P {{v1}} · C {{v2}} · G {{v3}}", {
                              v0: Math.round(macros.kcal),
                              v1: macros.proteinG.toFixed(1),
                              v2: macros.carbsG.toFixed(1),
                              v3: macros.fatG.toFixed(1),
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={10000}
                            defaultValue={num(it.grams)}
                            className="w-20"
                            aria-label={t("Gramas de {{v0}}", {
                              v0: it.foods?.name ?? "ingrediente",
                            })}
                            onBlur={(e) => {
                              const grams = Number(e.target.value);
                              if (!Number.isFinite(grams) || grams < 0 || grams > 10_000) {
                                toast.error("Informe um valor entre 0 e 10.000 g.");
                                e.target.value = String(num(it.grams));
                                return;
                              }
                              if (grams !== num(it.grams))
                                updateItem.mutate({ itemId: it.id, grams });
                            }}
                          />
                          <span className="text-xs text-muted-foreground">{t("g")}</span>
                        </div>
                        <ConfirmButton
                          aria-label={t("Remover {{v0}} da receita", {
                            v0: it.foods?.name ?? "ingrediente",
                          })}
                          title={t("Remover ingrediente?")}
                          description={t("Os macros da receita serão recalculados.")}
                          confirmLabel={t("Remover")}
                          onConfirm={() => removeItem.mutate(it.id)}
                        >
                          <Trash2 className="size-4" />
                        </ConfirmButton>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="h-20" aria-hidden />
        <div className="fixed inset-x-0 bottom-(--acima-da-barra) z-30 px-4 md:bottom-6 md:left-auto md:right-6 md:w-80">
          <Button
            className="h-13 w-full rounded-2xl text-base font-bold"
            onClick={() => save.mutate()}
            disabled={save.isPending || recipe.isPending}
            loading={save.isPending}
          >
            <Save className="mr-1.5 size-5" />
            {t("Salvar receita")}
          </Button>
        </div>
      </PageBody>
    </>
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
  const [portions, setPortions] = useState("1");

  const value = Number(portions);
  const invalid = !Number.isFinite(value) || value <= 0 || value > 50;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled} className="h-11 rounded-full px-4">
          <Plus className="mr-1 size-4" />
          {t("Diário")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("Adicionar ao diário de hoje")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="log-meal">{t("Refeição")}</Label>
            <Select value={meal} onValueChange={(v) => setMeal(v as MealValue)}>
              <SelectTrigger id="log-meal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEALS.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-portions">{t("Porções")}</Label>
            <Input
              id="log-portions"
              type="number"
              min={0.25}
              max={50}
              step={0.25}
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
              aria-invalid={invalid}
              aria-describedby={invalid ? "log-portions-error" : undefined}
            />
            {invalid && (
              <p id="log-portions-error" className="text-xs text-destructive">
                {t("Informe um valor entre 0,25 e 50.")}
              </p>
            )}
          </div>
          <Button
            className="w-full"
            disabled={invalid}
            onClick={() => {
              onLog(meal, value);
              setOpen(false);
            }}
          >
            {t("Adicionar")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
