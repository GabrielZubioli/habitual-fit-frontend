import { useRef, useState, type ReactNode } from "react";
import { PanResponder, Pressable, StyleSheet, View } from "react-native";
import { Defs, LinearGradient, Rect, Stop, Svg } from "react-native-svg";
import { __iconNode as check } from "lucide-react/dist/esm/icons/check.js";
import { WEEKDAY_INITIALS, WEEKDAY_LABELS, WEEKDAYS } from "@forja/domain";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Button } from "./button";
import { Icon } from "./icon";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/**
 * Controles do questionário — os mesmos do web
 * (`components/onboarding/controls.tsx`): alvos de toque de 48 px ou mais e
 * resposta imediata a cada seleção.
 */

export function Question({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View className="flex-1">
      <View className="mb-6">
        <Text
          textBreakStrategy="balanced"
          className="text-2xl font-bold leading-tight tracking-tight"
        >
          {title}
        </Text>
        {subtitle ? <Text className="mt-2 text-sm text-muted-foreground">{subtitle}</Text> : null}
      </View>
      <View className="flex-1">{children}</View>
    </View>
  );
}

interface ChoiceOption {
  value: string;
  label: string;
  hint?: string;
  emoji?: string;
}

/** Escolha única. Tocar marca a opção; o "Continuar" da etapa é quem avança. */
export function ChoiceList({
  options,
  selected,
  onSelect,
  columns = 1,
}: {
  options: readonly ChoiceOption[];
  selected: string | null | undefined;
  onSelect: (value: string) => void;
  columns?: 1 | 2;
}) {
  const branco = useColor("primary-foreground");
  return (
    <View className={cn("gap-2.5", columns === 2 && "flex-row flex-wrap")}>
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            className={cn(
              "min-h-[56px] flex-row items-center gap-3 rounded-2xl border-2 p-4 active:scale-[0.985]",
              columns === 2 && "w-[48.5%]",
              active ? "border-primary bg-primary/10" : "border-border",
            )}
          >
            {o.emoji ? <Text className="text-2xl leading-none">{o.emoji}</Text> : null}
            <View className="min-w-0 flex-1">
              <Text className="font-semibold leading-snug">{o.label}</Text>
              {o.hint ? (
                <Text className="mt-0.5 text-sm leading-snug text-muted-foreground">{o.hint}</Text>
              ) : null}
            </View>
            <View
              className={cn(
                "h-6 w-6 items-center justify-center rounded-full border-2",
                active ? "border-primary bg-primary" : "border-border",
              )}
            >
              {active ? <Icon node={check} color={branco} size={14} strokeWidth={3} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Escolha múltipla em pastilhas. Para listas onde nenhuma resposta também é resposta. */
export function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: readonly ChoiceOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  const branco = useColor("primary-foreground");
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => onToggle(o.value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            className={cn(
              "min-h-[44px] flex-row items-center gap-1.5 rounded-full border-2 px-4 py-2 active:scale-95",
              active ? "border-primary bg-primary" : "border-border",
            )}
          >
            {active ? <Icon node={check} color={branco} size={14} strokeWidth={3} /> : null}
            <Text className={cn("text-sm font-medium", active && "text-primary-foreground")}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Número grande com controle deslizante (o `input[type=range]` do web). */
export function NumberField({
  value,
  min,
  max,
  step = 1,
  unit,
  decimals = 0,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  decimals?: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const [largura, setLargura] = useState(0);
  const estado = useRef({ largura: 0, onChange, min, max, step });
  estado.current = { largura, onChange, min, max, step };

  const valorEm = (x: number) => {
    const s = estado.current;
    if (!s.largura) return null;
    const bruto = s.min + Math.min(1, Math.max(0, x / s.largura)) * (s.max - s.min);
    return Math.round(Math.round(bruto / s.step) * s.step * 10) / 10;
  };

  const arraste = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const v = valorEm(e.nativeEvent.locationX);
        if (v !== null) estado.current.onChange(v);
      },
      onPanResponderMove: (e) => {
        const v = valorEm(e.nativeEvent.locationX);
        if (v !== null) estado.current.onChange(v);
      },
    }),
  ).current;

  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));

  return (
    <View>
      <Text className="py-6 text-center">
        <Text className="text-6xl font-bold tracking-tight">{value.toFixed(decimals)}</Text>
        <Text className="text-xl font-medium text-muted-foreground"> {unit}</Text>
      </Text>
      <View className="px-1">
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min, max, now: value }}
          onAccessibilityAction={(e) =>
            onChange(
              e.nativeEvent.actionName === "increment"
                ? Math.min(max, value + step)
                : Math.max(min, value - step),
            )
          }
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
          className="h-8 justify-center"
          {...arraste.panHandlers}
        >
          <View pointerEvents="none" className="h-2.5 overflow-hidden rounded-full bg-muted">
            <View className="h-full bg-primary" style={{ width: `${pct * 100}%` }} />
          </View>
          <View
            pointerEvents="none"
            className="absolute h-6 w-6 rounded-full border-2 border-primary bg-background shadow-md"
            style={{ left: pct * Math.max(0, largura - 24) }}
          />
        </View>
        <View className="mt-2 flex-row justify-between">
          <Text className="text-xs text-muted-foreground">
            {min}
            {unit}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {max}
            {unit}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Contador para faixas curtas, onde o deslizante é impreciso demais. */
