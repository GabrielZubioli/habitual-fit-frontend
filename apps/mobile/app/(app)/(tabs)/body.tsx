import { useMemo, useState, type ReactNode } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays } from "date-fns";
import { __iconNode as activity } from "lucide-react/dist/esm/icons/activity.js";
import { __iconNode as chartLine } from "lucide-react/dist/esm/icons/chart-line.js";
import { __iconNode as flame } from "lucide-react/dist/esm/icons/flame.js";
import { __iconNode as ruler } from "lucide-react/dist/esm/icons/ruler.js";
import { __iconNode as scale } from "lucide-react/dist/esm/icons/scale.js";
import { __iconNode as target } from "lucide-react/dist/esm/icons/target.js";
import { __iconNode as trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
import { __iconNode as trendingDown } from "lucide-react/dist/esm/icons/trending-down.js";
import { __iconNode as trendingUp } from "lucide-react/dist/esm/icons/trending-up.js";
import { bmi, ema, goalProgress, navyBodyFat, weeklyRate } from "@forja/domain";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage, num } from "@forja/app-core/data/supabase-helpers";
import { fetchProfile } from "@forja/app-core/data/profile";
import {
  MEASURE_FIELDS,
  MEASURE_GROUPS,
  WEIGHT_RANGE,
  deleteMeasurement,
  fetchActiveGoals,
  fetchLatestMeasurement,
  fetchMeasurements,
  fetchWeighIns,
  measureInvalid,
  saveBodyWeight,
  saveMeasurements,
  type MeasureKey,
} from "@forja/app-core/data/body";
import { formatDayMonth, formatShortDate, todayISO } from "@forja/app-core/lib/date";
import { cn } from "@/lib/cn";
import { useCurrentUserId } from "@/lib/session";
import { useColor } from "@/theme/theme";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Sparkline, WeightChart } from "@/ui/charts";
import { DatePicker } from "@/ui/date-picker";
import { ConfirmDialog } from "@/ui/dialog";
import { Icon, type IconNode } from "@/ui/icon";
import { PageHeader, PageScroll } from "@/ui/page-header";
import { Text } from "@/ui/text";
import { LOCALE } from "@forja/app-core/i18n";
import { t } from "@forja/app-core/i18n";
import { Skeleton } from "@/ui/skeleton";

/**
 * Progresso corporal — o `body.tsx` do web: o Resumo (a leitura: "estou indo
 * bem?"), o Peso e as Medidas. As fotos estão desligadas no web
 * (`FOTOS_LIBERADAS`) e ficam fora aqui também.
 */
const HISTORY_DAYS = 180;
const WINDOW_DAYS = 30;
const VERDE = "#01D798";
const TINTA = "#020306";

