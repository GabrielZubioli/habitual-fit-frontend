import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, startOfWeek } from "date-fns";
import { __iconNode as check } from "lucide-react/dist/esm/icons/check.js";
import { __iconNode as chevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import { __iconNode as copyPlus } from "lucide-react/dist/esm/icons/copy-plus.js";
import { __iconNode as minus } from "lucide-react/dist/esm/icons/minus.js";
import { __iconNode as moreVertical } from "lucide-react/dist/esm/icons/ellipsis-vertical.js";
import { __iconNode as pencil } from "lucide-react/dist/esm/icons/pencil.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { __iconNode as repeat } from "lucide-react/dist/esm/icons/repeat.js";
import { __iconNode as trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
import { nutritionTotals, portionMacros, type FoodCandidate } from "@forja/domain";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage, num } from "@forja/app-core/data/supabase-helpers";
import { fetchProfile } from "@forja/app-core/data/profile";
import {
  copyPreviousDay as copiarDiaAnterior,
  ensureDayMaterialized,
  entryCandidate,
  entryPortion,
  fetchDayEntries,
  fetchDayMealLabels,
  recordSubstitutionPreference,
  removeEntry,
  setConsumed,
  setDayMealLabel,
  setEntryGrams,
  setMealConsumed,
  substituteEntry,
  visibleSlots,
  type DayEntry,
} from "@forja/app-core/data/diet-day";
import { ensureActiveMealPlan, setMealLabel } from "@forja/app-core/data/meal-plans";
import { MEALS, MEAL_LABELS, label, type MealValue } from "@forja/app-core/lib/labels";
import { formatDate, fromISODate, toISODate, todayISO } from "@forja/app-core/lib/date";
import { CATEGORY_EMOJI } from "@forja/app-core/lib/food-emoji";
import { cn } from "@/lib/cn";
import { useCurrentUserId } from "@/lib/session";
import { useColor } from "@/theme/theme";
import { AvisoProfissional } from "@/ui/aviso-profissional";
import { Button } from "@/ui/button";
import { Card, ErrorState } from "@/ui/card";
import { DatePicker } from "@/ui/date-picker";
import { AlertDialog, Dialog, MenuSheet } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { CalorieRing, MACRO_COLORS, MacroRing } from "@/ui/macro-rings";
import { PageHeader } from "@/ui/page-header";
import { SubstituteFoodDialog } from "@/ui/substitute-food-dialog";
import { Text } from "@/ui/text";
import { WeeklyMenu } from "@/ui/weekly-menu";

/**
 * A dieta — o `diet.tsx` do web: o Diário (o plano executável do dia: marcar o
 * que comeu, trocar, ajustar) e o Cardápio da semana. Os anéis contam só o
 * consumido; o planejado aparece à parte, como referência.
 */
export default function DietPage() {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const hoje = todayISO();
  const [date, setDate] = useState(hoje);
  const [aba, setAba] = useState<"diario" | "cardapio">("diario");
  const [erro, setErro] = useState<string | null>(null);
  const falhou = (e: unknown) => setErro(errorMessage(e));

  const profile = useQuery({ queryKey: queryKeys.profile(), queryFn: fetchProfile });
  const plan = useQuery({
    queryKey: queryKeys.diet.activePlan(),
    queryFn: () => ensureActiveMealPlan(userId),
    enabled: Boolean(userId),
  });
  const entries = useQuery({
    queryKey: queryKeys.diet.log(date),
    // Só materializa depois de o plano existir: a ordem inversa gravaria um dia vazio.
    enabled: Boolean(userId) && !plan.isPending,
    queryFn: async () => {
      await ensureDayMaterialized(userId, date, hoje);
      return fetchDayEntries(date);
    },
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.diet.log(date) });

  const rows = entries.data ?? [];
  const totaisConsumidos = nutritionTotals(rows.filter((e) => e.consumed).map(entryPortion));
  const totaisPlanejados = nutritionTotals(rows.map(entryPortion));

  const remove = useMutation({
    mutationFn: removeEntry,
    onSuccess: () => void invalidate(),
    onError: falhou,
  });
  const copyPreviousDay = useMutation({
    mutationFn: () => copiarDiaAnterior(userId, date),
    onSuccess: () => void invalidate(),
    onError: falhou,
  });

  const slotsExibidos = visibleSlots(
    MEALS.map((m) => m.key),
    plan.data?.meals.map((m) => m.slot as MealValue) ?? [],
    rows.map((r) => r.slot as MealValue),
    num(profile.data?.meals_per_day),
  ) as MealValue[];

  const nomesDoDia = useQuery({
    queryKey: [...queryKeys.diet.log(date), "nomes"],
    enabled: entries.isSuccess,
    queryFn: () => fetchDayMealLabels(date),
  });
  const nomeDaSemana = (slot: MealValue) =>
    plan.data?.meals.find((m) => m.slot === slot)?.label?.trim() || label(MEAL_LABELS, slot);
  const nomeDe = (slot: MealValue) => nomesDoDia.data?.[slot]?.trim() || nomeDaSemana(slot);

  /** Renomear: a semana toda (o nome do plano) ou só este dia. Só o nome muda. */
  const renomear = useMutation({
    mutationFn: async ({
      slot,
      nome,
      escopo,
    }: {
      slot: MealValue;
      nome: string;
      escopo: "semana" | "dia";
    }) => {
      if (!plan.data) throw new Error("O plano alimentar ainda está carregando.");
      if (escopo === "dia") {
        await setDayMealLabel(date, slot, nome && nome !== nomeDaSemana(slot) ? nome : null);
        return;
      }
      await setMealLabel(
        plan.data.id,
        slot,
        nome,
        MEALS.findIndex((m) => m.key === slot),
      );
      if (nomesDoDia.data?.[slot]) await setDayMealLabel(date, slot, null);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.diet.activePlan() });
      void qc.invalidateQueries({ queryKey: [...queryKeys.diet.log(date), "nomes"] });
    },
    onError: falhou,
  });

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="pb-28"
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader
        title="Dieta"
        description={
          // Mesma altura nas duas abas: o cabeçalho não muda de tamanho ao trocar.
          aba === "cardapio" ? (
            <View className="h-8 justify-center">
              <Text className="text-base text-muted-foreground">Cardápio da semana</Text>
            </View>
          ) : (
            <View className="h-8 justify-center">
              <DatePicker
                simples
                value={date}
                onChange={setDate}
                accessibilityLabel="Data do diário"
              />
            </View>
          )
        }
        action={aba === "diario" ? <SemanaDias date={date} hoje={hoje} onChange={setDate} /> : null}
      />

      <View className="px-4">
        <View accessibilityRole="tablist" className="mb-6 flex-row rounded-full bg-card p-1">
          {(
            [
              ["diario", "Diário"],
              ["cardapio", "Cardápio da semana"],
            ] as const
          ).map(([v, rotulo]) => (
            <Pressable
              key={v}
              accessibilityRole="tab"
              accessibilityState={{ selected: aba === v }}
              onPress={() => setAba(v)}
              className={cn("flex-1 items-center rounded-full py-2.5", aba === v && "bg-primary")}
            >
              <Text
                className={cn(
                  "text-[15px]",
                  aba === v
                    ? "font-bold text-primary-foreground"
                    : "font-medium text-muted-foreground",
                )}
              >
                {rotulo}
              </Text>
            </Pressable>
          ))}
        </View>

        {erro ? (
          <Pressable
            onPress={() => setErro(null)}
            className="mb-4 rounded-xl bg-destructive-soft px-3.5 py-3"
          >
            <Text className="text-sm font-medium text-destructive">{erro}</Text>
          </Pressable>
        ) : null}

        {aba === "cardapio" ? (
          <WeeklyMenu onError={setErro} />
        ) : (
          <>
            {/* Resumo do dia: a caloria em destaque, os macros abaixo. */}
            <View className="mb-6">
              {entries.isPending || profile.isPending ? (
                <>
                  <View className="h-[230px] w-[230px] self-center rounded-full bg-muted" />
                  <View className="mt-6 flex-row gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} className="h-24 flex-1 rounded-xl bg-muted" />
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <View className="items-center">
                    <CalorieRing
                      consumed={totaisConsumidos.kcal}
                      target={num(profile.data?.daily_kcal_target)}
                      planejado={totaisPlanejados.kcal}
                      size={230}
                    />
                  </View>
                  <View className="mt-7 flex-row gap-2">
                    <MacroRing
                      nome="Proteína"
                      icone="🥩"
                      valor={totaisConsumidos.proteinG}
                      meta={num(profile.data?.protein_g_target)}
                      planejado={totaisPlanejados.proteinG}
                      cor={MACRO_COLORS.protein}
                    />
                    <MacroRing
                      nome="Carbo"
                      icone="🫘"
                      valor={totaisConsumidos.carbsG}
                      meta={num(profile.data?.carbs_g_target)}
                      planejado={totaisPlanejados.carbsG}
                      cor={MACRO_COLORS.carbs}
                    />
                    <MacroRing
                      nome="Gordura"
                      icone="🥑"
                      valor={totaisConsumidos.fatG}
                      meta={num(profile.data?.fat_g_target)}
                      planejado={totaisPlanejados.fatG}
                      cor={MACRO_COLORS.fat}
                    />
                    <MacroRing
                      nome="Fibra"
                      icone="🥦"
                      valor={totaisConsumidos.fiberG}
                      meta={num(profile.data?.fiber_g_target)}
                      planejado={totaisPlanejados.fiberG}
                      cor={MACRO_COLORS.fiber}
                    />
                  </View>
                  {rows.length > 0 && totaisPlanejados.kcal - totaisConsumidos.kcal > 50 ? (
                    <Text className="mt-5 text-center text-xs text-muted-foreground">
                      Planejado para o dia:{" "}
                      <Text className="text-xs font-semibold">
                        {Math.round(totaisPlanejados.kcal).toLocaleString("pt-BR")} kcal
                      </Text>{" "}
                      · P {Math.round(totaisPlanejados.proteinG)} g
                    </Text>
                  ) : null}
                </>
              )}
            </View>

            {rows.length === 0 && !entries.isPending && !entries.isError ? (
              <View className="mb-4 rounded-[20px] border border-dashed border-primary/40 bg-primary/5 p-5">
                <Text className="text-lg font-bold">Monte suas refeições</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Suas refeições estão vazias. Os alimentos de cada refeição são montados no{" "}
                  <Text className="text-sm font-bold">Cardápio da semana</Text> e aparecem aqui, no
                  dia, para você marcar o que comeu. Monte por conta própria ou siga a orientação do
                  seu nutricionista.
                </Text>
                <View className="mt-4 flex-row">
                  <Button className="h-11 rounded-xl" onPress={() => setAba("cardapio")}>
                    Abrir o Cardápio da semana
                  </Button>
                </View>
              </View>
            ) : null}

            {entries.isError ? (
              <ErrorState
                message={errorMessage(entries.error)}
                onRetry={() => void entries.refetch()}
              />
            ) : (
              <View className="gap-3">
                {slotsExibidos.map((slot) => (
                  <MealCard
                    key={slot}
                    slot={slot}
                    nome={nomeDe(slot)}
                    onRename={(nome, escopo) => renomear.mutateAsync({ slot, nome, escopo })}
                    diaHoje={date === hoje}
                    date={date}
                    items={rows.filter((r) => r.slot === slot)}
                    isPending={entries.isPending}
                    userId={userId}
                    onRemove={(id) => remove.mutate(id)}
                    onChanged={invalidate}
                    onError={falhou}
                  />
                ))}
              </View>
            )}

            {rows.length === 0 && !entries.isPending ? (
              <Button
                variant="outline"
                className="mt-4 w-full"
                onPress={() => copyPreviousDay.mutate()}
                loading={copyPreviousDay.isPending}
              >
                <CopiarIcone />
                <Text className="text-sm font-medium">Copiar o dia anterior</Text>
              </Button>
            ) : null}

            <AvisoProfissional tipos={["dieta"]} className="mt-6" />
          </>
        )}
      </View>
    </ScrollView>
  );
}

