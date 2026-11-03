import { useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { addDays, startOfWeek, subWeeks } from "date-fns";
import { fetchCompletedWorkouts } from "@forja/app-core/data/routines";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { formatDate, toISODate } from "@forja/app-core/lib/date";
import { useColor } from "@/theme/theme";
import { ErrorState } from "./card";
import { Text } from "./text";

const WEEKS = 53;

/** Um ano de treinos, um quadrado por dia; colunas são semanas, a rolagem começa na atual. */
export function ActivityHeatmap() {
  const inicio = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), WEEKS - 1);
  const de = toISODate(inicio);
  const ate = toISODate(new Date());
  const [dia, setDia] = useState<string | null>(null);
  const rolagem = useRef<ScrollView>(null);
  const primaria = useColor("primary");
  const texto = useColor("foreground");
  const treinos = useQuery({
    queryKey: [...queryKeys.workouts.all, "heatmap", de],
    queryFn: () => fetchCompletedWorkouts(de, ate),
  });

  if (treinos.isPending) return <View className="h-32 w-full rounded-xl bg-muted" />;
  if (treinos.isError) {
    return (
      <ErrorState
        message={errorMessage(treinos.error)}
        onRetry={() => void treinos.refetch()}
        compact
      />
    );
  }

  const porDia = new Map<string, number>();
  for (const t of treinos.data) porDia.set(t.date, (porDia.get(t.date) ?? 0) + 1);
  const total = treinos.data.length;
  const nDia = dia ? (porDia.get(dia) ?? 0) : 0;
  const semanasAtivas = new Set(
    treinos.data.map((t) =>
      toISODate(startOfWeek(new Date(`${t.date}T12:00:00`), { weekStartsOn: 1 })),
    ),
  ).size;
  const cor = (n: number) => (n === 0 ? `${primaria}1A` : n === 1 ? `${primaria}8C` : primaria);

  return (
    <View>
      <View className="mb-3 flex-row items-end justify-between gap-3">
        <Text>
          <Text className="text-3xl font-extrabold text-primary">{total}</Text>{" "}
          <Text className="text-sm text-muted-foreground">
            {total === 1 ? "treino" : "treinos"} · {semanasAtivas} semanas ativas
          </Text>
        </Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-[10px] text-muted-foreground">menos</Text>
          {[0, 1, 2].map((n) => (
            <View
              key={n}
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ backgroundColor: cor(n) }}
            />
          ))}
          <Text className="text-[10px] text-muted-foreground">mais</Text>
        </View>
      </View>
      <ScrollView
        ref={rolagem}
        horizontal
        showsHorizontalScrollIndicator={false}
        className="grow-0"
        onContentSizeChange={() => rolagem.current?.scrollToEnd({ animated: false })}
        accessibilityLabel={`Mapa de treinos: ${total} treinos nas últimas ${WEEKS} semanas`}
      >
        <View className="flex-row gap-[3px] pb-1">
          {Array.from({ length: WEEKS }, (_, s) => (
            <View key={s} className="gap-[3px]">
              {Array.from({ length: 7 }, (_, d) => {
                const iso = toISODate(addDays(inicio, s * 7 + d));
                const n = porDia.get(iso) ?? 0;
                if (iso > ate) return <View key={d} className="h-3 w-3" />;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDia(iso === dia ? null : iso)}
                    hitSlop={2}
                    className="h-3 w-3 rounded-[3px]"
                    style={[
                      { backgroundColor: cor(Math.min(2, n)) },
                      iso === dia
                        ? { borderWidth: 1.5, borderColor: texto }
                        : iso === ate
                          ? { borderWidth: 1.5, borderColor: `${primaria}99` }
                          : null,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      <Text className="mt-3 min-h-5 text-sm">
        {dia ? (
          <>
            <Text className="text-sm font-semibold capitalize">
              {formatDate(dia, "EEEE, d 'de' MMMM")}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {" "}
              · {nDia === 0 ? "sem treino" : `${nDia} treino${nDia > 1 ? "s" : ""}`}
            </Text>
          </>
        ) : (
          <Text className="text-sm text-muted-foreground">
            Toque em um dia para ver os detalhes.
          </Text>
        )}
      </Text>
    </View>
  );
}
