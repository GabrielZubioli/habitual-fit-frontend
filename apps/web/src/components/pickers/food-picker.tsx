/**
 * Seletor de alimento com quantidade — usado no cardápio e no editor de receitas.
 * No cardápio também oferece as **receitas** (prontas e da pessoa), que entram
 * na refeição como os ingredientes delas.
 *
 * Dois passos: buscar no catálogo (`foods`, o mesmo do resto do app) e, ao
 * tocar num alimento, escolher a quantidade vendo os valores daquela porção.
 * Valor nutricional ausente no catálogo aparece como "—", nunca como zero.
 *
 * O diálogo é uma coluna flexível com rolagem só vertical: nomes longos da
 * TACO ("Carne, bovina, capa de contra-filé, sem gordura, grelhada") quebram
 * em duas linhas em vez de alargar o diálogo e criar rolagem horizontal.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Clock, Loader2, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/data/query-keys";
import { num, unwrapList } from "@/data/supabase-helpers";
import {
  RECIPE_CATEGORIES,
  fetchRecipes,
  recipeCategoryOf,
  type RecipeSummary,
} from "@/data/recipes";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResultList,
  ResultRow,
  ResultsEmpty,
  ResultsLoading,
  SearchDialogContent,
  SearchField,
} from "@/components/pickers/search-dialog";
import { ErrorState } from "@/components/query-boundary";
import { CATEGORY_EMOJI } from "@/lib/food-emoji";
import { cn, searchWords } from "@/lib/utils";

export type PickedFood = {
  id: string;
  name: string;
  brand: string | null;
  servingSizeG: number;
  kcal: number;
};

/** O alimento como o seletor o mostra: macros `null` quando o catálogo não tem o dado. */
type FoodOption = PickedFood & {
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  imageUrl: string | null;
  category: string | null;
  /** Medida caseira ("fatia", "colher de sopa") e quanto ela pesa. */
  measure: string | null;
  measureG: number | null;
};

/** Quantidades comuns — evitam digitação no celular durante a refeição. */
const QUICK_GRAMS = [50, 100, 150, 200, 300];
const PORCOES = [0.5, 1, 1.5, 2, 3];
const LIMITE_RESULTADOS = 50;

const kcalFmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const gFmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 });
const porcaoFmt = (n: number) => (n === 0.5 ? "½" : n.toLocaleString("pt-BR"));
/** Número do catálogo, ou `null` quando ausente — dado que falta não vira zero. */
const opcional = (v: unknown) => {
  const n = num(v, Number.NaN);
  return Number.isNaN(n) ? null : n;
};

