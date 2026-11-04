import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Clock,
  Copy,
  Languages,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import {
  RECIPE_CATEGORIES,
  copyRecipe,
  createRecipe,
  deleteRecipe,
  fetchRecipes,
  recipeCategoryOf,
  recipeLanguageBadge,
  type RecipeSummary,
} from "@forja/app-core/data/recipes";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { PageBody, PageHeader } from "@/components/page-header";
import { MACRO_COLORS } from "@/components/home/macro-rings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmButton } from "@/components/confirm-button";
import { ErrorState } from "@/components/query-boundary";
import { cn } from "@/lib/utils";
import { LOCALE } from "@forja/app-core/i18n";
import { t, tRich } from "@forja/app-core/i18n";
import { Badge } from "@/components/ui/badge";

/**
 * Receitas: as prontas do app, por categoria, e as da pessoa.
 *
 * As prontas não se editam (são de todos); abrem num detalhe com macros,
 * ingredientes e preparo, e podem ser copiadas para as da pessoa — que aí
 * edita à vontade. Na Dieta, as duas aparecem na aba Receitas do Adicionar.
 */
export const Route = createFileRoute("/_authenticated/recipes")({
  head: () => ({
    meta: [
      { title: t("Receitas — Habitual Fit") },
      { name: "description", content: t("Receitas prontas e suas, com macros por porção.") },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecipesPage,
});

const kcal = (n: number) => Math.round(n).toLocaleString(LOCALE);

function RecipesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const userId = useCurrentUserId();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [aberta, setAberta] = useState<RecipeSummary | null>(null);

  const receitas = useQuery({
    queryKey: [...queryKeys.recipes.all, "com-prontas"],
    queryFn: fetchRecipes,
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: queryKeys.recipes.all });

  const criar = useMutation({
    mutationFn: () => createRecipe(userId),
    onSuccess: (id) => {
      void invalidar();
      void navigate({ to: "/recipes/$id", params: { id } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const copiar = useMutation({
    mutationFn: (r: RecipeSummary) => copyRecipe(userId, r),
    onSuccess: (id) => {
      toast.success(t("Copiada para suas receitas"));
      void invalidar();
      void navigate({ to: "/recipes/$id", params: { id } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      await deleteRecipe(id);
      return id;
    },
    onSuccess: (id) => {
      void invalidar();
      toast.success(t("Receita excluída"), {
        action: {
          label: t("Desfazer"),
          onClick: () => void deleteRecipe(id, true).then(() => invalidar()),
        },
      });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const filtradas = useMemo(() => {
    const item = busca.trim().toLowerCase();
    return (receitas.data ?? []).filter(
      (r) =>
        (!item || r.name.toLowerCase().includes(item)) &&
        (!categoria || (categoria === "minhas" ? !r.isSystem : r.category === categoria)),
    );
  }, [receitas.data, busca, categoria]);

  const minhas = filtradas.filter((r) => !r.isSystem);
  const prontas = filtradas.filter((r) => r.isSystem);

  return (
    <>
      <PageHeader
        title={t("Receitas")}
        description={
          receitas.data
            ? t("{{length}} receitas prontas", {
                length: receitas.data.filter((r) => r.isSystem).length,
              })
            : undefined
        }
        action={
          <Button
            onClick={() => criar.mutate()}
            disabled={criar.isPending}
            className="rounded-full"
          >
            <Plus className="mr-1 size-4" />
            {t("Nova")}
          </Button>
        }
      />
      <PageBody>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("Buscar receita…")}
            className="h-12 rounded-2xl border-transparent bg-card pl-12"
            aria-label={t("Buscar receita")}
          />
        </div>
        <div
          className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
          role="radiogroup"
          aria-label={t("Categoria")}
        >
          {[
            { key: null, label: t("Todas") },
            ...RECIPE_CATEGORIES.map((c) => ({ key: c.key, label: `${c.emoji} ${c.label}` })),
            { key: "minhas", label: t("Minhas") },
          ].map((c) => (
            <button
              key={c.key ?? "todas"}
              type="button"
              role="radio"
              aria-checked={categoria === c.key}
              onClick={() => setCategoria(c.key)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                categoria === c.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {receitas.isPending ? (
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-[1.25rem]" />
            ))}
          </div>
        ) : receitas.isError ? (
          <ErrorState message={errorMessage(receitas.error)} onRetry={receitas.refetch} />
        ) : (
          <>
            {minhas.length > 0 && (
              <section className="mt-6" aria-label={t("Suas receitas")}>
                <h2 className="mb-3 px-1 text-lg font-semibold">{t("Suas receitas")}</h2>
                <ul className="space-y-2">
                  {minhas.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-2 rounded-[1.25rem] bg-card p-2 pr-3"
                    >
                      <Link
                        to="/recipes/$id"
                        params={{ id: r.id }}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1"
                      >
                        <Emoji categoria={r.category} />
                        <Linha r={r} />
                      </Link>
                      <Link
                        to="/recipes/$id"
                        params={{ id: r.id }}
                        aria-label={t("Editar {{name}}", { name: r.name })}
                        className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-elevated hover:text-foreground"
                      >
                        <Pencil className="size-4" />
                      </Link>
                      <ConfirmButton
                        aria-label={t("Excluir receita {{name}}", { name: r.name })}
                        title={t("Excluir esta receita?")}
                        description={t(
                          "“{{name}}” sai da lista. Lançamentos já feitos no diário não são afetados.",
                          { name: r.name },
                        )}
                        onConfirm={() => excluir.mutate(r.id)}
                      >
                        <Trash2 className="size-4" />
                      </ConfirmButton>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Sem filtro: um destaque e cada categoria numa fileira que rola de lado. */}
            {!busca.trim() && !categoria && prontas.length > 0 && (
              <section className="mt-6" aria-label={t("Mais proteína")}>
                <Titulo icone={<Zap className="size-4" />} texto={t("Mais proteína por caloria")} />
                <Fileira>
                  {[...prontas]
                    .sort(
                      (x, y) =>
                        y.perServing.proteinG / Math.max(1, y.perServing.kcal) -
                        x.perServing.proteinG / Math.max(1, x.perServing.kcal),
                    )
                    .slice(0, 8)
                    .map((r) => (
                      <CartaoReceita key={r.id} r={r} onOpen={() => setAberta(r)} grande />
                    ))}
                </Fileira>
              </section>
            )}

            {RECIPE_CATEGORIES.map((c) => {
              const daCategoria = prontas.filter((r) => r.category === c.key);
              if (daCategoria.length === 0) return null;
              const emGrade = Boolean(busca.trim() || categoria);
              return (
                <section key={c.key} className="mt-7" aria-label={c.label}>
                  <Titulo
                    icone={<span aria-hidden>{c.emoji}</span>}
                    texto={c.label}
                    contador={daCategoria.length}
                  />
                  {emGrade ? (
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {daCategoria.map((r) => (
                        <CartaoReceita key={r.id} r={r} onOpen={() => setAberta(r)} />
                      ))}
                    </div>
                  ) : (
                    <Fileira>
                      {daCategoria.map((r) => (
                        <CartaoReceita key={r.id} r={r} onOpen={() => setAberta(r)} />
                      ))}
                    </Fileira>
                  )}
                </section>
              );
            })}

            {filtradas.length === 0 && (
              <div className="mt-10 text-center text-muted-foreground">
                <BookOpen className="mx-auto size-8" aria-hidden />
                <p className="mt-2">{t("Nenhuma receita encontrada.")}</p>
              </div>
            )}
          </>
        )}
      </PageBody>

      <Dialog open={aberta !== null} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="flex max-h-[min(calc(88dvh-var(--teclado,0px)),44rem)] flex-col gap-0 overflow-hidden rounded-[1.5rem] p-0 sm:p-0">
          {aberta && (
            // Tudo rola junto, foto inclusive: numa tela baixa a foto e o título
            // fixos deixavam quase nada de espaço para a receita.
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
              {aberta.imageUrl && (
                <img
                  src={aberta.imageUrl}
                  alt=""
                  width={800}
                  height={600}
                  className="aspect-[16/9] w-full shrink-0 object-cover"
                />
              )}
              <DialogHeader className="space-y-1 px-5 pb-3 pt-5 text-left">
                <DialogTitle className="pr-8 text-xl leading-tight">
                  {aberta.imageUrl ? "" : `${recipeCategoryOf(aberta.category)?.emoji ?? ""} `}
                  {aberta.name}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-1">
                  {t("Rende {{servings}}", { servings: aberta.servings })}{" "}
                  {aberta.servings === 1 ? t("porção") : t("porções")}
                  {aberta.prepMinutes && (
                    <>
                      {" "}
                      · <Clock className="size-3.5" aria-hidden />{" "}
                      {t("{{prepMinutes}} min", { prepMinutes: aberta.prepMinutes })}
                    </>
                  )}
                  {recipeLanguageBadge(aberta) && (
                    <Badge variant="warning" className="ml-1 normal-case tracking-normal">
                      <Languages aria-hidden />
                      {recipeLanguageBadge(aberta)}
                    </Badge>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 px-5 pb-5">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("Por porção")}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        [t("Calorias"), aberta.perServing.kcal, "kcal", "var(--primary)"],
                        [t("Proteína"), aberta.perServing.proteinG, "g", MACRO_COLORS.protein],
                        [t("Carboidrato"), aberta.perServing.carbsG, "g", MACRO_COLORS.carbs],
                        [t("Gordura"), aberta.perServing.fatG, "g", MACRO_COLORS.fat],
                      ] as const
                    ).map(([rotulo, valor, unidade, cor]) => (
                      <div key={rotulo} className="rounded-2xl bg-card px-3.5 py-3">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: cor }}
                            aria-hidden
                          />
                          {rotulo}
                        </p>
                        <p className="mt-1 text-2xl font-extrabold tabular-nums">
                          {Math.round(valor)}
                          <span className="ml-1 text-sm font-semibold text-muted-foreground">
                            {unidade}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 flex items-baseline justify-between text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {t("Ingredientes")}
                    <span className="font-normal normal-case tracking-normal">
                      {t("receita inteira")}
                    </span>
                  </p>
                  <ul className="divide-y divide-border/50 rounded-2xl bg-card px-4">
                    {aberta.items.map((i) => (
                      <li
                        key={i.foodId + i.grams}
                        className="flex items-center justify-between gap-3 py-3 text-sm"
                      >
                        <span className="min-w-0 break-words">{i.name}</span>
                        <span className="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-xs font-semibold tabular-nums">
                          {t("{{grams}} g", { grams: i.grams })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {aberta.instructions && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      {t("Modo de preparo")}
                    </p>
                    <p className="text-sm leading-relaxed">{aberta.instructions}</p>
                  </div>
                )}
                {recipeLanguageBadge(aberta) && (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "Esta receita ainda não tem versão neste idioma e aparece no original, em português. Ingredientes, quantidades e macros não mudam.",
                    )}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  {tRich("Para comer, use <0>Dieta → Adicionar → Receitas</0> na refeição.", [
                    (s) => <b>{s}</b>,
                  ])}
                </p>
                <Button
                  variant="outline"
                  className="h-12 w-full"
                  onClick={() => copiar.mutate(aberta)}
                  disabled={copiar.isPending}
                >
                  {copiar.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Copy className="mr-2 size-4" />
                  )}
                  {t("Copiar para minhas receitas")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Emoji({ categoria }: { categoria: string | null }) {
  return (
    <span
      className="grid size-12 shrink-0 place-items-center rounded-xl bg-elevated text-2xl"
      aria-hidden
    >
      {recipeCategoryOf(categoria)?.emoji ?? "🍽️"}
    </span>
  );
}

function Linha({ r }: { r: RecipeSummary }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="line-clamp-2 break-words font-semibold leading-snug">{r.name}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
        {t("{{v0}} kcal · P {{v1}} g por porção", {
          v0: kcal(r.perServing.kcal),
          v1: Math.round(r.perServing.proteinG),
        })}
        {r.prepMinutes ? ` · ${r.prepMinutes} min` : ""}
      </span>
    </span>
  );
}

/** Tom de fundo de cada categoria: identifica a fileira sem depender de foto. */
const TOM: Record<string, string> = {
  vitaminas: "var(--chart-5)",
  "cafe-da-manha": "var(--chart-4)",
  sanduiches: "var(--chart-2)",
  pratos: "var(--chart-1)",
  saladas: "var(--chart-1)",
  lanches: "var(--chart-4)",
  "bolos-e-doces": "var(--chart-5)",
};

function Titulo({
  icone,
  texto,
  contador,
}: {
  icone: React.ReactNode;
  texto: string;
  contador?: number;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 px-1 text-lg font-bold">
      <span className="text-primary">{icone}</span>
      {texto}
      {contador ? (
        <span className="ml-auto text-sm font-medium text-muted-foreground">{contador}</span>
      ) : null}
    </h2>
  );
}

function Fileira({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none]">
      {children}
    </div>
  );
}

function CartaoReceita({
  r,
  onOpen,
  grande = false,
}: {
  r: RecipeSummary;
  onOpen: () => void;
  grande?: boolean;
}) {
  const tom = TOM[r.category ?? ""] ?? "var(--chart-1)";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex shrink-0 snap-start flex-col overflow-hidden rounded-[1.25rem] bg-card text-left transition-transform active:scale-[0.98]",
        grande ? "w-48" : "w-40 min-w-0 [.grid_&]:w-auto",
      )}
    >
      {r.imageUrl ? (
        <img
          src={r.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          width={400}
          height={300}
          className={cn("w-full bg-elevated object-cover", grande ? "h-28" : "h-24")}
        />
      ) : (
        <span
          className={cn(
            "grid w-full place-items-center",
            grande ? "h-28 text-6xl" : "h-24 text-5xl",
          )}
          style={{ background: `color-mix(in oklch, ${tom} 18%, transparent)` }}
          aria-hidden
        >
          {recipeCategoryOf(r.category)?.emoji ?? "🍽️"}
        </span>
      )}
      <span className="flex flex-1 flex-col p-3">
        <span className="line-clamp-2 min-h-[2.5rem] break-words text-sm font-bold leading-tight">
          {r.name}
        </span>
        <span className="mt-2 flex flex-wrap gap-1 text-[11px] font-semibold tabular-nums">
          <span className="rounded-full bg-elevated px-2 py-0.5">
            {t("{{v0}} kcal", { v0: kcal(r.perServing.kcal) })}
          </span>
          <span className="rounded-full bg-primary/12 px-2 py-0.5 text-primary">
            {t("{{v0}} g P", { v0: Math.round(r.perServing.proteinG) })}
          </span>
          {r.prepMinutes ? (
            <span className="rounded-full bg-elevated px-2 py-0.5 text-muted-foreground">
              {t("{{prepMinutes}} min", { prepMinutes: r.prepMinutes })}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
