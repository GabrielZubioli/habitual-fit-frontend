import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { __iconNode as chevronDown } from "lucide-react/dist/esm/icons/chevron-down.js";
import type { Enums } from "@gabrielzubioli/db/types";
import { createOwnExercise } from "@forja/app-core/data/workouts";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { EQUIPMENT_LABELS, MUSCLE_LABELS, label } from "@forja/app-core/lib/labels";
import { useCurrentUserId } from "@/lib/session";
import { useColor } from "@/theme/theme";
import { Button } from "./button";
import { Dialog, MenuSheet } from "./dialog";
import { Icon } from "./icon";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/**
 * Criar um exercício próprio — o `create-exercise-dialog.tsx` do web: nome,
 * músculo principal e equipamento. Só a pessoa vê.
 */
export function CreateExerciseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [musculo, setMusculo] = useState<Enums<"muscle_t">>("chest");
  const [equipamento, setEquipamento] = useState<Enums<"equipment_t">>("machine");
  const [escolhendo, setEscolhendo] = useState<"musculo" | "equipamento" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const apagada = useColor("muted-foreground");
  const texto = useColor("foreground");

  const criar = useMutation({
    mutationFn: () =>
      createOwnExercise(userId, { name: nome, primaryMuscle: musculo, equipment: equipamento }),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.exercises.all });
      onClose();
      setNome("");
      router.push({ pathname: "/exercises/[id]", params: { id } });
    },
    onError: (e) => setErro(errorMessage(e)),
  });
  const nomeValido = nome.trim().length >= 2 && nome.trim().length <= 80;

  const Campo = ({
    rotulo,
    valor,
    onPress,
  }: {
    rotulo: string;
    valor: string;
    onPress: () => void;
  }) => (
    <View className="gap-1.5">
      <Text className="text-sm font-medium">{rotulo}</Text>
      <Pressable
        onPress={onPress}
        className="h-10 flex-row items-center justify-between rounded-md border border-input bg-background px-3"
      >
        <Text className="text-sm">{valor}</Text>
        <Icon node={chevronDown} color={apagada} size={16} />
      </Pressable>
    </View>
  );

  return (
    <Dialog open={open} onClose={onClose} title={t("Novo exercício")}>
      <Text className="-mt-2 text-center text-sm text-muted-foreground">
        {t("Para o aparelho ou variação que não está na biblioteca. Só você vê.")}
      </Text>
      <View className="gap-1.5">
        <Text className="text-sm font-medium">{t("Nome")}</Text>
        <TextInput
          value={nome}
          onChangeText={setNome}
          maxLength={80}
          placeholder={t("Ex.: Remada articulada Hammer")}
          placeholderTextColor={apagada}
          className="h-10 rounded-md border border-input bg-background px-3 font-sans text-sm"
          style={{ color: texto }}
        />
      </View>
      <Campo
        rotulo={t("Músculo principal")}
        valor={label(MUSCLE_LABELS, musculo)}
        onPress={() => setEscolhendo("musculo")}
      />
      <Campo
        rotulo={t("Equipamento")}
        valor={label(EQUIPMENT_LABELS, equipamento)}
        onPress={() => setEscolhendo("equipamento")}
      />
      {erro ? <Text className="text-sm text-destructive">{erro}</Text> : null}
      <Button disabled={!nomeValido || criar.isPending} onPress={() => criar.mutate()}>
        {criar.isPending ? t("Criando…") : t("Criar")}
      </Button>

      <MenuSheet
        open={escolhendo !== null}
        onClose={() => setEscolhendo(null)}
        title={escolhendo === "musculo" ? t("Músculo principal") : t("Equipamento")}
        corIcone={texto}
        opcoes={
          escolhendo === "musculo"
            ? (Object.keys(MUSCLE_LABELS) as Enums<"muscle_t">[]).map((v) => ({
                label: label(MUSCLE_LABELS, v),
                onPress: () => setMusculo(v),
              }))
            : (Object.keys(EQUIPMENT_LABELS) as Enums<"equipment_t">[]).map((v) => ({
                label: label(EQUIPMENT_LABELS, v),
                onPress: () => setEquipamento(v),
              }))
        }
      />
    </Dialog>
  );
}