export function Stepper({
  value,
  min,
  max,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <View className="flex-row items-center justify-center gap-6 py-6">
      <Button
        variant="outline"
        size="icon"
        className="h-14 w-14 rounded-full"
        textClassName="text-2xl"
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        accessibilityLabel={t("Diminuir")}
      >
        −
      </Button>
      <View className="min-w-24 items-center">
        <Text className="text-6xl font-bold">{value}</Text>
        <Text className="mt-1 text-sm text-muted-foreground">{unit}</Text>
      </View>
      <Button
        variant="outline"
        size="icon"
        className="h-14 w-14 rounded-full"
        textClassName="text-2xl"
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        accessibilityLabel={t("Aumentar")}
      >
        +
      </Button>
    </View>
  );
}

export function WeekdayPicker({
  selected,
  onToggle,
}: {
  selected: readonly number[];
  onToggle: (day: number) => void;
}) {
  return (
    <View className="flex-row gap-1.5">
      {WEEKDAYS.map((dia) => {
        const active = selected.includes(dia);
        return (
          <Pressable
            key={dia}
            onPress={() => onToggle(dia)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={WEEKDAY_LABELS[dia]}
            className={cn(
              "min-h-[56px] flex-1 items-center justify-center rounded-xl border-2 active:scale-95",
              active ? "border-primary bg-primary" : "border-border",
            )}
          >
            <Text className={cn("font-bold", active && "text-primary-foreground")}>
              {WEEKDAY_INITIALS[dia]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Caixa de retorno: transforma a resposta em informação, não só em registro. */
export function Feedback({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <View
      className="mt-6 rounded-2xl border border-border bg-muted/40 p-4"
      accessibilityLiveRegion="polite"
    >
      {title ? <Text className="mb-1 text-sm font-semibold text-primary">{title}</Text> : null}
      <Text className="text-sm leading-relaxed text-muted-foreground">{children}</Text>
    </View>
  );
}

/** Botão de avanço logo abaixo da pergunta. */
export function NextButton({
  onPress,
  disabled,
  label = t("Continuar"),
}: {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
}) {
  // No web é `sticky bottom-0 mt-6`: logo abaixo do conteúdo, preso ao rodapé
  // só quando a tela rola. A área segura de baixo fica por conta da tela.
  return (
    <View className="mt-6 pb-4 pt-4">
      <Button
        size="lg"
        className="h-14 w-full rounded-2xl"
        textClassName="text-base font-semibold"
        onPress={onPress}
        disabled={disabled}
      >
        {label}
      </Button>
    </View>
  );
}

/** Barra de progresso do questionário, com o gradiente da marca do web. */
export function ProgressBar({ current, total }: { current: number; total: number }) {
  const vivo = useColor("primary-vivid");
  const primaria = useColor("primary");
  return (
    <View
      className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
      accessibilityRole="progressbar"
      accessibilityLabel={t("Progresso do questionário")}
      accessibilityValue={{ min: 0, max: total, now: current }}
    >
      <View
        className="h-full overflow-hidden rounded-full bg-primary"
        style={{ width: `${(current / total) * 100}%` }}
      >
        {/* `absoluteFill`: com width="100%" o Svg não ocupava a barra inteira. */}
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={vivo} />
              <Stop offset="1" stopColor={primaria} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#g)" />
        </Svg>
      </View>
    </View>
  );
}
