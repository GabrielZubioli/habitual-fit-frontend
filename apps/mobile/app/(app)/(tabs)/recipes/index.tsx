import { useMemo, useState, type ReactNode } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { __iconNode as bookOpen } from "lucide-react/dist/esm/icons/book-open.js";
import { __iconNode as copy } from "lucide-react/dist/esm/icons/copy.js";
import { __iconNode as pencil } from "lucide-react/dist/esm/icons/pencil.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { __iconNode as search } from "lucide-react/dist/esm/icons/search.js";
import { __iconNode as trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
import { __iconNode as x } from "lucide-react/dist/esm/icons/x.js";
import { __iconNode as zap } from "lucide-react/dist/esm/icons/zap.js";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import {
  RECIPE_CATEGORIES,
  copyRecipe,
  createRecipe,
  deleteRecipe,
  fetchRecipes,
  recipeCategoryOf,
  type RecipeSummary,
} from "@forja/app-core/data/recipes";
import { cn } from "@/lib/cn";
import { useCurrentUserId } from "@/lib/session";
import { urlDoSite } from "@/lib/site";
import { comAlfa } from "@/lib/paleta-treino";
import { useColor } from "@/theme/theme";
import { Button } from "@/ui/button";
import { ErrorState } from "@/ui/card";
import { ConfirmDialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { MacroTiles } from "@/ui/macro-rings";
import { PageHeader, PageScroll } from "@/ui/page-header";
import { Text } from "@/ui/text";

/**
 * Receitas — o `recipes.tsx` do web: as prontas, por categoria, e as da
 * pessoa. As prontas abrem num detalhe e podem ser copiadas; as da pessoa se
 * editam.
 */
const kcal = (n: number) => Math.round(n).toLocaleString("pt-BR");

/** Tom de fundo de cada categoria: identifica a fileira sem depender de foto. */
const TOM: Record<string, "chart-1" | "chart-2" | "chart-4" | "chart-5"> = {
  vitaminas: "chart-5",
  "cafe-da-manha": "chart-4",
  sanduiches: "chart-2",
  pratos: "chart-1",
  saladas: "chart-1",
  lanches: "chart-4",
  "bolos-e-doces": "chart-5",
};

export default function RecipesPage() {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [aberta, setAberta] = useState<RecipeSummary | null>(null);
  const [excluindo, setExcluindo] = useState<RecipeSummary | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const branco = useColor("primary-foreground");
  const apagada = useColor("muted-foreground");
  const primaria = useColor("primary");
  const texto = useColor("foreground");

  const receitas = useQuery({
    queryKey: [...queryKeys.recipes.all, "com-prontas"],
    queryFn: fetchRecipes,
  });
  const invalidar = () => qc.invalidateQueries({ queryKey: queryKeys.recipes.all });
  const abrir = (id: string) => router.push({ pathname: "/recipes/[id]", params: { id } });
  const falhou = (e: unknown) => setErro(errorMessage(e));

  const criar = useMutation({
    mutationFn: () => createRecipe(userId),
    onSuccess: (id) => {
      void invalidar();
      abrir(id);
    },
    onError: falhou,
  });
  const copiar = useMutation({
    mutationFn: (r: RecipeSummary) => copyRecipe(userId, r),
    onSuccess: (id) => {
      setAberta(null);
      void invalidar();
      abrir(id);
    },
    onError: falhou,
  });
  const excluir = useMutation({
    mutationFn: (id: string) => deleteRecipe(id),
    onSuccess: () => void invalidar(),
    onError: falhou,
  });

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (receitas.data ?? []).filter(
      (r) =>
        (!t || r.name.toLowerCase().includes(t)) &&
        (!categoria || (categoria === "minhas" ? !r.isSystem : r.category === categoria)),
    );
  }, [receitas.data, busca, categoria]);
  const minhas = filtradas.filter((r) => !r.isSystem);
  const prontas = filtradas.filter((r) => r.isSystem);
  const emGrade = Boolean(busca.trim() || categoria);

  return (
    <View className="flex-1 bg-background">
      <PageScroll
        contentContainerClassName="pb-28"
        keyboardShouldPersistTaps="handled"
        header={
          <PageHeader
            title="Receitas"
            description={
              receitas.data
                ? `${receitas.data.filter((r) => r.isSystem).length} receitas prontas`
                : undefined
            }
            action={
              <Button
                onPress={() => criar.mutate()}
                loading={criar.isPending}
                className="rounded-full"
              >
                <Icon node={plus} color={branco} size={16} />
                <Text className="text-sm font-medium text-primary-foreground">Nova</Text>
              </Button>
            }
          />
        }
      >
        <View className="px-4">
          {erro ? (
            <Pressable
              onPress={() => setErro(null)}
              className="mb-3 rounded-xl bg-destructive-soft px-3.5 py-3"
            >
              <Text className="text-sm font-medium text-destructive">{erro}</Text>
            </Pressable>
          ) : null}
          <View className="h-12 justify-center">
            <TextInput
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar receita…"
              placeholderTextColor={apagada}
              accessibilityLabel="Buscar receita"
              className="h-12 rounded-2xl bg-card pl-12 pr-4 font-sans text-base"
              style={{ color: texto }}
            />
            <View pointerEvents="none" className="absolute left-4">
              <Icon node={search} color={apagada} size={20} />
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3 grow-0"
          contentContainerClassName="items-center gap-1.5 px-4 pb-1"
        >
          {[
            { key: null, label: "Todas" },
            ...RECIPE_CATEGORIES.map((c) => ({
              key: c.key as string,
              label: `${c.emoji} ${c.label}`,
            })),
            { key: "minhas", label: "Minhas" },
          ].map((c) => (
            <Pressable
              key={c.key ?? "todas"}
              accessibilityRole="radio"
              accessibilityState={{ checked: categoria === c.key }}
              onPress={() => setCategoria(c.key)}
              className={cn(
                "rounded-full px-3.5 py-2",
                categoria === c.key ? "bg-primary" : "bg-card",
              )}
            >
              <Text
                className={cn(
                  "text-sm font-semibold",
                  categoria === c.key ? "text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {receitas.isPending ? (
          <View className="mt-6 gap-3 px-4">
            {[0, 1, 2, 3].map((i) => (
              <View key={i} className="h-20 rounded-[20px] bg-muted" />
            ))}
          </View>
        ) : receitas.isError ? (
          <View className="px-4">
            <ErrorState
              message={errorMessage(receitas.error)}
              onRetry={() => void receitas.refetch()}
            />
          </View>
        ) : (
          <>
            {minhas.length > 0 ? (
              <View className="mt-6 px-4">
                <Text className="mb-3 px-1 text-lg font-semibold">Suas receitas</Text>
                <View className="gap-2">
                  {minhas.map((r) => (
                    <View
                      key={r.id}
                      className="flex-row items-center gap-2 rounded-[20px] bg-card p-2 pr-3"
                    >
                      <Pressable
                        onPress={() => abrir(r.id)}
                        className="min-w-0 flex-1 flex-row items-center gap-3 p-1"
                      >
                        <View className="h-12 w-12 items-center justify-center rounded-xl bg-elevated">
                          <Text className="text-2xl">
                            {recipeCategoryOf(r.category)?.emoji ?? "🍽️"}
                          </Text>
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text numberOfLines={2} className="font-semibold leading-snug">
                            {r.name}
                          </Text>
                          <Text className="mt-0.5 text-xs text-muted-foreground">
                            {kcal(r.perServing.kcal)} kcal · P {Math.round(r.perServing.proteinG)} g
                            por porção
                            {r.prepMinutes ? ` · ${r.prepMinutes} min` : ""}
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => abrir(r.id)}
                        accessibilityLabel={`Editar ${r.name}`}
                        className="h-9 w-9 items-center justify-center rounded-full active:bg-elevated"
                      >
                        <Icon node={pencil} color={apagada} size={16} />
                      </Pressable>
                      <Pressable
                        onPress={() => setExcluindo(r)}
                        accessibilityLabel={`Excluir receita ${r.name}`}
                        className="h-9 w-9 items-center justify-center rounded-full active:bg-elevated"
                      >
                        <Icon node={trash2} color={apagada} size={16} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Sem filtro: um destaque e cada categoria numa fileira que rola de lado. */}
            {!emGrade && prontas.length > 0 ? (
              <View className="mt-6">
                <Titulo
                  icone={<Icon node={zap} color={primaria} size={16} />}
                  texto="Mais proteína por caloria"
                />
                <Fileira>
                  {[...prontas]
                    .sort(
                      (a, b) =>
                        b.perServing.proteinG / Math.max(1, b.perServing.kcal) -
                        a.perServing.proteinG / Math.max(1, a.perServing.kcal),
                    )
                    .slice(0, 8)
                    .map((r) => (
                      <CartaoReceita key={r.id} r={r} onOpen={() => setAberta(r)} grande />
                    ))}
                </Fileira>
              </View>
            ) : null}

            {RECIPE_CATEGORIES.map((c) => {
              const daCategoria = prontas.filter((r) => r.category === c.key);
              if (daCategoria.length === 0) return null;
              return (
                <View key={c.key} className="mt-7">
                  <Titulo
                    icone={<Text>{c.emoji}</Text>}
                    texto={c.label}
                    contador={daCategoria.length}
                  />
                  {emGrade ? (
                    <View className="flex-row flex-wrap gap-2.5 px-4">
                      {daCategoria.map((r) => (
                        <CartaoReceita key={r.id} r={r} onOpen={() => setAberta(r)} grade />
                      ))}
                    </View>
                  ) : (
                    <Fileira>
                      {daCategoria.map((r) => (
                        <CartaoReceita key={r.id} r={r} onOpen={() => setAberta(r)} />
                      ))}
                    </Fileira>
                  )}
                </View>
              );
            })}

            {filtradas.length === 0 ? (
              <View className="mt-10 items-center">
                <Icon node={bookOpen} color={apagada} size={32} />
                <Text className="mt-2 text-muted-foreground">Nenhuma receita encontrada.</Text>
              </View>
            ) : null}
          </>
        )}
      </PageScroll>

      <DetalheReceita
        receita={aberta}
        onClose={() => setAberta(null)}
        onCopy={(r) => copiar.mutate(r)}
        copiando={copiar.isPending}
      />
      <ConfirmDialog
        open={excluindo !== null}
        onClose={() => setExcluindo(null)}
        title="Excluir esta receita?"
        description={`“${excluindo?.name ?? ""}” sai da lista. Lançamentos já feitos no diário não são afetados.`}
        confirmLabel="Excluir"
        destructive
        onConfirm={() => excluindo && excluir.mutate(excluindo.id)}
      />
    </View>
  );
}

function Titulo({
  icone,
  texto,
  contador,
}: {
  icone: ReactNode;
  texto: string;
  contador?: number;
}) {
  return (
    <View className="mb-3 flex-row items-center gap-2 px-5">
      {icone}
      <Text className="text-lg font-bold">{texto}</Text>
      {contador ? (
        <Text className="ml-auto text-sm font-medium text-muted-foreground">{contador}</Text>
      ) : null}
    </View>
  );
}

function Fileira({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="grow-0"
      contentContainerClassName="gap-2.5 px-4 pb-1"
    >
      {children}
    </ScrollView>
  );
}

function CartaoReceita({
  r,
  onOpen,
  grande = false,
  grade = false,
}: {
  r: RecipeSummary;
  onOpen: () => void;
  grande?: boolean;
  grade?: boolean;
}) {
  const tom = useColor(TOM[r.category ?? ""] ?? "chart-1");
  const [quebrada, setQuebrada] = useState(false);
  const altura = grande ? "h-28" : "h-24";
  return (
    <Pressable
      onPress={onOpen}
      className={cn(
        "overflow-hidden rounded-[20px] bg-card active:scale-[0.98]",
        grande ? "w-48" : grade ? "w-[48%]" : "w-40",
      )}
    >
      {r.imageUrl && !quebrada ? (
        <Image
          source={{ uri: urlDoSite(r.imageUrl) }}
          onError={() => setQuebrada(true)}
          className={cn("w-full bg-elevated", altura)}
        />
      ) : (
        <View
          className={cn("w-full items-center justify-center", altura)}
          style={{ backgroundColor: comAlfa(tom, 0.18) }}
        >
          <Text className={grande ? "text-6xl" : "text-5xl"}>
            {recipeCategoryOf(r.category)?.emoji ?? "🍽️"}
          </Text>
        </View>
      )}
      <View className="p-3">
        <Text numberOfLines={2} className="min-h-[40px] text-sm font-bold leading-tight">
          {r.name}
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-1">
          <View className="rounded-full bg-elevated px-2 py-0.5">
            <Text className="text-[11px] font-semibold">{kcal(r.perServing.kcal)} kcal</Text>
          </View>
          <View className="rounded-full bg-primary/10 px-2 py-0.5">
            <Text className="text-[11px] font-semibold text-primary">
              {Math.round(r.perServing.proteinG)} g P
            </Text>
          </View>
          {r.prepMinutes ? (
            <View className="rounded-full bg-elevated px-2 py-0.5">
              <Text className="text-[11px] font-semibold text-muted-foreground">
                {r.prepMinutes} min
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** O detalhe de uma receita pronta: macros, ingredientes, preparo e "copiar". */
function DetalheReceita({
  receita,
  onClose,
  onCopy,
  copiando,
}: {
  receita: RecipeSummary | null;
  onClose: () => void;
  onCopy: (r: RecipeSummary) => void;
  copiando: boolean;
}) {
  const texto = useColor("foreground");
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={receita !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* O fundo é irmão do cartão, não pai: um Pressable em volta da rolagem
          disputava o toque com ela e o conteúdo longo ficava preso. */}
      <View className="flex-1 items-center justify-center px-4">
        <Pressable
          onPress={onClose}
          accessibilityLabel="Fechar"
          className="absolute inset-0 bg-black/80"
        />
        {receita ? (
          <View
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-background"
            // Altura máxima em pixels: com porcentagem, a rolagem crescia junto
            // com o conteúdo em vez de caber no cartão.
            style={{ maxHeight: (height - insets.top - insets.bottom) * 0.9 }}
          >
            <ScrollView
              className="grow-0"
              contentContainerClassName="gap-5 pb-5"
              showsVerticalScrollIndicator
            >
              {receita.imageUrl ? (
                <Image
                  source={{ uri: urlDoSite(receita.imageUrl) }}
                  className="aspect-video w-full bg-elevated"
                />
              ) : null}
              <View className={cn("gap-1 px-5", receita.imageUrl ? "pt-1" : "pt-5")}>
                <Text className="pr-10 text-2xl font-extrabold leading-tight">
                  {receita.imageUrl ? "" : `${recipeCategoryOf(receita.category)?.emoji ?? ""} `}
                  {receita.name}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  Rende {receita.servings} {receita.servings === 1 ? "porção" : "porções"}
                  {receita.prepMinutes ? ` · ${receita.prepMinutes} min` : ""}
                </Text>
              </View>

              <View className="px-5">
                <Text className="mb-2 text-xs font-bold uppercase tracking-[1.5px] text-muted-foreground">
                  Por porção
                </Text>
                <MacroTiles
                  kcal={receita.perServing.kcal}
                  proteinG={receita.perServing.proteinG}
                  carbsG={receita.perServing.carbsG}
                  fatG={receita.perServing.fatG}
                />
              </View>

              <View className="px-5">
                <View className="mb-2 flex-row items-baseline justify-between">
                  <Text className="text-xs font-bold uppercase tracking-[1.5px] text-muted-foreground">
                    Ingredientes
                  </Text>
                  <Text className="text-xs text-muted-foreground">receita inteira</Text>
                </View>
                <View className="rounded-2xl bg-card px-4">
                  {receita.items.map((i, k) => (
                    <View
                      key={i.foodId + i.grams}
                      className={cn(
                        "flex-row items-center justify-between gap-3 py-3",
                        k > 0 && "border-t border-border/50",
                      )}
                    >
                      <Text className="min-w-0 flex-1 text-sm">{i.name}</Text>
                      <View className="rounded-full bg-elevated px-2.5 py-1">
                        <Text className="text-xs font-semibold tabular-nums">{i.grams} g</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {receita.instructions ? (
                <View className="px-5">
                  <Text className="mb-2 text-xs font-bold uppercase tracking-[1.5px] text-muted-foreground">
                    Modo de preparo
                  </Text>
                  <Text className="text-sm leading-relaxed">{receita.instructions}</Text>
                </View>
              ) : null}

              <View className="gap-3 px-5">
                <Text className="text-sm text-muted-foreground">
                  Para comer, use{" "}
                  <Text className="text-sm font-bold">Dieta → Adicionar → Receitas</Text> na
                  refeição.
                </Text>
                <Button
                  variant="outline"
                  className="h-12 w-full"
                  onPress={() => onCopy(receita)}
                  loading={copiando}
                >
                  <Icon node={copy} color={texto} size={16} />
                  <Text className="text-sm font-medium">Copiar para minhas receitas</Text>
                </Button>
              </View>
            </ScrollView>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Fechar"
              className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-black/45"
            >
              <Icon node={x} color="#fff" size={18} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
