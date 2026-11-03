import { View } from "react-native";
import { PageHeader, PageScroll } from "./page-header";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

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
    <PageScroll
      className="flex-1 bg-background"
      contentContainerClassName="pb-28"
      header={<PageHeader title={title} description={description} />}
    >
      <View className="mx-4 mt-2 rounded-3xl bg-card p-6">
        <Text className="font-bold">{t("Em construção")}</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          {t("Esta tela chega na fase {{fase}} da migração (docs/migracao-expo.md).", { fase })}
        </Text>
      </View>
    </PageScroll>
  );
}
