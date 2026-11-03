import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MUSCLE_LABELS, label } from "@forja/app-core/lib/labels";
import {
  BODY_OUTLINE,
  MUSCLES_BY_VIEW,
  SILHOUETTE_PARTS,
  VIEW_BOX,
  resolveMuscle,
  type BodyView,
} from "@forja/app-core/lib/body-map/muscle-paths";
import {
  intensityByGroup,
  suggestedView,
  type MuscleIntensity,
} from "@forja/app-core/lib/body-map/intensity";

export {
  aggregateMuscleIntensities,
  type MuscleIntensity,
} from "@forja/app-core/lib/body-map/intensity";

/**
 * Mapa muscular — o que o treino de hoje estimula.
 *
 * ## Como a figura é montada
 *
 * Quatro camadas, nesta ordem:
 *
 * 1. **Silhueta** — cabeça, mãos, pés e articulações, em cinza neutro. Sem ela
 *    a figura teria buracos onde não há músculo mapeado.
 * 2. **Todos os músculos, apagados** — dá relevo anatômico ao corpo mesmo
 *    quando nada está destacado. Sem esta camada o boneco fica chapado e
 *    parece uma sombra, não um corpo.
 * 3. **Músculos ativos** — preenchidos com a cor de destaque.
 * 4. **Contorno** — traçado por cima de tudo, que é o que dá a linha da figura.
 *
 * ## A intensidade importa
 *
 * Um treino de peito recruta tríceps e deltoide anterior, mas não da mesma
 * forma. Pintar os três com a mesma cor diria algo falso; a opacidade acompanha
 * a **contribuição real** (a coluna `contribution` de `exercise_muscles`, 0 a
 * 1), então o peitoral aparece sólido e o tríceps, translúcido. É a diferença
 * entre um gráfico e um enfeite.
 *
 * ## Duas vistas, a primeira escolhida sozinha
 *
 * Um dia de costas abre de costas. Obrigar o usuário a virar a figura para ver
 * o que ele vai treinar é um toque a mais em cada abertura da tela.
 *
 * ## Enquadrar no que foi trabalhado
 *
 * Com `enquadrar`, a figura mostra só a região dos músculos destacados na vista
 * aberta — o mesmo efeito do `recorte` dos grupos de exercício, mas calculado
 * pelos próprios músculos, porque o treino de um dia muda de um dia para o
 * outro. A caixa sai da área real dos desenhos (`getBBox`), com folga e um
 * tamanho mínimo para o músculo não aparecer solto, sem o corpo em volta.
 */

