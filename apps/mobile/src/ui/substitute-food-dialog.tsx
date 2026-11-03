import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchCuratedFoods, fetchDietaryRestrictions } from "@forja/app-core/data/meal-plans";
import { queryKeys } from "@forja/app-core/data/query-keys";
import {
  describeSubstitution,
  findSubstitutions,
  safePool,
  type FoodCandidate,
} from "@forja/domain";
import { useColor } from "@/theme/theme";
import { ResultRow, ResultsEmpty, ResultsLoading, SearchDialog } from "./search-dialog";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/**
 * Substituição de alimento — o `diet/substitute-food-dialog.tsx` do web: as
 * alternativas do catálogo curado, já sem o que as restrições da pessoa
 * excluem, com a quantidade ajustada e o custo da troca em números.
 */
export function SubstituteFoodDialog({
  open,
  onClose,
  food,
  grams,
  preferredIds = [],
  onSubstitute,
}: {
  open: boolean;
  onClose: () => void;
  food: FoodCandidate;
  grams: number;
  preferredIds?: readonly string[];
  onSubstitute: (substitute: FoodCandidate, grams: number) => void | Promise<unknown>;
}) {
  const [applying, setApplying] = useState<string | null>(null);
  const apagada = useColor("muted-foreground");

  const pool = useQuery({
    queryKey: queryKeys.diet.substitutions(food.id),
    enabled: open,
    queryFn: async () => {
      const [catalogo, restricoes] = await Promise.all([
        fetchCuratedFoods(),
        fetchDietaryRestrictions(),
      ]);
      return { seguros: safePool(catalogo, restricoes), catalogo };
    },
  });

  // Com perfil curado, o original troca só dentro do mesmo papel culinário.
  const original = pool.data?.catalogo.find((f) => f.id === food.id) ?? food;
  const opcoes = pool.data
    ? findSubstitutions(original, grams, pool.data.seguros, { preferredIds })
    : [];

  const aplicar = async (substituto: FoodCandidate, novasGramas: number) => {
    setApplying(substituto.id);
    try {
      await onSubstitute(substituto, novasGramas);
      onClose();
    } catch {
      // Quem chamou mostra o erro; o diálogo fica aberto.
    } finally {
      setApplying(null);
    }
  };

  return (
    <SearchDialog
      open={open}
      onClose={onClose}
      title={t("Substituir alimento")}
      description={t(
        "Trocando {{name}} ({{v1}} g). As quantidades já vêm ajustadas para manter o valor nutricional da refeição.",
        { name: food.name, v1: Math.round(grams) },
      )}
    >
      {pool.isPending ? (
        <ResultsLoading />
      ) : opcoes.length === 0 ? (
        <ResultsEmpty>
          {t("Não encontramos alternativas equivalentes para este alimento.")}
        </ResultsEmpty>
      ) : (
        <View className="gap-2">
          {opcoes.map((sub) => (
            <ResultRow
              key={sub.food.id}
              title={sub.food.name}
              detail={describeSubstitution(sub)}
              highlight={sub.distance < 0.25}
              disabled={applying !== null}
              onPress={() => void aplicar(sub.food, sub.grams)}
              aside={
                <View className="flex-row items-center gap-1">
                  {applying === sub.food.id ? (
                    <ActivityIndicator size="small" color={apagada} />
                  ) : null}
                  <Text className="text-base font-bold">
                    {t("{{grams}} g", { grams: sub.grams })}
                  </Text>
                </View>
              }
            >
              {/* O custo da troca, em números. */}
              <View className="mt-1.5 flex-row flex-wrap gap-1">
                {(
                  [
                    ["kcal", sub.delta.kcal, ""],
                    ["P", sub.delta.proteinG, "g"],
                    ["C", sub.delta.carbsG, "g"],
                    ["G", sub.delta.fatG, "g"],
                  ] as const
                )
                  .filter(([, v]) => Math.abs(v) >= 1)
                  .map(([nome, valor, unidade]) => (
                    <View key={nome} className="rounded-full bg-elevated px-2 py-0.5">
                      <Text className="text-[11px] font-medium text-muted-foreground">
                        {nome} {valor > 0 ? "+" : ""}
                        {valor}
                        {unidade}
                      </Text>
                    </View>
                  ))}
              </View>
            </ResultRow>
          ))}
        </View>
      )}
    </SearchDialog>
  );
}
