import { useId } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Text } from "./text";

/**
 * Os anéis de calorias e macros — o `home/macro-rings.tsx` do web. Contam o
 * consumido contra a meta (ou, sem meta, contra o planejado). Só as calorias
 * acendem o vermelho, e só acima de 105%.
 */
export const MACRO_COLORS = {
  protein: "chart-1",
  carbs: "chart-2",
  fat: "chart-4",
  fiber: "chart-5",
} as const;

type CorMacro = (typeof MACRO_COLORS)[keyof typeof MACRO_COLORS];

export function CalorieRing({
  consumed,
  target,
  planejado = 0,
  size = 148,
  compacto = false,
}: {
  consumed: number;
  target: number;
  planejado?: number;
  size?: number;
  compacto?: boolean;
}) {
  const degrade = useId().replace(/:/g, "");
  const primaria = useColor("primary");
  const brilho = useColor("primary-glow");
  const escura = useColor("primary-dark");
  const destrutiva = useColor("destructive");
  const stroke = compacto ? 10 : 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const usaMeta = target > 0;
  const referencia = usaMeta ? target : planejado;
  const ratio = referencia > 0 ? consumed / referencia : 0;
  const offset = circumference * (1 - Math.min(1, ratio));
  const restante = Math.round(target - consumed);
  const excedeu = usaMeta && ratio > 1.05;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={
        referencia > 0
          ? `${Math.round(consumed)} de ${Math.round(referencia)} calorias ${usaMeta ? "da meta" : "planejadas"} consumidas.`
          : `${Math.round(consumed)} calorias consumidas.`
      }
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Defs>
          <LinearGradient id={degrade} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={brilho} />
            <Stop offset="1" stopColor={escura} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={primaria}
          strokeOpacity={0.15}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={excedeu ? destrutiva : compacto ? primaria : `url(#${degrade})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text
          className={cn(
            compacto ? "text-lg" : "text-5xl",
            "font-bold leading-none tracking-tight",
            excedeu && "text-destructive",
          )}
        >
          {(usaMeta ? Math.abs(restante) : Math.round(consumed)).toLocaleString("pt-BR")}
        </Text>
        <Text className={cn("mt-1 text-muted-foreground", compacto ? "text-[9px]" : "text-xs")}>
          {!usaMeta
            ? "kcal"
            : restante >= 0
              ? compacto
                ? "restantes"
                : "kcal restantes"
              : "kcal acima"}
        </Text>
        {!compacto && referencia > 0 ? (
          <Text className="mt-1.5 text-[11px] text-muted-foreground">
            {usaMeta
              ? `${Math.round(consumed).toLocaleString("pt-BR")} / ${Math.round(target).toLocaleString("pt-BR")}`
              : `de ${Math.round(planejado).toLocaleString("pt-BR")} planejadas`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Um macro: anel com o ícone no centro, o percentual num selo, nome e gramas. */
export function MacroRing({
  nome,
  icone,
  valor,
  meta,
  planejado = 0,
  cor,
}: {
  nome: string;
  icone: string;
  valor: number;
  meta: number;
  planejado?: number;
  cor: CorMacro;
}) {
  const degrade = useId().replace(/:/g, "");
  const traco = useColor(cor);
  const brilho = useColor("primary-glow");
  const escura = useColor("primary-dark");
  const r = 26;
  const c = 2 * Math.PI * r;
  const referencia = meta > 0 ? meta : planejado;
  const semMeta = referencia <= 0;
  const pct = semMeta ? 0 : Math.min(1, valor / referencia);
  // Anel verde (a proteína) leva o mesmo degradê do anel de calorias.
  const verde = cor === MACRO_COLORS.protein;
  return (
    <View className="min-w-0 flex-1 items-center">
      <View className="h-[72px] w-[72px]">
        <Svg
          width={72}
          height={72}
          viewBox="0 0 64 64"
          style={{ transform: [{ rotate: "-90deg" }] }}
        >
          {verde ? (
            <Defs>
              <LinearGradient id={degrade} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={brilho} />
                <Stop offset="1" stopColor={escura} />
              </LinearGradient>
            </Defs>
          ) : null}
          <Circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={traco}
            strokeOpacity={0.16}
            strokeWidth="8"
          />
          <Circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={verde ? `url(#${degrade})` : traco}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
          />
        </Svg>
        <View className="absolute inset-[11px] items-center justify-center rounded-full bg-elevated">
          <Text className="text-2xl">{icone}</Text>
        </View>
        {!semMeta ? (
          <View className="absolute -right-1 -top-1 rounded-full border border-border bg-card px-1.5">
            <Text className="text-[10px] font-extrabold">{Math.round(pct * 100)}%</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} className="mt-1.5 text-xs font-bold">
        {nome}
      </Text>
      <Text className="text-[11px] text-muted-foreground">
        {semMeta ? (
          valor > 0 ? (
            `${Math.round(valor)}g`
          ) : (
            "nada planejado"
          )
        ) : (
          <>
            <Text className="text-[11px] font-bold">{Math.round(valor)}</Text>/
            {Math.round(referencia)}g
          </>
        )}
      </Text>
    </View>
  );
}
