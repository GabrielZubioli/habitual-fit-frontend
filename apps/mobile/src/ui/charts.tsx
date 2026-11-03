import { useId, useState } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { useColor } from "@/theme/theme";
import { LOCALE } from "@forja/app-core/i18n";
import { t } from "@forja/app-core/i18n";

/**
 * Gráficos simples em SVG — o lugar dos gráficos do recharts no web: grade,
 * eixos e a série. ponytail: sem tooltip ao tocar; adicionar se a pessoa
 * sentir falta do valor exato (as telas já mostram os números ao lado).
 */
type Ponto = { label: string; value: number };

const EIXO_X = 20;
const TOPO = 8;

/** Eixo Y como o "auto" do recharts: ~4 divisões em passos redondos (1, 2, 5 × 10ⁿ). */
function escala(valores: readonly number[], zeroBase: boolean) {
  const menor = zeroBase ? 0 : Math.min(...valores);
  const maior = Math.max(...valores);
  const bruto = (maior - menor || Math.abs(maior) || 1) / 4;
  const ordem = 10 ** Math.floor(Math.log10(bruto));
  const passo = ([1, 2, 5, 10].find((f) => f * ordem >= bruto) ?? 10) * ordem;
  const min = zeroBase
    ? 0
    : Math.max(0, Math.floor(menor / passo) * passo - (maior === menor ? passo : 0));
  const max = Math.ceil(maior / passo) * passo + (maior === menor ? passo : 0);
  const ticks: number[] = [];
  for (let item = min; item <= max + passo / 2; item += passo) ticks.push(item);
  return { min, max, ticks };
}

function useGrafico(
  altura: number,
  n: number,
  valores: readonly number[],
  { zeroBase = false, eixoY = 40 }: { zeroBase?: boolean; eixoY?: number } = {},
) {
  const [largura, setLargura] = useState(0);
  const { min, max, ticks } = escala(valores.length ? valores : [0], zeroBase);
  const areaW = Math.max(0, largura - eixoY - 8);
  const areaH = altura - EIXO_X - TOPO;
  const y = (v: number) => TOPO + areaH - ((v - min) / (max - min)) * areaH;
  // Rótulos do eixo X sem encavalar: no máximo ~um a cada 56 px.
  const cada = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(areaW / 56))));
  return { largura, setLargura, areaW, areaH, y, ticks, cada, eixoY };
}

type Grafico = ReturnType<typeof useGrafico>;

function Grade({
  g,
  cor,
  texto,
  unidade = "",
}: {
  g: Grafico;
  cor: string;
  texto: string;
  unidade?: string;
}) {
  return g.ticks.map((item) => (
    <G key={item}>
      <Line
        x1={g.eixoY}
        x2={g.largura - 8}
        y1={g.y(item)}
        y2={g.y(item)}
        stroke={cor}
        strokeDasharray="3 3"
      />
      {g.eixoY > 0 ? (
        <SvgText x={g.eixoY - 6} y={g.y(item) + 4} fontSize={11} fill={texto} textAnchor="end">
          {`${Number(item.toPrecision(6)).toLocaleString(LOCALE)}${unidade}`}
        </SvgText>
      ) : null}
    </G>
  ));
}

function RotulosX({
  g,
  labels,
  x,
  altura,
  cor,
}: {
  g: Grafico;
  labels: readonly string[];
  x: (i: number) => number;
  altura: number;
  cor: string;
}) {
  return labels.map((l, i) =>
    i % g.cada === 0 ? (
      <SvgText key={i} x={x(i)} y={altura - 4} fontSize={11} fill={cor} textAnchor="middle">
        {l}
      </SvgText>
    ) : null,
  );
}

const caminho = (pts: readonly [number, number][]) =>
  pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");

