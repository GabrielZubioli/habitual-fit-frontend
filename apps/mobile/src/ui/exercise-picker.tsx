import { exerciseName } from "@forja/app-core/data/exercise-library";
import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { __iconNode as chevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import { __iconNode as plus } from "lucide-react/dist/esm/icons/plus.js";
import { queryKeys } from "@forja/app-core/data/query-keys";
import {
  FILTERABLE_MUSCLES,
  searchExercises,
  type ExerciseSearchRow,
  type PickedExercise,
} from "@forja/app-core/data/exercise-search";
import { exerciseMedia } from "@forja/app-core/data/exercise-media";
import { useDebouncedValue } from "@forja/app-core/hooks/use-debounced-value";
import { EQUIPMENT_LABELS, MUSCLE_LABELS, type MuscleValue } from "@forja/app-core/lib/labels";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { ErrorState } from "./card";
import { MenuSheet } from "./dialog";
import { Icon } from "./icon";
import {
  ResultRow,
  ResultsEmpty,
  ResultsLoading,
  SearchDialog,
  SearchField,
} from "./search-dialog";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/**
 * Seletor de exercício — o `pickers/exercise-picker.tsx` do web: busca por nome
 * (português ou inglês), filtro por músculo, miniatura estática.
 */
export function ExercisePicker({
  open,
  onClose,
  title = t("Adicionar exercício"),
  showMuscleFilter = true,
  muscle: initialMuscle,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  showMuscleFilter?: boolean;
  /** Músculo pré-selecionado (ao trocar um exercício, o mesmo grupo). */
  muscle?: string;
  onPick: (exercise: PickedExercise) => void | Promise<unknown>;
}) {
  const [term, setTerm] = useState("");
  const [muscle, setMuscle] = useState<string>(initialMuscle ?? "all");
  const [escolhendoMusculo, setEscolhendoMusculo] = useState(false);
  const primaria = useColor("primary");
  const texto = useColor("foreground");
  const debouncedTerm = useDebouncedValue(term.trim(), 300);

  useEffect(() => {
    if (open) return;
    const reset = setTimeout(() => {
      setTerm("");
      setMuscle(initialMuscle ?? "all");
    }, 150);
    return () => clearTimeout(reset);
  }, [open, initialMuscle]);

  const exercises = useQuery({
    queryKey: queryKeys.exercises.search(debouncedTerm, muscle),
    enabled: open,
    queryFn: () => searchExercises(debouncedTerm, muscle),
  });

  const pick = async (ex: ExerciseSearchRow) => {
    await onPick({
      id: ex.id,
      name: ex.name,
      category: ex.category,
      primaryMuscle: ex.primary_muscle,
    });
    onClose();
  };

  const rotuloMusculo =
    muscle === "all" ? t("Todos os músculos") : (MUSCLE_LABELS[muscle as MuscleValue] ?? muscle);

  return (
    <SearchDialog
      open={open}
      onClose={onClose}
      title={title}
      top={
        <>
          <SearchField
            value={term}
            onChange={setTerm}
            placeholder={t("Buscar exercício…")}
            loading={exercises.isFetching}
          />
          {showMuscleFilter ? (
            <Pressable
              onPress={() => setEscolhendoMusculo(true)}
              accessibilityLabel={t("Filtrar por músculo")}
              className={cn(
                "h-11 flex-row items-center justify-between rounded-2xl border bg-card px-3",
                muscle !== "all" ? "border-primary/50" : "border-transparent",
              )}
            >
              <Text className={cn("text-sm font-semibold", muscle !== "all" && "text-primary")}>
                {rotuloMusculo}
              </Text>
              <Icon node={chevronDown} color={muscle !== "all" ? primaria : texto} size={16} />
            </Pressable>
          ) : null}
        </>
      }
    >
      {exercises.isPending ? (
        <ResultsLoading />
      ) : exercises.isError ? (
        <ErrorState
          message={t("Falha ao buscar exercícios.")}
          onRetry={() => void exercises.refetch()}
          compact
        />
      ) : exercises.data.length === 0 ? (
        <ResultsEmpty>
          {t("Nenhum exercício encontrado{{v0}}.", {
            v0: debouncedTerm ? ` para “${debouncedTerm}”` : "",
          })}
        </ResultsEmpty>
      ) : (
        <View className="gap-2">
          {exercises.data.map((ex) => (
            <ResultRow
              key={ex.id}
              thumb={<PickerThumb exercise={ex} />}
              title={exerciseName(ex)}
              detail={`${MUSCLE_LABELS[ex.primary_muscle as MuscleValue] ?? ex.primary_muscle} · ${
                EQUIPMENT_LABELS[ex.equipment as keyof typeof EQUIPMENT_LABELS] ?? ex.equipment
              }`}
              aside={<Icon node={plus} color={primaria} size={20} />}
              onPress={() => void pick(ex)}
            />
          ))}
        </View>
      )}

      <MenuSheet
        open={escolhendoMusculo}
        onClose={() => setEscolhendoMusculo(false)}
        title={t("Filtrar por músculo")}
        corIcone={primaria}
        opcoes={[
          { label: t("Todos os músculos"), onPress: () => setMuscle("all") },
          ...FILTERABLE_MUSCLES.map((m) => ({
            label: MUSCLE_LABELS[m],
            onPress: () => setMuscle(m),
          })),
        ]}
      />
    </SearchDialog>
  );
}

/** Miniatura estática do exercício (nunca a animação: são dezenas na lista). */
export function PickerThumb({
  exercise,
}: {
  exercise: {
    name: string;
    image_urls: string[] | null;
    external_id: string | null;
    media_id: string | null;
    media_ref: string | null;
    media_source: string | null;
  };
}) {
  const media = exerciseMedia({
    name: exercise.name,
    imageUrls: exercise.image_urls,
    externalId: exercise.external_id,
    mediaId: exercise.media_id,
    mediaRef: exercise.media_ref,
    mediaSource: exercise.media_source,
  });
  const thumb = media.images[0];
  if (!thumb) return <View className="h-14 w-14 rounded-xl bg-elevated" />;
  return (
    <Image
      source={{ uri: thumb }}
      className="h-14 w-14 rounded-xl bg-elevated"
      resizeMode="cover"
    />
  );
}
