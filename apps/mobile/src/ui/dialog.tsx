import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from "react-native";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "./button";
import { Icon, type IconNode } from "./icon";
import { Sheet } from "./sheet";
import { Text } from "./text";

/**
 * O AlertDialog do web (`ui/alert-dialog.tsx`) no celular: cartão no centro,
 * título e descrição centralizados, botões empilhados — a ação em cima e o
 * "Cancelar" embaixo (`flex-col-reverse`).
 */
export type AcaoDialogo = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Fecha o diálogo antes de rodar a ação (padrão: sim). */
  fecha?: boolean;
};

export function AlertDialog({
  open,
  onClose,
  title,
  description,
  acoes,
  cancelar = "Cancelar",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  acoes: AcaoDialogo[];
  /** Rótulo do botão de fechar; `null` para não ter. */
  cancelar?: string | null;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable className="flex-1 items-center justify-center bg-black/80 px-4" onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          className="w-full max-w-lg gap-4 rounded-3xl border border-border bg-background p-6 shadow-lg"
        >
          <View className="gap-2">
            <Text className="text-center text-lg font-semibold">{title}</Text>
            {typeof description === "string" ? (
              <Text className="text-center text-sm text-muted-foreground">{description}</Text>
            ) : (
              description
            )}
          </View>
          <View className="gap-2">
            {acoes.map((a) => (
              <Button
                key={a.label}
                variant={a.variant ?? "default"}
                className="h-10 rounded-2xl"
                textClassName="font-bold"
                onPress={() => {
                  if (a.fecha !== false) onClose();
                  a.onPress();
                }}
              >
                {a.label}
              </Button>
            ))}
            {cancelar ? (
              <Button variant="outline" className="h-10 rounded-2xl" onPress={onClose}>
                {cancelar}
              </Button>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** O ConfirmDialog do web: pergunta com "Cancelar" e a ação (vermelha se destrutiva). */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      acoes={[
        {
          label: confirmLabel,
          onPress: onConfirm,
          variant: destructive ? "destructive" : "default",
        },
      ]}
    />
  );
}

/**
 * As opções de um `DropdownMenu` do web, num painel que sobe de baixo — o
 * jeito do celular de mostrar uma lista de ações.
 */
export type OpcaoMenu = {
  label: string;
  icon?: IconNode;
  /** Texto curto à esquerda, como o "4+" do RIR. */
  prefixo?: string;
  onPress: () => void;
  destrutiva?: boolean;
};

export function MenuSheet({
  open,
  onClose,
  title,
  opcoes,
  corIcone,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  opcoes: OpcaoMenu[];
  corIcone: string;
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      <ScrollView contentContainerClassName="px-2 pb-4 pt-3">
        {title ? (
          <Text className="px-4 pb-2 text-sm font-semibold text-muted-foreground">{title}</Text>
        ) : null}
        {opcoes.map((o) => (
          <Pressable
            key={o.label}
            onPress={() => {
              onClose();
              o.onPress();
            }}
            className="min-h-[48px] flex-row items-center gap-3 rounded-xl px-4 py-3 active:bg-accent"
          >
            {o.icon ? <Icon node={o.icon} color={corIcone} size={18} /> : null}
            {o.prefixo ? <Text className="w-7 font-bold">{o.prefixo}</Text> : null}
            <Text className={cn("flex-1", o.destrutiva && "text-destructive")}>{o.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

/** O Dialog do web: cartão no centro com título e o conteúdo que vier. */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
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
            className="w-full max-w-lg gap-4 rounded-3xl border border-border bg-background p-6 shadow-lg"
          >
            <Text className="text-center text-lg font-semibold">{title}</Text>
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
