/**
 * Substituição de exercício dentro de um treino em andamento.
 *
 * O aparelho está ocupado, dói o ombro naquele ângulo, a academia não tem a
 * barra — antes disso a única saída era apagar o exercício e adicionar outro,
 * perdendo as séries já registradas. Aqui a troca preserva séries, peso, reps e
 * posição: muda só qual movimento está sendo feito.
 *
 * As alternativas são filtradas pelo **mesmo músculo primário**, ordenadas por
 * proximidade de equipamento, para a sugestão fazer sentido sem o usuário
 * precisar pensar.
 */
import { type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Repeat } from "lucide-react";
import { searchSubstitutes, type SubstituteCandidate } from "@forja/app-core/data/exercise-search";
import { useDebouncedValue } from "@forja/app-core/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  ResultList,
  ResultRow,
  ResultsEmpty,
  ResultsLoading,
  SearchDialogContent,
  SearchField,
} from "@/components/pickers/search-dialog";
import { PickerThumb } from "@/components/pickers/exercise-picker";
import { ErrorState } from "@/components/query-boundary";
import { EQUIPMENT_LABELS, MUSCLE_LABELS, label } from "@forja/app-core/lib/labels";
import { t } from "@forja/app-core/i18n";

export type { SubstituteCandidate };

export function SubstituteExerciseDialog({
  currentExerciseId,
  currentExerciseName,
  primaryMuscle,
  currentEquipment,
  onSubstitute,
  isPending,
  trigger,
}: {
  currentExerciseId: string;
  currentExerciseName: string;
  primaryMuscle: string;
  currentEquipment?: string;
  onSubstitute: (exercise: SubstituteCandidate) => void | Promise<void>;
  isPending?: boolean;
  /** Gatilho próprio (ex.: item de menu). Padrão: botão com ícone de troca. */
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const debouncedTerm = useDebouncedValue(term.trim(), 250);

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
      setOpen(false);
    } finally {
      setEscolhendo(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={t("Substituir {{currentExerciseName}} por outro exercício", {
              currentExerciseName,
            })}
            disabled={isPending}
          >
            <Repeat className="size-4" />
          </Button>
        )}
      </DialogTrigger>

      <SearchDialogContent
        title={t("Substituir exercício")}
        description={
          <>
            Trocando <b className="font-semibold text-foreground">{currentExerciseName}</b>. As
            séries já registradas são mantidas — muda só o movimento.
          </>
        }
        top={
          <SearchField
            value={term}
            onChange={setTerm}
            placeholder={t("Buscar em {{v0}}…", {
              v0: label(MUSCLE_LABELS, primaryMuscle).toLowerCase(),
            })}
            loading={alternatives.isFetching}
          />
        }
      >
        {alternatives.isPending ? (
          <ResultsLoading />
        ) : alternatives.isError ? (
          <ErrorState
            message={t("Falha ao buscar alternativas.")}
            onRetry={alternatives.refetch}
            compact
          />
        ) : alternatives.data.length === 0 ? (
          <ResultsEmpty>
            {t("Nenhuma alternativa para {{v0}}", {
              v0: label(MUSCLE_LABELS, primaryMuscle).toLowerCase(),
            })}
            {debouncedTerm ? t(" com “{{debouncedTerm}}”", { debouncedTerm }) : ""}.
          </ResultsEmpty>
        ) : (
          <ResultList>
            {alternatives.data.map((exercise) => {
              const mesmoEquip = exercise.equipment === currentEquipment;
              return (
                <li key={exercise.id}>
                  <ResultRow
                    thumb={<PickerThumb exercise={exercise} />}
                    title={exercise.name}
                    detail={
                      mesmoEquip
                        ? t("{{v0}} · mesmo equipamento", {
                            v0: label(EQUIPMENT_LABELS, exercise.equipment),
                          })
                        : label(EQUIPMENT_LABELS, exercise.equipment)
                    }
                    highlight={mesmoEquip}
                    aside={
                      escolhendo === exercise.id ? (
                        <Loader2 className="size-5 animate-spin text-primary" />
                      ) : (
                        <Repeat className="size-5 text-primary" aria-hidden />
                      )
                    }
                    disabled={escolhendo !== null}
                    onClick={() => void escolher(exercise)}
                  />
                </li>
              );
            })}
          </ResultList>
        )}
      </SearchDialogContent>
    </Dialog>
  );
}
