import { StyleSheet, View, type ViewStyle } from "react-native";
import { Defs, LinearGradient, RadialGradient, Rect, Stop, Svg } from "react-native-svg";

/**
 * Efeitos que o web faz com `blur-3xl` e `bg-gradient-to-t`, que o React
 * Native não tem: aqui viram gradientes de SVG.
 */

/** Brilho difuso e redondo (o `rounded-full bg-primary/25 blur-3xl` do web). */
export function Glow({
  size,
  color,
  opacity = 0.25,
  style,
}: {
  size: number;
  color: string;
  opacity?: number;
  style?: ViewStyle;
}) {
  return (
    <View pointerEvents="none" style={[{ position: "absolute", width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="brilho" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.6" stopColor={color} stopOpacity={opacity * 0.5} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#brilho)" />
      </Svg>
    </View>
  );
}

/** Fundo que some para cima (o `bg-gradient-to-t from-background via-background/95 to-transparent`). */
export function FadeUp({ color }: { color: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="sobe" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset="0.5" stopColor={color} stopOpacity={0.95} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#sobe)" />
    </Svg>
  );
}
