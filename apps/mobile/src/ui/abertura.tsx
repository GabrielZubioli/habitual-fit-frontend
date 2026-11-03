import { useState } from "react";
import { StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { BrandSymbol } from "./brand-symbol";
import { Glow } from "./glow";

// A tela nativa (logo parada, fundo escuro) fica até esta camada estar
// desenhada por cima — a troca não pisca.
void SplashScreen.preventAutoHideAsync();

/** O fundo e a cor do `expo-splash-screen` no app.json. */
const FUNDO = "#020306";
const VERDE = "#01D798";
/** A logo da tela nativa ocupa ~90% dos 120 dp da imagem. */
const LOGO = 108;

/**
 * A abertura: assume a tela nativa com a logo no mesmo lugar, a logo recua,
 * um brilho verde pulsa atrás e o nome aparece; depois a logo cresce e a
 * camada some, revelando o app que já carregou por baixo.
 */
export function Abertura() {
  const [fim, setFim] = useState(false);
  const logo = useSharedValue(1);
  const brilho = useSharedValue(0);
  const nome = useSharedValue(0);
  const camada = useSharedValue(1);

  const comecar = () => {
    void SplashScreen.hideAsync();
    const suave = Easing.bezier(0.22, 1, 0.36, 1);
    logo.value = withSequence(
      withTiming(0.86, { duration: 260, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 420, easing: suave }),
      withDelay(380, withTiming(7, { duration: 520, easing: Easing.in(Easing.cubic) })),
    );
    brilho.value = withSequence(
      withDelay(200, withTiming(1, { duration: 500, easing: suave })),
      withDelay(300, withTiming(0, { duration: 300 })),
    );
    nome.value = withSequence(
      withDelay(380, withTiming(1, { duration: 420, easing: suave })),
      withDelay(250, withTiming(0, { duration: 200 })),
    );
    camada.value = withDelay(
      1180,
      withTiming(0, { duration: 380 }, (ok) => {
        if (ok) runOnJS(setFim)(true);
      }),
    );
  };

  const estiloCamada = useAnimatedStyle(() => ({ opacity: camada.value }));
  const estiloLogo = useAnimatedStyle(() => ({ transform: [{ scale: logo.value }] }));
  const estiloBrilho = useAnimatedStyle(() => ({
    opacity: brilho.value,
    transform: [{ scale: 0.6 + brilho.value * 0.5 }],
  }));
  const estiloNome = useAnimatedStyle(() => ({
    opacity: nome.value,
    transform: [{ translateY: (1 - nome.value) * 12 }],
  }));

  if (fim) return null;

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={comecar}
      style={[StyleSheet.absoluteFill, styles.camada, estiloCamada]}
    >
      <Animated.View style={[styles.centro, estiloBrilho]}>
        <Glow size={320} color={VERDE} opacity={0.35} />
      </Animated.View>
      <Animated.View style={estiloLogo}>
        <BrandSymbol width={LOGO} />
      </Animated.View>
      <Animated.Text style={[styles.nome, estiloNome]}>Habitual Fit</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  camada: {
    backgroundColor: FUNDO,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    elevation: 100,
  },
  centro: {
    position: "absolute",
    width: 320,
    height: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  nome: {
    position: "absolute",
    top: "50%",
    marginTop: LOGO / 2 + 28,
    color: "#ffffff",
    fontFamily: "Inter",
    fontWeight: "800",
    fontSize: 22,
    letterSpacing: -0.4,
  },
});
