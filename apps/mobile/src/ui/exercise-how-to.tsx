import type { ReactNode } from "react";
import { View } from "react-native";
import { __iconNode as alertTriangle } from "lucide-react/dist/esm/icons/triangle-alert.js";
import { __iconNode as languages } from "lucide-react/dist/esm/icons/languages.js";
import { __iconNode as lightbulb } from "lucide-react/dist/esm/icons/lightbulb.js";
import { __iconNode as listOrdered } from "lucide-react/dist/esm/icons/list-ordered.js";
import { INJURY_OPTIONS } from "@forja/app-core/lib/onboarding/options";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Icon, type IconNode } from "./icon";
import { Text } from "./text";

/**
 * Como executar o exercício — o `exercise-how-to.tsx` do web: o passo a passo
 * em português e, só na falta dele, o original rotulado "em inglês" (nunca
 * tradução automática); depois dicas, erros comuns e contraindicações.
 */
export type ExerciseHowToData = {
  execution: string[] | null;
  instructions: string | null;
  execution_en: string[] | null;
  cues: string[] | null;
  common_mistakes: string[] | null;
  contraindications: string[] | null;
};

export function ExerciseHowTo({ exercise }: { exercise: ExerciseHowToData }) {
  const texto = useColor("foreground");
  const branco = useColor("primary-foreground");
  const passosPt = exercise.execution ?? [];
  const passosEn = exercise.execution_en ?? [];
  const textoEn = exercise.instructions?.trim() ?? "";

  const passos = passosPt.length > 0 ? passosPt : passosEn;
  const emIngles = passosPt.length === 0 && (passosEn.length > 0 || textoEn.length > 0);
  const mostrarTextoCorrido = passosPt.length === 0 && passosEn.length === 0 && textoEn.length > 0;

  return (
    <View className="gap-3">
      {mostrarTextoCorrido ? (
        <Bloco titulo="Execução" icone={listOrdered} cor={texto} extra={<EmIngles />}>
          <Text className="text-[15px] leading-relaxed">{textoEn}</Text>
        </Bloco>
      ) : null}

      {passos.length > 0 ? (
        <Bloco
          titulo="Passo a passo"
          icone={listOrdered}
          cor={texto}
          extra={emIngles ? <EmIngles /> : null}
        >
          {/* Linha vertical ligando os números: lê como sequência, não como lista solta. */}
          <View className="gap-4">
            <View className="absolute bottom-3 left-[13px] top-3 w-px bg-border" />
            {passos.map((passo, i) => (
              <View key={passo} className="flex-row gap-3.5">
                <View className="h-7 w-7 items-center justify-center rounded-full bg-primary">
                  <Text className="text-xs font-extrabold" style={{ color: branco }}>
                    {i + 1}
                  </Text>
                </View>
                <Text className="flex-1 pt-0.5 text-[15px] leading-relaxed">{passo}</Text>
              </View>
            ))}
          </View>
          {emIngles ? (
            <Text className="mt-3 text-xs text-muted-foreground">
              Sem versão em português na base de origem. O texto original é exibido sem tradução
              automática — instrução de execução traduzida por máquina pode sair perigosa.
            </Text>
          ) : null}
        </Bloco>
      ) : null}

      {exercise.cues?.length ? (
        <ListaComIcone
          titulo="Dicas de execução"
          icone={lightbulb}
          itens={exercise.cues}
          tom="primary"
        />
      ) : null}
      {exercise.common_mistakes?.length ? (
        <ListaComIcone
          titulo="Erros comuns"
          icone={alertTriangle}
          itens={exercise.common_mistakes}
          tom="warning"
        />
      ) : null}
      {exercise.contraindications?.length ? (
        <ListaComIcone
          titulo="Cuidado se você tem"
          icone={alertTriangle}
          itens={exercise.contraindications.map(
            (c) => INJURY_OPTIONS.find((o) => o.value === c)?.label ?? c,
          )}
          tom="destructive"
        />
      ) : null}

      {passos.length === 0 && !mostrarTextoCorrido ? (
        <View className="rounded-[20px] border border-dashed border-border p-4">
          <Text className="text-sm text-muted-foreground">
            Este exercício ainda não tem passo a passo cadastrado. A demonstração acima mostra o
            movimento completo.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function EmIngles() {
  const cor = useColor("warning");
  return (
    <View className="flex-row items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5">
      <Icon node={languages} color={cor} size={12} />
      <Text className="text-xs font-semibold text-warning">em inglês</Text>
    </View>
  );
}

function Bloco({
  titulo,
  icone,
  cor,
  extra,
  children,
}: {
  titulo: string;
  icone: IconNode;
  cor: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="rounded-[20px] bg-card p-4">
      <View className="mb-3 flex-row flex-wrap items-center gap-2">
        <Icon node={icone} color={cor} size={16} />
        <Text className="font-bold">{titulo}</Text>
        {extra}
      </View>
      {children}
    </View>
  );
}

const TONS = {
  primary: { titulo: "text-primary", borda: "border-l-primary" },
  warning: { titulo: "text-warning", borda: "border-l-warning" },
  destructive: { titulo: "text-destructive", borda: "border-l-destructive" },
} as const;

function ListaComIcone({
  titulo,
  icone,
  itens,
  tom,
}: {
  titulo: string;
  icone: IconNode;
  itens: readonly string[];
  tom: keyof typeof TONS;
}) {
  const cor = useColor(tom);
  return (
    <View className={cn("rounded-[20px] border-l-4 bg-card p-4", TONS[tom].borda)}>
      <View className="mb-2 flex-row items-center gap-2">
        <Icon node={icone} color={cor} size={16} />
        <Text className={cn("font-bold", TONS[tom].titulo)}>{titulo}</Text>
      </View>
      <View className="gap-1.5">
        {itens.map((item) => (
          <View key={item} className="flex-row gap-2.5">
            <View className="mt-2.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <Text className="flex-1 text-[15px] leading-relaxed">{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
