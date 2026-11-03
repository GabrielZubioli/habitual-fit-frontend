import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { __iconNode as arrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { useColor } from "@/theme/theme";
import { Icon } from "./icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./text";

/**
 * O PageHeader do web (`components/page-header.tsx`): título de 40 px em
 * extrabold, descrição abaixo, ação opcional à direita.
 */
export function PageHeader({
  title,
  description,
  action,
  topo,
}: {
  title: string;
  /** Texto, ou um elemento (o seletor de data da Dieta). */
  description?: ReactNode;
  action?: ReactNode;
  /** Linha acima do título, alinhada à direita (o `topo` do web). */
  topo?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="px-4 pb-3" style={{ paddingTop: Math.max(24, insets.top) }}>
      {topo ? <View className="mb-2 flex-row justify-end">{topo}</View> : null}
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-[40px] font-extrabold leading-[42px] tracking-tight">{title}</Text>
          {typeof description === "string" ? (
            <Text className="mt-1 text-base text-muted-foreground">{description}</Text>
          ) : description ? (
            <View className="mt-1">{description}</View>
          ) : null}
        </View>
        {action ? <View className="flex-row items-center gap-2">{action}</View> : null}
      </View>
    </View>
  );
}

/** O BackButton do web: volta no histórico ou, sem histórico, vai ao `fallback`. */
export function BackButton({ fallback = "/dashboard" }: { fallback?: Href }) {
  const cor = useColor("foreground");
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.navigate(fallback))}
      accessibilityLabel="Voltar"
      className="h-11 w-11 items-center justify-center rounded-full bg-card active:bg-elevated"
    >
      <Icon node={arrowLeft} color={cor} size={20} />
    </Pressable>
  );
}

/** O `headerIconClass` do web: botão redondo de 48 px no cabeçalho. */
export function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: import("./icon").IconNode;
  label: string;
  onPress: () => void;
}) {
  const cor = useColor("foreground");
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="h-12 w-12 items-center justify-center rounded-full bg-card active:bg-elevated"
    >
      <Icon node={icon} color={cor} size={20} />
    </Pressable>
  );
}
