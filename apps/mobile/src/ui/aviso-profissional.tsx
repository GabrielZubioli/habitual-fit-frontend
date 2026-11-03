import { View } from "react-native";
import { __iconNode as apple } from "lucide-react/dist/esm/icons/apple.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as info } from "lucide-react/dist/esm/icons/info.js";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Icon } from "./icon";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/** Avisos de orientação profissional — os mesmos textos de `aviso-profissional.tsx` do web. */
const AVISOS = {
  treino: {
    icon: dumbbell,
    titulo: t("O plano sugerido é uma referência geral"),
    texto: t(
      "Ele é montado a partir das suas respostas e não substitui a orientação individualizada de um profissional de educação física.",
    ),
  },
  dieta: {
    icon: apple,
    titulo: t("O app não prescreve dietas"),
    texto: t(
      "Monte e registre suas refeições aqui. O planejamento alimentar — o que, quanto e quando comer — deve ser orientado por um nutricionista.",
    ),
  },
  lesao: {
    icon: info,
    titulo: t("Você informou uma lesão ou dor"),
    texto: t(
      "Deixamos de fora os exercícios que carregam essa região, mas a seleção automática é só uma referência geral — não é avaliação clínica. Antes de treinar, procure orientação de um profissional de saúde e de educação física.",
    ),
  },
  app: {
    icon: info,
    titulo: t("Para que serve o Habitual Fit"),
    texto: t(
      "É uma ferramenta para organizar, acompanhar e gerenciar seus treinos e hábitos. Não é um serviço de consulta profissional.",
    ),
  },
} as const;

export type AvisoTipo = keyof typeof AVISOS;

export function AvisoProfissional({
  tipos,
  className,
}: {
  tipos: readonly AvisoTipo[];
  className?: string;
}) {
  const primaria = useColor("primary");
  return (
    <View
      accessibilityLabel={t("Avisos sobre orientação profissional")}
      className={cn("gap-3 rounded-[20px] border border-border bg-card p-4", className)}
    >
      {tipos.map((item) => {
        const { icon, titulo, texto } = AVISOS[item];
        return (
          <View key={item} className="flex-row gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Icon node={icon} color={primaria} size={16} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold">{titulo}</Text>
              <Text className="text-sm leading-relaxed text-muted-foreground">{texto}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
