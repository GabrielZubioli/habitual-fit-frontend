/**
 * Seletor de exercício — usado na sessão ao vivo e no editor de template.
 *
 * Havia dois `AddExerciseDialog` separados: o da sessão tinha filtro por
 * músculo, o do template não; as listas de músculos, os limites e o tratamento
 * de "nada encontrado" divergiam. Este componente unifica os dois.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { queryKeys } from "@forja/app-core/data/query-keys";
import {
  FILTERABLE_MUSCLES,
  searchExercises,
  type PickedExercise,
} from "@forja/app-core/data/exercise-search";
import { useDebouncedValue } from "@forja/app-core/hooks/use-debounced-value";
import { MUSCLE_LABELS, EQUIPMENT_LABELS, type MuscleValue } from "@forja/app-core/lib/labels";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  ResultList,
  ResultRow,
  ResultsEmpty,
  ResultsLoading,
  SearchDialogContent,
  SearchField,
} from "@/components/pickers/search-dialog";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/query-boundary";
import { exerciseMedia } from "@forja/app-core/data/exercise-media";

export type { PickedExercise };

export function ExercisePicker({
  trigger,
  title = "Adicionar exercício",
  showMuscleFilter = true,
  muscle: initialMuscle,
  onPick,
}: {
  trigger: ReactNode;
  title?: string;
  showMuscleFilter?: boolean;
  /**
   * Músculo pré-selecionado. Ao trocar um exercício, filtrar pelo mesmo grupo
   * é quase sempre o que se quer — abrir a lista completa de 880 obrigaria o
   * usuário a refazer o filtro toda vez.
   */
  muscle?: string;
  onPick: (exercise: PickedExercise) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [muscle, setMuscle] = useState<string>(initialMuscle ?? "all");

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

  const pick = async (ex: {
    id: string;
    name: string;
    category: string;
    primary_muscle: string;
  }) => {
    await onPick({
      id: ex.id,
      name: ex.name,
      category: ex.category,
      primaryMuscle: ex.primary_muscle,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <SearchDialogContent
        title={title}
        srDescription="Busque um exercício pelo nome e filtre pelo músculo."
        top={
          <>
            <SearchField
              value={term}
              onChange={setTerm}
              placeholder="Buscar exercício…"
              loading={exercises.isFetching}
            />
            {showMuscleFilter && (
              <Select value={muscle} onValueChange={setMuscle}>
                <SelectTrigger
                  className={cn(
                    "h-11 w-full rounded-2xl border-transparent bg-card text-sm font-semibold",
                    muscle !== "all" && "border-primary/50 text-primary",
                  )}
                  aria-label="Filtrar por músculo"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os músculos</SelectItem>
                  {FILTERABLE_MUSCLES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MUSCLE_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        }
      >
        {exercises.isPending ? (
          <ResultsLoading />
        ) : exercises.isError ? (
          <ErrorState message="Falha ao buscar exercícios." onRetry={exercises.refetch} compact />
        ) : exercises.data.length === 0 ? (
          <ResultsEmpty>
            Nenhum exercício encontrado{debouncedTerm ? ` para “${debouncedTerm}”` : ""}.
          </ResultsEmpty>
        ) : (
          <ResultList>
            {exercises.data.map((ex) => (
              <li key={ex.id}>
                {/* A miniatura resolve o que o nome sozinho não resolve:
                    reconhecer o movimento sem abrir a ficha. Vem da camada
                    de mídia, não de `image_urls` direto — a maior parte do
                    catálogo tem a imagem numa fonte externa. */}
                <ResultRow
                  thumb={<PickerThumb exercise={ex} />}
                  title={ex.name}
                  detail={`${MUSCLE_LABELS[ex.primary_muscle as MuscleValue] ?? ex.primary_muscle} · ${
                    EQUIPMENT_LABELS[ex.equipment as keyof typeof EQUIPMENT_LABELS] ?? ex.equipment
                  }`}
                  aside={<Plus className="size-5 text-primary" aria-hidden />}
                  onClick={() => void pick(ex)}
                />
              </li>
            ))}
          </ResultList>
        )}
      </SearchDialogContent>
    </Dialog>
  );
}

/**
 * Miniatura estática do exercício.
 *
 * Nunca o GIF: a lista mostra dezenas de itens por vez e animar todos custaria
 * megabytes e a fluidez da rolagem. Quem quer ver o movimento abre a ficha.
 */
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

  if (!thumb) return <span className="size-14 shrink-0 rounded-xl bg-elevated" aria-hidden />;

  return (
    <img
      src={thumb}
      alt=""
      loading="lazy"
      decoding="async"
      width={56}
      height={56}
      className="size-14 shrink-0 rounded-xl bg-elevated object-cover"
    />
  );
}
