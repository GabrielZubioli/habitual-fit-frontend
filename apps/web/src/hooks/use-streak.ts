import { useQuery } from "@tanstack/react-query";
import { addDays, startOfWeek } from "date-fns";
import { queryKeys } from "@/data/query-keys";
import { fetchActiveRoutine, fetchCompletedWorkouts } from "@/data/routines";
import { toISODate, todayISO } from "@/lib/date";
import { diasSeguidos } from "@/lib/streak";

/**
 * A sequência de dias de treino (a do card de Início), com os dias treinados
 * das últimas ~25 semanas. Dias de treino do plano: na semana fixa, os dias
 * das rotinas; na rotação, os dias escolhidos.
 */
export function useStreak() {
  const routine = useQuery({
    queryKey: queryKeys.workouts.activeRoutine(),
    queryFn: fetchActiveRoutine,
  });
  const recentes = useQuery({
    queryKey: [...queryKeys.workouts.all, "completed-recent"],
    queryFn: () => {
      const inicio = startOfWeek(new Date(), { weekStartsOn: 1 });
      return fetchCompletedWorkouts(
        toISODate(addDays(inicio, -7 * 25)),
        toISODate(addDays(inicio, 6)),
      );
    },
  });
  const r = routine.data;
  const treinou = new Set((recentes.data ?? []).map((w) => w.date));
  const diasDoPlano = new Set(
    r
      ? r.scheduleMode === "fixed"
        ? r.templates.flatMap((t) => t.weekdays)
        : r.trainingWeekdays
      : [],
  );
  return {
    dias: diasSeguidos(treinou, (wd) => diasDoPlano.has(wd), todayISO()),
    treinou,
    isPending: routine.isPending || recentes.isPending,
  };
}