export function BodyMap({
  muscles,
  className,
  showLegend = true,
  showToggle = true,
  size = "md",
  recorte,
  enquadrar = false,
}: {
  muscles: readonly MuscleIntensity[];
  className?: string;
  showLegend?: boolean;
  showToggle?: boolean;
  size?: "sm" | "md" | "lg";
  /**
   * Enquadra só uma região do corpo, numa vista fixa: `box` = [x, y, largura,
   * altura] nas coordenadas da vista (724 × 1448). O SVG passa a preencher o
   * contêiner.
   */
  recorte?: { view: BodyView; box: readonly [number, number, number, number] };
  /** Mostra só a região dos músculos destacados, numa moldura 4:3 que ocupa a largura. */
  enquadrar?: boolean;
}) {
  /** Intensidade por grupo desenhável, já resolvendo os apelidos. */
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
  // Enquanto o usuário não escolher, a vista acompanha o treino selecionado.
  const view = recorte?.view ?? escolhida ?? vistaSugerida;

  // Enquadramento: medido depois de desenhar, na área dos músculos ativos.
  const ativos = useRef<SVGGElement>(null);
  const [caixa, setCaixa] = useState<string | null>(null);
  useLayoutEffect(() => {
    const g = ativos.current;
    if (!enquadrar || !g || g.childElementCount === 0) {
      setCaixa(null);
      return;
    }
    const b = g.getBBox();
    // Folga de 15% e no mínimo 360 × 270 (meia figura): o músculo aparece com
    // o corpo em volta, não solto. Moldura 4:3, centrada no que foi trabalhado.
    let w = Math.max(b.width * 1.3, 360);
    let h = Math.max(b.height * 1.3, 270);
    if (w / h > 4 / 3) h = (w * 3) / 4;
    else w = (h * 4) / 3;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    setCaixa(`${cx - w / 2} ${cy - h / 2} ${w} ${h}`);
  }, [enquadrar, view, porGrupo]);

  const viewBox = recorte
    ? `${(view === "back" ? 724 : 0) + recorte.box[0]} ${recorte.box[1]} ${recorte.box[2]} ${recorte.box[3]}`
    : (caixa ?? VIEW_BOX[view]);

  const destacados = [...porGrupo.entries()].sort((a, b) => b[1] - a[1]);

  const altura = { sm: "h-40", md: "h-56 sm:h-64", lg: "h-72 sm:h-80" }[size];

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className={cn("relative", recorte && "size-full", enquadrar && "aspect-[4/3] w-full")}>
        <svg
          viewBox={viewBox}
          className={cn(recorte || enquadrar ? "size-full" : cn("w-auto", altura))}
          role="img"
          aria-label={
            destacados.length > 0
              ? `Músculos trabalhados: ${destacados.map(([m]) => label(MUSCLE_LABELS, m)).join(", ")}`
              : "Nenhum músculo destacado"
          }
        >
          {/* 1 — silhueta */}
          {SILHOUETTE_PARTS[view].map((d, i) => (
            <path key={`sil-${i}`} d={d} fill="var(--body-fill)" />
          ))}

          {/* 2 — músculos apagados, num tom levemente distinto da silhueta.
               É essa diferença mínima que dá relevo ao corpo: com o mesmo tom
               dos dois lados, o boneco vira uma sombra chapada. */}
          {Object.entries(MUSCLES_BY_VIEW[view]).map(([muscle, paths]) =>
            paths.map((d, i) => (
              <path key={`base-${muscle}-${i}`} d={d} fill="var(--body-relief)" />
            )),
          )}

          {/* 3 — músculos ativos (num grupo: é a área dele que o enquadramento mede) */}
          <g ref={ativos}>
            {Object.entries(MUSCLES_BY_VIEW[view]).map(([muscle, paths]) => {
              const intensidade = porGrupo.get(muscle) ?? 0;
              if (intensidade <= 0) return null;

              // Piso de 0,35: um músculo com contribuição 0,1 ficaria invisível, e
              // "quase não aparece" não é a mesma informação que "não trabalha".
              const opacidade = 0.35 + Math.min(1, intensidade) * 0.65;

              return paths.map((d, i) => (
                <path
                  key={`on-${muscle}-${i}`}
                  d={d}
                  fill={corDoGrupo.get(muscle) ?? "var(--primary)"}
                  opacity={opacidade}
                  className="transition-opacity duration-500 motion-reduce:transition-none"
                />
              ));
            })}
          </g>

          {/* 4 — contorno por cima, que é o que dá a linha da figura */}
          <path
            d={BODY_OUTLINE[view]}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.45}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {showToggle && (
          <div className="absolute inset-x-0 -bottom-2 flex justify-center">
            <div className="inline-flex rounded-full border border-border bg-card p-0.5 shadow-sm">
              {(["front", "back"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEscolhida(v)}
                  aria-pressed={view === v}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    view === v
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "front" ? "Frente" : "Costas"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showLegend && destacados.length > 0 && (
        <ul className="mt-7 flex flex-wrap justify-center gap-1.5">
          {destacados.slice(0, 6).map(([m, intensidade]) => {
            const principal = intensidade >= 0.75;
            return (
              <li
                key={m}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  principal ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {label(MUSCLE_LABELS, m)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
