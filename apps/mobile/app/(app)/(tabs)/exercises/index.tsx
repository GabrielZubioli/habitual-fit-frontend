import { useMemo, useState, type ReactElement } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { __iconNode as arrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { __iconNode as chevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import { __iconNode as chevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as heart } from "lucide-react/dist/esm/icons/heart.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { __iconNode as search } from "lucide-react/dist/esm/icons/search.js";
import { __iconNode as searchX } from "lucide-react/dist/esm/icons/search-x.js";
import { __iconNode as sparkles } from "lucide-react/dist/esm/icons/sparkles.js";
import { __iconNode as xIcon } from "lucide-react/dist/esm/icons/x.js";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { fetchActiveRoutine, type ActiveRoutine } from "@forja/app-core/data/routines";
import { addTemplateItem } from "@forja/app-core/data/workout-week";
import { useFavoritos } from "@forja/app-core/data/exercise-favorites";
import {
  EQUIPAMENTOS,
  ESTRUTURAS,
  GRUPOS,
  NIVEIS,
  PAGE_SIZE,
  fetchEquipmentCover,
  fetchExerciseCounts,
  fetchExercisePage,
  fetchFavoriteExercises,
  miniaturaDe,
  type ExerciseRow,
} from "@forja/app-core/data/exercise-library";
import { useDebouncedValue } from "@forja/app-core/hooks/use-debounced-value";
import { EQUIPMENT_LABELS, MUSCLE_LABELS, label } from "@forja/app-core/lib/labels";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { BodyMap } from "@/ui/body-map";
import { EmptyState, ErrorState } from "@/ui/card";
import { CreateExerciseDialog } from "@/ui/create-exercise-dialog";
import { MenuSheet } from "@/ui/dialog";
import { FavoriteButton } from "@/ui/favorite-button";
import { Icon } from "@/ui/icon";
import { HeaderFrame, HeaderSpacer, PageHeader, PageScroll } from "@/ui/page-header";
import { Text } from "@/ui/text";
import { LOCALE } from "@forja/app-core/i18n";
import { t } from "@forja/app-core/i18n";

/**
 * Exercícios — o `exercises.tsx` do web: busca, as abas Músculos /
 * Equipamentos / Favoritos e a tela filtrada de um grupo ou equipamento
 * (`?grupo=` / `?equipamento=`), com rolagem infinita.
 */
type Aba = "musculos" | "equipamentos" | "favoritos";

export default function ExerciseLibrary() {
  const params = useLocalSearchParams<{ aba?: string; grupo?: string; equipamento?: string }>();
  const aba: Aba =
    params.aba === "equipamentos" || params.aba === "favoritos" ? params.aba : "musculos";
  const [term, setTerm] = useState("");
  const termo = useDebouncedValue(term.trim(), 300);

  const rotina = useQuery({
    queryKey: queryKeys.workouts.activeRoutine(),
    queryFn: fetchActiveRoutine,
  });
  const contagem = useQuery({
    queryKey: [...queryKeys.exercises.all, "contagem"],
    queryFn: fetchExerciseCounts,
  });

  const g = GRUPOS.find((x) => x.key === params.grupo);
  const e = EQUIPAMENTOS.find((x) => x.key === params.equipamento);
  if (g || e) {
    return (
      <TelaFiltrada
        key={g?.key ?? e?.key}
        titulo={g ? g.nome : e!.nome}
        musculos={g ? [...g.musculos] : undefined}
        equipamento={e?.key}
        rotina={rotina.data ?? null}
      />
    );
  }

  const irPara = (a: Aba) => router.setParams({ aba: a === "musculos" ? undefined : a });

  const topo = (
    <PageHeader
      title={t("Exercícios")}
      description={
        contagem.data
          ? t("{{v0}} exercícios com demonstração", {
              v0: contagem.data.total.toLocaleString(LOCALE),
            })
          : undefined
      }
    />
  );
  const cabecalho = (
    <View className="px-4 pt-4">
      <Busca term={term} setTerm={setTerm} />
    </View>
  );

  if (termo) {
    return (
      <BuscaComFiltros
        termo={termo}
        rotina={rotina.data ?? null}
        topo={topo}
        cabecalho={cabecalho}
      />
    );
  }

  return (
    <PageScroll
      header={topo}
      className="flex-1 bg-background"
      contentContainerClassName="pb-28"
      keyboardShouldPersistTaps="handled"
    >
      {cabecalho}
      <View className="px-4">
        <View accessibilityRole="tablist" className="mt-4 flex-row rounded-2xl bg-card p-1">
          {(
            [
              ["musculos", t("Músculos")],
              ["equipamentos", t("Equipamentos")],
              ["favoritos", t("Favoritos")],
            ] as const
          ).map(([v, rotulo]) => (
            <Pressable
              key={v}
              accessibilityRole="tab"
              accessibilityState={{ selected: aba === v }}
              onPress={() => irPara(v)}
              className={cn("flex-1 items-center rounded-xl py-2.5", aba === v && "bg-primary")}
            >
              <Text
                className={cn(
                  "text-sm",
                  aba === v
                    ? "font-bold text-primary-foreground"
                    : "font-semibold text-muted-foreground",
                )}
              >
                {rotulo}
              </Text>
            </Pressable>
          ))}
        </View>
        <Animated.View key={aba} entering={FadeIn.duration(300)} className="mt-4">
          {aba === "musculos" ? <AbaMusculos porMusculo={contagem.data?.porMusculo} /> : null}
          {aba === "equipamentos" ? <AbaEquipamentos porEquip={contagem.data?.porEquip} /> : null}
          {aba === "favoritos" ? <AbaFavoritos rotina={rotina.data ?? null} /> : null}
        </Animated.View>
      </View>
    </PageScroll>
  );
}

function Busca({ term, setTerm }: { term: string; setTerm: (item2: string) => void }) {
  const apagada = useColor("muted-foreground");
  const texto = useColor("foreground");
  return (
    <View className="h-[52px] justify-center">
      <TextInput
        placeholder={t("Buscar exercício…")}
        placeholderTextColor={apagada}
        value={term}
        onChangeText={setTerm}
        accessibilityLabel={t("Buscar exercício")}
        returnKeyType="search"
        className="h-[52px] rounded-2xl bg-card pl-12 pr-10 font-sans text-base"
        style={{ color: texto }}
      />
      <View pointerEvents="none" className="absolute left-4">
        <Icon node={search} color={apagada} size={20} />
      </View>
      {term ? (
        <Pressable
          onPress={() => setTerm("")}
          accessibilityLabel={t("Limpar busca")}
          className="absolute right-3 rounded-full p-1"
        >
          <Icon node={xIcon} color={apagada} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Grupos musculares em cards, com o corpo destacando os músculos do grupo. */
function AbaMusculos({ porMusculo }: { porMusculo?: Map<string, number> }) {
  const [criando, setCriando] = useState(false);
  const primaria = useColor("primary");
  return (
    <>
      <View className="flex-row flex-wrap gap-2.5">
        {GRUPOS.map((g, i) => {
          const n = porMusculo
            ? g.musculos.reduce((s, m) => s + (porMusculo.get(m) ?? 0), 0)
            : null;
          return (
            <Animated.View
              key={g.key}
              entering={FadeInDown.delay(i * 30).duration(300)}
              className="w-[48.5%]"
            >
              <Pressable
                onPress={() => router.setParams({ grupo: g.key })}
                className="items-center rounded-[20px] bg-card p-3 active:scale-[0.98] active:bg-elevated"
              >
                <View
                  pointerEvents="none"
                  className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-elevated"
                >
                  <BodyMap
                    muscles={g.musculos.map((m) => ({ muscle: m, intensity: 1 }))}
                    showLegend={false}
                    showToggle={false}
                    recorte={"recorte" in g ? g.recorte : undefined}
                  />
                </View>
                <Text className="mt-2 text-center font-bold leading-tight">{g.nome}</Text>
                <Text className="text-xs text-muted-foreground">
                  {n === null ? "…" : `${n} ${n === 1 ? t("exercício") : t("exercícios")}`}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
      <Pressable
        onPress={() => setCriando(true)}
        className="mt-3 flex-row items-center gap-4 rounded-[20px] border border-dashed border-primary/40 p-3 active:bg-primary/5"
      >
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Icon node={sparkles} color={primaria} size={20} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-bold">{t("Criar seu exercício")}</Text>
          <Text className="text-sm text-muted-foreground">{t("Nome e músculo, sem animação")}</Text>
        </View>
        <Icon node={chevronRight} color={primaria} size={20} />
      </Pressable>
      <CreateExerciseDialog open={criando} onClose={() => setCriando(false)} />
    </>
  );
}

/** Equipamentos com a foto do exercício mais popular de cada um, filtrados pela estrutura. */
function AbaEquipamentos({ porEquip }: { porEquip?: Map<string, number> }) {
  const [estrutura, setEstrutura] = useState<(typeof ESTRUTURAS)[number]["key"]>("completa");
  const disponiveis = ESTRUTURAS.find((x) => x.key === estrutura)!
    .equipamentos as readonly string[];
  return (
    <>
      <View accessibilityRole="radiogroup" className="flex-row gap-1 rounded-2xl bg-card p-1">
        {ESTRUTURAS.map((x) => (
          <Pressable
            key={x.key}
            accessibilityRole="radio"
            accessibilityState={{ checked: estrutura === x.key }}
            onPress={() => setEstrutura(x.key)}
            className={cn(
              "flex-1 items-center rounded-xl px-1 py-2",
              estrutura === x.key && "bg-primary",
            )}
          >
            <Text
              className={cn(
                "text-center text-xs font-semibold leading-tight",
                estrutura === x.key ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {x.nome}
            </Text>
          </Pressable>
        ))}
      </View>
      <View className="mt-3 flex-row flex-wrap gap-2.5">
        {EQUIPAMENTOS.filter((e) => disponiveis.includes(e.key)).map((e, i) => (
          <Animated.View
            key={e.key}
            entering={FadeInDown.delay(i * 30).duration(300)}
            className="w-[48.5%]"
          >
            <CartaoEquipamento equipamento={e} n={porEquip?.get(e.key) ?? null} />
          </Animated.View>
        ))}
      </View>
    </>
  );
}

function CartaoEquipamento({
  equipamento,
  n,
}: {
  equipamento: (typeof EQUIPAMENTOS)[number];
  n: number | null;
}) {
  const apagada = useColor("muted-foreground");
  const capa = useQuery({
    queryKey: [...queryKeys.exercises.all, "capa", equipamento.key],
    staleTime: Infinity,
    queryFn: () => fetchEquipmentCover(equipamento.key),
  });
  return (
    <Pressable
      onPress={() => router.setParams({ equipamento: equipamento.key })}
      className="overflow-hidden rounded-[20px] bg-card active:scale-[0.98] active:bg-elevated"
    >
      <View className="aspect-[4/3] bg-white">
        {capa.data ? (
          <Image source={{ uri: capa.data }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center bg-elevated">
            <Icon node={dumbbell} color={apagada} size={32} />
          </View>
        )}
      </View>
      <View className="p-3">
        <Text className="font-bold leading-tight">{equipamento.nome}</Text>
        <Text className="text-xs text-muted-foreground">
          {n === null ? "…" : `${n} ${n === 1 ? t("exercício") : t("exercícios")}`}
        </Text>
      </View>
    </Pressable>
  );
}

function AbaFavoritos({ rotina }: { rotina: ActiveRoutine | null }) {
  const { ordem, carregando } = useFavoritos();
  const exercicios = useQuery({
    queryKey: [...queryKeys.exercises.all, "favoritos", ordem],
    enabled: ordem.length > 0,
    queryFn: () => fetchFavoriteExercises(ordem),
  });
  if (carregando || (ordem.length > 0 && exercicios.isPending)) return <CardsSkeleton count={3} />;
  if (ordem.length === 0) {
    return (
      <EmptyState
        icon={heart}
        title={t("Nenhum favorito ainda")}
        description={t("Toque no coração de um exercício para guardá-lo aqui.")}
      />
    );
  }
  return (
    <View className="gap-2.5">
      {(exercicios.data ?? []).map((ex) => (
        <ExerciseListRow key={ex.id} exercise={ex} rotina={rotina} />
      ))}
    </View>
  );
}

/** Tela de um grupo muscular ou de um equipamento: busca, filtros e a lista. */
function TelaFiltrada({
  titulo,
  musculos,
  equipamento,
  rotina,
}: {
  titulo: string;
  musculos?: string[];
  equipamento?: string;
  rotina: ActiveRoutine | null;
}) {
  const insets = useSafeAreaInsets();
  const texto = useColor("foreground");
  const [term, setTerm] = useState("");
  const termo = useDebouncedValue(term.trim(), 300);
  const [nivel, setNivel] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [grupo, setGrupo] = useState<string | null>(null);
  const musculosFiltro =
    musculos ?? (grupo ? [...GRUPOS.find((g) => g.key === grupo)!.musculos] : undefined);
  const equipFiltro = equipamento ? [equipamento] : equip ? [equip] : undefined;

  const topo = (
    <View className="px-4 pb-3" style={{ paddingTop: Math.max(24, insets.top + 8) }}>
      <View className="flex-row items-center gap-3 pt-2">
        {/* Nas abas, trocar o filtro não cria histórico: voltar é limpar o filtro. */}
        <Pressable
          onPress={() => router.setParams({ grupo: undefined, equipamento: undefined })}
          accessibilityLabel={t("Voltar")}
          className="h-11 w-11 items-center justify-center rounded-full bg-card active:bg-elevated"
        >
          <Icon node={arrowLeft} color={texto} size={20} />
        </Pressable>
        <Text numberOfLines={1} className="min-w-0 flex-1 text-2xl font-extrabold">
          {titulo}
        </Text>
      </View>
    </View>
  );
  const cabecalho = (
    <View className="px-4 pt-2">
      <Busca term={term} setTerm={setTerm} />
      <View className="mt-3 flex-row gap-2">
        <Seletor
          rotulo={t("Nível")}
          valor={nivel}
          onChange={setNivel}
          todos={t("Nível")}
          opcoes={NIVEIS}
        />
        {musculos ? (
          <Seletor
            rotulo={t("Equipamento")}
            valor={equip}
            onChange={setEquip}
            todos={t("Equipamento")}
            opcoes={EQUIPAMENTOS.map((e) => ({ value: e.key, label: e.nome }))}
          />
        ) : (
          <Seletor
            rotulo={t("Grupo muscular")}
            valor={grupo}
            onChange={setGrupo}
            todos={t("Músculo")}
            opcoes={GRUPOS.map((g) => ({ value: g.key, label: g.nome }))}
          />
        )}
      </View>
    </View>
  );

  return (
    <ListaExercicios
      topo={topo}
      cabecalho={cabecalho}
      termo={termo}
      musculos={musculosFiltro}
      equipamentos={equipFiltro}
      nivel={nivel}
      rotina={rotina}
    />
  );
}

/** Busca geral com filtros de nível e grupo muscular. */
function BuscaComFiltros({
  termo,
  rotina,
  topo,
  cabecalho,
}: {
  termo: string;
  rotina: ActiveRoutine | null;
  topo: ReactElement;
  cabecalho: ReactElement;
}) {
  const [nivel, setNivel] = useState<string | null>(null);
  const [grupo, setGrupo] = useState<string | null>(null);
  const musculos = grupo ? [...GRUPOS.find((g) => g.key === grupo)!.musculos] : undefined;
  return (
    <ListaExercicios
      topo={topo}
      cabecalho={
        <>
          {cabecalho}
          <View className="mt-3 flex-row gap-2 px-4">
            <Seletor
              rotulo={t("Nível")}
              valor={nivel}
              onChange={setNivel}
              todos={t("Nível")}
              opcoes={NIVEIS}
            />
            <Seletor
              rotulo={t("Grupo muscular")}
              valor={grupo}
              onChange={setGrupo}
              todos={t("Músculo")}
              opcoes={GRUPOS.map((g) => ({ value: g.key, label: g.nome }))}
            />
          </View>
        </>
      }
      termo={termo}
      musculos={musculos}
      nivel={nivel}
      rotina={rotina}
    />
  );
}

/** Lista paginada por rolagem (FlatList com `onEndReached`, o IntersectionObserver do web). */
function ListaExercicios({
  topo,
  cabecalho,
  termo,
  musculos,
  equipamentos,
  nivel,
  rotina,
}: {
  /** O cabeçalho fixo no topo; `cabecalho` rola com a lista. */
  topo: ReactElement;
  cabecalho: ReactElement;
  termo: string;
  musculos?: string[];
  equipamentos?: string[];
  nivel?: string | null;
  rotina: ActiveRoutine | null;
}) {
  const apagada = useColor("muted-foreground");
  const lista = useInfiniteQuery({
    queryKey: [
      ...queryKeys.exercises.all,
      "lista",
      termo,
      musculos ?? [],
      equipamentos ?? [],
      nivel ?? "",
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchExercisePage({ page: pageParam, termo, musculos, equipamentos, nivel }),
    getNextPageParam: (ultima, todas) => (ultima.length < PAGE_SIZE ? undefined : todas.length),
  });
  const exercicios = useMemo(() => lista.data?.pages.flat() ?? [], [lista.data]);

  let vazio: ReactElement | null = null;
  if (lista.isError) {
    vazio = <ErrorState message={errorMessage(lista.error)} onRetry={() => void lista.refetch()} />;
  } else if (lista.isPending) {
    vazio = <CardsSkeleton count={6} />;
  } else if (exercicios.length === 0) {
    vazio = (
      <EmptyState
        icon={searchX}
        title={t("Nenhum exercício encontrado")}
        description={
          termo
            ? t("Nada corresponde a “{{termo}}”. A busca também aceita o nome em inglês.", {
                termo,
              })
            : t("Nenhum exercício com esta combinação de filtros.")
        }
      />
    );
  }

  return (
    <HeaderFrame header={topo}>
      <FlatList
        className="flex-1 bg-background"
        data={vazio ? [] : exercicios}
        keyExtractor={(ex) => ex.id}
        ListHeaderComponent={
          <View className="pb-4">
            <HeaderSpacer />
            {cabecalho}
          </View>
        }
        ListEmptyComponent={vazio ? <View className="px-4">{vazio}</View> : null}
        renderItem={({ item }) => (
          <View className="px-4 pb-2.5">
            <ExerciseListRow exercise={item} rotina={rotina} />
          </View>
        )}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (lista.hasNextPage && !lista.isFetchingNextPage) void lista.fetchNextPage();
        }}
        ListFooterComponent={
          lista.isFetchingNextPage ? (
            <View className="flex-row items-center justify-center gap-2 py-6">
              <ActivityIndicator size="small" color={apagada} />
              <Text className="text-sm text-muted-foreground">{t("Carregando mais…")}</Text>
            </View>
          ) : null
        }
        contentContainerClassName="pb-28"
        keyboardShouldPersistTaps="handled"
      />
    </HeaderFrame>
  );
}

/** Uma linha: miniatura, nome, "músculo · equipamento", favorito e "+ Plano". */
function ExerciseListRow({
  exercise,
  rotina,
}: {
  exercise: ExerciseRow;
  rotina: ActiveRoutine | null;
}) {
  const qc = useQueryClient();
  const [menu, setMenu] = useState(false);
  const primaria = useColor("primary");
  const miniatura = miniaturaDe(exercise);
  const adicionar = useMutation({
    mutationFn: (item2: { id: string; exerciseCount: number }) =>
      addTemplateItem(item2.id, exercise.id, item2.exerciseCount + 1),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.workouts.all }),
  });

  return (
    <View className="flex-row items-center gap-3 rounded-[20px] bg-card p-3">
      <Pressable
        onPress={() => router.push({ pathname: "/exercises/[id]", params: { id: exercise.id } })}
        accessibilityLabel={t("Abrir {{name}}", { name: exercise.name })}
        className="min-w-0 flex-1 flex-row items-center gap-3.5"
      >
        <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white">
          {miniatura ? (
            <Image source={{ uri: miniatura }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Icon node={dumbbell} color="#a3a3a3" size={24} />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-semibold leading-snug">{exercise.name}</Text>
          <Text className="text-sm text-muted-foreground">
            {label(MUSCLE_LABELS, exercise.primary_muscle)} ·{" "}
            {label(EQUIPMENT_LABELS, exercise.equipment)}
            {exercise.owner_id ? " · seu" : ""}
          </Text>
        </View>
      </Pressable>
      <FavoriteButton exerciseId={exercise.id} nome={exercise.name} />
      {rotina && rotina.templates.length > 0 ? (
        <>
          <Pressable
            onPress={() => setMenu(true)}
            accessibilityLabel={t("Adicionar {{name}} a uma rotina", { name: exercise.name })}
            className="h-10 w-10 items-center justify-center rounded-full border border-primary/40 active:bg-primary/10"
          >
            <Icon node={plus} color={primaria} size={20} />
          </Pressable>
          <MenuSheet
            open={menu}
            onClose={() => setMenu(false)}
            title={t("Adicionar à rotina")}
            corIcone={primaria}
            opcoes={rotina.templates.map((item2) => ({
              label: item2.name.replace(/^[A-Z]\s*—\s*/, ""),
              onPress: () => adicionar.mutate(item2),
            }))}
          />
        </>
      ) : null}
    </View>
  );
}

/** Filtro compacto (o `Select` do web), abrindo as opções num painel. */
function Seletor({
  rotulo,
  todos,
  valor,
  onChange,
  opcoes,
}: {
  rotulo: string;
  todos: string;
  valor: string | null;
  onChange: (v: string | null) => void;
  opcoes: { value: string; label: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const primaria = useColor("primary");
  const texto = useColor("foreground");
  const atual = opcoes.find((o) => o.value === valor)?.label ?? todos;
  return (
    <>
      <Pressable
        onPress={() => setAberto(true)}
        accessibilityLabel={rotulo}
        className={cn(
          "h-11 min-w-0 flex-1 flex-row items-center justify-between rounded-2xl border bg-card px-3",
          valor ? "border-primary/50" : "border-transparent",
        )}
      >
        <Text
          numberOfLines={1}
          className={cn("flex-1 text-sm font-semibold", valor && "text-primary")}
        >
          {atual}
        </Text>
        <Icon node={chevronDown} color={valor ? primaria : texto} size={16} />
      </Pressable>
      <MenuSheet
        open={aberto}
        onClose={() => setAberto(false)}
        title={rotulo}
        corIcone={texto}
        opcoes={[
          { label: todos, onPress: () => onChange(null) },
          ...opcoes.map((o) => ({ label: o.label, onPress: () => onChange(o.value) })),
        ]}
      />
    </>
  );
}

function CardsSkeleton({ count }: { count: number }) {
  return (
    <View className="gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="h-[88px] w-full rounded-[20px] bg-muted" />
      ))}
    </View>
  );
}
