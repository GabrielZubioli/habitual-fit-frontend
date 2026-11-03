import { View } from "react-native";
import { cn } from "@/lib/cn";
import { Text } from "./text";

/** O Badge do web (`ui/badge.tsx`), com as mesmas variantes. */
const FUNDO = {
  padrao: "border-transparent bg-primary",
  suave: "border-transparent bg-primary-soft",
  secundario: "border-transparent bg-secondary",
  contorno: "border-border",
  sucesso: "border-transparent bg-success-soft",
  atencao: "border-transparent bg-warning-soft",
  destrutivo: "border-transparent bg-destructive-soft",
} as const;

const TEXTO = {
  padrao: "text-primary-foreground",
  suave: "text-primary-soft-foreground",
  secundario: "text-secondary-foreground",
  contorno: "text-muted-foreground",
  sucesso: "text-success",
  atencao: "text-warning",
  destrutivo: "text-destructive",
} as const;

export function Badge({
  children,
  variante = "padrao",
  className,
  textClassName,
}: {
  children: string;
  variante?: keyof typeof FUNDO;
  className?: string;
  textClassName?: string;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-1 rounded-md border px-2 py-0.5",
        FUNDO[variante],
        className,
      )}
    >
      <Text className={cn("text-xs font-medium leading-5", TEXTO[variante], textClassName)}>
        {children}
      </Text>
    </View>
  );
}
