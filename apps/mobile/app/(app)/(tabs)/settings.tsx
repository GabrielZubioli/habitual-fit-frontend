import { useEffect, useState, type ReactNode } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Directory, File } from "expo-file-system";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { __iconNode as award } from "lucide-react/dist/esm/icons/award.js";
import { __iconNode as calendarDays } from "lucide-react/dist/esm/icons/calendar-days.js";
import { __iconNode as check } from "lucide-react/dist/esm/icons/check.js";
import { __iconNode as clock } from "lucide-react/dist/esm/icons/clock.js";
import { __iconNode as crosshair } from "lucide-react/dist/esm/icons/crosshair.js";
import { __iconNode as download } from "lucide-react/dist/esm/icons/download.js";
import { __iconNode as droplet } from "lucide-react/dist/esm/icons/droplet.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as fileJson } from "lucide-react/dist/esm/icons/file-braces.js";
import { __iconNode as fileSpreadsheet } from "lucide-react/dist/esm/icons/file-spreadsheet.js";
import { __iconNode as heartPulse } from "lucide-react/dist/esm/icons/heart-pulse.js";
import { __iconNode as info } from "lucide-react/dist/esm/icons/info.js";
import { __iconNode as logOut } from "lucide-react/dist/esm/icons/log-out.js";
import { __iconNode as mapPin } from "lucide-react/dist/esm/icons/map-pin.js";
import { __iconNode as minus } from "lucide-react/dist/esm/icons/minus.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { __iconNode as shieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";
import { __iconNode as target } from "lucide-react/dist/esm/icons/target.js";
import { __iconNode as trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
import { __iconNode as upload } from "lucide-react/dist/esm/icons/upload.js";
import { __iconNode as utensils } from "lucide-react/dist/esm/icons/utensils.js";
import { parseWorkoutCsv } from "@forja/domain";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import {
  NUTRITION_TARGET_FIELDS,
  deleteAccount,
  fetchProfile,
  nutritionTargetDraft,
  parseNutritionTargets,
  preferencesOf,
  savePreferences,
  updateProfile,
  type NutritionTargetKey,
  type PreferencesForm,
} from "@forja/app-core/data/profile";
import { buildExportFile, type ExportFormat } from "@forja/app-core/data/export";
import { importWorkouts, type ImportSummary } from "@forja/app-core/data/import";
import {
  DURATION_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  FOCUS_OPTIONS,
  INJURY_OPTIONS,
  MEALS_PER_DAY_OPTIONS,
  PLACE_OPTIONS,
} from "@forja/app-core/lib/onboarding/options";
import { cn } from "@/lib/cn";
import { useCurrentUserId } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { useColor } from "@/theme/theme";
import { AvisoProfissional } from "@/ui/aviso-profissional";
import { Button } from "@/ui/button";
import { Card, ErrorState } from "@/ui/card";
import { Dialog } from "@/ui/dialog";
import { Icon, type IconNode } from "@/ui/icon";
import { PageHeader, PageScroll } from "@/ui/page-header";
import { Text } from "@/ui/text";
import * as SecureStore from "expo-secure-store";
import { __iconNode as languages } from "lucide-react/dist/esm/icons/languages.js";
import { __iconNode as chevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import { Sheet } from "@/ui/sheet";
import {
  LANGUAGE_NAMES,
  LANGUAGE_PREF_KEY,
  LANGUAGES,
  LOCALE,
  t,
  type Language,
} from "@forja/app-core/i18n";

/**
 * Configurações — o `settings.tsx` do web. Cada seção é uma opção do Menu e
 * abre sozinha (`?secao=treino`); sem `secao`, todas.
 */
const SECOES = [
  { key: "metas", title: t("Metas nutricionais") },
  { key: "treino", title: t("Treino") },
  { key: "alimentacao", title: t("Alimentação") },
  { key: "saude", title: t("Saúde") },
  { key: "conta", title: t("Dados e conta") },
] as const;
type Secao = (typeof SECOES)[number]["key"];

const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6];

type Aviso = { texto: string; erro: boolean } | null;

export default function SettingsPage() {
  const params = useLocalSearchParams<{ secao?: string }>();
  const secao = SECOES.find((s) => s.key === params.secao)?.key;
  const mostra = (k: Secao) => !secao || secao === k;
  const titulo = SECOES.find((s) => s.key === secao)?.title ?? "Configurações";
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<PreferencesForm>(preferencesOf({}));
  const [prefsTouched, setPrefsTouched] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const avisar = (texto: string, erro = false) => setAviso({ texto, erro });

  const profile = useQuery({ queryKey: queryKeys.profile(), queryFn: fetchProfile });
  const profileId = profile.data?.id;

  // Só reidrata quando muda o registro carregado ou a seção, não a cada refetch.
  useEffect(() => {
    if (!profile.data) return;
    setPrefs(preferencesOf(profile.data));
    setPrefsTouched(false);
  }, [profileId, secao]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvarPrefs = useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error("Perfil ainda não carregado.");
      await savePreferences(profileId, prefs);
    },
    onSuccess: () => {
      avisar(t("Preferências salvas — valem para os próximos planos gerados."));
      setPrefsTouched(false);
      void qc.invalidateQueries({ queryKey: queryKeys.profile() });
    },
    onError: (e) => avisar(errorMessage(e), true),
  });

  const updatePref = <K extends keyof PreferencesForm>(key: K, value: PreferencesForm[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setPrefsTouched(true);
  };
  const alternar = (key: "equipment_available" | "injuries", v: string) =>
    updatePref(
      key,
      prefs[key].includes(v) ? prefs[key].filter((x) => x !== v) : [...prefs[key], v],
    );

  const editaPreferencias = mostra("treino") || mostra("alimentacao") || mostra("saude");

  return (
    <View className="flex-1 bg-background">
      <PageScroll
        header={<PageHeader title={titulo} />}
        key={secao ?? "todas"}
        contentContainerClassName={cn("pb-28", prefsTouched && "pb-48")}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-8 px-4">
          {aviso ? (
            <Pressable
              onPress={() => setAviso(null)}
              className={cn(
                "rounded-xl px-3.5 py-3",
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

          {profile.isError ? (
            <ErrorState
              message={errorMessage(profile.error)}
              onRetry={() => void profile.refetch()}
            />
          ) : profile.isPending ? (
            <View className="gap-3">
              {[0, 1, 2, 3].map((i) => (
                <View key={i} className="h-24 w-full rounded-[20px] bg-muted" />
              ))}
            </View>
          ) : (
            <>
              {mostra("metas") ? (
                <SecaoView
                  icon={target}
                  title={t("Metas nutricionais")}
                  description={t("Opcionais — o app não calcula nem sugere metas.")}
                  sozinha={Boolean(secao)}
                >
                  {profile.data ? (
                    <ManualNutritionTargets
                      key={profile.data.id}
                      profile={profile.data}
                      avisar={avisar}
                    />
                  ) : null}
                  <AvisoProfissional tipos={["dieta", "app"]} />
                </SecaoView>
              ) : null}

              {mostra("treino") ? (
                <SecaoView
                  icon={dumbbell}
                  title={t("Treino")}
                  description={t("Define como os próximos planos são montados.")}
                  sozinha={Boolean(secao)}
                >
                  <Cartao titulo={t("Dias por semana")} icone={calendarDays}>
                    <NumeroPicker
                      options={DAYS_PER_WEEK_OPTIONS}
                      value={prefs.days_per_week}
                      onChange={(v) => updatePref("days_per_week", v)}
                      sufixo="×"
                    />
                  </Cartao>
                  <Cartao titulo={t("Experiência")} icone={award}>
                    <Chips
                      options={EXPERIENCE_OPTIONS}
                      ativo={(v) => prefs.experience_level === v}
                      onPress={(v) => updatePref("experience_level", v)}
                    />
                  </Cartao>
                  <Cartao titulo={t("Tempo por sessão")} icone={clock}>
                    <Chips
                      options={DURATION_OPTIONS.map((o) => ({
                        value: o.value,
                        label: `${o.label} · ${o.minutes}`,
                      }))}
                      ativo={(v) => prefs.session_duration === v}
                      onPress={(v) => updatePref("session_duration", v)}
                    />
                  </Cartao>
                  <Cartao titulo={t("Onde você treina")} icone={mapPin}>
                    <Chips
                      options={PLACE_OPTIONS}
                      ativo={(v) => prefs.training_place === v}
                      onPress={(v) => updatePref("training_place", v)}
                    />
                  </Cartao>
                  <Cartao
                    titulo={t("Equipamentos disponíveis")}
                    icone={dumbbell}
                    contador={prefs.equipment_available.length}
                  >
                    <Chips
                      multi
                      options={EQUIPMENT_OPTIONS}
                      ativo={(v) => prefs.equipment_available.includes(v)}
                      onPress={(v) => alternar("equipment_available", v)}
                    />
                  </Cartao>
                  <Cartao titulo={t("Foco")} icone={crosshair}>
                    <Chips
                      options={FOCUS_OPTIONS}
                      ativo={(v) => prefs.focus_area === v}
                      onPress={(v) => updatePref("focus_area", v)}
                    />
                  </Cartao>
                </SecaoView>
              ) : null}

              {mostra("alimentacao") ? (
                <SecaoView
                  icon={utensils}
                  title={t("Alimentação")}
                  description={t("Quantas refeições aparecem na sua dieta e quanto de água beber.")}
                  sozinha={Boolean(secao)}
                >
                  <Cartao titulo={t("Refeições por dia")} icone={utensils}>
                    <NumeroPicker
                      options={[...MEALS_PER_DAY_OPTIONS]}
                      value={prefs.meals_per_day}
                      onChange={(v) => updatePref("meals_per_day", v)}
                    />
                  </Cartao>
                  <Cartao titulo={t("Meta de água")} icone={droplet}>
                    <AguaStepper
                      value={prefs.water_ml_target}
                      onChange={(v) => updatePref("water_ml_target", v)}
                    />
                  </Cartao>
                </SecaoView>
              ) : null}

              {mostra("saude") ? (
                <SecaoView
                  icon={heartPulse}
                  title={t("Saúde")}
                  description={t(
                    "Exercícios que carregam as regiões marcadas saem dos planos gerados.",
                  )}
                  sozinha={Boolean(secao)}
                >
                  <Cartao
                    titulo={t("Regiões a preservar")}
                    icone={shieldCheck}
                    contador={prefs.injuries.length}
                  >
                    <Chips
                      multi
                      options={INJURY_OPTIONS}
                      ativo={(v) => prefs.injuries.includes(v)}
                      onPress={(v) => alternar("injuries", v)}
                    />
                  </Cartao>
                  <InfoSaude />
                </SecaoView>
              ) : null}

              {mostra("conta") ? (
                <View className="gap-3">
                  <LanguageCard avisar={avisar} />
                  <ImportDataCard avisar={avisar} />
                  <ExportDataCard avisar={avisar} />
                  <DeleteAccountCard avisar={avisar} />
                  <SairButton />
                </View>
              ) : null}
            </>
          )}
        </View>
      </PageScroll>

      {/* Um só botão de salvar, acima da barra, visível só quando há mudança. */}
      {editaPreferencias && prefsTouched ? (
        <View className="absolute inset-x-0 bottom-28 px-4" pointerEvents="box-none">
          <Button
            className="h-[52px] w-full rounded-2xl"
            onPress={() => salvarPrefs.mutate()}
            loading={salvarPrefs.isPending}
          >
            <Text className="text-base font-bold text-primary-foreground">
              {t("Salvar alterações")}
            </Text>
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function SecaoView({
  icon,
  title,
  description,
  sozinha,
  children,
}: {
  icon: IconNode;
  title: string;
  description: string;
  sozinha: boolean;
  children: ReactNode;
}) {
  const branco = useColor("primary-foreground");
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3.5 px-1">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary">
          <Icon node={icon} color={branco} size={24} />
        </View>
        <View className="min-w-0 flex-1">
          {!sozinha ? <Text className="text-xl font-extrabold">{title}</Text> : null}
          <Text className={cn("text-muted-foreground", sozinha ? "text-[15px]" : "text-sm")}>
            {description}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function Cartao({
  titulo,
  icone,
  contador,
  children,
}: {
  titulo: string;
  icone: IconNode;
  contador?: number;
  children: ReactNode;
}) {
  const primaria = useColor("primary");
  return (
    <View className="rounded-[20px] bg-card p-4">
      <View className="mb-3 flex-row items-center gap-2">
        <Icon node={icone} color={primaria} size={16} />
        <Text className="font-bold">{titulo}</Text>
        {contador ? (
          <View className="ml-auto rounded-full bg-primary/15 px-2 py-0.5">
            <Text className="text-xs font-bold text-primary">{contador}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Os chips do web (`ui/chip-group.tsx`): um (rádio) ou vários. */
function Chips({
  options,
  ativo,
  onPress,
  multi = false,
}: {
  options: readonly { value: string; label: string }[];
  ativo: (v: string) => boolean;
  onPress: (v: string) => void;
  multi?: boolean;
}) {
  const cor = useColor("primary-soft-foreground");
  return (
    <View accessibilityRole={multi ? undefined : "radiogroup"} className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const on = ativo(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => onPress(o.value)}
            accessibilityRole={multi ? "checkbox" : "radio"}
            accessibilityState={{ checked: on }}
            className={cn(
              "flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:scale-95",
              on ? "border-primary bg-primary-soft" : "border-border bg-card",
            )}
          >
            {multi && on ? <Icon node={check} color={cor} size={14} strokeWidth={3} /> : null}
            <Text
              className={cn(
                "text-sm",
                on ? "text-primary-soft-foreground" : "text-muted-foreground",
              )}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Escolha de um número pequeno (dias, refeições) em círculos grandes. */
function NumeroPicker({
  options,
  value,
  onChange,
  sufixo = "",
}: {
  options: number[];
  value: number | null;
  onChange: (v: number) => void;
  sufixo?: string;
}) {
  return (
    <View accessibilityRole="radiogroup" className="flex-row justify-between gap-2">
      {options.map((n) => (
        <Pressable
          key={n}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === n }}
          onPress={() => onChange(n)}
          className={cn(
            "aspect-square max-w-14 flex-1 items-center justify-center rounded-full border-2",
            value === n ? "border-primary bg-primary" : "border-border",
          )}
        >
          <Text
            className={cn(
              "text-lg font-extrabold",
              value === n ? "text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {n}
            {sufixo}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Meta de água em passos de 250 ml; vazio = o app estima pelo peso. */
function AguaStepper({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const texto = useColor("foreground");
  const branco = useColor("primary-foreground");
  const atual = value ?? 2500;
  const mudar = (d: number) => onChange(Math.min(8000, Math.max(500, atual + d)));
  return (
    <View>
      <View className="flex-row items-center justify-between gap-3">
        <Pressable
          onPress={() => mudar(-250)}
          accessibilityLabel={t("Menos 250 ml")}
          className="h-12 w-12 items-center justify-center rounded-full border-2 border-border"
        >
          <Icon node={minus} color={texto} size={20} />
        </Pressable>
        <View className="items-center">
          <Text className="text-4xl font-extrabold">
            {value === null
              ? t("Auto")
              : t("{{v0}} L", { v0: (value / 1000).toLocaleString(LOCALE) })}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {value === null
              ? t("estimada pelo seu peso")
              : t("{{v0}} copos de 250 ml", { v0: Math.round(value / 250) })}
          </Text>
        </View>
        <Pressable
          onPress={() => mudar(250)}
          accessibilityLabel={t("Mais 250 ml")}
          className="h-12 w-12 items-center justify-center rounded-full bg-primary"
        >
          <Icon node={plus} color={branco} size={20} />
        </Pressable>
      </View>
      {value !== null ? (
        <Pressable onPress={() => onChange(null)} className="mt-3 items-center">
          <Text className="text-sm font-semibold text-primary">{t("Deixar o app estimar")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function InfoSaude() {
  const primaria = useColor("primary");
  return (
    <View className="flex-row gap-2.5 rounded-[20px] border border-border p-4">
      <Icon node={info} color={primaria} size={16} />
      <Text className="flex-1 text-sm text-muted-foreground">
        {t(
          "O app não substitui orientação médica. Em caso de dor durante um exercício, pare e procure um profissional.",
        )}
      </Text>
    </View>
  );
}

type Perfil = NonNullable<Awaited<ReturnType<typeof fetchProfile>>>;

/** Metas nutricionais manuais e opcionais — o `manual-nutrition-targets.tsx` do web. */
function ManualNutritionTargets({
  profile,
  avisar,
}: {
  profile: Perfil;
  avisar: (item: string, erro?: boolean) => void;
}) {
  const qc = useQueryClient();
  const texto = useColor("foreground");
  const apagada = useColor("muted-foreground");
  const [valores, setValores] = useState(() => nutritionTargetDraft(profile));
  const [erros, setErros] = useState<Partial<Record<NutritionTargetKey, string>>>({});

  const salvar = useMutation({
    mutationFn: (patch: Record<NutritionTargetKey, number | null>) =>
      updateProfile(profile.id, patch, "salvar metas nutricionais"),
    onSuccess: (_, patch) => {
      avisar(
        Object.values(patch).every((v) => v === null) ? t("Metas removidas") : t("Metas salvas"),
      );
      void qc.invalidateQueries({ queryKey: queryKeys.profile() });
    },
    onError: (e) => avisar(errorMessage(e), true),
  });

  const enviar = () => {
    const r = parseNutritionTargets(valores);
    setErros(r.ok ? {} : r.erros);
    if (r.ok) salvar.mutate(r.patch);
  };
  const algumaMeta = NUTRITION_TARGET_FIELDS.some((c) => profile[c.key] != null);

  return (
    <View className="rounded-[20px] bg-card p-4">
      <Text className="text-sm text-muted-foreground">
        {t(
          "Opcional. Se você tem acompanhamento, preencha com as metas definidas pelo seu nutricionista. Deixe em branco para não usar metas — as telas mostram só o que você consumiu.",
        )}
      </Text>
      <View className="mt-4 flex-row flex-wrap gap-3">
        {NUTRITION_TARGET_FIELDS.map((c) => (
          <View key={c.key} className={c.key === "daily_kcal_target" ? "w-full" : "w-[47%]"}>
            <Text className="text-sm font-medium">
              {c.rotulo}{" "}
              <Text className="text-sm text-muted-foreground">
                {t("({{unidade}}/dia)", { unidade: c.unidade })}
              </Text>
            </Text>
            <TextInput
              value={valores[c.key]}
              onChangeText={(v) => setValores((s) => ({ ...s, [c.key]: v }))}
              keyboardType="number-pad"
              placeholder={t("Sem meta")}
              placeholderTextColor={apagada}
              accessibilityLabel={c.rotulo}
              className={cn(
                "mt-1.5 h-12 rounded-xl border bg-background px-3 font-sans text-base",
                erros[c.key] ? "border-destructive" : "border-input",
              )}
              style={{ color: texto }}
            />
            {erros[c.key] ? (
              <Text className="mt-1 text-xs text-destructive">{erros[c.key]}</Text>
            ) : null}
          </View>
        ))}
      </View>
      <View className="mt-4 gap-2">
        <Button className="h-12 rounded-xl" onPress={enviar} loading={salvar.isPending}>
          {t("Salvar metas")}
        </Button>
        {algumaMeta ? (
          <Button
            variant="outline"
            className="h-12 rounded-xl"
            disabled={salvar.isPending}
            onPress={() => {
              setValores(nutritionTargetDraft({}));
              setErros({});
              salvar.mutate(
                Object.fromEntries(NUTRITION_TARGET_FIELDS.map((c) => [c.key, null])) as Record<
                  NutritionTargetKey,
                  null
                >,
              );
            }}
          >
            {t("Remover metas")}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Idioma do app, numa caixa de seleção: o campo mostra a escolha e abre a
 * lista num painel de baixo (o RN não tem `<select>`). "Automático" segue o
 * país (ver `resolveLanguage`). A escolha vai para o SecureStore e vale ao
 * reabrir: o `index.js` a lê antes do i18n, que decide o idioma uma vez.
 */
function LanguageCard({ avisar }: { avisar: (item: string, erro?: boolean) => void }) {
  const [escolha, setEscolha] = useState<string>(
    () => SecureStore.getItem(LANGUAGE_PREF_KEY) ?? "auto",
  );
  const [aberto, setAberto] = useState(false);
  const texto = useColor("foreground");
  const primaria = useColor("primary");
  const opcoes = [
    { value: "auto", label: t("Automático (pelo país)") },
    ...LANGUAGES.map((l: Language) => ({ value: l, label: LANGUAGE_NAMES[l] })),
  ];
  const rotulo = opcoes.find((o) => o.value === escolha)?.label ?? opcoes[0]!.label;

  const escolher = (v: string) => {
    setAberto(false);
    if (v === escolha) return;
    try {
      if (v === "auto") void SecureStore.deleteItemAsync(LANGUAGE_PREF_KEY);
      else SecureStore.setItem(LANGUAGE_PREF_KEY, v);
      setEscolha(v);
      avisar(t("Idioma salvo. Feche e abra o app para aplicar."));
    } catch (e) {
      avisar(errorMessage(e), true);
    }
  };

  return (
    <Cartao titulo={t("Idioma")} icone={languages}>
      <Pressable
        onPress={() => setAberto(true)}
        accessibilityRole="combobox"
        accessibilityLabel={t("Idioma")}
        accessibilityValue={{ text: rotulo }}
        className="h-11 flex-row items-center justify-between rounded-2xl border border-border bg-background px-4 active:opacity-80"
      >
        <Text className="text-[15px]">{rotulo}</Text>
        <Icon node={chevronDown} color={texto} size={18} />
      </Pressable>
      <Sheet open={aberto} onClose={() => setAberto(false)}>
        <View accessibilityRole="radiogroup" className="gap-1 px-4 pb-4 pt-5">
          <Text className="mb-2 px-2 text-lg font-bold">{t("Idioma")}</Text>
          {opcoes.map((o) => {
            const on = o.value === escolha;
            return (
              <Pressable
                key={o.value}
                onPress={() => escolher(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                className={cn(
                  "h-12 flex-row items-center justify-between rounded-xl px-3 active:bg-muted",
                  on && "bg-primary/10",
                )}
              >
                <Text className={cn("text-[15px]", on && "font-semibold text-primary")}>
                  {o.label}
                </Text>
                {on ? <Icon node={check} color={primaria} size={18} strokeWidth={3} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </Cartao>
  );
}

/**
 * Exportar — o `export-data-card.tsx` do web. No celular o arquivo é gravado
 * numa pasta que a pessoa escolhe (o seletor do sistema).
 */
function ExportDataCard({ avisar }: { avisar: (item: string, erro?: boolean) => void }) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const texto = useColor("foreground");

  const exportar = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const { conteudo, nome, mime } = await buildExportFile(format);
      const pasta = await Directory.pickDirectoryAsync();
      pasta.createFile(nome, mime).write(conteudo);
      avisar(t("Exportação concluída: {{nome}}", { nome }));
    } catch (e) {
      // Fechar o seletor de pasta não é erro.
      if (!/cancel/i.test(errorMessage(e))) avisar(errorMessage(e), true);
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card>
      <View className="gap-3 p-4">
        <View className="flex-row items-center gap-2">
          <Icon node={download} color={texto} size={16} />
          <Text className="text-base font-semibold">{t("Seus dados")}</Text>
        </View>
        <Text className="text-sm text-muted-foreground">
          {t(
            "Baixe tudo o que você registrou: treinos, séries, diário alimentar, receitas, pesos e medidas. Seus dados são seus — leve-os quando quiser.",
          )}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Button
            variant="outline"
            onPress={() => void exportar("json")}
            disabled={exporting !== null}
          >
            <Icon node={fileJson} color={texto} size={16} />
            <Text className="text-sm font-medium">
              {exporting === "json" ? t("Exportando…") : t("Exportar JSON")}
            </Text>
          </Button>
          <Button
            variant="outline"
            onPress={() => void exportar("csv")}
            disabled={exporting !== null}
          >
            <Icon node={fileSpreadsheet} color={texto} size={16} />
            <Text className="text-sm font-medium">
              {exporting === "csv" ? t("Exportando…") : t("Exportar CSV")}
            </Text>
          </Button>
        </View>
        <Text className="text-xs text-muted-foreground">
          {t(
            "JSON preserva a estrutura completa (ideal para backup ou migração). CSV abre direto no Excel e no Google Planilhas.",
          )}
        </Text>
      </View>
    </Card>
  );
}

/** Limite de tamanho: um histórico de anos do Strong tem poucos MB. */
const MAX_BYTES = 20 * 1024 * 1024;

/** Importar de outro app — o `import-data-card.tsx` do web. */
function ImportDataCard({ avisar }: { avisar: (item: string, erro?: boolean) => void }) {
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  const branco = useColor("primary-foreground");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [unidade, setUnidade] = useState<"kg" | "lb">("kg");
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<(ImportSummary & { skipped: number }) | null>(null);

  const escolher = async () => {
    const r = await File.pickFileAsync({
      mimeTypes: ["text/csv", "text/comma-separated-values", "text/plain"],
    });
    if (!r.canceled) setArquivo(r.result);
  };

  const importar = async () => {
    if (!arquivo) return;
    if ((arquivo.size ?? 0) > MAX_BYTES)
      return avisar(t("Arquivo grande demais: o limite é 20 MB."), true);
    setImportando(true);
    setResultado(null);
    try {
      const parsed = parseWorkoutCsv(await arquivo.text(), unidade);
      if (parsed.workouts.length === 0) {
        avisar(
          t(
            "Nenhum treino encontrado. Confira se é o CSV exportado pelo app (com colunas de data e exercício).",
          ),
          true,
        );
        return;
      }
      const resumo = await importWorkouts(userId, parsed);
      setResultado({ ...resumo, skipped: parsed.skipped.length });
      void qc.invalidateQueries({ queryKey: queryKeys.workouts.all });
      void qc.invalidateQueries({ queryKey: queryKeys.exercises.all });
    } catch (e) {
      avisar(t("Não foi possível importar: {{v0}}", { v0: errorMessage(e) }), true);
    } finally {
      setImportando(false);
    }
  };

  return (
    <Card>
      <View className="gap-3 p-4">
        <Text className="text-base font-semibold">{t("Importar de outro app")}</Text>
        <Text className="text-sm text-muted-foreground">
          {t(
            "Traga seu histórico do Strong, Hevy ou FitNotes: exporte o CSV no app e envie aqui. Os exercícios são reconhecidos pelo nome; os que não estiverem na biblioteca viram exercícios seus.",
          )}
        </Text>
        <Button variant="outline" onPress={() => void escolher()}>
          <Text numberOfLines={1} className="text-sm font-medium">
            {arquivo ? arquivo.name : t("Escolher arquivo CSV")}
          </Text>
        </Button>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-muted-foreground">{t("Pesos em")}</Text>
          {(["kg", "lb"] as const).map((u) => (
            <Pressable
              key={u}
              onPress={() => setUnidade(u)}
              accessibilityState={{ selected: unidade === u }}
              className={cn(
                "rounded-md border px-3 py-1.5",
                unidade === u ? "border-primary bg-primary/10" : "border-input",
              )}
            >
              <Text className={cn("text-sm", unidade === u && "font-semibold text-primary")}>
                {u}
              </Text>
            </Pressable>
          ))}
          <Button
            className="ml-auto"
            onPress={() => void importar()}
            disabled={!arquivo}
            loading={importando}
          >
            <Icon node={upload} color={branco} size={16} />
            <Text className="text-sm font-medium text-primary-foreground">{t("Importar")}</Text>
          </Button>
        </View>
        {resultado ? (
          <Text className="text-sm">
            {t("{{workouts}} treinos e {{sets}} séries importados", {
              workouts: resultado.workouts,
              sets: resultado.sets,
            })}
            {resultado.duplicates > 0 ? ` · ${resultado.duplicates} já existiam` : ""}
            {resultado.skipped > 0 ? ` · ${resultado.skipped} linhas ignoradas` : ""}
            {resultado.newExercises.length > 0
              ? ` · ${resultado.newExercises.length} exercícios novos criados`
              : ""}
            .
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const PALAVRA = "EXCLUIR";

/** Exclusão da conta — o `delete-account-card.tsx` do web: digitar a palavra confirma. */
function DeleteAccountCard({ avisar }: { avisar: (item: string, erro?: boolean) => void }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const destrutiva = useColor("destructive");
  const cor = useColor("foreground");

  const excluir = async () => {
    setExcluindo(true);
    try {
      await deleteAccount();
      router.replace("/");
    } catch (e) {
      avisar(t("Não foi possível excluir a conta: {{v0}}", { v0: errorMessage(e) }), true);
      setExcluindo(false);
    }
  };

  return (
    <Card className="border border-destructive/40">
      <View className="gap-3 p-4">
        <Text className="text-base font-semibold">{t("Excluir conta")}</Text>
        <Text className="text-sm text-muted-foreground">
          {t(
            "Apaga seus treinos, dieta, medidas, fotos e a conta. Não dá para desfazer — se quiser guardar algo, exporte antes. Assinaturas feitas na App Store ou no Google Play são canceladas na própria loja.",
          )}
        </Text>
        <View className="flex-row">
          <Button variant="outline" onPress={() => setAberto(true)}>
            <Icon node={trash2} color={destrutiva} size={16} />
            <Text className="text-sm font-medium text-destructive">{t("Excluir minha conta")}</Text>
          </Button>
        </View>
      </View>
      <Dialog
        open={aberto}
        onClose={() => {
          if (excluindo) return;
          setAberto(false);
          setTexto("");
        }}
        title={t("Excluir a conta para sempre?")}
      >
        <Text className="text-center text-sm text-muted-foreground">
          {t("Digite {{PALAVRA}} para confirmar. Todos os seus dados serão apagados.", { PALAVRA })}
        </Text>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          autoCapitalize="characters"
          autoCorrect={false}
          accessibilityLabel={t("Digite {{PALAVRA}} para confirmar", { PALAVRA })}
          className="h-10 rounded-md border border-input bg-background px-3 font-sans text-base"
          style={{ color: cor }}
        />
        <Button
          variant="destructive"
          disabled={texto.trim().toUpperCase() !== PALAVRA || excluindo}
          onPress={() => void excluir()}
        >
          {excluindo ? t("Excluindo…") : t("Excluir para sempre")}
        </Button>
        <Button
          variant="outline"
          disabled={excluindo}
          onPress={() => {
            setAberto(false);
            setTexto("");
          }}
        >
          {t("Cancelar")}
        </Button>
      </Dialog>
    </Card>
  );
}

function SairButton() {
  const texto = useColor("foreground");
  return (
    <Button variant="outline" className="w-full" onPress={() => void supabase.auth.signOut()}>
      <Icon node={logOut} color={texto} size={16} />
      <Text className="text-sm font-medium">{t("Sair da conta")}</Text>
    </Button>
  );
}