function CopiarIcone() {
  return <Icon node={copyPlus} color={useColor("foreground")} size={16} />;
}

/** Uma refeição. "Concluir refeição" marca tudo com um toque. */
function MealCard({
  slot,
  nome,
  onRename,
  diaHoje,
  date,
  items,
  isPending,
  userId,
  onRemove,
  onChanged,
  onError,
}: {
  slot: MealValue;
  nome: string;
  onRename: (nome: string, escopo: "semana" | "dia") => Promise<void>;
  diaHoje: boolean;
  date: string;
  items: DayEntry[];
  isPending: boolean;
  userId: string;
  onRemove: (id: string) => void;
  onChanged: () => void | Promise<unknown>;
  onError: (e: unknown) => void;
}) {
  const qc = useQueryClient();
  const primaria = useColor("primary");
  const texto = useColor("foreground");
  const totals = nutritionTotals(items.map(entryPortion));
  const todosConsumidos = items.length > 0 && items.every((i) => i.consumed);
  // Refeição concluída se fecha: some a lista, fica o resumo.
  const [aberta, setAberta] = useState(!todosConsumidos);
  useEffect(() => setAberta(!todosConsumidos), [todosConsumidos]);
  const fechada = items.length > 0 && !aberta;

  const toggleItem = useMutation({
    mutationFn: ({ id, consumed }: { id: string; consumed: boolean }) => setConsumed(id, consumed),
    onMutate: async ({ id, consumed }) => {
      await qc.cancelQueries({ queryKey: queryKeys.diet.log(date) });
      const anterior = qc.getQueryData<DayEntry[]>(queryKeys.diet.log(date));
      // Otimista: marcar um item é a ação mais repetida da tela.
      qc.setQueryData<DayEntry[]>(queryKeys.diet.log(date), (old) =>
        (old ?? []).map((e) => (e.id === id ? { ...e, consumed } : e)),
      );
      return { anterior };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(queryKeys.diet.log(date), ctx.anterior);
      onError(e);
    },
    onSettled: () => void onChanged(),
  });

  const concluirRefeicao = useMutation({
    mutationFn: (consumed: boolean) => setMealConsumed(date, slot, consumed),
    onSuccess: () => void onChanged(),
    onError,
  });

  const substituir = useMutation({
    mutationFn: async (p: { entry: DayEntry; foodId: string; grams: number }) => {
      await substituteEntry(p.entry.id, p.foodId, p.grams);
      await recordSubstitutionPreference(userId, p.entry.foodId, p.foodId);
    },
    onSuccess: () => void onChanged(),
    onError,
  });

  const ajustarQuantidade = useMutation({
    mutationFn: ({ id, grams }: { id: string; grams: number }) => setEntryGrams(id, grams),
    onSuccess: () => void onChanged(),
    onError,
  });

  return (
    <Card
      className={cn("rounded-3xl border border-border/60", todosConsumidos && "border-primary/40")}
    >
      <View className="p-4">
        <View className={cn("flex-row items-start justify-between gap-3", !fechada && "mb-3")}>
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text numberOfLines={1} className="shrink text-xl font-bold leading-tight">
                {nome}
              </Text>
              <RenomearRefeicao
                atual={nome}
                padrao={label(MEAL_LABELS, slot)}
                diaHoje={diaHoje}
                onSave={onRename}
              />
              {todosConsumidos ? <Icon node={check} color={primaria} size={16} /> : null}
            </View>
            {items.length > 0 ? (
              <View className="mt-1.5 flex-row items-center gap-2">
                <Text className="text-xs text-muted-foreground">
                  {items.length} {items.length === 1 ? "alimento" : "alimentos"}
                </Text>
                <View className="rounded-full bg-primary/15 px-2 py-0.5">
                  <Text className="text-xs font-bold text-primary">
                    {Math.round(totals.kcal)} kcal · P {Math.round(totals.proteinG)} g
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
          {items.length > 0 ? (
            <Pressable
              onPress={() => setAberta((v) => !v)}
              accessibilityState={{ expanded: aberta }}
              accessibilityLabel={aberta ? `Fechar ${nome}` : `Abrir ${nome}`}
              className="h-10 w-10 items-center justify-center rounded-full bg-primary/15 active:bg-primary/25"
            >
              <View style={{ transform: [{ rotate: aberta ? "180deg" : "0deg" }] }}>
                <Icon node={chevronDown} color={primaria} size={20} />
              </View>
            </Pressable>
          ) : null}
        </View>

        {fechada ? null : isPending ? (
          <View className="gap-2 py-1">
            <View className="h-10 w-full rounded-md bg-muted" />
            <View className="h-10 w-full rounded-md bg-muted" />
          </View>
        ) : items.length === 0 ? (
          <Text className="py-3 text-center text-sm text-muted-foreground">
            Refeição vazia — adicione alimentos no Cardápio da semana.
          </Text>
        ) : (
          <>
            <View className="gap-1 border-t border-border/60 pt-2">
              {items.map((item) => (
                <FoodRow
                  key={item.id}
                  item={item}
                  onToggle={(consumed) => toggleItem.mutate({ id: item.id, consumed })}
                  onRemove={() => onRemove(item.id)}
                  onSubstitute={(food, grams) =>
                    substituir.mutateAsync({ entry: item, foodId: food.id, grams })
                  }
                  onChangeGrams={(grams) => ajustarQuantidade.mutate({ id: item.id, grams })}
                />
              ))}
            </View>
            {!todosConsumidos ? (
              <Button
                variant="outline"
                className="mt-3 h-10 w-full rounded-xl"
                onPress={() => concluirRefeicao.mutate(true)}
                loading={concluirRefeicao.isPending}
              >
                <Icon node={check} color={texto} size={16} />
                <Text className="text-sm font-medium">Concluir refeição</Text>
              </Button>
            ) : null}
          </>
        )}
      </View>
    </Card>
  );
}

/** Ilustração do alimento: a foto quando houver; senão, o símbolo da categoria. */
function FoodThumb({ item }: { item: DayEntry }) {
  if (item.food.imageUrl) {
    return <Image source={{ uri: item.food.imageUrl }} className="h-11 w-11 rounded-full" />;
  }
  return (
    <View className="h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-elevated">
      <Text className="text-lg">
        {CATEGORY_EMOJI[item.food.category ?? "other"] ?? CATEGORY_EMOJI.other}
      </Text>
    </View>
  );
}

function FoodRow({
  item,
  onToggle,
  onRemove,
  onSubstitute,
  onChangeGrams,
}: {
  item: DayEntry;
  onToggle: (consumed: boolean) => void;
  onRemove: () => void;
  onSubstitute: (food: FoodCandidate, grams: number) => Promise<void>;
  onChangeGrams: (grams: number) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [menu, setMenu] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const apagada = useColor("muted-foreground");
  const primaria = useColor("primary");
  const branco = useColor("primary-foreground");
  const macros = portionMacros(entryPortion(item));
  const medida =
    item.food.measure && item.food.measureG
      ? `≈ ${(item.grams / item.food.measureG).toFixed(1).replace(".0", "")} × ${item.food.measure}`
      : null;

  return (
    <View className={cn("rounded-lg py-1.5", item.consumed && "opacity-60")}>
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => onToggle(!item.consumed)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.consumed }}
          accessibilityLabel={`Marcar ${item.name} como consumido`}
          hitSlop={8}
          className={cn(
            "h-5 w-5 items-center justify-center rounded border",
            item.consumed ? "border-primary bg-primary" : "border-primary/60",
          )}
        >
          {item.consumed ? <Icon node={check} color={branco} size={14} /> : null}
        </Pressable>

        <FoodThumb item={item} />

        <View className="min-w-0 flex-1">
          <Text
            numberOfLines={1}
            className={cn("text-[15px] font-semibold", item.consumed && "line-through")}
          >
            {item.name}
          </Text>
          <Text className="text-[13px] text-muted-foreground">
            {Math.round(macros.kcal)} kcal · P {macros.proteinG.toFixed(0)} g
          </Text>
          <Text className="text-[11px] text-muted-foreground">
            <Text
              onPress={() => setEditando((v) => !v)}
              accessibilityLabel={`Alterar a quantidade de ${item.name}`}
              className="text-[11px] font-medium underline"
            >
              {Math.round(item.grams)} g
            </Text>
            {medida ? ` (${medida})` : ""} · C {macros.carbsG.toFixed(0)} g · G{" "}
            {macros.fatG.toFixed(0)} g
          </Text>
        </View>

        <Pressable
          onPress={() => setMenu(true)}
          accessibilityLabel={`Opções de ${item.name}`}
          className="h-8 w-8 items-center justify-center rounded-md active:bg-accent"
        >
          <Icon node={moreVertical} color={apagada} size={16} />
        </Pressable>
      </View>

      {editando ? (
        <GramsEditor
          grams={item.grams}
          name={item.name}
          onCancel={() => setEditando(false)}
          onSave={(g) => {
            onChangeGrams(g);
            setEditando(false);
          }}
        />
      ) : null}

      <MenuSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={item.name}
        corIcone={primaria}
        opcoes={[
          { label: "Substituir", icon: repeat, onPress: () => setTrocando(true) },
          { label: "Alterar quantidade", icon: pencil, onPress: () => setEditando(true) },
          { label: "Remover", icon: trash2, destrutiva: true, onPress: onRemove },
        ]}
      />
      <SubstituteFoodDialog
        open={trocando}
        onClose={() => setTrocando(false)}
        food={entryCandidate(item)}
        grams={item.grams}
        onSubstitute={onSubstitute}
      />
    </View>
  );
}

/** Ajuste de quantidade, com passos de 10 g ao lado do campo. */
function GramsEditor({
  grams,
  name,
  onSave,
  onCancel,
}: {
  grams: number;
  name: string;
  onSave: (grams: number) => void;
  onCancel: () => void;
}) {
  const [valor, setValor] = useState(String(Math.round(grams)));
  const texto = useColor("foreground");
  const numero = Math.max(1, Math.round(Number(valor) || 0));
  return (
    <View className="mt-2 flex-row items-center gap-2 rounded-xl bg-muted/50 p-2">
      <Pressable
        onPress={() => setValor(String(Math.max(1, numero - 10)))}
        accessibilityLabel="Diminuir 10 gramas"
        className="h-9 w-9 items-center justify-center rounded-md border border-border bg-card"
      >
        <Icon node={minus} color={texto} size={16} />
      </Pressable>
      <TextInput
        value={valor}
        onChangeText={setValor}
        keyboardType="number-pad"
        autoFocus
        accessibilityLabel={`Quantidade de ${name} em gramas`}
        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-sans text-base"
        style={{ color: texto }}
      />
      <Pressable
        onPress={() => setValor(String(numero + 10))}
        accessibilityLabel="Aumentar 10 gramas"
        className="h-9 w-9 items-center justify-center rounded-md border border-border bg-card"
      >
        <Icon node={plus} color={texto} size={16} />
      </Pressable>
      <Button size="sm" className="h-9" onPress={() => onSave(numero)}>
        Salvar
      </Button>
      <Button size="sm" variant="ghost" className="h-9 px-2" onPress={onCancel}>
        Cancelar
      </Button>
    </View>
  );
}

/**
 * Lápis ao lado do nome da refeição. Primeiro o nome (vazio volta ao padrão);
 * depois, se mudou: a semana toda ou só este dia.
 */
function RenomearRefeicao({
  atual,
  padrao,
  diaHoje,
  onSave,
}: {
  atual: string;
  padrao: string;
  diaHoje: boolean;
  onSave: (nome: string, escopo: "semana" | "dia") => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [escopo, setEscopo] = useState(false);
  const [nome, setNome] = useState(atual);
  const apagada = useColor("muted-foreground");
  const texto = useColor("foreground");
  const novo = nome.trim() || padrao;

  const salvar = (qual: "semana" | "dia") =>
    void onSave(novo === padrao ? "" : novo, qual).catch(() => undefined);

  return (
    <>
      <Pressable
        onPress={() => {
          setNome(atual);
          setAberto(true);
        }}
        accessibilityLabel={`Renomear ${atual}`}
        className="h-7 w-7 items-center justify-center rounded-full active:bg-elevated"
      >
        <Icon node={pencil} color={apagada} size={14} />
      </Pressable>
      <Dialog open={aberto} onClose={() => setAberto(false)} title="Nome da refeição">
        <Text className="text-center text-sm text-muted-foreground">
          Deixe em branco para voltar a “{padrao}”.
        </Text>
        <TextInput
          autoFocus
          value={nome}
          maxLength={40}
          onChangeText={setNome}
          placeholder={padrao}
          accessibilityLabel="Nome da refeição"
          onSubmitEditing={() => {
            setAberto(false);
            if (novo !== atual) setEscopo(true);
          }}
          className="h-12 rounded-md border border-input bg-background px-3 font-sans text-lg"
          style={{ color: texto }}
        />
        <Button
          className="h-12 w-full"
          onPress={() => {
            setAberto(false);
            if (novo !== atual) setEscopo(true);
          }}
        >
          Continuar
        </Button>
      </Dialog>
      <AlertDialog
        open={escopo}
        onClose={() => setEscopo(false)}
        title={`Renomear para “${novo}”`}
        description="Deseja alterar o nome de todas as refeições correspondentes no cardápio da semana?"
        acoes={[
          { label: "Sim, alterar a semana toda", onPress: () => salvar("semana") },
          {
            label: diaHoje ? "Não, somente hoje" : "Não, somente neste dia",
            variant: "outline",
            onPress: () => salvar("dia"),
          },
        ]}
      />
    </>
  );
}

/** A semana do dia aberto, de segunda a domingo: trocar de dia com um toque. */
function SemanaDias({
  date,
  hoje,
  onChange,
}: {
  date: string;
  hoje: string;
  onChange: (iso: string) => void;
}) {
  const inicio = startOfWeek(fromISODate(date), { weekStartsOn: 1 });
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Dia da semana" className="flex-row">
      {Array.from({ length: 7 }, (_, i) => {
        const iso = toISODate(addDays(inicio, i));
        const ativo = iso === date;
        const cor = ativo
          ? "text-foreground"
          : iso === hoje
            ? "text-primary"
            : "text-muted-foreground";
        return (
          <Pressable
            key={iso}
            accessibilityRole="radio"
            accessibilityState={{ checked: ativo }}
            accessibilityLabel={`${formatDate(iso, "EEEE, d 'de' MMMM")}${iso === hoje ? ", hoje" : ""}`}
            onPress={() => onChange(iso)}
            className={cn(
              "w-8 items-center rounded-xl py-1.5",
              ativo && "border border-border bg-elevated",
            )}
          >
            <Text className={cn("text-[11px] font-semibold uppercase leading-tight", cor)}>
              {formatDate(iso, "EEEEE")}
            </Text>
            <Text className={cn("mt-1 text-[13px] font-bold leading-tight", cor)}>
              {iso.slice(8)}
            </Text>
            <Text className={cn("text-[10px] leading-tight", cor)}>
              {formatDate(iso, "MMM").replace(".", "")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
