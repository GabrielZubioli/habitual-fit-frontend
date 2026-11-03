import { useRef, useState, type ReactNode } from "react";
import { Linking, Pressable, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { __iconNode as activity } from "lucide-react/dist/esm/icons/activity.js";
import { __iconNode as cake } from "lucide-react/dist/esm/icons/cake.js";
import { __iconNode as calendarHeart } from "lucide-react/dist/esm/icons/calendar-heart.js";
import { __iconNode as chevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as flag } from "lucide-react/dist/esm/icons/flag.js";
import { __iconNode as flame } from "lucide-react/dist/esm/icons/flame.js";
import { __iconNode as lock } from "lucide-react/dist/esm/icons/lock.js";
import { __iconNode as logOut } from "lucide-react/dist/esm/icons/log-out.js";
import { __iconNode as pencil } from "lucide-react/dist/esm/icons/pencil.js";
import { __iconNode as ruler } from "lucide-react/dist/esm/icons/ruler.js";
import { __iconNode as scale } from "lucide-react/dist/esm/icons/scale.js";
import { __iconNode as share2 } from "lucide-react/dist/esm/icons/share-2.js";
import { __iconNode as target } from "lucide-react/dist/esm/icons/target.js";
import { __iconNode as trophy } from "lucide-react/dist/esm/icons/trophy.js";
import { __iconNode as user } from "lucide-react/dist/esm/icons/user.js";
import { yearsBetween } from "@forja/domain";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage, num } from "@forja/app-core/data/supabase-helpers";
import {
  PROFILE_FIELD_TITLES,
  bmiBand,
  convertProfileField,
  fetchProfile,
  updateProfile,
  validateProfileField,
  type ProfileField,
} from "@forja/app-core/data/profile";
import { fetchWeightEnds, fetchWorkoutCounts } from "@forja/app-core/data/body";
import { fetchPersonalRecords } from "@forja/app-core/data/workouts";
import { useStreak } from "@forja/app-core/hooks/use-streak";
import {
  ACTIVITY_HINTS,
  ACTIVITY_LABELS,
  GOAL_LABELS,
  SEX_LABELS,
  label,
} from "@forja/app-core/lib/labels";
import {
  EXPERIENCE_OPTIONS,
  FOCUS_OPTIONS,
  PLACE_OPTIONS,
} from "@forja/app-core/lib/onboarding/options";
import { weightJourney } from "@forja/app-core/lib/weight-journey";
import { formatDate, todayISO } from "@forja/app-core/lib/date";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";
import { urlDoSite } from "@/lib/site";
import { supabase } from "@/lib/supabase";
import { useColor } from "@/theme/theme";
import { ActivityHeatmap } from "@/ui/activity-heatmap";
import { AvatarPicker } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { ErrorState } from "@/ui/card";
import { DatePicker } from "@/ui/date-picker";
import { ConfirmDialog, Dialog } from "@/ui/dialog";
import { Icon, type IconNode } from "@/ui/icon";
import { ShareProfileDialog } from "@/ui/share-profile-dialog";
import { Text } from "@/ui/text";
import { LOCALE } from "@forja/app-core/i18n";
import { t } from "@forja/app-core/i18n";

/**
 * Perfil — o `profile.tsx` do web: a identidade, a evolução e os destaques
 * (só o que foi registrado de verdade) e os dados pessoais, editáveis ali.
 */
const fmt = (n: number) => n.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
const opcao = (opcoes: { value: string; label: string }[], v: string | null | undefined) =>
  opcoes.find((o) => o.value === v)?.label ?? null;

