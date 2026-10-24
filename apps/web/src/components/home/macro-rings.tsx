import { cn } from "@/lib/utils";

/**
 * Anéis de macronutrientes.
 *
 * ## Por que anel e não barra
 *
 * A barra de progresso responde "quanto falta?" e some quando estoura — 40% e
 * 120% ficam parecidos porque ambos são "a barra cheia ou quase". O anel
 * responde "onde estou em relação à meta?" e tem espaço no centro para o número
 * absoluto, que é a informação que a pessoa realmente procura ao abrir o app.
 *
 * ## Excesso é informação
 *
 * Passar da meta de proteína é neutro; passar da de calorias, não. O anel muda
 * de cor acima de 105% para tornar a diferença visível sem exigir leitura de
 * número — mas só depois de uma margem, porque 102% é ruído de arredondamento
 * de porção, não desvio.
 */

/**
 * Cor de cada macronutriente — uma vez só, para o app inteiro.
 *
 * O dashboard e o diário mostram os mesmos quatro anéis e cada tela repetia a
 * lista de cores à mão. Duas listas iguais só permanecem iguais até alguém
 * mexer numa delas: bastava trocar a cor da fibra em um lugar para o mesmo dado
 * aparecer de duas cores em duas telas do mesmo app.
 *
 * A proteína fica com o jade da marca porque é o macro que o app existe para
 * defender; os demais seguem a ordem da série categórica.
 */
export const MACRO_COLORS = {
  protein: "var(--chart-1)",
  carbs: "var(--chart-2)",
  fat: "var(--chart-4)",
  fiber: "var(--chart-5)",
} as const;

/**
 * Anel grande de calorias, com o restante no centro.
 *
 * "Faltam 640 kcal" é acionável; "1.840 de 2.480" exige uma subtração mental
 * que ninguém quer fazer antes do almoço. O número absoluto continua embaixo,
 * para quem quiser conferir.
 */
export function CalorieRing({
  consumed,
  target,
  planejado = 0,
  size = 148,
  compacto = false,
}: {
  consumed: number;
  target: number;
  /**
   * Calorias do que está planejado para o dia (o cardápio). Sem meta — o
   * padrão, já que o app não prescreve —, é a referência do anel: ele enche
   * conforme a pessoa marca o que comeu, em vez de ficar parado em zero.
   */
  planejado?: number;
  size?: number;
  /** Versão pequena (Início): só o restante no centro. */
  compacto?: boolean;
}) {
  const stroke = compacto ? 10 : 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const usaMeta = target > 0;
  const referencia = usaMeta ? target : planejado;
  const ratio = referencia > 0 ? consumed / referencia : 0;
  const offset = circumference * (1 - Math.min(1, ratio));
  const restante = Math.round(target - consumed);
  // Comer além do planejado não é "excesso": só a meta acende o vermelho.
  const excedeu = usaMeta && ratio > 1.05;
  // Sem meta: o centro mostra o que foi consumido (e, se houver, de quanto planejado).
  const semMeta = !usaMeta;

  return (
    // `max-width` em vez de `width`: em telas muito estreitas o anel acompanha a
    // largura disponível em vez de forçar rolagem horizontal.
    <div className="relative aspect-square w-full shrink-0" style={{ maxWidth: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeOpacity={0.15}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={excedeu ? "var(--destructive)" : "var(--primary)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset,stroke] duration-1000 ease-out-soft motion-reduce:transition-none"
        />
      </svg>

      <div className="absolute inset-0 grid place-content-center text-center">
        <p
          className={cn(
            compacto ? "text-lg" : "text-3xl",
            "font-bold tabular-nums leading-none tracking-tight",
            excedeu && "text-destructive",
          )}
        >
          {(semMeta ? Math.round(consumed) : Math.abs(restante)).toLocaleString("pt-BR")}
        </p>
        <p className={cn("mt-1 text-muted-foreground", compacto ? "text-[9px]" : "text-xs")}>
          {semMeta
            ? compacto
              ? "kcal"
              : "kcal consumidas"
            : restante >= 0
              ? compacto
                ? "restantes"
                : "kcal restantes"
              : "kcal acima"}
        </p>
        <p
          className={cn(
            "mt-1.5 text-[11px] tabular-nums text-muted-foreground",
            (compacto || referencia <= 0) && "hidden",
          )}
        >
          {usaMeta ? (
            <>
              {Math.round(consumed).toLocaleString("pt-BR")} /{" "}
              {Math.round(target).toLocaleString("pt-BR")}
            </>
          ) : (
            `de ${Math.round(planejado).toLocaleString("pt-BR")} planejadas`
          )}
        </p>
      </div>

      <span className="sr-only">
        {referencia > 0
          ? `${Math.round(consumed)} de ${Math.round(referencia)} calorias ${usaMeta ? "da meta" : "planejadas"} consumidas.`
          : `${Math.round(consumed)} calorias consumidas.`}
      </span>
    </div>
  );
}
