import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { __iconNode as copy } from "lucide-react/dist/esm/icons/copy.js";
import { __iconNode as info } from "lucide-react/dist/esm/icons/info.js";
import { __iconNode as moreVertical } from "lucide-react/dist/esm/icons/ellipsis-vertical.js";
import { __iconNode as repeat } from "lucide-react/dist/esm/icons/repeat.js";
import { __iconNode as timer } from "lucide-react/dist/esm/icons/timer.js";
import { __iconNode as trash2 } from "lucide-react/dist/esm/icons/trash-2.js";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import {
  duplicateTemplateItem,
  removeTemplateItem,
  swapTemplateExercise,
  updateTemplateItem,
  type WeekExercise,
  type WeekSplit,
} from "@forja/app-core/data/workout-week";
import { exerciseImages } from "@forja/app-core/data/exercise-media";
import { EQUIPMENT_LABELS, label } from "@forja/app-core/lib/labels";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";
import { ConfirmDialog, MenuSheet } from "./dialog";
import { ExerciseDemo } from "./exercise-demo";
import { ExercisePicker } from "./exercise-picker";
import { Icon } from "./icon";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/**
 * Uma linha de exercício da rotina — o `routine-exercise-row.tsx` do web:
 * séries, repetições, descanso e RPE editáveis no lugar, sem abrir tela.
 */