export default function ProfilePage() {
  const session = useSession();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [editando, setEditando] = useState<ProfileField | null>(null);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const rolagem = useRef<ScrollView>(null);
  const [yDados, setYDados] = useState(0);
  const [yConteudo, setYConteudo] = useState(0);
  const branco = useColor("primary-foreground");
  const primaria = useColor("primary");
  const apagada = useColor("muted-foreground");
  const texto = useColor("foreground");

  const profile = useQuery({ queryKey: queryKeys.profile(), queryFn: fetchProfile });
  const pesos = useQuery({
    queryKey: [...queryKeys.body.all, "weight-ends"],
    queryFn: fetchWeightEnds,
  });
  const treinos = useQuery({
    queryKey: [...queryKeys.workouts.all, "counts"],
    queryFn: fetchWorkoutCounts,
  });
  const recordes = useQuery({
    queryKey: queryKeys.workouts.personalRecords(),
    queryFn: () => fetchPersonalRecords(20),
  });
  const sequencia = useStreak();

  /** O logout de sempre: para as consultas, limpa o cache e encerra a sessão. */
  const sair = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.replace("/auth");
  };

  if (profile.isError) {
    return (
      <View className="flex-1 bg-background px-4 pt-16">
        <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
      </View>
    );
  }

  const p = profile.data;
  const idade = p?.birth_date ? yearsBetween(p.birth_date) : null;
  const altura = p?.height_cm ? num(p.height_cm) : null;
  const peso = pesos.data?.latest ?? null;
  const meta = p?.goal_weight_kg != null ? num(p.goal_weight_kg) : null;
  const imc = peso && altura ? peso / (altura / 100) ** 2 : null;
  const jornada = weightJourney({
    startKg: pesos.data?.first ?? null,
    currentKg: peso,
    goalKg: meta,
  });
  const totalTreinos = treinos.data?.total ?? null;
  const destaques = (recordes.data ?? []).slice(0, 3);
  const objetivo = p?.goal ? label(GOAL_LABELS, p.goal) : null;
  const estilo = [
    opcao(EXPERIENCE_OPTIONS, p?.experience_level),
    opcao(PLACE_OPTIONS, p?.training_place),
    p?.days_per_week
      ? t("{{days_per_week}}× por semana", { days_per_week: p.days_per_week })
      : null,
    p?.focus_area && p.focus_area !== "full_body"
      ? t("Foco em {{v0}}", { v0: opcao(FOCUS_OPTIONS, p.focus_area)?.toLowerCase() })
      : null,
  ].filter((s): s is string => Boolean(s));

  return (
    <View className="flex-1 bg-background">
      <ScrollView ref={rolagem} contentContainerClassName="pb-28">
        {/* A faixa da marca, com compartilhar e sair no canto. */}
        <View
          className="h-48 overflow-hidden bg-primary"
          style={{ paddingTop: Math.max(24, insets.top) }}
        >
          <View className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <View className="absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-black/10" />
          <View className="flex-row items-start justify-between gap-3 px-5">
            <Text className="text-[32px] font-extrabold leading-none tracking-tight text-primary-foreground">
              {t("Perfil")}
            </Text>
            <View className="flex-row gap-2">
              <BotaoTopo
                icon={share2}
                rotulo={t("Compartilhar perfil")}
                onPress={() => setCompartilhando(true)}
                disabled={!p}
                cor={branco}
              />
              <BotaoTopo
                icon={logOut}
                rotulo={t("Sair da conta")}
                onPress={() => setConfirmandoSaida(true)}
                cor={branco}
              />
            </View>
          </View>
        </View>

        <View className="px-4" onLayout={(e) => setYConteudo(e.nativeEvent.layout.y)}>
          {/* Identidade: foto sobre a faixa, nome, objetivo e o jeito de treinar. */}
          <View className="-mt-20 items-center">
            {!p ? (
              <View className="h-32 w-32 rounded-full border-4 border-background bg-muted" />
            ) : (
              <AvatarPicker
                path={p.avatar_url ?? null}
                name={p.display_name ?? null}
                profileId={p.id}
                onError={setErro}
                className="h-32 w-32 border-4"
              />
            )}
            {!p ? (
              <View className="mt-4 h-8 w-48 rounded-md bg-muted" />
            ) : (
              <Pressable
                onPress={() => setEditando("display_name")}
                accessibilityLabel={t("Editar nome")}
                className="mt-4 max-w-full flex-row items-center gap-2 rounded-xl px-2 py-1 active:bg-card"
              >
                <Text numberOfLines={1} className="shrink text-3xl font-extrabold tracking-tight">
                  {p.display_name?.trim() || t("Seu nome")}
                </Text>
                <Icon node={pencil} color={apagada} size={16} />
              </Pressable>
            )}
            {p?.created_at ? (
              <Text className="mt-1 text-sm text-muted-foreground">
                {t("No Habitual Fit desde {{v0}}", {
                  v0: formatDate(p.created_at, "MMMM 'de' yyyy"),
                })}
              </Text>
            ) : null}

            {objetivo || estilo.length > 0 ? (
              <View className="mt-4 flex-row flex-wrap justify-center gap-2">
                {objetivo ? (
                  <View className="rounded-full bg-primary px-3 py-1">
                    <Text className="text-sm font-bold text-primary-foreground">{objetivo}</Text>
                  </View>
                ) : null}
                {estilo.map((s) => (
                  <View key={s} className="rounded-full border border-border bg-card px-3 py-1">
                    <Text className="text-sm font-medium">{s}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="mt-5 w-full max-w-sm flex-row gap-2">
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                onPress={() => rolagem.current?.scrollTo({ y: yConteudo + yDados, animated: true })}
              >
                <Icon node={pencil} color={texto} size={16} />
                <Text className="text-sm font-medium">{t("Editar perfil")}</Text>
              </Button>
              <Button
                className="h-11 flex-1 rounded-xl"
                onPress={() => setCompartilhando(true)}
                disabled={!p}
              >
                <Icon node={share2} color={branco} size={16} />
                <Text className="text-sm font-bold text-primary-foreground">
                  {t("Compartilhar")}
                </Text>
              </Button>
            </View>
          </View>

          {erro ? (
            <Pressable
              onPress={() => setErro(null)}
              className="mt-4 rounded-xl bg-destructive-soft px-3.5 py-3"
            >
              <Text className="text-sm font-medium text-destructive">{erro}</Text>
            </Pressable>
          ) : null}

          {/* Evolução: só números que existem. */}
          <Titulo>{t("Evolução")}</Titulo>
          {treinos.isPending ? (
            <View className="h-28 rounded-[20px] bg-muted" />
          ) : totalTreinos === 0 ? (
            <View className="items-center rounded-3xl border border-dashed border-primary/40 bg-primary/5 p-5">
              <Icon node={dumbbell} color={primaria} size={32} />
              <Text className="mt-2 text-lg font-bold">
                {t("Seu portfólio começa no primeiro treino")}
              </Text>
              <Text className="mt-1 text-center text-sm text-muted-foreground">
                {t("Treinos, sequência e recordes aparecem aqui conforme você registra.")}
              </Text>
              <Button className="mt-4 h-11 rounded-xl" onPress={() => router.push("/train")}>
                {t("Começar um treino")}
              </Button>
            </View>
          ) : (
            <>
              <View className="flex-row gap-3">
                <Numero icon={dumbbell} valor={totalTreinos} rotulo={t("Treinos")} />
                <Numero icon={calendarHeart} valor={treinos.data?.month} rotulo={t("Neste mês")} />
                <Numero
                  icon={flame}
                  valor={sequencia.isPending ? null : sequencia.dias}
                  rotulo={sequencia.dias === 1 ? t("Dia seguido") : t("Dias seguidos")}
                />
              </View>
              <View className="mt-3 rounded-[20px] bg-card p-4">
                <Text className="mb-3 text-sm font-semibold text-muted-foreground">
                  {t("Constância no último ano")}
                </Text>
                <ActivityHeatmap />
              </View>
            </>
          )}

          {/* A jornada até a meta. */}
          {jornada ? (
            <View className="mt-3 rounded-[20px] bg-card p-5">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-muted-foreground">
                  {t("Início {{v0}} kg", { v0: fmt(jornada.startKg) })}
                </Text>
                <View className="flex-row items-center gap-1">
                  <Icon node={flag} color={primaria} size={16} />
                  <Text className="text-sm text-muted-foreground">
                    {t("Meta {{v0}} kg", { v0: fmt(jornada.goalKg) })}
                  </Text>
                </View>
              </View>
              <View
                accessibilityLabel={t("{{percent}}% do caminho até a meta", {
                  percent: jornada.percent,
                })}
                className="mt-3 h-3 overflow-hidden rounded-full bg-elevated"
              >
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(4, jornada.percent)}%` }}
                />
              </View>
              <Text className="mt-3 text-lg font-semibold">
                {jornada.reached
                  ? t("Você chegou à meta 🎉")
                  : t("{{percent}}% do caminho · faltam {{v1}} kg", {
                      percent: jornada.percent,
                      v1: fmt(jornada.remainingKg),
                    })}
              </Text>
            </View>
          ) : null}

          {/* Destaques: os recordes de verdade. */}
          {destaques.length > 0 ? (
            <>
              <Titulo>{t("Destaques")}</Titulo>
              <View className="overflow-hidden rounded-[20px] bg-card">
                {destaques.map((r, i) => (
                  <View
                    key={r.exerciseId}
                    className={cn(
                      "flex-row items-center gap-3 p-4",
                      i > 0 && "border-t border-border/60",
                    )}
                  >
                    <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                      <Icon node={trophy} color={primaria} size={20} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="font-semibold">
                        {r.exerciseName}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {t("Recorde em {{v0}}", { v0: formatDate(r.date, "d 'de' MMM") })}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-extrabold">
                        {t("{{v0}} kg", { v0: fmt(r.weightKg) })}
                      </Text>
                      <Text className="text-xs font-medium text-muted-foreground">
                        × {r.reps} {r.reps === 1 ? t("repetição") : t("repetições")}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Os dados — privados; cada bloco abre a edição. */}
          <View
            onLayout={(e) => setYDados(e.nativeEvent.layout.y)}
            className="mb-3 mt-8 flex-row items-center justify-between px-1"
          >
            <Text className="text-lg text-muted-foreground">{t("Dados pessoais")}</Text>
            <View className="flex-row items-center gap-1">
              <Icon node={lock} color={apagada} size={14} />
              <Text className="text-xs text-muted-foreground">{t("Só você vê")}</Text>
            </View>
          </View>
          {!p ? (
            <View className="flex-row flex-wrap gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <View key={i} className="h-24 w-[48%] rounded-[20px] bg-muted" />
              ))}
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-3">
              <Dado
                icon={flame}
                rotulo={t("Objetivo")}
                valor={objetivo}
                onPress={() => setEditando("goal")}
                pequeno
              />
              <Dado
                icon={activity}
                rotulo={t("Atividade")}
                valor={p.activity_level ? label(ACTIVITY_LABELS, p.activity_level) : null}
                onPress={() => setEditando("activity_level")}
                pequeno
              />
              <Dado
                icon={cake}
                rotulo={t("Idade")}
                valor={idade}
                unidade="anos"
                onPress={() => setEditando("birth_date")}
              />
              <Dado
                icon={ruler}
                rotulo={t("Altura")}
                valor={altura}
                unidade="cm"
                onPress={() => setEditando("height_cm")}
              />
              <Dado
                icon={scale}
                rotulo={t("Peso atual")}
                valor={peso && fmt(peso)}
                unidade="kg"
                nota={t("Registrar em Progresso")}
                acao={chevronRight}
                onPress={() => router.push("/body")}
              />
              <Dado
                icon={target}
                rotulo={t("Meta de peso")}
                valor={meta && fmt(meta)}
                unidade="kg"
                onPress={() => setEditando("goal_weight_kg")}
              />
              <Dado
                icon={user}
                rotulo={t("Sexo")}
                valor={p.sex ? label(SEX_LABELS, p.sex) : null}
                onPress={() => setEditando("sex")}
                pequeno
              />
              <Dado
                icon={activity}
                rotulo="IMC"
                valor={imc && fmt(imc)}
                nota={imc ? bmiBand(imc) : t("Precisa de peso e altura")}
                acao={null}
              />
            </View>
          )}

          {/* Metas definidas pela pessoa (manuais), quando houver. */}
          {p?.daily_kcal_target != null ? (
            <Pressable
              onPress={() => router.push("/settings?secao=metas")}
              className="mt-3 flex-row items-center gap-4 rounded-[20px] bg-card p-4 active:bg-elevated"
            >
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                <Icon node={flame} color={primaria} size={20} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-semibold">
                  {t("{{v0}} kcal por dia", {
                    v0: Math.round(num(p.daily_kcal_target)).toLocaleString(LOCALE),
                  })}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  {t("P {{v0}} g · C {{v1}} g · G {{v2}} g", {
                    v0: Math.round(num(p.protein_g_target)),
                    v1: Math.round(num(p.carbs_g_target)),
                    v2: Math.round(num(p.fat_g_target)),
                  })}
                </Text>
              </View>
              <Icon node={chevronRight} color={apagada} size={20} />
            </Pressable>
          ) : null}

          <Text numberOfLines={1} className="mt-6 px-1 text-center text-xs text-muted-foreground">
            {t("Conectado como")} {session?.user.email}
          </Text>
          <View className="mt-2 flex-row justify-center gap-4">
            <Text
              onPress={() => void Linking.openURL(urlDoSite("/termos"))}
              className="text-xs text-muted-foreground"
            >
              {t("Termos de Uso")}
            </Text>
            <Text
              onPress={() => void Linking.openURL(urlDoSite("/privacidade"))}
              className="text-xs text-muted-foreground"
            >
              {t("Política de Privacidade")}
            </Text>
          </View>
        </View>
      </ScrollView>

      {p && editando ? (
        <EditarCampo
          key={editando}
          campo={editando}
          perfil={p}
          onClose={() => setEditando(null)}
          onError={setErro}
        />
      ) : null}

      {p ? (
        <ShareProfileDialog
          open={compartilhando}
          onClose={() => setCompartilhando(false)}
          avatarPath={p.avatar_url}
          perfil={{
            nome: p.display_name,
            objetivo,
            treinos: totalTreinos || null,
            sequencia: sequencia.isPending ? null : sequencia.dias || null,
            recordes: destaques,
            metaPercent: jornada ? jornada.percent : null,
          }}
        />
      ) : null}

      <ConfirmDialog
        open={confirmandoSaida}
        onClose={() => setConfirmandoSaida(false)}
        title={t("Sair da conta?")}
        description={t(
          "Você vai precisar entrar de novo com seu e-mail e senha. Seus dados continuam salvos.",
        )}
        confirmLabel={t("Sair")}
        destructive
        onConfirm={() => void sair()}
      />
    </View>
  );
}

function BotaoTopo({
  icon,
  rotulo,
  onPress,
  disabled,
  cor,
}: {
  icon: IconNode;
  rotulo: string;
  onPress: () => void;
  disabled?: boolean;
  cor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={rotulo}
      className={cn(
        "h-11 w-11 items-center justify-center rounded-full bg-black/15 active:bg-black/25",
        disabled && "opacity-50",
      )}
    >
      <Icon node={icon} color={cor} size={20} />
    </Pressable>
  );
}

function Numero({
  icon,
  valor,
  rotulo,
}: {
  icon: IconNode;
  valor: number | null | undefined;
  rotulo: string;
}) {
  const primaria = useColor("primary");
  return (
    <View className="min-w-0 flex-1 rounded-[20px] bg-card p-4">
      <Icon node={icon} color={primaria} size={20} />
      {valor == null ? (
        <View className="mt-2 h-8 w-10 rounded-md bg-muted" />
      ) : (
        <Text className="mt-2 text-2xl font-extrabold">{valor}</Text>
      )}
      <Text className="text-xs text-muted-foreground">{rotulo}</Text>
    </View>
  );
}

function Titulo({ children }: { children: ReactNode }) {
  return <Text className="mb-3 mt-8 px-1 text-lg text-muted-foreground">{children}</Text>;
}

/** Um bloco de dado: toca e edita (ou abre a tela do dado). `acao={null}` = só leitura. */
function Dado({
  icon,
  rotulo,
  valor,
  unidade,
  nota,
  pequeno = false,
  acao = pencil,
  onPress,
}: {
  icon: IconNode;
  rotulo: string;
  valor: string | number | null | undefined;
  unidade?: string;
  nota?: string;
  pequeno?: boolean;
  acao?: IconNode | null;
  onPress?: () => void;
}) {
  const primaria = useColor("primary");
  const apagada = useColor("muted-foreground");
  const vazio = valor === null || valor === undefined || valor === "";
  const texto = vazio ? "" : String(valor);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={onPress ? t("Editar {{v0}}", { v0: rotulo.toLowerCase() }) : undefined}
      className="w-[48%] rounded-[20px] bg-card p-4 active:bg-elevated"
    >
      <View className="flex-row items-center gap-1.5">
        <Icon node={icon} color={primaria} size={16} />
        <Text className="flex-1 text-sm text-muted-foreground">{rotulo}</Text>
        {acao ? <Icon node={acao} color={apagada} size={14} /> : null}
      </View>
      <Text
        numberOfLines={1}
        className={cn("mt-2 font-extrabold", pequeno ? "text-lg" : "text-2xl")}
      >
        {vazio ? (
          <Text className="text-base font-normal text-muted-foreground">{t("Adicionar")}</Text>
        ) : (
          <>
            {texto.charAt(0).toUpperCase() + texto.slice(1)}
            {unidade ? (
              <Text className="text-base font-semibold text-muted-foreground"> {unidade}</Text>
            ) : null}
          </>
        )}
      </Text>
      {nota ? <Text className="text-xs text-muted-foreground">{nota}</Text> : null}
    </Pressable>
  );
}

type Perfil = NonNullable<Awaited<ReturnType<typeof fetchProfile>>>;

function EditarCampo({
  campo,
  perfil,
  onClose,
  onError,
}: {
  campo: ProfileField;
  perfil: Perfil;
  onClose: () => void;
  onError: (mensagem: string) => void;
}) {
  const qc = useQueryClient();
  const texto = useColor("foreground");
  const apagada = useColor("muted-foreground");
  const inicial = perfil[campo];
  const [valor, setValor] = useState<string>(inicial == null ? "" : String(inicial));
  const erro = validateProfileField(campo, valor);
  const { titulo, dica } = PROFILE_FIELD_TITLES[campo];

  const salvar = useMutation({
    mutationFn: async () => {
      if (erro) throw new Error(erro);
      await updateProfile(perfil.id, { [campo]: convertProfileField(campo, valor) });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.profile() });
      onClose();
    },
    onError: (e) => onError(errorMessage(e)),
  });

  return (
    <Dialog open onClose={onClose} title={titulo}>
      {dica ? (
        <Text className="-mt-2 text-center text-sm text-muted-foreground">{dica}</Text>
      ) : null}
      {campo === "display_name" ? (
        <TextInput
          autoFocus
          value={valor}
          maxLength={80}
          onChangeText={setValor}
          placeholder={t("Como podemos te chamar?")}
          placeholderTextColor={apagada}
          accessibilityLabel={titulo}
          className="h-12 rounded-md border border-input bg-background px-3 font-sans text-lg"
          style={{ color: texto }}
        />
      ) : null}
      {campo === "height_cm" || campo === "goal_weight_kg" ? (
        <View className="justify-center">
          <TextInput
            autoFocus
            value={valor}
            onChangeText={setValor}
            keyboardType="decimal-pad"
            accessibilityLabel={titulo}
            className="h-14 rounded-md border border-input bg-background px-3 pr-14 font-sans text-2xl font-bold"
            style={{ color: texto }}
          />
          <Text className="absolute right-4 text-muted-foreground">
            {campo === "height_cm" ? "cm" : "kg"}
          </Text>
        </View>
      ) : null}
      {campo === "birth_date" ? (
        <DatePicker
          max={todayISO()}
          value={valor}
          onChange={setValor}
          accessibilityLabel={titulo}
        />
      ) : null}
      {campo === "sex" ? <Opcoes valor={valor} onChange={setValor} opcoes={SEX_LABELS} /> : null}
      {campo === "goal" ? <Opcoes valor={valor} onChange={setValor} opcoes={GOAL_LABELS} /> : null}
      {campo === "activity_level" ? (
        <Opcoes valor={valor} onChange={setValor} opcoes={ACTIVITY_LABELS} dicas={ACTIVITY_HINTS} />
      ) : null}
      {erro && valor !== "" ? <Text className="text-sm text-destructive">{erro}</Text> : null}
      <View className="flex-row gap-2">
        <Button variant="outline" className="h-12 flex-1" onPress={onClose}>
          {t("Cancelar")}
        </Button>
        <Button
          className="h-12 flex-1"
          disabled={Boolean(erro)}
          loading={salvar.isPending}
          onPress={() => salvar.mutate()}
        >
          {t("Salvar")}
        </Button>
      </View>
    </Dialog>
  );
}

function Opcoes({
  valor,
  onChange,
  opcoes,
  dicas,
}: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: Record<string, string>;
  dicas?: Record<string, string>;
}) {
  return (
    <View accessibilityRole="radiogroup" className="gap-2">
      {Object.entries(opcoes).map(([k, rotulo]) => (
        <Pressable
          key={k}
          accessibilityRole="radio"
          accessibilityState={{ checked: valor === k }}
          onPress={() => onChange(k)}
          className={cn(
            "rounded-2xl border px-4 py-3",
            valor === k ? "border-primary bg-primary/10" : "border-border bg-card",
          )}
        >
          <Text className="font-semibold">{rotulo}</Text>
          {dicas?.[k] ? <Text className="text-sm text-muted-foreground">{dicas[k]}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}
