import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, type PressableProps } from "react-native";
import { cn } from "@/lib/cn";
import { Text } from "./text";

/**
 * O Button do web (`components/ui/button.tsx`), com as mesmas variantes e
 * alturas. No React Native a cor do texto não herda do fundo, então cada
 * variante leva também a sua cor de texto.
 */
const FUNDO = {
  default: "bg-primary active:bg-primary-active",
  soft: "bg-primary-soft",
  outline: "border border-border bg-card active:bg-accent",
  secondary: "bg-secondary",
  ghost: "active:bg-accent",
  destructive: "bg-destructive",
} as const;

const TEXTO = {
  default: "text-primary-foreground",
  soft: "text-primary-soft-foreground",
  outline: "text-foreground",
  secondary: "text-secondary-foreground",
  ghost: "text-foreground",
  destructive: "text-destructive-foreground",
} as const;

const TAMANHO = {
  default: "h-10 rounded-md px-4",
  sm: "h-8 rounded-md px-3",
  lg: "h-11 rounded-lg px-6",
  icon: "h-10 w-10 rounded-md",
} as const;

export type ButtonVariant = keyof typeof FUNDO;

export function Button({
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  className,
  textClassName,
  children,
  ...props
}: Omit<PressableProps, "children"> & {
  variant?: ButtonVariant;
  size?: keyof typeof TAMANHO;
  loading?: boolean;
  className?: string;
  textClassName?: string;
  children: ReactNode;
}) {
  const inativo = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inativo, busy: loading }}
      disabled={inativo}
      className={cn(
        "flex-row items-center justify-center gap-2 active:scale-[0.98]",
        FUNDO[variant],
        TAMANHO[size],
        inativo && "opacity-50",
        className,
      )}
      {...props}
    >
      {typeof children === "string" ? (
        <Text
          className={cn(
            "font-medium",
            size === "sm" ? "text-xs" : size === "lg" ? "text-[15px]" : "text-sm",
            TEXTO[variant],
            textClassName,
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
      {loading ? <ActivityIndicator size="small" /> : null}
    </Pressable>
  );
}
