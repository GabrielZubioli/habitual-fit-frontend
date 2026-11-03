import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Painel que sobe de baixo — o Drawer (vaul) do web: fundo preto 80%, cantos
 * de 10 px em cima, alça cinza no topo.
 *
 * ponytail: Modal nativo, sem arrastar para fechar. Trocar por
 * @gorhom/bottom-sheet quando o npm install estiver liberado.
 */
export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable className="flex-1 bg-black/80" onPress={onClose} accessibilityLabel="Fechar" />
      <View
        className="max-h-[80%] rounded-t-[10px] border border-border bg-background"
        style={{ paddingBottom: insets.bottom }}
      >
        <View className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
        {children}
      </View>
    </Modal>
  );
}
