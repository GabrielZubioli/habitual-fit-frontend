import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { __iconNode as search } from "lucide-react/dist/esm/icons/search.js";
import { __iconNode as x } from "lucide-react/dist/esm/icons/x.js";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Icon } from "./icon";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/**
 * O diálogo de busca do web (`pickers/search-dialog.tsx`): cartão de até 88%
 * da altura, título, a área de filtros e a lista que rola. Usado pelos
 * seletores de exercício e de alimento.
 */
export function SearchDialog({
  open,
  onClose,
  title,
  description,
  top,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  top?: ReactNode;
  children: ReactNode;
}) {
  const texto = useColor("muted-foreground");
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView behavior="height" className="flex-1">
        <Pressable
          className="flex-1 items-center justify-center bg-black/80 px-4"
          onPress={onClose}
        >
          <Pressable
            onPress={() => undefined}
            className="h-[88%] max-h-[704px] w-full max-w-lg overflow-hidden rounded-[28px] border border-border bg-background"
          >
            <View className="gap-1.5 px-5 pb-4 pt-5">
              <Text className="pr-8 text-xl font-bold leading-tight tracking-tight">{title}</Text>
              {description ? (
                <Text className="text-sm leading-snug text-muted-foreground">{description}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityLabel={t("Fechar")}
              className="absolute right-4 top-4 h-8 w-8 items-center justify-center rounded-full"
            >
              <Icon node={x} color={texto} size={18} />
            </Pressable>
            {top ? <View className="gap-3 border-b border-border/60 px-5 pb-4">{top}</View> : null}
            <ScrollView
              className="flex-1"
              contentContainerClassName="px-5 pb-6 pt-4"
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  loading?: boolean;
}) {
  const apagada = useColor("muted-foreground");
  const texto = useColor("foreground");
  return (
    <View className="h-12 justify-center">
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={apagada}
        autoFocus
        accessibilityLabel={placeholder.replace(/…$/, "")}
        returnKeyType="search"
        className="h-12 rounded-2xl bg-card pl-11 pr-10 font-sans text-base"
        style={{ color: texto }}
      />
      <View pointerEvents="none" className="absolute left-4">
        <Icon node={search} color={apagada} size={18} />
      </View>
      {loading ? (
        <View className="absolute right-4">
          <ActivityIndicator size="small" color={apagada} />
        </View>
      ) : null}
    </View>
  );
}

export function ResultRow({
  thumb,
  title,
  detail,
  aside,
  onPress,
  disabled,
  highlight,
  children,
}: {
  thumb?: ReactNode;
  title: string;
  detail?: string;
  aside?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  highlight?: boolean;
  /** Linha extra embaixo do detalhe (as fichas de macros). */
  children?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn(
        "flex-row items-center gap-3 rounded-2xl border bg-card p-3 active:bg-elevated",
        highlight ? "border-primary/40" : "border-transparent",
        disabled && "opacity-60",
      )}
    >
      {thumb}
      <View className="min-w-0 flex-1">
        <Text numberOfLines={2} className="font-semibold leading-snug">
          {title}
        </Text>
        {detail ? (
          <Text className="mt-0.5 text-xs leading-snug text-muted-foreground">{detail}</Text>
        ) : null}
        {children}
      </View>
      {aside ? <View>{aside}</View> : null}
    </Pressable>
  );
}

export function ResultsLoading() {
  return (
    <View className="gap-2" accessibilityLabel={t("Carregando")}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} className="h-[72px] w-full rounded-2xl bg-muted" />
      ))}
    </View>
  );
}

export function ResultsEmpty({ children }: { children: string }) {
  const apagada = useColor("muted-foreground");
  return (
    <View className="items-center px-4 py-12">
      <View style={{ opacity: 0.5 }}>
        <Icon node={search} color={apagada} size={32} />
      </View>
      <Text className="mt-3 text-center text-sm text-muted-foreground">{children}</Text>
    </View>
  );
}
