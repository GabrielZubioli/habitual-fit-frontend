import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  makeMutable,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";

/**
 * O `Skeleton` do web (`components/ui/skeleton.tsx`): espaço reservado neutro
 * (`bg-muted`) enquanto o dado não chegou, com um brilho que vai e volta.
 *
 * Um relógio só para todos: um skeleton que monta depois pulsa em fase com os
 * que já estavam na tela, em vez de a tela piscar em ondas desencontradas.
 */
const brilho = makeMutable(0);
let andando = false;

export function Skeleton({ className }: { className?: string }) {
  const cor = useColor("foreground");
  if (!andando) {
    andando = true;
    brilho.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }
  const estilo = useAnimatedStyle(() => ({ opacity: brilho.value * 0.06 }));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn("overflow-hidden rounded-md bg-muted", className)}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: cor }, estilo]}
      />
    </View>
  );
}