export function AreaChart({ data, height }: { data: readonly Ponto[]; height: number }) {
  const g = useGrafico(
    height,
    data.length,
    data.map((p) => p.value),
  );
  const serie = useColor("chart-1");
  const grade = useColor("border");
  const texto = useColor("muted-foreground");
  const x = (i: number) =>
    g.eixoY + (data.length === 1 ? g.areaW / 2 : (i / (data.length - 1)) * g.areaW);
  const linha = caminho(data.map((p, i) => [x(i), g.y(p.value)]));
  const base = TOPO + g.areaH;
  return (
    <View style={{ height }} onLayout={(e) => g.setLargura(e.nativeEvent.layout.width)}>
      {g.largura > 0 ? (
        <Svg width={g.largura} height={height}>
          <Grade g={g} cor={grade} texto={texto} />
          <Path
            d={`${linha} L${x(data.length - 1)},${base} L${x(0)},${base} Z`}
            fill={serie}
            fillOpacity={0.12}
          />
          <Path d={linha} stroke={serie} strokeWidth={2.5} fill="none" />
          {data.map((p, i) => (
            <Circle key={i} cx={x(i)} cy={g.y(p.value)} r={3} fill={serie} />
          ))}
          <RotulosX g={g} labels={data.map((p) => p.label)} x={x} altura={height} cor={texto} />
        </Svg>
      ) : null}
    </View>
  );
}