export function FoodPicker({
  trigger,
  title = "Adicionar alimento",
  confirmLabel = "Adicionar alimento",
  defaultGrams = 100,
  onPick,
  onPickRecipe,
  isPending,
}: {
  trigger: ReactNode;
  title?: string;
  confirmLabel?: string;
  defaultGrams?: number;
  /** Recebe o alimento e a quantidade em gramas. Deve fechar via retorno da promise. */
  onPick: (food: PickedFood, grams: number) => void | Promise<void>;
  /** Com esta função, o seletor ganha a aba Receitas. */
  onPickRecipe?: (recipe: RecipeSummary, portions: number) => void | Promise<void>;
  isPending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<"alimentos" | "receitas">("alimentos");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<FoodOption | null>(null);
  const [grams, setGrams] = useState(String(defaultGrams));
  const [receita, setReceita] = useState<RecipeSummary | null>(null);
  const [porcoes, setPorcoes] = useState(1);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const debouncedTerm = useDebouncedValue(term.trim(), 300);

  // Estado local zerado ao fechar: reabrir o diálogo deve começar limpo.
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
    // Enquanto a nova busca carrega, a lista anterior fica (esmaecida) em vez de piscar.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("foods")
        .select(
          "id, name, brand, serving_size_g, kcal, protein_g, carbs_g, fat_g, image_url, category, household_measure, household_grams",
        )
        .is("deleted_at", null)
        .order("name")
        .limit(LIMITE_RESULTADOS);
      for (const w of searchWords(debouncedTerm)) query = query.ilike("name", `%${w}%`);
      return unwrapList("buscar alimentos", await query).map((f): FoodOption => ({
        id: f.id,
        name: f.name,
        brand: f.brand,
        servingSizeG: num(f.serving_size_g, 100),
        kcal: num(f.kcal),
        proteinG: opcional(f.protein_g),
        carbsG: opcional(f.carbs_g),
        fatG: opcional(f.fat_g),
        imageUrl: f.image_url,
        category: f.category,
        measure: f.household_measure,
        measureG: opcional(f.household_grams) || null,
      }));
    },
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

  const gramsValue = Number(grams);
  const gramsInvalid = !Number.isFinite(gramsValue) || gramsValue <= 0 || gramsValue > 10_000;

  /**
   * Grava e fecha. `salvando` trava o botão já no primeiro toque — o duplo toque
   * não adiciona o alimento duas vezes. Se falhar, o diálogo fica aberto (quem
   * chamou mostra o erro) e a pessoa tenta de novo sem refazer a busca.
   */
  const gravar = async (acao: () => void | Promise<void>) => {
    if (salvando) return;
    setSalvando(true);
    try {
      await acao();
      setOpen(false);
    } catch {
      // O erro já foi exibido por quem chamou.
    } finally {
      setSalvando(false);
    }
  };

  const confirm = () => {
    if (!selected || gramsInvalid) return;
    void gravar(() => onPick(selected, gramsValue));
  };

  const confirmarReceita = () => {
    if (!receita || !onPickRecipe) return;
    void gravar(() => onPickRecipe(receita, porcoes));
  };

  const titulo = receita?.name ?? title;
  const lista = !selected && !receita;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <SearchDialogContent
        title={titulo}
        description={selected ? "Escolha a quantidade e confira os valores." : undefined}
        srDescription="Busque um alimento ou uma receita e escolha a quantidade."
        top={
          lista && (
            <>
              {onPickRecipe && (
                <div role="tablist" className="grid grid-cols-2 rounded-2xl bg-card p-1">
                  {(["alimentos", "receitas"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      role="tab"
                      aria-selected={aba === a}
                      onClick={() => setAba(a)}
                      className={cn(
                        "rounded-xl py-2.5 text-sm font-semibold transition-colors",
                        aba === a ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {a === "alimentos" ? "Alimentos" : "Receitas"}
                    </button>
                  ))}
                </div>
              )}
              <SearchField
                value={term}
                onChange={setTerm}
                placeholder={aba === "alimentos" ? "Buscar alimento pelo nome…" : "Buscar receita…"}
                loading={foods.isFetching || receitas.isFetching}
              />
              {aba === "receitas" && (
                <Select
                  value={categoria ?? "todas"}
                  onValueChange={(v) => setCategoria(v === "todas" ? null : v)}
                >
                  <SelectTrigger
                    aria-label="Categoria"
                    className={cn(
                      "h-11 w-full rounded-2xl border-transparent bg-card text-sm font-semibold",
                      categoria && "border-primary/50 text-primary",
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as categorias</SelectItem>
                    {RECIPE_CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.emoji} {c.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="minhas">Minhas receitas</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </>
          )
        }
      >
        {selected ? (
          <EscolherGramas
            food={selected}
            grams={grams}
            setGrams={setGrams}
            invalid={gramsInvalid}
            onBack={() => setSelected(null)}
            onConfirm={confirm}
            confirmLabel={confirmLabel}
            isPending={salvando || isPending}
          />
        ) : receita ? (
          <EscolherPorcoes
            receita={receita}
            porcoes={porcoes}
            setPorcoes={setPorcoes}
            onBack={() => setReceita(null)}
            onConfirm={confirmarReceita}
            isPending={salvando}
          />
        ) : aba === "alimentos" ? (
          // Lista vazia da busca anterior não serve de "nada encontrado" para a nova.
          foods.isPending || (foods.isPlaceholderData && foods.data.length === 0) ? (
            <ResultsLoading />
          ) : foods.isError ? (
            <ErrorState
              message="Não foi possível buscar os alimentos. Verifique a conexão e tente de novo."
              onRetry={foods.refetch}
              compact
            />
          ) : foods.data.length === 0 ? (
            <ResultsEmpty>
              {debouncedTerm ? (
                <>
                  Nenhum alimento encontrado para “{debouncedTerm}”.
                  <br />
                  Tente outro nome ou uma palavra mais curta.
                </>
              ) : (
                "Nenhum alimento no catálogo."
              )}
            </ResultsEmpty>
          ) : (
            <div
              className={cn(
                "transition-opacity",
                foods.isPlaceholderData && "pointer-events-none opacity-60",
              )}
            >
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {!debouncedTerm
                  ? "Catálogo de alimentos"
                  : foods.data.length >= LIMITE_RESULTADOS
                    ? `Primeiros ${LIMITE_RESULTADOS} resultados — refine a busca`
                    : `${foods.data.length} ${foods.data.length === 1 ? "resultado" : "resultados"}`}
              </p>
              <ResultList>
                {foods.data.map((f) => (
                  <li key={f.id}>
                    <ResultRow
                      thumb={<FoodThumb food={f} />}
                      title={f.name}
                      detail={
                        <>
                          <span className="font-semibold text-foreground">
                            {kcalFmt(f.kcal)} kcal
                          </span>{" "}
                          em {gFmt(f.servingSizeG)} g{f.brand ? ` · ${f.brand}` : ""}
                        </>
                      }
                      aside={<ChevronRight className="size-5 text-muted-foreground" aria-hidden />}
                      onClick={() => setSelected(f)}
                    >
                      <MacrosLinha food={f} />
                    </ResultRow>
                  </li>
                ))}
              </ResultList>
            </div>
          )
        ) : receitas.isPending ? (
          <ResultsLoading />
        ) : receitas.isError ? (
          <ErrorState message="Falha ao carregar receitas." onRetry={receitas.refetch} compact />
        ) : receitasFiltradas.length === 0 ? (
          <ResultsEmpty>Nenhuma receita encontrada.</ResultsEmpty>
        ) : (
          <ResultList>
            {receitasFiltradas.map((r) => (
              <li key={r.id}>
                <ResultRow
                  thumb={
                    r.imageUrl ? (
                      <img
                        src={r.imageUrl}
                        alt=""
                        loading="lazy"
                        width={112}
                        height={112}
                        className="size-14 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-elevated text-2xl">
                        {recipeCategoryOf(r.category)?.emoji ?? "🍽️"}
                      </span>
                    )
                  }
                  title={r.name}
                  detail={`${kcalFmt(r.perServing.kcal)} kcal · P ${Math.round(r.perServing.proteinG)} g${
                    r.prepMinutes ? ` · ${r.prepMinutes} min` : ""
                  }${!r.isSystem ? " · sua" : ""}`}
                  aside={<ChevronRight className="size-5 text-muted-foreground" aria-hidden />}
                  onClick={() => setReceita(r)}
                />
              </li>
            ))}
          </ResultList>
        )}
      </SearchDialogContent>
    </Dialog>
  );
}

/**
 * Foto do alimento quando o catálogo tem uma; senão, o símbolo da categoria —
 * um identificador neutro, que não finge ser foto do prato.
 */
function FoodThumb({ food, grande }: { food: FoodOption; grande?: boolean }) {
  const [quebrada, setQuebrada] = useState(false);
  const tamanho = grande ? "size-16 rounded-2xl text-3xl" : "size-12 rounded-xl text-xl";
  if (food.imageUrl && !quebrada) {
    return (
      <img
        src={food.imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setQuebrada(true)}
        className={cn("shrink-0 object-cover", tamanho)}
      />
    );
  }
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center bg-primary/10", tamanho)}>
      {CATEGORY_EMOJI[food.category ?? "other"] ?? CATEGORY_EMOJI.other}
    </span>
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
    <span className="mt-1.5 flex flex-wrap gap-1">
      {macros.map(([rotulo, v]) => (
        <span
          key={rotulo}
          className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
        >
          {rotulo} {gFmt(v)} g
        </span>
      ))}
    </span>
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
  isPending?: boolean;
}) {
  const valor = Number(grams);
  const fator = invalid ? 0 : valor / (food.servingSizeG || 100);
  const passo = (delta: number) =>
    setGrams(String(Math.min(10_000, Math.max(1, (invalid ? 0 : valor) + delta))));
  const atalhos = [
    ...(food.measure && food.measureG
      ? [{ g: food.measureG, rotulo: `1 ${food.measure} · ${gFmt(food.measureG)} g` }]
      : []),
    ...QUICK_GRAMS.map((g) => ({ g, rotulo: `${g} g` })),
  ];
  const valores: [string, number | null][] = [
    ["Proteína", food.proteinG],
    ["Carbo", food.carbsG],
    ["Gordura", food.fatG],
  ];

  return (
    <div className="flex min-h-full flex-col gap-5">
      {/* O alimento escolhido, em destaque. */}
      <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] p-3">
        <FoodThumb food={food} grande />
        <div className="min-w-0 flex-1">
          <p className="break-words font-bold leading-snug">{food.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {kcalFmt(food.kcal)} kcal em {gFmt(food.servingSizeG)} g
            {food.brand ? ` · ${food.brand}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
        >
          Trocar
        </button>
      </div>

      <div className="space-y-2.5">
        <Label htmlFor="food-grams">Quantidade</Label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => passo(-10)}
            disabled={invalid || valor <= 1}
            aria-label="Diminuir 10 g"
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-card transition-colors hover:bg-elevated disabled:opacity-40"
          >
            <Minus className="size-5" aria-hidden />
          </button>
          <div className="relative min-w-0 flex-1">
            <Input
              id="food-grams"
              type="number"
              inputMode="decimal"
              min={1}
              max={10000}
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirm();
              }}
              aria-invalid={invalid}
              aria-describedby={invalid ? "food-grams-error" : undefined}
              className="h-14 rounded-2xl pr-10 text-center text-2xl font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              autoFocus
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
              g
            </span>
          </div>
          <button
            type="button"
            onClick={() => passo(10)}
            disabled={!invalid && valor >= 10_000}
            aria-label="Aumentar 10 g"
            className="grid size-14 shrink-0 place-items-center rounded-2xl bg-card transition-colors hover:bg-elevated disabled:opacity-40"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
        {invalid && (
          <p id="food-grams-error" className="text-xs text-destructive">
            Informe um valor entre 1 e 10.000 g.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {atalhos.map((a) => (
            <button
              key={a.rotulo}
              type="button"
              onClick={() => setGrams(String(a.g))}
              aria-pressed={valor === a.g}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
                valor === a.g
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Os valores da quantidade escolhida. */}
      <div className="rounded-2xl bg-card p-4" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">Nesta quantidade</span>
          <span className="text-2xl font-extrabold tabular-nums text-primary">
            {invalid ? "—" : kcalFmt(food.kcal * fator)}
            <span className="ml-1 text-sm font-semibold">kcal</span>
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {valores.map(([rotulo, v]) => (
            <div key={rotulo} className="rounded-xl bg-background/60 px-1 py-2">
              <dt className="text-[11px] text-muted-foreground">{rotulo}</dt>
              <dd className="font-bold tabular-nums">
                {v === null || invalid ? "—" : `${gFmt(v * fator)} g`}
              </dd>
            </div>
          ))}
        </dl>
        {valores.some(([, v]) => v === null) && (
          <p className="mt-2 text-[11px] text-muted-foreground">— sem dado no catálogo</p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-6 mt-auto flex gap-2 border-t border-border/60 bg-background px-5 py-3">
        <Button variant="outline" className="h-12 rounded-xl" onClick={onBack}>
          <ArrowLeft className="mr-1 size-4" aria-hidden />
          Voltar
        </Button>
        <Button
          className="h-12 flex-1 rounded-xl text-base font-bold"
          onClick={onConfirm}
          disabled={invalid || isPending}
        >
          {isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="mr-1.5 size-4" aria-hidden />
          )}
          {confirmLabel}
        </Button>
      </div>
    </div>
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
  const fator = porcoes / receita.servings;
  const m = receita.perServing;
  const idx = PORCOES.indexOf(porcoes);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {recipeCategoryOf(receita.category)?.label ?? "Sua receita"} · rende {receita.servings}{" "}
        {receita.servings === 1 ? "porção" : "porções"}
        {receita.prepMinutes ? (
          <span className="inline-flex items-center gap-1">
            {" "}
            · <Clock className="size-3.5" aria-hidden /> {receita.prepMinutes} min
          </span>
        ) : null}
      </p>

      {/* Porções */}
      <div className="flex items-center justify-between rounded-2xl bg-card p-2">
        <button
          type="button"
          onClick={() => setPorcoes(PORCOES[Math.max(0, idx - 1)]!)}
          disabled={idx <= 0}
          aria-label="Menos"
          className="grid size-11 place-items-center rounded-xl bg-elevated disabled:opacity-40"
        >
          <Minus className="size-5" />
        </button>
        <p className="text-center">
          <span className="block text-2xl font-extrabold tabular-nums">{porcaoFmt(porcoes)}</span>
          <span className="text-xs text-muted-foreground">
            {porcoes <= 1 ? "porção" : "porções"}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setPorcoes(PORCOES[Math.min(PORCOES.length - 1, idx + 1)]!)}
          disabled={idx >= PORCOES.length - 1}
          aria-label="Mais"
          className="grid size-11 place-items-center rounded-xl bg-elevated disabled:opacity-40"
        >
          <Plus className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ["kcal", m.kcal * porcoes],
          ["Prot.", m.proteinG * porcoes],
          ["Carbo", m.carbsG * porcoes],
          ["Gord.", m.fatG * porcoes],
        ].map(([rotulo, valor]) => (
          <div key={rotulo as string} className="rounded-2xl bg-card px-1 py-2.5">
            <p className="font-bold tabular-nums">{Math.round(valor as number)}</p>
            <p className="text-[11px] text-muted-foreground">{rotulo}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Ingredientes</p>
        <ul className="divide-y divide-border/50 rounded-2xl bg-card">
          {receita.items.map((i) => (
            <li
              key={i.foodId + i.grams}
              className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span className="min-w-0 break-words">{i.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {Math.round(i.grams * fator)} g
              </span>
            </li>
          ))}
        </ul>
      </div>

      {receita.instructions && (
        <div>
          <p className="mb-1 text-sm font-semibold">Modo de preparo</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{receita.instructions}</p>
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 flex gap-2 bg-background px-5 pt-2">
        <Button variant="outline" className="h-12" onClick={onBack}>
          <ArrowLeft className="mr-1 size-4" />
          Voltar
        </Button>
        <Button className="h-12 flex-1" onClick={onConfirm} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Adicionar receita
        </Button>
      </div>
    </div>
  );
}
