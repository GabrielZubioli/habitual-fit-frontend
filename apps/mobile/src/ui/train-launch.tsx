import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { COR_TREINO } from "@/lib/paleta-treino";
import { Punho } from "./punho";

/**
 * A transição do botão Treinar — o `train-launch.tsx` do web: um braço verde da
 * largura da tela sobe do rodapé com o punho cerrado na ponta; a navegação
 * acontece no meio, coberta por ele; o punho sai pelo topo e a tela de destino,
 * da mesma cor, já está por baixo. Quem pediu menos movimento vai direto.
 */
type Fase = "subindo" | "saindo" | null;
export type CorLancamento = "verde" | "laranja";

const COR: Record<CorLancamento, string> = { verde: "#01D798", laranja: COR_TREINO.treino };
const SUBIDA_MS = 820;
/** O `cubic-bezier(0.3, 0.85, 0.35, 1)` do web. */
const CURVA = Easing.bezier(0.3, 0.85, 0.35, 1);

export function useTrainLaunch() {
  const [fase, setFase] = useState<Fase>(null);
  const [cor, setCor] = useState<CorLancamento>("verde");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reduzido = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduzido.current = v));
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const lancar = useCallback(
    (ir: () => void, corDoDestino: CorLancamento) => {
      if (fase) return;
      if (reduzido.current) return ir();
      setCor(corDoDestino);
      setFase("subindo");
      timers.current = [
        setTimeout(ir, SUBIDA_MS * 0.5),
        setTimeout(() => setFase("saindo"), SUBIDA_MS + 40),
        setTimeout(() => setFase(null), SUBIDA_MS + 400),
      ];
    },
    [fase],
  );

  return { fase, cor, lancar };
}

export function TrainLaunchOverlay({ fase, cor }: { fase: Fase; cor: CorLancamento }) {
  if (!fase) return null;
  return <Braco fase={fase} cor={COR[cor]} />;
}

function Braco({ fase, cor }: { fase: Exclude<Fase, null>; cor: string }) {
  const { width, height } = useWindowDimensions();
  // O punho é esticado na largura da tela (viewBox 1092 × 870).
  const alturaPunho = (width * 870) / 1092;
  const total = alturaPunho + height + 64;
  const y = useSharedValue(0);
  const giro = useSharedValue(-4);
  const escala = useSharedValue(0.94);
  const opacidade = useSharedValue(1);

  useEffect(() => {
    y.value = withTiming(-total, { duration: SUBIDA_MS, easing: CURVA });
    // O soco: chega inclinado, passa um pouco e assenta.
    giro.value = withSequence(
      withTiming(2, { duration: SUBIDA_MS * 0.55, easing: CURVA }),
      withTiming(0, { duration: SUBIDA_MS * 0.45, easing: CURVA }),
    );
    escala.value = withSequence(
      withTiming(1.03, { duration: SUBIDA_MS * 0.55, easing: CURVA }),
      withTiming(1, { duration: SUBIDA_MS * 0.45, easing: CURVA }),
    );
  }, [total, y, giro, escala]);

  useEffect(() => {
    if (fase === "saindo") opacidade.value = withTiming(0, { duration: 300 });
  }, [fase, opacidade]);

  const camada = useAnimatedStyle(() => ({ opacity: opacidade.value }));
  const braco = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const punho = useAnimatedStyle(() => ({
    transform: [{ rotate: `${giro.value}deg` }, { scale: escala.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }, camada]}
    >
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: height }, braco]}>
        <Animated.View style={[{ zIndex: 1 }, punho]}>
          <Punho width={width} height={alturaPunho} cor={cor} />
        </Animated.View>
        {/* O braço entra por baixo do punho: quando o soco inclina, não abre fresta. */}
        <View style={{ marginTop: -64, height: height + 64, backgroundColor: cor }} />
      </Animated.View>
    </Animated.View>
  );
}
