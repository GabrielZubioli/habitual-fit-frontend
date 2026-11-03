import { ScrollView, View } from "react-native";
import { PageHeader } from "./page-header";
import { Text } from "./text";

/** Tela ainda não migrada: o cabeçalho real e em que fase ela chega. */
export function EmBreve({
  title,
  description,
  fase,
}: {
  title: string;
  description?: string;
  fase: number;
}) {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-28">
      <PageHeader title={title} description={description} />
      <View className="mx-4 mt-2 rounded-3xl bg-card p-6">
        <Text className="font-bold">Em construção</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Esta tela chega na fase {fase} da migração (docs/migracao-expo.md).
        </Text>
      </View>
    </ScrollView>
  );
}
