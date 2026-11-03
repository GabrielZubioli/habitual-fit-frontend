import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Circle, Svg } from "react-native-svg";
import { router } from "expo-router";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { fetchOpenSession } from "@forja/app-core/data/workout-session";
import { formatClock } from "@forja/app-core/lib/date";
import { emitirTerminarTreino } from "@/lib/eventos";
import { COR_TREINO } from "@/lib/paleta-treino";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/tabs";
import { __iconNode as house } from "lucide-react/dist/esm/icons/house.js";
import { __iconNode as calendarDays } from "lucide-react/dist/esm/icons/calendar-days.js";
import { __iconNode as utensils } from "lucide-react/dist/esm/icons/utensils.js";
import { __iconNode as menu } from "lucide-react/dist/esm/icons/menu.js";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { AppMenu } from "./app-menu";
import { BrandSymbol } from "./brand-symbol";
import { Icon, type IconNode } from "./icon";
import { Text } from "./text";
import { TrainLaunchOverlay, useTrainLaunch } from "./train-launch";
import { t } from "@forja/app-core/i18n";

/**
 * A barra de baixo do web (`_authenticated/route.tsx`): Início, Plano, o botão
 * de treinar no centro, Dieta e Menu.
 */
const ABAS = {
  dashboard: { label: t("Início"), icon: house },
  plan: { label: t("Plano"), icon: calendarDays },
  diet: { label: t("Dieta"), icon: utensils },
} satisfies Record<string, { label: string; icon: IconNode }>;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const primaria = useColor("primary");
  const apagada = useColor("muted-foreground");
  const [menuAberto, setMenuAberto] = useState(false);
  const lancamento = useTrainLaunch();
  const rotaAtual = state.routes[state.index];
  const atual = rotaAtual?.name;
  const sessaoAberta = useQuery({
    queryKey: [...queryKeys.workouts.all, "open-session-info"],
    queryFn: fetchOpenSession,
  });
  const sessao = sessaoAberta.data ?? null;
  /** Está na tela do próprio treino em andamento: o botão vira "terminar". */
  const naSessao =
    Boolean(sessao) &&
    atual === "workouts/session/[id]" &&
    (rotaAtual?.params as { id?: string } | undefined)?.id === sessao?.id;
  /** Treinar: sem treino, a tela Treinar; com treino, vai a ele; dentro dele, termina. */
  const aoTocarTreinar = () => {
    if (naSessao) return emitirTerminarTreino();
    if (sessao)
      return lancamento.lancar(
        () => router.push({ pathname: "/workouts/session/[id]", params: { id: sessao.id } }),
        "laranja",
      );
    lancamento.lancar(() => ir("train"), "verde");
  };

  const ir = (nome: string) => {
    const rota = state.routes.find((r) => r.name === nome);
    if (rota) navigation.navigate(rota.name, rota.params);
  };

  const aba = (nome: keyof typeof ABAS) => {
    const ativa = atual === nome;
    const { label, icon } = ABAS[nome];
    return (
      <Pressable
        key={nome}
        onPress={() => ir(nome)}
        accessibilityRole="tab"
        accessibilityState={{ selected: ativa }}
        className="min-h-[60px] flex-1 items-center justify-center gap-1 px-1 py-2"
      >
        <Icon node={icon} color={ativa ? primaria : apagada} />
        <Text
          numberOfLines={1}
          className={cn(
            "text-[12px]",
            ativa ? "font-semibold text-primary" : "text-muted-foreground",
          )}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      {/* Atrás da barra (vem antes dela): a tela troca, a navegação fica no lugar. */}
      <TrainLaunchOverlay fase={lancamento.fase} cor={lancamento.cor} />
      {/* Por cima do conteúdo, como o `fixed bottom-0` do web: as telas reservam
          o espaço no fim (pb-28). A faixa de cima é transparente e deixa o toque
          passar, mas faz parte da barra — no Android, toque fora dos limites
          da View pai se perde, e o botão central sobe acima da barra. */}
      <View pointerEvents="box-none" className="absolute inset-x-0 bottom-0 pt-11">
        <View
          className="flex-row items-end border-t border-border/60 bg-background/95"
          style={{ paddingBottom: insets.bottom }}
        >
          {aba("dashboard")}
          {aba("plan")}
          <Pressable
            onPress={aoTocarTreinar}
            accessibilityRole="button"
            accessibilityLabel={
              naSessao ? t("Terminar treino") : sessao ? t("Voltar ao treino") : t("Treinar")
            }
            // O botão "gravando" é 12 px maior: sobe junto para a barra não crescer.
            // `active:` só no Pressable: numa View, o NativeWind faz ela capturar o toque.
            className={cn(
              "flex-1 items-center gap-1 pb-2 active:scale-95",
              sessao ? "-mt-10" : "-mt-7",
            )}
          >
            {sessao ? (
              <Gravando
                startedAt={sessao.startedAt}
                plannedSeconds={sessao.plannedSeconds}
                naSessao={naSessao}
              />
            ) : (
              <>
                <View className="h-16 w-16 items-center justify-center rounded-full bg-[#01D798]">
                  <BrandSymbol width={36} escuro />
                </View>
                <Text className="text-[12px] font-bold text-primary">{t("Treinar")}</Text>
              </>
            )}
          </Pressable>
          {aba("diet")}
          <Pressable
            onPress={() => setMenuAberto(true)}
            accessibilityRole="button"
            accessibilityLabel={t("Menu")}
            className="min-h-[60px] flex-1 items-center justify-center gap-1 px-1 py-2"
          >
            <Icon node={menu} color={apagada} />
            <Text className="text-[12px] text-muted-foreground">{t("Menu")}</Text>
          </Pressable>
        </View>
      </View>
      <AppMenu open={menuAberto} onClose={() => setMenuAberto(false)} />
    </>
  );
}

/** Treino em andamento: o anel do tempo em volta do botão, como numa gravação. */
function Gravando({
  startedAt,
  plannedSeconds,
  naSessao,
}: {
  startedAt: string;
  plannedSeconds: number;
  naSessao: boolean;
}) {
  const borda = useColor("border");
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const decorrido = Math.max(0, (agora - Date.parse(startedAt)) / 1000);
  const progresso = Math.min(1, decorrido / plannedSeconds);
  const R = 35;
  const C = 2 * Math.PI * R;

  return (
    <>
      <View className="h-[76px] w-[76px]">
        <Svg
          width={76}
          height={76}
          viewBox="0 0 76 76"
          style={{ transform: [{ rotate: "-90deg" }] }}
        >
          <Circle cx="38" cy="38" r={R} fill="none" stroke={borda} strokeWidth={4} />
          <Circle
            cx="38"
            cy="38"
            r={R}
            fill="none"
            stroke={COR_TREINO.treino}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progresso)}
          />
        </Svg>
        <View
          className="absolute inset-[11px] items-center justify-center rounded-full"
          style={{
            backgroundColor: COR_TREINO.treino,
            elevation: 8,
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
        >
          {naSessao ? (
            <View className="h-5 w-5 rounded-[6px]" style={{ backgroundColor: COR_TREINO.tinta }} />
          ) : (
            <BrandSymbol width={32} escuro />
          )}
        </View>
      </View>
      <Text
        className="text-[12px] font-bold"
        style={{ color: COR_TREINO.treino, fontVariant: ["tabular-nums"] }}
      >
        {formatClock(decorrido)}
      </Text>
    </>
  );
}
