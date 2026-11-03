import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage, num, unwrapMaybe } from "@forja/app-core/data/supabase-helpers";
import {
  fetchProfile,
  preferencesOf,
  savePreferences as gravarPreferencias,
  type PreferencesForm,
} from "@forja/app-core/data/profile";
import { PageBody, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChipGroup, ChipRadio } from "@/components/ui/chip-group";
import { ErrorState } from "@/components/query-boundary";
import { ManualNutritionTargets } from "@/components/profile/manual-nutrition-targets";
import { AvisoProfissional } from "@/components/aviso-profissional";
import { ExportDataCard } from "@/components/export-data-card";
import { DeleteAccountCard } from "@/components/delete-account-card";
import { ImportDataCard } from "@/components/import-data-card";
import {
  SETTINGS_SECTIONS,
  isSettingsSection,
  type SettingsSection,
} from "@/components/profile/settings-sections";
import { MACRO_COLORS } from "@/components/home/macro-rings";
import {
  Award,
  CalendarDays,
  Clock,
  Crosshair,
  Droplet,
  Dumbbell,
  HeartPulse,
  Info,
  LogOut,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Target,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { macroTargets, yearsBetween } from "@forja/domain";
import {
  DURATION_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  FOCUS_OPTIONS,
  INJURY_OPTIONS,
  MEALS_PER_DAY_OPTIONS,
  PLACE_OPTIONS,
} from "@forja/app-core/lib/onboarding/options";
import { todayISO } from "@forja/app-core/lib/date";
import { LOCALE } from "@forja/app-core/i18n";
import { t } from "@forja/app-core/i18n";

/**
 * Configurações: dados, metas e preferências.
 *
 * Cada seção é uma opção do Menu e abre sozinha (`?secao=treino`). Sem
 * `secao`, a tela mostra todas — é o que o link da barra lateral abre.
 */
export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: t("Configurações — Habitual Fit") },
      { name: "description", content: t("Ajuste dados corporais, objetivos e metas de calorias.") },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { secao?: SettingsSection } => ({
    secao: isSettingsSection(search.secao) ? search.secao : undefined,
  }),
  component: SettingsPage,
});

/**
 * Validação do formulário de perfil.
 *
 * Antes, qualquer valor era gravado direto: uma altura de `9999` cm ou uma data
 * de nascimento no futuro produziam metas calóricas absurdas sem qualquer aviso.
 */
const profileSchema = z.object({
  display_name: z.string().trim().max(80, t("Nome muito longo (máx. 80 caracteres).")).optional(),
  sex: z.enum(["male", "female", "other"]),
  birth_date: z
    .string()
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), t("Data inválida."))
    .refine((v) => v === "" || v <= todayISO(), t("A data de nascimento não pode estar no futuro."))
    .refine((v) => {
      if (v === "") return true;
      const age = yearsBetween(v);
      return age >= 10 && age <= 120;
    }, t("Informe uma data compatível com idade entre 10 e 120 anos.")),
  height_cm: z
    .string()
    .refine(
      (v) => v === "" || (Number(v) >= 100 && Number(v) <= 250),
      t("Altura esperada entre 100 e 250 cm."),
    ),
  goal_weight_kg: z
    .string()
    .refine(
      (v) => v === "" || (Number(v) >= 30 && Number(v) <= 300),
      t("Peso-alvo esperado entre 30 e 300 kg."),
    ),
  activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["lose", "maintain", "gain"]),
});

type ProfileForm = z.infer<typeof profileSchema>;

const EMPTY_FORM: ProfileForm = {
  display_name: "",
  sex: "male",
  birth_date: "",
  height_cm: "",
  goal_weight_kg: "",
  activity_level: "moderate",
  goal: "maintain",
};

const EMPTY_PREFERENCES: PreferencesForm = preferencesOf({});

const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6] as const;

