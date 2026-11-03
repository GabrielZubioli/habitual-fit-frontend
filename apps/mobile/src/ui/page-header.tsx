import { createContext, useContext, useRef, useState, type ReactNode, type Ref } from "react";
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import { Defs, LinearGradient, Rect, Stop, Svg } from "react-native-svg";
import { router, type Href } from "expo-router";
import { __iconNode as arrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { useColor, useTheme } from "@/theme/theme";
import { Icon } from "./icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./text";

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
    <View className="px-4 pb-3" style={{ paddingTop: Math.max(24, insets.top) }}>
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

/** Quanto o vidro passa da borda de baixo do cabeçalho, sumindo em degradê (o `-bottom-8` do web). */
const ESMAECER = 32;

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
export function HeaderFrame({
  header,
  tint,
  children,
}: {
  header: ReactNode;
  /** Cor do fundo da tela, se não for a do tema (a Treinar é verde). */
  tint?: string;
  children: ReactNode;
}) {
  const fundo = useColor("background");
  const { scheme } = useTheme();
  const cor = tint ?? fundo;
  const alvo = useRef<View | null>(null);
  const [altura, setAltura] = useState(0);
  const fim = altura / (altura + ESMAECER);
  return (
    <AlturaCabecalho.Provider value={altura}>
      <View style={{ flex: 1, backgroundColor: cor }}>
        <BlurTargetView ref={alvo} style={{ flex: 1, backgroundColor: cor }}>
          {children}
        </BlurTargetView>
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          onLayout={(e) => setAltura(Math.round(e.nativeEvent.layout.height))}
        >
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { bottom: -ESMAECER, overflow: "hidden" }]}
          >
            <BlurView
              blurTarget={alvo}
              intensity={45}
              tint={tint || scheme === "light" ? "light" : "dark"}
              blurMethod="dimezisBlurViewSdk31Plus"
              style={[StyleSheet.absoluteFill, { bottom: ESMAECER / 2 }]}
            />
            {/* O `bg-background/55` por cima do vidro, engrossando até a borda e
                sumindo depois dela — o `mask-image` do web. */}
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="vidro" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={cor} stopOpacity={0.55} />
                  <Stop offset={fim * 0.7} stopColor={cor} stopOpacity={0.6} />
                  <Stop offset={fim} stopColor={cor} stopOpacity={0.85} />
                  <Stop offset="1" stopColor={cor} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#vidro)" />
            </Svg>
          </View>
          {header}
        </View>
      </View>
    </AlturaCabecalho.Provider>
  );
}

/** O espaço do cabeçalho fixo no começo da rolagem. */
export function HeaderSpacer() {
  return <View style={{ height: useContext(AlturaCabecalho) }} />;
}

/** Um `ScrollView` com o cabeçalho fixo por cima — o par de quase toda tela. */
export function PageScroll({
  header,
  tint,
  ref,
  children,
  ...props
}: ScrollViewProps & { header: ReactNode; tint?: string; ref?: Ref<ScrollView> }) {
  return (
    <HeaderFrame header={header} tint={tint}>
      <ScrollView ref={ref} {...props}>
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
      accessibilityLabel="Voltar"
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