export function BarChart({ data, height }: { data: readonly Ponto[]; height: number }) {
  const g = useGrafico(
    height,
    data.length,
    data.map((p) => p.value),
    { zeroBase: true },
  );
  const serie = useColor("chart-1");
  const grade = useColor("border");
  const texto = useColor("muted-foreground");
  const faixa = g.areaW / Math.max(1, data.length);
  const barra = Math.min(40, faixa * 0.7);
  const base = TOPO + g.areaH;
  const x = (i: number) => g.eixoY + faixa * (i + 0.5);
  return (
    <View style={{ height }} onLayout={(e) => g.setLargura(e.nativeEvent.layout.width)}>
      {g.largura > 0 ? (
        <Svg width={g.largura} height={height}>
          <Grade g={g} cor={grade} texto={texto} />
          {data.map((p, i) => {
            const topo = g.y(p.value);
            return (
              <Rect
                key={i}
                x={x(i) - barra / 2}
                y={topo}
                width={barra}
                height={base - topo}
                rx={4}
                fill={serie}
              />
            );
          })}
          <RotulosX g={g} labels={data.map((p) => p.label)} x={x} altura={height} cor={texto} />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Peso e tendência — o `charts/weight-chart.tsx` do web: o peso do dia é uma
 * linha fina e apagada (é ruído); a tendência, a linha grossa com a área. A
 * meta, tracejada em âmbar.
 */
export function WeightChart({
  data,
  goal,
  height,
  showDots = false,
}: {
  data: readonly { label: string; peso: number; tendencia: number }[];
  goal?: number | null;
  height: number;
  showDots?: boolean;
}) {
  const degrade = useId().replace(/:/g, "");
  const valores = [...data.flatMap((p) => [p.peso, p.tendencia]), ...(goal ? [goal] : [])];
  const g = useGrafico(height, data.length, valores, { eixoY: 52 });
  const serie = useColor("chart-1");
  const apagada = useColor("muted-foreground");
  const grade = useColor("border");
  const aviso = useColor("warning");
  const x = (i: number) =>
    g.eixoY + (data.length === 1 ? g.areaW / 2 : (i / (data.length - 1)) * g.areaW);
  const tendencia = caminho(data.map((p, i) => [x(i), g.y(p.tendencia)]));
  const base = TOPO + g.areaH;
  return (
    <View style={{ height }} onLayout={(e) => g.setLargura(e.nativeEvent.layout.width)}>
      {g.largura > 0 ? (
        <Svg width={g.largura} height={height}>
          <Defs>
            <LinearGradient id={degrade} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={serie} stopOpacity={0.2} />
              <Stop offset="1" stopColor={serie} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Grade g={g} cor={grade} texto={apagada} unidade=" kg" />
          {goal ? (
            <Line
              x1={g.eixoY}
              x2={g.largura - 8}
              y1={g.y(goal)}
              y2={g.y(goal)}
              stroke={aviso}
              strokeDasharray="6 5"
              strokeWidth={2}
            />
          ) : null}
          <Path
            d={`${tendencia} L${x(data.length - 1)},${base} L${x(0)},${base} Z`}
            fill={`url(#${degrade})`}
          />
          <Path
            d={caminho(data.map((p, i) => [x(i), g.y(p.peso)]))}
            stroke={apagada}
            strokeOpacity={0.7}
            strokeWidth={1.5}
            fill="none"
          />
          {showDots
            ? data.map((p, i) => <Circle key={i} cx={x(i)} cy={g.y(p.peso)} r={2} fill={apagada} />)
            : null}
          <Path d={tendencia} stroke={serie} strokeWidth={3} strokeLinecap="round" fill="none" />
          <RotulosX g={g} labels={data.map((p) => p.label)} x={x} altura={height} cor={apagada} />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Treinos por semana — o `charts/weekly-chart.tsx` do web: a semana atual
 * acesa, as outras recuam; a meta da rotina tracejada.
 */
export function WeeklyChart({
  data,
  goal,
  height,
}: {
  data: readonly Ponto[];
  goal?: number | null;
  height: number;
}) {
  const valores = [...data.map((p) => p.value), goal ?? 0, 1];
  const g = useGrafico(height, data.length, valores, { zeroBase: true, eixoY: 4 });
  const serie = useColor("chart-1");
  const texto = useColor("muted-foreground");
  const faixa = g.areaW / Math.max(1, data.length);
  const barra = Math.min(40, faixa * 0.7);
  const base = TOPO + g.areaH;
  const x = (i: number) => g.eixoY + faixa * (i + 0.5);
  const atual = data.length - 1;
  return (
    <View style={{ height }} onLayout={(e) => g.setLargura(e.nativeEvent.layout.width)}>
      {g.largura > 0 ? (
        <Svg width={g.largura} height={height}>
          {goal ? (
            <G>
              <Line
                x1={g.eixoY}
                x2={g.largura - 4}
                y1={g.y(goal)}
                y2={g.y(goal)}
                stroke={serie}
                strokeOpacity={0.6}
                strokeDasharray="5 5"
              />
              <SvgText
                x={g.largura - 6}
                y={g.y(goal) + 12}
                fontSize={10}
                fill={texto}
                textAnchor="end"
              >
                {t("meta {{goal}}", { goal })}
              </SvgText>
            </G>
          ) : null}
          {data.map((p, i) => {
            const topo = g.y(p.value);
            return (
              <Rect
                key={i}
                x={x(i) - barra / 2}
                y={topo}
                width={barra}
                height={Math.max(0, base - topo)}
                rx={6}
                fill={serie}
                fillOpacity={i === atual ? 1 : 0.35}
              />
            );
          })}
          <RotulosX g={g} labels={data.map((p) => p.label)} x={x} altura={height} cor={texto} />
        </Svg>
      ) : null}
    </View>
  );
}

/** Mini-gráfico de uma medida — sem eixo nem grade: só a direção da curva. */
export function Sparkline({ values, height }: { values: readonly number[]; height: number }) {
  const degrade = useId().replace(/:/g, "");
  const [largura, setLargura] = useState(0);
  const serie = useColor("chart-1");
  const min = Math.min(...values);
  const max = Math.max(...values);
  const y = (v: number) =>
    4 + (max === min ? (height - 4) / 2 : (1 - (v - min) / (max - min)) * (height - 8));
  const x = (i: number) =>
    2 + (values.length === 1 ? largura / 2 : (i / (values.length - 1)) * (largura - 4));
  const linha = caminho(values.map((v, i) => [x(i), y(v)]));
  return (
    <View style={{ height }} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {largura > 0 && values.length > 0 ? (
        <Svg width={largura} height={height}>
          <Defs>
            <LinearGradient id={degrade} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={serie} stopOpacity={0.25} />
              <Stop offset="1" stopColor={serie} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path
            d={`${linha} L${x(values.length - 1)},${height} L${x(0)},${height} Z`}
            fill={`url(#${degrade})`}
          />
          <Path d={linha} stroke={serie} strokeWidth={2} fill="none" />
        </Svg>
      ) : null}
    </View>
  );
}
