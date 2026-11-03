import { Text as RNText, type TextProps } from "react-native";
import { cn } from "@/lib/cn";

/**
 * Texto com a fonte e a cor padrão do web (Inter, `text-foreground`). No React
 * Native o estilo não herda do pai, então todo texto do app passa por aqui.
 */
export function Text({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={cn("font-sans text-base text-foreground", className)} {...props} />;
}
