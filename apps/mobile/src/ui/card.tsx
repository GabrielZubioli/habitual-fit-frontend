import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { router } from "expo-router";
import { __iconNode as circleAlert } from "lucide-react/dist/esm/icons/circle-alert.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as refreshCw } from "lucide-react/dist/esm/icons/refresh-cw.js";
import { cn } from "@/lib/cn";
import { useColor, useTheme } from "@/theme/theme";
import { Button } from "./button";
import { Icon, type IconNode } from "./icon";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/** O Card do web: borda no claro, sem borda no escuro (`dark:border-transparent`). */
export function Card({ className, ...props }: ViewProps & { className?: string }) {
  const { scheme } = useTheme();
  return (
    <View
      className={cn(
        "rounded-xl border bg-card shadow-sm",
        scheme === "dark" ? "border-transparent" : "border-border",
        className,
      )}
      {...props}
    />
  );
}

/** O `ErrorState` de `query-boundary.tsx`. */
export function ErrorState({
  message,
  onRetry,
  compact,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const destrutiva = useColor("destructive");
  const texto = useColor("foreground");
  return (
    <Card className="border-destructive/30">
      <View className={cn("items-center gap-3 px-6", compact ? "py-6" : "py-10")}>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
          <Icon node={circleAlert} color={destrutiva} size={20} />
        </View>
        <View className="items-center">
          <Text className="font-medium">{t("Não foi possível carregar")}</Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">{message}</Text>
        </View>
        {onRetry ? (
          <Button variant="outline" size="sm" onPress={onRetry}>
            <Icon node={refreshCw} color={texto} size={16} />
            <Text className="text-xs font-medium">{t("Tentar novamente")}</Text>
          </Button>
        ) : null}
      </View>
    </Card>
  );
}

/** O `NoRoutineCard` de `home/today-workout-card.tsx`. */
export function NoRoutineCard() {
  const apagada = useColor("muted-foreground");
  return (
    <Card className="border-dashed">
      <View className="items-center p-5">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Icon node={dumbbell} color={apagada} size={24} />
        </View>
        <Text className="mt-3 font-semibold">{t("Seu plano de treino está em branco")}</Text>
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          {t(
            "Crie suas rotinas e escolha os dias na tela Plano — ou use o plano sugerido para as suas respostas.",
          )}
        </Text>
        <Button className="mt-4 h-12 w-full rounded-xl" onPress={() => router.push("/plan")}>
          {t("Montar meu plano")}
        </Button>
      </View>
    </Card>
  );
}

/** O `EmptyState` de `query-boundary.tsx`. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: IconNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const branco = useColor("primary-foreground");
  return (
    <Card className="border border-dashed border-primary/35 bg-card">
      <View className="items-center gap-3 px-6 py-12">
        {icon ? (
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Icon node={icon} color={branco} size={24} />
          </View>
        ) : null}
        <View className="max-w-sm items-center">
          <Text className="text-center font-semibold">{title}</Text>
          {description ? (
            <Text className="mt-1 text-center text-sm text-muted-foreground">{description}</Text>
          ) : null}
        </View>
        {action}
      </View>
    </Card>
  );
}