function SettingsPage() {
  const { secao } = Route.useSearch();
  const mostra = (k: SettingsSection) => !secao || secao === k;
  const titulo = SETTINGS_SECTIONS.find((s) => s.key === secao)?.title ?? "Configurações";
  const qc = useQueryClient();
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [prefs, setPrefs] = useState<PreferencesForm>(EMPTY_PREFERENCES);
  const [prefsTouched, setPrefsTouched] = useState(false);

  const profile = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: fetchProfile,
  });

  const latestWeight = useQuery({
    queryKey: queryKeys.body.latestWeight(),
    queryFn: async () => {
      const row = unwrapMaybe(
        "buscar último peso",
        await supabase
          .from("body_weights")
          .select("weight_kg")
          .order("log_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
      return row ? num(row.weight_kg) : null;
    },
  });

  const profileId = profile.data?.id;
  useEffect(() => {
    if (!profile.data) return;
    const p = profile.data;
    setForm({
      display_name: p.display_name ?? "",
      sex: (p.sex ?? "male") as ProfileForm["sex"],
      birth_date: p.birth_date ?? "",
      height_cm: p.height_cm?.toString() ?? "",
      goal_weight_kg: p.goal_weight_kg?.toString() ?? "",
      activity_level: (p.activity_level ?? "moderate") as ProfileForm["activity_level"],
      goal: (p.goal ?? "maintain") as ProfileForm["goal"],
    });
    setPrefs(preferencesOf(p));
    setPrefsTouched(false);
    // Só reidrata quando muda o registro carregado, não a cada refetch — senão
    // uma revalidação em background descartaria o que o usuário está digitando.
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const validation = profileSchema.safeParse(form);

  const weightKg = latestWeight.data ?? 0;

  const savePreferences = useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error("Perfil ainda não carregado.");
      await gravarPreferencias(profileId, prefs);
    },
    onSuccess: () => {
      toast.success(t("Preferências salvas"), {
        description: t("Valem para os próximos planos gerados."),
      });
      setPrefsTouched(false);
      void qc.invalidateQueries({ queryKey: queryKeys.profile() });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const updatePref = <K extends keyof PreferencesForm>(key: K, value: PreferencesForm[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setPrefsTouched(true);
  };

  if (profile.isError) {
    return (
      <>
        <PageHeader title={titulo} />
        <PageBody>
          <ErrorState message={errorMessage(profile.error)} onRetry={profile.refetch} />
        </PageBody>
      </>
    );
  }

  const carregando = profile.isPending;
  const editaPreferencias = mostra("treino") || mostra("alimentacao") || mostra("saude");

  return (
    <>
      <PageHeader title={titulo} />
      <PageBody>
        {/* `key`: trocar de seção pelo Menu remonta a tela. */}
        <div key={secao ?? "todas"} className={cn("space-y-8", prefsTouched && "pb-40")}>
          {carregando ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-[1.25rem]" />
              ))}
            </div>
          ) : (
            <>
              {mostra("metas") && (
                <Secao
                  icon={<Target />}
                  title={t("Metas nutricionais")}
                  description={t("Opcionais — o app não calcula nem sugere metas.")}
                  sozinha={Boolean(secao)}
                >
                  {profile.data && (
                    <ManualNutritionTargets key={profile.data.id} profile={profile.data} />
                  )}
                  <AvisoProfissional tipos={["dieta", "app"]} />
                </Secao>
              )}

              {mostra("treino") && (
                <Secao
                  icon={<Dumbbell />}
                  title={t("Treino")}
                  description={t("Define como os próximos planos são montados.")}
                  sozinha={Boolean(secao)}
                >
                  <Cartao titulo={t("Dias por semana")} icone={<CalendarDays />}>
                    <NumeroPicker
                      label={t("Dias por semana")}
                      options={[...DAYS_PER_WEEK_OPTIONS]}
                      value={prefs.days_per_week}
                      onChange={(v) => updatePref("days_per_week", v)}
                      sufixo="×"
                    />
                  </Cartao>

                  <Cartao titulo={t("Experiência")} icone={<Award />}>
                    <ChipRadio
                      label={t("Experiência")}
                      options={EXPERIENCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      value={prefs.experience_level}
                      onChange={(v) => updatePref("experience_level", v)}
                    />
                  </Cartao>

                  <Cartao titulo={t("Tempo por sessão")} icone={<Clock />}>
                    <ChipRadio
                      label={t("Tempo por sessão")}
                      options={DURATION_OPTIONS.map((o) => ({
                        value: o.value,
                        label: `${o.label} · ${o.minutes}`,
                      }))}
                      value={prefs.session_duration}
                      onChange={(v) => updatePref("session_duration", v)}
                    />
                  </Cartao>

                  <Cartao titulo={t("Onde você treina")} icone={<MapPin />}>
                    <ChipRadio
                      label={t("Onde você treina")}
                      options={PLACE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                      value={prefs.training_place}
                      onChange={(v) => updatePref("training_place", v)}
                    />
                  </Cartao>

                  <Cartao
                    titulo={t("Equipamentos disponíveis")}
                    icone={<Dumbbell />}
                    contador={prefs.equipment_available.length}
                  >
                    <ChipGroup
                      label={t("Equipamentos disponíveis")}
                      options={EQUIPMENT_OPTIONS}
                      selected={prefs.equipment_available}
                      onChange={(v) => updatePref("equipment_available", v)}
                    />
                  </Cartao>

                  <Cartao titulo={t("Foco")} icone={<Crosshair />}>
                    <ChipRadio
                      label={t("Foco")}
                      options={FOCUS_OPTIONS}
                      value={prefs.focus_area}
                      onChange={(v) => updatePref("focus_area", v)}
                    />
                  </Cartao>
                </Secao>
              )}

              {mostra("alimentacao") && (
                <Secao
                  icon={<Utensils />}
                  title={t("Alimentação")}
                  description={t("Quantas refeições aparecem na sua dieta e quanto de água beber.")}
                  sozinha={Boolean(secao)}
                >
                  <Cartao titulo={t("Refeições por dia")} icone={<Utensils />}>
                    <NumeroPicker
                      label={t("Refeições por dia")}
                      options={[...MEALS_PER_DAY_OPTIONS]}
                      value={prefs.meals_per_day}
                      onChange={(v) => updatePref("meals_per_day", v)}
                    />
                  </Cartao>

                  <Cartao titulo={t("Meta de água")} icone={<Droplet />}>
                    <AguaStepper
                      value={prefs.water_ml_target}
                      onChange={(v) => updatePref("water_ml_target", v)}
                    />
                  </Cartao>
                </Secao>
              )}

              {mostra("saude") && (
                <Secao
                  icon={<HeartPulse />}
                  title={t("Saúde")}
                  description={t(
                    "Exercícios que carregam as regiões marcadas saem dos planos gerados.",
                  )}
                  sozinha={Boolean(secao)}
                >
                  <Cartao
                    titulo={t("Regiões a preservar")}
                    icone={<ShieldCheck />}
                    contador={prefs.injuries.length}
                  >
                    <ChipGroup
                      label={t("Regiões a preservar")}
                      options={INJURY_OPTIONS}
                      selected={prefs.injuries}
                      onChange={(v) => updatePref("injuries", v)}
                    />
                  </Cartao>
                  <p className="flex gap-2.5 rounded-[1.25rem] border border-border p-4 text-sm text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {t(
                      "O app não substitui orientação médica. Em caso de dor durante um exercício, pare e procure um profissional.",
                    )}
                  </p>
                </Secao>
              )}

              {mostra("conta") && (
                <div className="space-y-3">
                  <ImportDataCard />
                  <ExportDataCard />
                  <DeleteAccountCard />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => void supabase.auth.signOut()}
                  >
                    <LogOut className="mr-1.5 size-4" aria-hidden />
                    {t("Sair da conta")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/*
          Um só botão de salvar, preso acima da barra inferior e visível só
          quando há mudança: as três seções gravam na mesma linha de `profiles`.
        */}
        {editaPreferencias && prefsTouched && (
          <div className="fixed inset-x-0 bottom-(--acima-da-barra) z-30 px-4 animate-in fade-in slide-in-from-bottom-3 duration-300 md:bottom-6 md:left-auto md:right-6 md:w-96">
            <Button
              className="h-13 w-full rounded-2xl text-base font-bold"
              onClick={() => savePreferences.mutate()}
              loading={savePreferences.isPending}
            >
              {t("Salvar alterações")}
            </Button>
          </div>
        )}
      </PageBody>
    </>
  );
}

/** Cabeçalho de uma seção: ícone em verde sólido, título e o porquê dela. */
function Secao({
  icon,
  title,
  description,
  sozinha,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Aberta pelo Menu: o título da página já diz o nome, então só a descrição. */
  sozinha: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3.5 px-1">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground [&_svg]:size-6">
          {icon}
        </span>
        <div className="min-w-0">
          {!sozinha && <h2 className="text-xl font-extrabold">{title}</h2>}
          <p className={cn("text-muted-foreground", sozinha ? "text-[15px]" : "text-sm")}>
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Cartao({
  titulo,
  icone,
  contador,
  children,
}: {
  titulo?: string;
  icone?: React.ReactNode;
  contador?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] bg-card p-4">
      {titulo && (
        <p className="mb-3 flex items-center gap-2 font-bold [&_svg]:size-4 [&_svg]:text-primary">
          {icone}
          {titulo}
          {contador ? (
            <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
              {contador}
            </span>
          ) : null}
        </p>
      )}
      {children}
    </div>
  );
}

/** Escolha de um número pequeno (dias, refeições) em círculos grandes. */
function NumeroPicker({
  label: rotulo,
  options,
  value,
  onChange,
  sufixo = "",
}: {
  label: string;
  options: number[];
  value: number | null;
  onChange: (v: number) => void;
  sufixo?: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex justify-between gap-2">
      {options.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={cn(
            "grid aspect-square w-full max-w-14 place-items-center rounded-full border-2 text-lg font-extrabold tabular-nums transition-colors",
            value === n
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary/50",
          )}
        >
          {n}
          {sufixo}
        </button>
      ))}
    </div>
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
  const atual = value ?? 2500;
  const mudar = (d: number) => onChange(Math.min(8000, Math.max(500, atual + d)));
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => mudar(-250)}
          className="grid size-12 place-items-center rounded-full border-2 border-border text-xl font-bold hover:border-primary/50"
          aria-label={t("Menos 250 ml")}
        >
          <Minus className="size-5" />
        </button>
        <p className="text-center">
          <span className="block text-4xl font-extrabold tabular-nums">
            {value === null
              ? t("Auto")
              : t("{{v0}} L", { v0: (value / 1000).toLocaleString(LOCALE) })}
          </span>
          <span className="text-xs text-muted-foreground">
            {value === null
              ? t("estimada pelo seu peso")
              : t("{{v0}} copos de 250 ml", { v0: Math.round(value / 250) })}
          </span>
        </p>
        <button
          type="button"
          onClick={() => mudar(250)}
          className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground"
          aria-label={t("Mais 250 ml")}
        >
          <Plus className="size-5" />
        </button>
      </div>
      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-3 w-full text-center text-sm font-semibold text-primary"
        >
          {t("Deixar o app estimar")}
        </button>
      )}
    </div>
  );
}
