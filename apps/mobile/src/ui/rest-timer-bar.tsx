import { useState } from "react";
import { Pressable, View } from "react-native";
import { __iconNode as bell } from "lucide-react/dist/esm/icons/bell.js";
import { __iconNode as bellOff } from "lucide-react/dist/esm/icons/bell-off.js";
import { __iconNode as minus } from "lucide-react/dist/esm/icons/minus.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { __iconNode as x } from "lucide-react/dist/esm/icons/x.js";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PaletaTreino } from "@/lib/paleta-treino";
import { restSoundEnabled, setRestSound, type RestTimer } from "@/lib/rest-timer";
import { Icon } from "./icon";
import { Text } from "./text";

/**
 * A barra do descanso — o `RestTimerBar` do web: o tempo encolhendo, − e + 15
 * segundos à esquerda, som e pular à direita, e o meio livre para o botão
 * Treinar, que sobe sobre ela.
 *
 * O recorte em volta do botão é, no web, uma máscara CSS. Aqui é um círculo na
 * cor da página por cima da barra (cortado pelas bordas dela): o que se veria
 * pelo recorte é justamente o fundo da página.
 */
const RAIO_RECORTE = 38 + 8; // anel do botão gravando (76 px) + folga do web
/**
 * A barra fica 8 px acima da barra de abas; o anel do botão gravando sobe 40 px
 * (`-mt-10`) e tem 76, então o centro dele fica 2 px acima da barra de abas —
 * 6 px abaixo da borda de baixo desta barra.
 */
const CENTRO_ABAIXO = 6;
/** Altura da barra de abas sem a área segura (alvo de 60 px). */
const BARRA_ABAS = 60;

export function RestTimerBar({ timer, p }: { timer: RestTimer; p: PaletaTreino }) {
  const [som, setSom] = useState(restSoundEnabled);
  const insets = useSafeAreaInsets();
  if (timer.remaining === null) return null;

  const mm = Math.floor(timer.remaining / 60);
  const ss = String(timer.remaining % 60).padStart(2, "0");
  const fracao = timer.total > 0 ? timer.remaining / timer.total : 0;

  const pequeno = "h-9 w-9 items-center justify-center rounded-full active:scale-90";
  const grande = "h-11 w-11 items-center justify-center rounded-full active:scale-90";

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 px-4"
      style={{ bottom: BARRA_ABAS + insets.bottom + 8 }}
    >
      <View
        accessibilityRole="timer"
        accessibilityLabel="Descanso"
        className="mx-auto w-full max-w-md overflow-hidden rounded-3xl"
        style={{
          backgroundColor: p.surface,
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 16,
        }}
      >
        <View className="h-1" style={{ backgroundColor: p.raised }}>
          <View
            className="h-full"
            style={{ width: `${fracao * 100}%`, backgroundColor: p.accent }}
          />
        </View>
        <View className="flex-row items-center justify-between gap-2 p-2">
          <View className="flex-row items-center">
            <Pressable
              className={pequeno}
              style={{ backgroundColor: p.raised }}
              onPress={() => timer.adjust(-15)}
              accessibilityLabel="Menos 15 segundos"
            >
              <Icon node={minus} color={p.on} size={16} />
            </Pressable>
            <View className="min-w-[54px] items-center px-1">
              <Text
                className="text-[9px] font-bold uppercase tracking-[1.5px]"
                style={{ color: p.onSoft }}
              >
                Descanso
              </Text>
              <Text
                numberOfLines={1}
                className="text-2xl font-extrabold leading-none"
                style={{ color: p.accent }}
              >
                {mm}:{ss}
              </Text>
            </View>
            <Pressable
              className={pequeno}
              style={{ backgroundColor: p.raised }}
              onPress={() => timer.adjust(15)}
              accessibilityLabel="Mais 15 segundos"
            >
              <Icon node={plus} color={p.on} size={16} />
            </Pressable>
          </View>
          <View className="flex-row items-center gap-1">
            <Pressable
              className={grande}
              onPress={() => {
                setSom(!som);
                setRestSound(!som);
              }}
              accessibilityLabel={som ? "Desligar som do descanso" : "Ligar som do descanso"}
              accessibilityState={{ checked: som }}
            >
              <Icon node={som ? bell : bellOff} color={p.onSoft} size={20} />
            </Pressable>
            <Pressable
              onPress={timer.stop}
              accessibilityLabel="Pular descanso"
              className={grande}
              style={{ backgroundColor: p.accent }}
            >
              <Icon node={x} color={p.accentFg} size={20} strokeWidth={2.75} />
            </Pressable>
          </View>
        </View>
        {/* O recorte do botão Treinar. */}
        <View
          pointerEvents="none"
          className="absolute self-center rounded-full"
          style={{
            width: RAIO_RECORTE * 2,
            height: RAIO_RECORTE * 2,
            bottom: -(CENTRO_ABAIXO + RAIO_RECORTE),
            backgroundColor: p.page,
          }}
        />
      </View>
    </View>
  );
}