export default function BodyPage() {
  const [aba, setAba] = useState<"overview" | "weight" | "measures">("overview");
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const avisar = (texto: string, erro = false) => setAviso({ texto, erro });

  return (
    <PageScroll
      header={
        <PageHeader
          title={t("Progresso")}
          description={t("Onde você está e para onde está indo.")}
        />
      }
      className="flex-1 bg-background"
      contentContainerClassName="pb-28"
      keyboardShouldPersistTaps="handled"
    >
      <View className="px-4">
        <View accessibilityRole="tablist" className="flex-row rounded-lg bg-muted p-1">
          {(
            [
              ["overview", t("Resumo"), chartLine],
              ["weight", t("Peso"), scale],
              ["measures", t("Medidas"), ruler],
            ] as const
          ).map(([v, rotulo, icone]) => (
            <Aba
              key={v}
              ativa={aba === v}
              rotulo={rotulo}
              icone={icone}
              onPress={() => setAba(v)}
            />
          ))}
        </View>

        {aviso ? (
          <Pressable
            onPress={() => setAviso(null)}
            className={cn(
              "mt-4 rounded-xl px-3.5 py-3",
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

        <View className="mt-4">
          {aba === "overview" ? <ProgressOverview /> : null}
          {aba === "weight" ? <WeightPanel avisar={avisar} /> : null}
          {aba === "measures" ? <MeasurementsPanel avisar={avisar} /> : null}
        </View>
      </View>
    </PageScroll>
  );
}

function Aba({
  ativa,
  rotulo,
  icone,
  onPress,
}: {
  ativa: boolean;
  rotulo: string;
  icone: IconNode;
  onPress: () => void;
}) {
  const cor = useColor(ativa ? "foreground" : "muted-foreground");
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: ativa }}
      onPress={onPress}
      className={cn(
        "flex-1 flex-row items-center justify-center gap-1 rounded-md py-1.5",
        ativa && "bg-background",
      )}
    >
      <Icon node={icone} color={cor} size={16} />
      <Text
        className={cn("text-sm font-medium", ativa ? "text-foreground" : "text-muted-foreground")}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

function Campo({
  rotulo,
  children,
  dica,
}: {
  rotulo: string;
  children: ReactNode;
  dica?: string | null;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium">{rotulo}</Text>
      {children}
      {dica ? <Text className="text-xs text-muted-foreground">{dica}</Text> : null}
    </View>
  );
}

function WeightPanel({ avisar }: { avisar: (item: string, erro?: boolean) => void }) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const texto = useColor("foreground");
  const apagada = useColor("muted-foreground");
  const [weight, setWeight] = useState("");
  const [logDate, setLogDate] = useState(todayISO());

  const weights = useQuery({
    queryKey: queryKeys.body.weights(HISTORY_DAYS),
    queryFn: () => fetchWeighIns(HISTORY_DAYS),
  });
  const value = Number(weight.replace(",", "."));
  const invalid =
    weight === "" ||
    !Number.isFinite(value) ||
    value < WEIGHT_RANGE.min ||
    value > WEIGHT_RANGE.max;

  const save = useMutation({
    mutationFn: () => saveBodyWeight(userId, logDate, value),
    onSuccess: () => {
      avisar(t("Peso registrado"));
      setWeight("");
      void qc.invalidateQueries({ queryKey: queryKeys.body.all });
    },
    onError: (e) => avisar(errorMessage(e), true),
  });

  const chart = useMemo(() => {
    const rows = weights.data ?? [];
    const smoothed = ema(
      rows.map((w) => w.kg),
      0.2,
    );
    return rows.map((w, i) => ({
      label: formatDayMonth(w.date),
      peso: w.kg,
      tendencia: Number((smoothed[i] ?? 0).toFixed(2)),
    }));
  }, [weights.data]);
  const ultimo = chart.at(-1);
  const anterior = chart.at(-2);
  const delta = ultimo && anterior ? ultimo.tendencia - anterior.tendencia : null;

  return (
    <View className="gap-4">
      <Card>
        <View className="gap-3 p-4">
          <Text className="text-base font-semibold">{t("Registrar peso")}</Text>
          {ultimo ? (
            <View className="overflow-hidden rounded-2xl p-4" style={{ backgroundColor: VERDE }}>
              <View className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/20" />
              <Text
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: `${TINTA}B3` }}
              >
                {t("Último registro")}
              </Text>
              <View className="mt-0.5 flex-row items-baseline gap-1.5">
                <Text className="text-4xl font-extrabold tracking-tight" style={{ color: TINTA }}>
                  {ultimo.peso.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}
                </Text>
                <Text className="text-sm font-semibold" style={{ color: `${TINTA}B3` }}>
                  {t("kg · {{label}}", { label: ultimo.label })}
                </Text>
              </View>
            </View>
          ) : null}
          <Campo rotulo={t("Data")}>
            <DatePicker value={logDate} max={todayISO()} onChange={setLogDate} />
          </Campo>
          <Campo
            rotulo={t("Peso (kg)")}
            dica={t("Registrar de novo no mesmo dia atualiza o valor.")}
          >
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder={t("Ex: 75,4")}
              placeholderTextColor={apagada}
              accessibilityLabel={t("Peso (kg)")}
              onSubmitEditing={() => !invalid && save.mutate()}
              className={cn(
                "h-10 rounded-md border bg-background px-3 font-sans text-base",
                weight !== "" && invalid ? "border-destructive" : "border-input",
              )}
              style={{ color: texto }}
            />
          </Campo>
          <Button
            className="w-full"
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={invalid}
          >
            {t("Adicionar peso")}
          </Button>
        </View>
      </Card>

      <Card className="border border-primary/25">
        <View className="p-4">
          <View className="mb-3 flex-row items-baseline justify-between gap-2">
            <Text className="text-base font-semibold">
              {t("Histórico — {{HISTORY_DAYS}} dias", { HISTORY_DAYS })}
            </Text>
            {delta !== null ? (
              <View className="rounded-full bg-primary/15 px-2.5 py-1">
                <Text className="text-xs font-bold text-primary">
                  {t("tendência")} {delta >= 0 ? "+" : ""}
                  {t("{{v0}} kg", { v0: delta.toFixed(2) })}
                </Text>
              </View>
            ) : null}
          </View>
          {weights.isPending ? (
            <Skeleton className="h-72 rounded-md" />
          ) : chart.length === 0 ? (
            <View className="h-72 items-center justify-center">
              <Text className="text-sm text-muted-foreground">
                {t("Registre seu primeiro peso para ver a tendência.")}
              </Text>
            </View>
          ) : (
            <WeightChart data={chart} height={288} showDots />
          )}
        </View>
      </Card>
    </View>
  );
}

