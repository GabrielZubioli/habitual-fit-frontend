import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { __iconNode as repeat } from "lucide-react/dist/esm/icons/repeat.js";
import { searchSubstitutes, type SubstituteCandidate } from "@forja/app-core/data/exercise-search";
import { useDebouncedValue } from "@forja/app-core/hooks/use-debounced-value";
import { EQUIPMENT_LABELS, MUSCLE_LABELS, label } from "@forja/app-core/lib/labels";
import { useColor } from "@/theme/theme";
import { ErrorState } from "./card";
import { PickerThumb } from "./exercise-picker";
import { Icon } from "./icon";
import {
  ResultRow,
  ResultsEmpty,
  ResultsLoading,
  SearchDialog,
  SearchField,
} from "./search-dialog";

/**
 * Trocar um exercício no meio do treino — o `pickers/substitute-exercise-dialog.tsx`
 * do web: alternativas do mesmo músculo, mesmo equipamento primeiro. As séries
 * já registradas ficam; muda só o movimento.
 */
export function SubstituteExerciseDialog({
  open,
  onClose,
  currentExerciseId,
  currentExerciseName,
  primaryMuscle,
  currentEquipment,
  onSubstitute,
}: {
  open: boolean;
  onClose: () => void;
  currentExerciseId: string;
  currentExerciseName: string;
  primaryMuscle: string;
  currentEquipment?: string;
  onSubstitute: (exercise: SubstituteCandidate) => Promise<unknown>;
}) {
  const [term, setTerm] = useState("");
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const primaria = useColor("primary");
  const debouncedTerm = useDebouncedValue(term.trim(), 250);

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const alternatives = useQuery({
    queryKey: ["substitutes", primaryMuscle, currentExerciseId, debouncedTerm],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: () =>
      searchSubstitutes({
        primaryMuscle,
        excludeId: currentExerciseId,
        term: debouncedTerm,
        equipment: currentEquipment,
      }),
  });

  const escolher = async (exercise: SubstituteCandidate) => {
    setEscolhendo(exercise.id);
    try {
      await onSubstitute(exercise);
      onClose();
    } catch {
      // Quem chamou mostra o erro; o diálogo fica aberto.
    } finally {
      setEscolhendo(null);
    }
  };

  const musculo = label(MUSCLE_LABELS, primaryMuscle).toLowerCase();

  return (
    <SearchDialog
      open={open}
      onClose={onClose}
      title="Substituir exercício"
      description={`Trocando ${currentExerciseName}. As séries já registradas são mantidas — muda só o movimento.`}
      top={
        <SearchField
          value={term}
          onChange={setTerm}
          placeholder={`Buscar em ${musculo}…`}
          loading={alternatives.isFetching}
        />
      }
    >
      {alternatives.isPending ? (
        <ResultsLoading />
      ) : alternatives.isError ? (
        <ErrorState
          message="Falha ao buscar alternativas."
          onRetry={() => void alternatives.refetch()}
          compact
        />
      ) : alternatives.data.length === 0 ? (
        <ResultsEmpty>{`Nenhuma alternativa para ${musculo}${debouncedTerm ? ` com “${debouncedTerm}”` : ""}.`}</ResultsEmpty>
      ) : (
        <View className="gap-2">
          {alternatives.data.map((exercise) => {
            const mesmoEquip = exercise.equipment === currentEquipment;
            return (
              <ResultRow
                key={exercise.id}
                thumb={<PickerThumb exercise={exercise} />}
                title={exercise.name}
                detail={
                  mesmoEquip
                    ? `${label(EQUIPMENT_LABELS, exercise.equipment)} · mesmo equipamento`
                    : label(EQUIPMENT_LABELS, exercise.equipment)
                }
                highlight={mesmoEquip}
                disabled={escolhendo !== null}
                onPress={() => void escolher(exercise)}
                aside={
                  escolhendo === exercise.id ? (
                    <ActivityIndicator color={primaria} />
                  ) : (
                    <Icon node={repeat} color={primaria} size={20} />
                  )
                }
              />
            );
          })}
        </View>
      )}
    </SearchDialog>
  );
}