export function RoutineExerciseRow({
  exercise,
  index,
  templateId,
  onOpenDetail,
  onChanged,
  onError,
}: {
  exercise: WeekExercise;
  index: number;
  templateId: string;
  onOpenDetail: () => void;
  onChanged: () => void | Promise<unknown>;
  onError: (mensagem: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [menu, setMenu] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);
  const apagada = useColor("muted-foreground");
  const destrutiva = useColor("destructive");
  const primaria = useColor("primary");
  const falhou = (e: unknown) => onError(errorMessage(e));

  const salvar = useMutation({
    mutationFn: (patch: Parameters<typeof updateTemplateItem>[1]) =>
      updateTemplateItem(exercise.itemId, patch),
    onSuccess: () => void onChanged(),
    onError: falhou,
  });
  const remover = useMutation({
    mutationFn: () => removeTemplateItem(exercise.itemId),
    onSuccess: () => void onChanged(),
    onError: falhou,
  });
  const duplicar = useMutation({
    mutationFn: () => duplicateTemplateItem(exercise, templateId),
    onSuccess: () => void onChanged(),
    onError: falhou,
  });
  const trocar = useMutation({
    mutationFn: (newId: string) => swapTemplateExercise(exercise.itemId, newId),
    onSuccess: () => void onChanged(),
    onError: falhou,
  });

  const faixaReps =
    exercise.targetRepMin && exercise.targetRepMax
      ? `${exercise.targetRepMin}–${exercise.targetRepMax}`
      : String(exercise.targetReps);

  return (
    <View>
      <Card className="overflow-hidden">
        <View className="p-3">
          <View className="flex-row gap-3">
            <Pressable
              onPress={onOpenDetail}
              accessibilityLabel={t("Ver detalhes de {{name}}", { name: exercise.name })}
              className="w-20"
            >
              <ExerciseDemo
                images={exerciseImages(exercise.name, exercise.imageUrls)}
                name={exercise.name}
                autoPlay={false}
              />
            </Pressable>

            <View className="min-w-0 flex-1">
              <View className="flex-row items-start justify-between gap-2">
                <Pressable onPress={onOpenDetail} className="min-w-0 flex-1">
                  <Text textBreakStrategy="balanced" className="font-semibold leading-snug">
                    <Text className="text-muted-foreground">{index + 1}. </Text>
                    {exercise.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-muted-foreground">
                    {label(EQUIPMENT_LABELS, exercise.equipment)}
                    {exercise.supersetGroup !== null ? " · em supersérie" : ""}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMenu(true)}
                  accessibilityLabel={t("Opções de {{name}}", { name: exercise.name })}
                  className="h-8 w-8 items-center justify-center rounded-md active:bg-accent"
                >
                  <Icon node={moreVertical} color={apagada} size={16} />
                </Pressable>
              </View>

              <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
                <Badge variante="secundario">{`${exercise.targetSets} × ${faixaReps}`}</Badge>
                <Badge variante="contorno">
                  {t("{{restSeconds}}s descanso", { restSeconds: exercise.restSeconds })}
                </Badge>
                {exercise.targetRpe ? (
                  <Badge variante="contorno">
                    {t("RPE {{targetRpe}}", { targetRpe: exercise.targetRpe })}
                  </Badge>
                ) : null}
                {exercise.cadence ? <Badge variante="contorno">{exercise.cadence}</Badge> : null}
              </View>
            </View>
          </View>

          {expandido ? (
            <View className="mt-3 flex-row flex-wrap gap-3 border-t border-border pt-3">
              <NumberInput
                label={t("Séries")}
                value={exercise.targetSets}
                min={1}
                max={12}
                onCommit={(v) => salvar.mutate({ target_sets: v })}
              />
              <NumberInput
                label={t("Repetições")}
                value={exercise.targetReps}
                min={1}
                max={100}
                onCommit={(v) => salvar.mutate({ target_reps: v })}
              />
              <NumberInput
                label={t("Descanso (s)")}
                value={exercise.restSeconds}
                min={0}
                max={600}
                onCommit={(v) => salvar.mutate({ rest_seconds: v })}
              />
              <NumberInput
                label={t("RPE alvo")}
                value={exercise.targetRpe ?? 8}
                min={1}
                max={10}
                onCommit={(v) => salvar.mutate({ target_rpe: v })}
              />
              <View className="w-full flex-row">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setConfirmarRemocao(true)}
                  accessibilityLabel={t("Remover {{name}} do treino", { name: exercise.name })}
                >
                  <Icon node={trash2} color={destrutiva} size={16} />
                  <Text className="text-xs font-medium">{t("Remover exercício")}</Text>
                </Button>
              </View>
            </View>
          ) : null}
        </View>
      </Card>

      <MenuSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={exercise.name}
        corIcone={primaria}
        opcoes={[
          { label: t("Ver execução"), icon: info, onPress: onOpenDetail },
          {
            label: expandido ? t("Ocultar ajustes") : t("Ajustar séries e descanso"),
            icon: timer,
            onPress: () => setExpandido((v) => !v),
          },
          { label: t("Duplicar"), icon: copy, onPress: () => duplicar.mutate() },
          { label: t("Trocar exercício"), icon: repeat, onPress: () => setTrocando(true) },
          {
            label: t("Remover do plano"),
            icon: trash2,
            destrutiva: true,
            onPress: () => setConfirmarRemocao(true),
          },
        ]}
      />
      <ExercisePicker
        open={trocando}
        onClose={() => setTrocando(false)}
        title={t("Trocar {{name}}", { name: exercise.name })}
        muscle={exercise.primaryMuscle}
        onPick={(ex) => trocar.mutateAsync(ex.id)}
      />
      <ConfirmDialog
        open={confirmarRemocao}
        onClose={() => setConfirmarRemocao(false)}
        title={t("Remover do plano?")}
        description={t("“{{name}}” sai desta rotina. Seu histórico de séries continua salvo.", {
          name: exercise.name,
        })}
        confirmLabel={t("Remover")}
        destructive
        onConfirm={() => remover.mutate()}
      />
    </View>
  );
}

/** Campo numérico que grava ao sair do foco, não a cada tecla. */
function NumberInput({
  label: rotulo,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const texto = useColor("foreground");
  return (
    <View className="w-[47%]">
      <Text className="mb-1 text-xs text-muted-foreground">{rotulo}</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        keyboardType="number-pad"
        accessibilityLabel={rotulo}
        onBlur={() => {
          const n = Number(draft);
          if (!Number.isFinite(n) || draft.trim() === "") return setDraft(String(value));
          const clamped = Math.max(min, Math.min(max, n));
          setDraft(String(clamped));
          if (clamped !== value) onCommit(clamped);
        }}
        className={cn("h-10 rounded-md border border-input bg-background px-3 font-sans text-base")}
        style={{ color: texto }}
      />
    </View>
  );
}

/**
 * Duração estimada do treino: descanso prescrito + ~35 s por série. Uma
 * aproximação declarada como tal ("~45 min").
 */
export function estimarDuracao(split: WeekSplit): string {
  const segundos = split.exercises.reduce(
    (total, e) => total + e.targetSets * (e.restSeconds + 35),
    0,
  );
  return `~${Math.round(segundos / 60)} min`;
}
