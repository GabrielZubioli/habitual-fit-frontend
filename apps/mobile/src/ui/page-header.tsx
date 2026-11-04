import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import MaskedView from "@react-native-masked-view/masked-view";
import { Defs, LinearGradient, Rect, Stop, Svg } from "react-native-svg";
import { router, useFocusEffect, type Href } from "expo-router";
import { __iconNode as arrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { useColor, useTheme } from "@/theme/theme";
import { Icon } from "./icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/**
 * O PageHeader do web (`components/page-header.tsx`): título de 40 px em
 * extrabold, descrição abaixo, ação opcional à direita.
 */
export function PageHeader({
  title,
  description,
  action,
  topo,
}: {
  title: string;
  /** Texto, ou um elemento (o seletor de data da Dieta). */
  description?: ReactNode;
  action?: ReactNode;
  /** Linha acima do título, alinhada à direita (o `topo` do web). */
  topo?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="px-4 pb-2" style={{ paddingTop: Math.max(16, insets.top + 4) }}>
      {topo ? <View className="mb-2 flex-row justify-end">{topo}</View> : null}
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[40px] font-extrabold leading-[42px] tracking-tight">{title}</Text>
          {typeof description === "string" ? (
            <Text className="mt-1 text-base text-muted-foreground">{description}</Text>
          ) : description ? (
            <View className="mt-1">{description}</View>
          ) : null}
        </View>
        {action ? <View className="flex-row items-center gap-2">{action}</View> : null}
      </View>
    </View>
  );
}

/** Quanto o vidro passa da borda de baixo do cabeçalho (o `-bottom-4` do web). */
const ESMAECER = 16;
/** Altura do degradê em que o vidro some (o `calc(100%-2rem)` do web). */
const DEGRADE = 32;

const AlturaCabecalho = createContext(0);

/**
 * O `sticky top-0` do web, em vidro fosco: o cabeçalho fica parado no topo e o
 * conteúdo rola por trás dele, desfocado. O vidro passa um pouco da borda de
 * baixo e some em degradê, sem linha de corte.
 *
 * No Android o desfoque precisa saber o que desfocar (`BlurTargetView`), e o
 * vidro não pode estar dentro dele — por isso o cabeçalho sai da rolagem e
 * fica por cima dela. O conteúdo abre espaço com `HeaderSpacer`.
 */
export function HeaderFrame({ header, children }: { header: ReactNode; children: ReactNode }) {
  const cor = useColor("background");
  const { scheme } = useTheme();
  const alvo = useRef<View | null>(null);
  const [altura, setAltura] = useState(0);
  const inicioFade = Math.max(0, (altura + ESMAECER - DEGRADE) / (altura + ESMAECER || 1));
  return (
    <AlturaCabecalho.Provider value={altura}>
      <View style={{ flex: 1, backgroundColor: cor }}>
        <BlurTargetView ref={alvo} style={{ flex: 1, backgroundColor: cor }}>
          {/* O fundo como filho: o desfoque do Android não lê o fundo do
              próprio alvo, e numa tela de rolagem transparente desfocava um
              vazio que saía cinza. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: cor }]} />
          {children}
        </BlurTargetView>
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          onLayout={(e) => setAltura(Math.round(e.nativeEvent.layout.height))}
        >
          {/* O `mask-image` do web: uma máscara só para desfoque e véu, que
              ficam inteiros até 32 px antes do fim e somem num degradê
              contínuo — sem faixas nem linha de corte. */}
          <MaskedView
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { bottom: -ESMAECER }]}
            maskElement={
              <Svg style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="vidro" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#000" stopOpacity={1} />
                    <Stop offset={inicioFade} stopColor="#000" stopOpacity={1} />
                    <Stop offset="1" stopColor="#000" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#vidro)" />
              </Svg>
            }
          >
            {/* O tint do expo-blur no Android pinta uma cor por cima do
                desfoque: o `dark` é um cinza (25,25,25); o
                `systemChromeMaterialDark` é preto e some sob o véu. */}
            <BlurView
              blurTarget={alvo}
              intensity={60}
              tint={scheme === "light" ? "light" : "systemChromeMaterialDark"}
              blurMethod="dimezisBlurViewSdk31Plus"
              style={StyleSheet.absoluteFill}
            />
            {/* O `bg-background/55` por cima do vidro. */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: cor, opacity: 0.55 }]} />
          </MaskedView>
          {header}
        </View>
      </View>
    </AlturaCabecalho.Provider>
  );
}

/** Respiro entre o cabeçalho e o conteúdo (o `pt-2` do `PageBody` do web). */
const RESPIRO = 8;

/**
 * O espaço do cabeçalho fixo no começo da rolagem, mais o respiro: sem ele o
 * conteúdo começa onde o vidro ainda está quase opaco e fica por baixo dele.
 */
export function HeaderSpacer() {
  return <View style={{ height: useContext(AlturaCabecalho) + RESPIRO }} />;
}

type Rolavel = {
  scrollTo?: (o: { y: number; animated: boolean }) => void;
  scrollToOffset?: (o: { offset: number; animated: boolean }) => void;
};

/**
 * Toda entrada numa tela começa no topo. As telas das abas ficam montadas
 * entre uma visita e outra e guardavam a rolagem; agora ela volta ao topo ao
 * sair — sem animação e fora da vista, então a próxima entrada não pula depois
 * de carregar. Atualizações com a tela aberta não mexem na rolagem.
 */
export function useTopoAoSair(ref: RefObject<Rolavel | null>) {
  useFocusEffect(
    useCallback(
      () => () => {
        const r = ref.current;
        if (r?.scrollToOffset) r.scrollToOffset({ offset: 0, animated: false });
        else r?.scrollTo?.({ y: 0, animated: false });
      },
      [ref],
    ),
  );
}

/** Um `ScrollView` com o cabeçalho fixo por cima — o par de quase toda tela. */
export function PageScroll({
  header,
  children,
  ...props
}: ScrollViewProps & { header: ReactNode }) {
  const rolagem = useRef<ScrollView>(null);
  useTopoAoSair(rolagem);
  return (
    <HeaderFrame header={header}>
      <ScrollView ref={rolagem} {...props}>
        <HeaderSpacer />
        {children}
      </ScrollView>
    </HeaderFrame>
  );
}

/** O BackButton do web: volta no histórico ou, sem histórico, vai ao `fallback`. */
export function BackButton({ fallback = "/dashboard" }: { fallback?: Href }) {
  const cor = useColor("foreground");
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.navigate(fallback))}
      accessibilityLabel={t("Voltar")}
      className="h-11 w-11 items-center justify-center rounded-full bg-card active:bg-elevated"
    >
      <Icon node={arrowLeft} color={cor} size={20} />
    </Pressable>
  );
}

/** O `headerIconClass` do web: botão redondo de 48 px no cabeçalho. */
export function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: import("./icon").IconNode;
  label: string;
  onPress: () => void;
}) {
  const cor = useColor("foreground");
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="h-12 w-12 items-center justify-center rounded-full bg-card active:bg-elevated"
    >
      <Icon node={icon} color={cor} size={20} />
    </Pressable>
  );
}
