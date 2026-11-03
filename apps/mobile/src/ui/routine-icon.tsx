import { View } from "react-native";
import { __iconNode as accessibility } from "lucide-react/dist/esm/icons/accessibility.js";
import { __iconNode as bicepsFlexed } from "lucide-react/dist/esm/icons/biceps-flexed.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as flame } from "lucide-react/dist/esm/icons/flame.js";
import { __iconNode as footprints } from "lucide-react/dist/esm/icons/footprints.js";
import { __iconNode as handFist } from "lucide-react/dist/esm/icons/hand-fist.js";
import { __iconNode as heartPulse } from "lucide-react/dist/esm/icons/heart-pulse.js";
import { __iconNode as mountain } from "lucide-react/dist/esm/icons/mountain.js";
import { __iconNode as personStanding } from "lucide-react/dist/esm/icons/person-standing.js";
import { __iconNode as target } from "lucide-react/dist/esm/icons/target.js";
import { __iconNode as trophy } from "lucide-react/dist/esm/icons/trophy.js";
import { __iconNode as weight } from "lucide-react/dist/esm/icons/weight.js";
import { __iconNode as zap } from "lucide-react/dist/esm/icons/zap.js";
import { useState } from "react";
import { Pressable } from "react-native";
import { guessRoutineIcon } from "@forja/app-core/lib/routine-icons";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Icon, type IconNode } from "./icon";
import { Sheet } from "./sheet";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/**
 * O ícone de cada rotina — o `routine-icon.tsx` do web. Perna e tronco são
 * desenhados lá, no traço do lucide; aqui vão os mesmos paths.
 */
const LEG: IconNode = [
  [
    "path",
    {
      d: "M6 2c0 3.2 1 6 2.5 8.5.6 1 .6 2.2.4 3.5L8 19.5A1.5 1.5 0 0 0 9.5 21H18a1.5 1.5 0 0 0 .2-3L12 17c.8-2 1.6-4.3.5-6.5C11.8 8.8 13 5 13.5 2",
      key: "a",
    },
  ],
];
const TORSO: IconNode = [
  ["path", { d: "M11 5H8a5 5 0 0 0-5 5v1c2.3 2.7 5.5 3.2 8 1.5Z", key: "a" }],
  ["path", { d: "M13 5h3a5 5 0 0 1 5 5v1c-2.3 2.7-5.5 3.2-8 1.5Z", key: "b" }],
  ["path", { d: "M9.5 16.5h1.5M13 16.5h1.5M9.5 20h1.5M13 20h1.5", key: "c" }],
];

export const ROUTINE_ICONS: { key: string; label: string; icon: IconNode }[] = [
  { key: "braco", label: t("Braço"), icon: bicepsFlexed },
  { key: "perna", label: t("Perna"), icon: LEG },
  { key: "tronco", label: t("Peito"), icon: TORSO },
  { key: "halter", label: t("Halter"), icon: dumbbell },
  { key: "peso", label: t("Peso"), icon: weight },
  { key: "punho", label: t("Força"), icon: handFist },
  { key: "corpo", label: t("Corpo todo"), icon: personStanding },
  { key: "mobilidade", label: t("Mobilidade"), icon: accessibility },
  { key: "corrida", label: t("Corrida"), icon: footprints },
  { key: "cardio", label: t("Cardio"), icon: heartPulse },
  { key: "queima", label: t("Queima"), icon: flame },
  { key: "explosao", label: t("Explosão"), icon: zap },
  { key: "foco", label: t("Foco"), icon: target },
  { key: "desafio", label: t("Desafio"), icon: mountain },
  { key: "meta", label: t("Meta"), icon: trophy },
];

export function routineIconOf(icon: string | null | undefined, name: string): IconNode {
  const key = icon ?? guessRoutineIcon(name);
  return (ROUTINE_ICONS.find((i) => i.key === key) ?? ROUTINE_ICONS[3]!).icon;
}

/** O quadrado verde com o ícone da rotina (48 px; `pequeno` = 40 px com ícone de 20). */
export function RoutineIcon({
  icon,
  name,
  pequeno = false,
  muted = false,
}: {
  icon: string | null | undefined;
  name: string;
  pequeno?: boolean;
  muted?: boolean;
}) {
  const cor = useColor(muted ? "foreground" : "primary-foreground");
  return (
    <View
      className={cn(
        "items-center justify-center rounded-xl",
        pequeno ? "h-10 w-10" : "h-12 w-12",
        muted ? "bg-elevated" : "bg-primary",
      )}
    >
      <Icon node={routineIconOf(icon, name)} color={cor} size={pequeno ? 20 : 24} />
    </View>
  );
}

/**
 * O ícone da rotina como botão: abre a grade para escolher outro — o
 * `RoutineIconPicker` do web, com o popover virando o painel de baixo.
 */
export function RoutineIconPicker({
  icon,
  name,
  onChange,
}: {
  icon: string | null;
  name: string;
  onChange: (key: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = icon ?? guessRoutineIcon(name);
  const branco = useColor("primary-foreground");
  const texto = useColor("foreground");
  return (
    <>
      <Pressable
        onPress={() => setAberto(true)}
        accessibilityLabel={t("Trocar o ícone de {{name}}", { name })}
        className="rounded-xl active:scale-95"
      >
        <RoutineIcon icon={icon} name={name} />
      </Pressable>
      <Sheet open={aberto} onClose={() => setAberto(false)}>
        <View className="p-4 pb-6">
          <Text className="mb-2 px-1 text-sm font-semibold">{t("Ícone da rotina")}</Text>
          <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
            {ROUTINE_ICONS.map(({ key, label, icon: desenho }) => (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ checked: atual === key }}
                accessibilityLabel={label}
                onPress={() => {
                  onChange(key);
                  setAberto(false);
                }}
                className={cn(
                  "h-12 w-12 items-center justify-center rounded-xl",
                  atual === key ? "bg-primary" : "bg-elevated",
                )}
              >
                <Icon node={desenho} color={atual === key ? branco : texto} size={24} />
              </Pressable>
            ))}
          </View>
        </View>
      </Sheet>
    </>
  );
}
