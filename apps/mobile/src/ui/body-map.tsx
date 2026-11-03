import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { G, Path, Svg } from "react-native-svg";
import {
  BODY_OUTLINE,
  MUSCLES_BY_VIEW,
  SILHOUETTE_PARTS,
  VIEW_BOX,
  resolveMuscle,
  type BodyView,
} from "@forja/app-core/lib/body-map/muscle-paths";
import {
  framedViewBox,
  intensityByGroup,
  suggestedView,
  type MuscleIntensity,
} from "@forja/app-core/lib/body-map/intensity";
import { MUSCLE_LABELS, label } from "@forja/app-core/lib/labels";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/**
 * Mapa muscular — o `body-map.tsx` do web, com os mesmos desenhos (do
 * `app-core`) e as mesmas quatro camadas: silhueta, todos os músculos apagados
 * (o relevo), os ativos com opacidade pela contribuição real, e o contorno.
 * A primeira vista é a de mais estímulo; `enquadrar` mostra só a região
 * trabalhada, numa moldura 4:3.
 */
export function BodyMap({
  muscles,
  showLegend = true,
  showToggle = true,
  size = "md",
  enquadrar = false,
  recorte,
}: {
  muscles: readonly MuscleIntensity[];
  showLegend?: boolean;
  showToggle?: boolean;
  size?: "sm" | "md" | "lg";
  enquadrar?: boolean;
  /**
   * Só uma região do corpo, numa vista fixa: `box` = [x, y, largura, altura]
   * nas coordenadas da vista (724 × 1448). O desenho preenche o contêiner.
   */
  recorte?: { view: BodyView; box: readonly [number, number, number, number] };
}) {
  const fill = useColor("body-fill");
  const relief = useColor("body-relief");
  const primaria = useColor("primary");
  const contorno = useColor("muted-foreground");
  const branco = useColor("primary-foreground");

  const corDoGrupo = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const m of muscles) {
      const grupo = resolveMuscle(m.muscle);
      if (grupo && m.color && !mapa.has(grupo)) mapa.set(grupo, m.color);
    }
    return mapa;
  }, [muscles]);
  const porGrupo = useMemo(() => intensityByGroup(muscles), [muscles]);
  const vistaSugerida = useMemo(() => suggestedView(porGrupo), [porGrupo]);
  const [escolhida, setEscolhida] = useState<BodyView | null>(null);
  /** Largura desenhada, para o contorno ter 2,5 px na tela (o `non-scaling-stroke` do web). */
  const [larguraNaTela, setLarguraNaTela] = useState(330);
  const view = recorte?.view ?? escolhida ?? vistaSugerida;
  const viewBox = useMemo(() => {
    if (recorte) {
      const [x, y, w, h] = recorte.box;
      return `${(view === "back" ? 724 : 0) + x} ${y} ${w} ${h}`;
    }
    return enquadrar ? framedViewBox(view, porGrupo) : VIEW_BOX[view];
  }, [recorte, enquadrar, view, porGrupo]);
  const preenche = enquadrar || Boolean(recorte);
  const destacados = [...porGrupo.entries()].sort((a, b) => b[1] - a[1]);
  // `h-56` / `h-72` do web (o `sm:` não vale no celular).
  const altura = { sm: 160, md: 224, lg: 288 }[size];
  // O contorno do web usa `vector-effect: non-scaling-stroke` (2,5 px na tela);
  // aqui o traço escala com o desenho, então é ajustado pela escala da vista.
  const largura = Number(viewBox.split(" ")[2]);
  const traco = preenche ? (2.5 * largura) / larguraNaTela : (2.5 * 1448) / altura;

  return (
    <View className={cn("items-center", recorte && "h-full w-full")}>
      <View
        className={cn("relative", enquadrar && "aspect-[4/3] w-full", recorte && "h-full w-full")}

        onLayout={(e) => setLarguraNaTela(Math.max(1, e.nativeEvent.layout.width))}
      >
        <Svg
          viewBox={viewBox}
          width={preenche ? "100%" : altura / 2}
          height={preenche ? "100%" : altura}
          accessibilityRole="image"
          accessibilityLabel={
            destacados.length > 0
              ? t("Músculos trabalhados: {{v0}}", {
                  v0: destacados.map(([m]) => label(MUSCLE_LABELS, m)).join(", "),
                })
              : t("Nenhum músculo destacado")
          }
        >
          {SILHOUETTE_PARTS[view].map((d, i) => (
            <Path key={`sil-${i}`} d={d} fill={fill} />
          ))}
          {Object.entries(MUSCLES_BY_VIEW[view]).map(([muscle, paths]) =>
            paths.map((d, i) => <Path key={`base-${muscle}-${i}`} d={d} fill={relief} />),
          )}
          <G>
            {Object.entries(MUSCLES_BY_VIEW[view]).map(([muscle, paths]) => {
              const intensidade = porGrupo.get(muscle) ?? 0;
              if (intensidade <= 0) return null;
              // Piso de 0,35: "quase não aparece" não é o mesmo que "não trabalha".
              const opacidade = 0.35 + Math.min(1, intensidade) * 0.65;
              return paths.map((d, i) => (
                <Path
                  key={`on-${muscle}-${i}`}
                  d={d}
                  fill={corDoGrupo.get(muscle) ?? primaria}
                  opacity={opacidade}
                />
              ));
            })}
          </G>
          <Path
            d={BODY_OUTLINE[view]}
            fill="none"
            stroke={contorno}
            strokeWidth={traco}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.45}
          />
        </Svg>

        {showToggle ? (
          <View className="absolute inset-x-0 -bottom-2 items-center">
            <View className="flex-row rounded-full border border-border bg-card p-0.5 shadow-sm">
              {(["front", "back"] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setEscolhida(v)}
                  accessibilityState={{ selected: view === v }}
                  className={cn("rounded-full px-3 py-1", view === v && "bg-primary")}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: view === v ? branco : contorno }}
                  >
                    {v === "front" ? t("Frente") : t("Costas")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {showLegend && destacados.length > 0 ? (
        <View className="mt-7 flex-row flex-wrap justify-center gap-1.5">
          {destacados.slice(0, 6).map(([m, intensidade]) => {
            const principal = intensidade >= 0.75;
            return (
              <View
                key={m}
                className={cn("rounded-full px-2.5 py-1", principal ? "bg-primary/15" : "bg-muted")}
              >
                <Text
                  className={cn(
                    "text-xs font-medium",
                    principal ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {label(MUSCLE_LABELS, m)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