function MeasurementsPanel({ avisar }: { avisar: (item: string, erro?: boolean) => void }) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const texto = useColor("foreground");
  const apagada = useColor("muted-foreground");
  const [logDate, setLogDate] = useState(todayISO());
  const [values, setValues] = useState<Partial<Record<MeasureKey, string>>>({});
  const [excluindo, setExcluindo] = useState<{ id: string; date: string } | null>(null);

  const measurements = useQuery({
    queryKey: queryKeys.body.measurements(),
    queryFn: () => fetchMeasurements(HISTORY_DAYS),
  });
  const preenchidos = MEASURE_FIELDS.filter((f) => (values[f.key] ?? "") !== "");
  const invalidos = preenchidos.filter((f) => measureInvalid(f.key, values[f.key] ?? ""));

  const save = useMutation({
    mutationFn: () => saveMeasurements(userId, logDate, values),
    onSuccess: () => {
      avisar(t("Medidas registradas"));
      setValues({});
      void qc.invalidateQueries({ queryKey: queryKeys.body.measurements() });
    },
    onError: (e) => avisar(errorMessage(e), true),
  });
  const remove = useMutation({
    mutationFn: deleteMeasurement,
    onSuccess: () => {
      avisar(t("Registro excluído"));
      void qc.invalidateQueries({ queryKey: queryKeys.body.measurements() });
    },
    onError: (e) => avisar(errorMessage(e), true),
  });

  const linhas = (measurements.data ?? []) as Record<string, unknown>[];
  const seriesFor = (key: MeasureKey) =>
    linhas.filter((m) => m[key] != null).map((m) => num(m[key]));

  return (
    <View className="gap-4">
      <Card>
        <View className="gap-3 p-4">
          <Text className="text-base font-semibold">{t("Registrar medidas")}</Text>
          <Campo rotulo={t("Data")}>
            <DatePicker value={logDate} max={todayISO()} onChange={setLogDate} />
          </Campo>
          {/* Agrupado por região: dá para preencher só o bloco que interessa. */}
          {MEASURE_GROUPS.map((grupo) => (
            <View key={grupo} className="gap-3">
              <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {grupo}
              </Text>
              {MEASURE_FIELDS.filter((f) => f.grupo === grupo).map((f) => {
                const raw = values[f.key] ?? "";
                const bad = measureInvalid(f.key, raw);
                return (
                  <Campo
                    key={f.key}
                    rotulo={`${f.label} (${f.unit})`}
                    dica={
                      bad
                        ? t("Esperado entre {{min}} e {{max}} {{unit}}.", {
                            min: f.min,
                            max: f.max,
                            unit: f.unit,
                          })
                        : null
                    }
                  >
                    <TextInput
                      value={raw}
                      onChangeText={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                      keyboardType="decimal-pad"
                      accessibilityLabel={`${f.label} (${f.unit})`}
                      placeholderTextColor={apagada}
                      className={cn(
                        "h-10 rounded-md border bg-background px-3 font-sans text-base",
                        bad ? "border-destructive" : "border-input",
                      )}
                      style={{ color: texto }}
                    />
                  </Campo>
                );
              })}
            </View>
          ))}
          <Button
            className="w-full"
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={preenchidos.length === 0 || invalidos.length > 0}
          >
            {t("Salvar")}
          </Button>
          <Text className="text-xs text-muted-foreground">
            {t("Preencha só o que quiser acompanhar.")}
          </Text>
        </View>
      </Card>

      <Card>
        <View className="p-4">
          <Text className="mb-3 text-base font-semibold">{t("Tendências")}</Text>
          {measurements.isPending ? (
            <View className="gap-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </View>
          ) : linhas.length === 0 ? (
            <Text className="py-8 text-center text-sm text-muted-foreground">
              {t("Registre suas medidas para ver a evolução.")}
            </Text>
          ) : (
            <View className="gap-3">
              {MEASURE_FIELDS.map((f) => {
                const data = seriesFor(f.key);
                if (data.length === 0) return null;
                const atual = data.at(-1) ?? 0;
                const diff = atual - (data[0] ?? atual);
                return (
                  <View key={f.key} className="rounded-lg border border-border p-3">
                    <Text className="text-xs font-medium text-muted-foreground">{f.label}</Text>
                    <View className="mb-2 flex-row items-baseline gap-2">
                      <Text className="text-lg font-semibold">
                        {atual} {f.unit}
                      </Text>
                      {data.length > 1 ? (
                        <Text className="text-xs text-muted-foreground">
                          {diff >= 0 ? "+" : ""}
                          {diff.toFixed(1)} {f.unit}
                        </Text>
                      ) : null}
                    </View>
                    <Sparkline values={data} height={64} />
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </Card>

      <Card>
        <Text className="px-4 pb-2 pt-4 text-base font-semibold">{t("Histórico")}</Text>
        {measurements.isPending ? (
          <View className="gap-2 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 rounded-md" />
            ))}
          </View>
        ) : linhas.length === 0 ? (
          <Text className="py-8 text-center text-sm text-muted-foreground">
            {t("Sem registros.")}
          </Text>
        ) : (
          [...linhas].reverse().map((m, i) => {
            const resumo = MEASURE_FIELDS.filter((f) => m[f.key] != null)
              .map((f) => `${f.label} ${String(m[f.key])}${f.unit}`)
              .join(" · ");
            const data = String(m.log_date);
            return (
              <View
                key={String(m.id)}
                className={cn(
                  "flex-row items-center justify-between gap-3 px-4 py-3",
                  i > 0 && "border-t border-border",
                )}
              >
                <View className="min-w-0 flex-1">
                  <Text className="font-medium">{formatShortDate(data)}</Text>
                  <Text className="text-xs text-muted-foreground">{resumo || "—"}</Text>
                </View>
                <Pressable
                  onPress={() => setExcluindo({ id: String(m.id), date: data })}
                  accessibilityLabel={t("Excluir medidas de {{v0}}", { v0: formatShortDate(data) })}
                  className="h-9 w-9 items-center justify-center rounded-full active:bg-elevated"
                >
                  <Icon node={trash2} color={apagada} size={16} />
                </Pressable>
              </View>
            );
          })
        )}
      </Card>

      <ConfirmDialog
        open={excluindo !== null}
        onClose={() => setExcluindo(null)}
        title={t("Excluir este registro?")}
        description={t("As medidas desta data são removidas permanentemente.")}
        confirmLabel={t("Excluir")}
        destructive
        onConfirm={() => excluindo && remove.mutate(excluindo.id)}
      />
    </View>
  );
}

const BMI_LABELS: Record<string, string> = {
  underweight: t("Abaixo do peso"),
  normal: t("Faixa saudável"),
  overweight: t("Acima do peso"),
  obese_1: t("Obesidade grau I"),
  obese_2: t("Obesidade grau II"),
  obese_3: t("Obesidade grau III"),
};

/** O Resumo — o `progress/progress-overview.tsx` do web. */
function ProgressOverview() {
  const primaria = useColor("primary");
  const branco = useColor("primary-foreground");
  const profile = useQuery({ queryKey: queryKeys.profile(), queryFn: fetchProfile });
  const weights = useQuery({
    queryKey: queryKeys.body.weights(WINDOW_DAYS),
    queryFn: () => fetchWeighIns(WINDOW_DAYS),
  });
  const measurement = useQuery({
    queryKey: [...queryKeys.body.measurements(), "latest"],
    queryFn: fetchLatestMeasurement,
  });
  const goals = useQuery({ queryKey: queryKeys.goals.list(), queryFn: fetchActiveGoals });

  if (profile.isPending || weights.isPending) {
    return (
      <View className="gap-4">
        <View className="flex-row flex-wrap gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-[48%] rounded-xl" />
          ))}
        </View>
        <Skeleton className="h-32 rounded-xl" />
      </View>
    );
  }

  const serie = (weights.data ?? []).map((w) => ({ date: w.date, weightKg: w.kg }));
  const pesoAtual = serie.at(-1)?.weightKg;
  const alturaCm = num(profile.data?.height_cm);
  const metaPeso = profile.data?.goal_weight_kg ? num(profile.data.goal_weight_kg) : null;
  const imc = pesoAtual && alturaCm ? bmi(pesoAtual, alturaCm) : null;
  const primeiraData = serie[0]?.date;
  const ritmo = primeiraData
    ? weeklyRate(
        serie.map((p) => ({
          dayIndex: differenceInCalendarDays(
            new Date(`${p.date}T12:00:00`),
            new Date(`${primeiraData}T12:00:00`),
          ),
          weightKg: p.weightKg,
        })),
      )
    : null;
  const medida = measurement.data;
  const gorduraEstimada =
    medida && alturaCm && medida.waist_cm && medida.neck_cm
      ? navyBodyFat({
          sex: (profile.data?.sex ?? "other") as "male" | "female" | "other",
          heightCm: alturaCm,
          neckCm: num(medida.neck_cm),
          waistCm: num(medida.waist_cm),
          ...(medida.hip_cm ? { hipCm: num(medida.hip_cm) } : {}),
        })
      : null;
  // A medida registrada à mão tem prioridade sobre a estimada.
  const gordura = medida?.body_fat_pct ? num(medida.body_fat_pct) : gorduraEstimada;
  const gorduraEhEstimativa = !medida?.body_fat_pct && gorduraEstimada !== null;
  const outrasMetas = (goals.data ?? []).filter((g) => g.metric_key !== "body_weight");

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-3">
        <StatCard
          icon={scale}
          label={t("Peso atual")}
          destaque
          value={pesoAtual !== undefined ? `${pesoAtual.toFixed(1)}` : "—"}
          unit="kg"
        />
        <StatCard
          icon={ritmo !== null && ritmo < 0 ? trendingDown : trendingUp}
          label={t("Ritmo")}
          value={ritmo !== null ? `${ritmo > 0 ? "+" : ""}${ritmo.toFixed(2)}` : "—"}
          unit="kg/sem"
          hint={ritmo === null ? t("4 pesagens") : undefined}
        />
        <StatCard
          icon={activity}
          label="IMC"
          value={imc ? String(imc.bmi) : "—"}
          hint={imc ? BMI_LABELS[imc.category] : t("informe a altura")}
        />
        <StatCard
          icon={flame}
          label={t("Gordura")}
          value={gordura !== null ? gordura.toFixed(1) : "—"}
          unit="%"
          hint={
            gordura === null
              ? t("meça cintura e pescoço")
              : gorduraEhEstimativa
                ? "estimativa"
                : "medido"
          }
        />
      </View>

      {imc ? (
        <Text className="px-1 text-xs leading-relaxed text-muted-foreground">
          {t(
            "O IMC não distingue músculo de gordura — quem treina há anos costuma aparecer acima da faixa mesmo com pouca gordura. As medidas de circunferência dizem mais sobre a sua composição do que o peso sozinho.",
          )}
        </Text>
      ) : null}
      {gorduraEhEstimativa ? (
        <Text className="px-1 text-xs leading-relaxed text-muted-foreground">
          O percentual de gordura é estimado a partir das circunferências, com margem de 3 a 4
          pontos. Medido sempre do mesmo jeito, o erro é constante — então a{" "}
          <Text className="text-xs italic">{t("variação")}</Text> é confiável mesmo que o valor
          absoluto não seja.
        </Text>
      ) : null}

      {metaPeso !== null && pesoAtual !== undefined && serie[0] ? (
        <GoalCard
          label={metaPeso < pesoAtual ? t("Chegar ao peso desejado") : t("Ganhar até a meta")}
          start={serie[0].weightKg}
          current={pesoAtual}
          target={metaPeso}
          unit="kg"
          rate={ritmo}
        />
      ) : null}

      {outrasMetas.length > 0 ? (
        <View>
          <View className="mb-2 flex-row items-center gap-1.5 px-1">
            <Icon node={target} color={primaria} size={14} />
            <Text className="text-xs font-bold uppercase tracking-wider text-primary">
              {t("Suas metas")}
            </Text>
          </View>
          <Card>
            {outrasMetas.map((g, i) => (
              <View
                key={g.id}
                className={cn(
                  "flex-row items-center justify-between gap-3 px-4 py-3",
                  i > 0 && "border-t border-border",
                )}
              >
                <Text numberOfLines={1} className="min-w-0 flex-1 text-sm">
                  {g.label}
                </Text>
                <View className="rounded-full bg-primary/15 px-2.5 py-0.5">
                  <Text className="text-sm font-bold text-primary">
                    {num(g.target_value)} {g.unit}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {!medida ? (
        <Card className="border border-dashed border-primary/35">
          <View className="items-center p-4">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary">
              <Icon node={ruler} color={branco} size={20} />
            </View>
            <Text className="mt-2 text-sm font-medium">{t("Registre suas medidas")}</Text>
            <Text className="mt-1 text-center text-xs text-muted-foreground">
              {t(
                "Cintura e pescoço destravam a estimativa de gordura corporal — e a cintura é o número que melhor acompanha a mudança de composição.",
              )}
            </Text>
          </View>
        </Card>
      ) : null}

      <Button variant="ghost" className="w-full" onPress={() => router.push("/plan")}>
        <Text className="text-sm font-semibold text-primary">
          {t("Ver progressão de cargas nos treinos")}
        </Text>
      </Button>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
  hint,
  destaque = false,
}: {
  icon: IconNode;
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  destaque?: boolean;
}) {
  const primaria = useColor("primary");
  const suave = destaque ? { color: `${TINTA}B3` } : undefined;
  return (
    <View
      className={cn(
        "w-[48%] rounded-[20px] p-3.5",
        !destaque && "border border-primary/20 bg-card",
      )}
      style={destaque ? { backgroundColor: VERDE } : undefined}
    >
      <View className="flex-row items-center gap-2">
        <View
          className={cn(
            "h-7 w-7 items-center justify-center rounded-lg",
            !destaque && "bg-primary/15",
          )}
          style={destaque ? { backgroundColor: `${TINTA}1F` } : undefined}
        >
          <Icon node={icon} color={destaque ? TINTA : primaria} size={16} />
        </View>
        <Text
          className={cn(
            "text-[11px] font-bold uppercase tracking-wider",
            !destaque && "text-muted-foreground",
          )}
          style={suave}
        >
          {label}
        </Text>
      </View>
      <Text
        className="mt-2.5 text-[28px] font-extrabold leading-none tracking-tight"
        style={destaque ? { color: TINTA } : undefined}
      >
        {value}
        {unit && value !== "—" ? (
          <Text
            className={cn("text-sm font-semibold", !destaque && "text-muted-foreground")}
            style={suave}
          >
            {" "}
            {unit}
          </Text>
        ) : null}
      </Text>
      {hint ? (
        <Text
          numberOfLines={1}
          className={cn("mt-1 text-[11px]", !destaque && "text-muted-foreground")}
          style={suave}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Progresso rumo à meta de peso; a previsão só aparece quando o ritmo aponta para a meta. */
function GoalCard({
  label,
  start,
  current,
  target: alvo,
  unit,
  rate,
}: {
  label: string;
  start: number;
  current: number;
  target: number;
  unit: string;
  rate: number | null;
}) {
  const progresso = goalProgress(start, current, alvo);
  const pct = Math.min(100, progresso.ratio * 100);
  const direcaoCerta =
    rate !== null && Math.abs(rate) > 0.05 && Math.sign(alvo - current) === Math.sign(rate);
  const semanas = direcaoCerta ? Math.ceil(Math.abs((alvo - current) / rate!)) : null;
  return (
    <Card className={cn(progresso.achieved && "border border-primary/30 bg-primary/5")}>
      <View className="p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-semibold leading-tight">{label}</Text>
            <Text className="mt-0.5 text-sm text-muted-foreground">
              {t("{{v0}} → {{v1}} de {{v2}} {{unit}}", {
                v0: start.toFixed(1),
                v1: current.toFixed(1),
                v2: alvo.toFixed(1),
                unit,
              })}
            </Text>
          </View>
          {progresso.achieved ? (
            <Badge>{t("Atingida")}</Badge>
          ) : (
            <Text className="text-lg font-bold">{Math.round(pct)}%</Text>
          )}
        </View>
        <View
          accessibilityLabel={`${label}: ${Math.round(pct)}%`}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-primary/15"
        >
          <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </View>
        {!progresso.achieved ? (
          <Text className="mt-2 text-xs text-muted-foreground">
            Faltam{" "}
            <Text className="text-xs font-medium">
              {progresso.remaining} {unit}
            </Text>
            {semanas !== null && semanas <= 104
              ? ` — cerca de ${semanas} ${semanas === 1 ? "semana" : "semanas"} no ritmo atual`
              : ""}
            .
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
