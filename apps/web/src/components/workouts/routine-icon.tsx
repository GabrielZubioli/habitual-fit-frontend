import { useState, type ComponentType, type SVGProps } from "react";
import {
  Accessibility,
  BicepsFlexed,
  Dumbbell,
  Flame,
  Footprints,
  HandFist,
  HeartPulse,
  Mountain,
  PersonStanding,
  Target,
  Trophy,
  Weight,
  Zap,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { guessRoutineIcon } from "@forja/app-core/lib/routine-icons";
import { t } from "@forja/app-core/i18n";

export { guessRoutineIcon };

/**
 * O ícone de cada rotina, no lugar da letra A/B/C.
 *
 * Perna e tronco são desenhados aqui, no traço do lucide, que não tem nenhum
 * dos dois — e são justamente os mais pedidos para uma divisão de treino.
 */

function LegIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M6 2c0 3.2 1 6 2.5 8.5.6 1 .6 2.2.4 3.5L8 19.5A1.5 1.5 0 0 0 9.5 21H18a1.5 1.5 0 0 0 .2-3L12 17c.8-2 1.6-4.3.5-6.5C11.8 8.8 13 5 13.5 2" />
    </svg>
  );
}

function TorsoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M11 5H8a5 5 0 0 0-5 5v1c2.3 2.7 5.5 3.2 8 1.5Z" />
      <path d="M13 5h3a5 5 0 0 1 5 5v1c-2.3 2.7-5.5 3.2-8 1.5Z" />
      <path d="M9.5 16.5h1.5M13 16.5h1.5M9.5 20h1.5M13 20h1.5" />
    </svg>
  );
}

type Icone = ComponentType<SVGProps<SVGSVGElement>>;

export const ROUTINE_ICONS: { key: string; label: string; Icon: Icone }[] = [
  { key: "braco", label: t("Braço"), Icon: BicepsFlexed },
  { key: "perna", label: t("Perna"), Icon: LegIcon },
  { key: "tronco", label: t("Peito"), Icon: TorsoIcon },
  { key: "halter", label: t("Halter"), Icon: Dumbbell },
  { key: "peso", label: t("Peso"), Icon: Weight },
  { key: "punho", label: t("Força"), Icon: HandFist },
  { key: "corpo", label: t("Corpo todo"), Icon: PersonStanding },
  { key: "mobilidade", label: t("Mobilidade"), Icon: Accessibility },
  { key: "corrida", label: t("Corrida"), Icon: Footprints },
  { key: "cardio", label: t("Cardio"), Icon: HeartPulse },
  { key: "queima", label: t("Queima"), Icon: Flame },
  { key: "explosao", label: t("Explosão"), Icon: Zap },
  { key: "foco", label: t("Foco"), Icon: Target },
  { key: "desafio", label: t("Desafio"), Icon: Mountain },
  { key: "meta", label: t("Meta"), Icon: Trophy },
];

/** O componente do ícone de uma rotina (escolhido ou pelo nome). */
export function routineIconOf(icon: string | null | undefined, name: string): Icone {
  const key = icon ?? guessRoutineIcon(name);
  return (ROUTINE_ICONS.find((i) => i.key === key) ?? ROUTINE_ICONS[3]!).Icon;
}

/** O quadrado verde com o ícone da rotina. */
export function RoutineIcon({
  icon,
  name,
  className,
  muted = false,
}: {
  icon: string | null | undefined;
  name: string;
  className?: string;
  muted?: boolean;
}) {
  const Icon = routineIconOf(icon, name);
  return (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-xl",
        muted ? "bg-elevated text-foreground" : "bg-primary text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      <Icon className="size-6" />
    </span>
  );
}

/** O ícone da rotina como botão: abre a grade para escolher outro. */
export function RoutineIconPicker({
  icon,
  name,
  onChange,
}: {
  icon: string | null;
  name: string;
  onChange: (key: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = icon ?? guessRoutineIcon(name);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("Trocar o ícone de {{name}}", { name })}
          className="shrink-0 rounded-xl transition-transform active:scale-95"
        >
          <RoutineIcon icon={icon} name={name} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto rounded-[1.25rem] border-border bg-card p-3 shadow-xl"
      >
        <p className="mb-2 px-1 text-sm font-semibold">{t("Ícone da rotina")}</p>
        <div role="radiogroup" aria-label={t("Ícone da rotina")} className="grid grid-cols-5 gap-2">
          {ROUTINE_ICONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={atual === key}
              aria-label={label}
              title={label}
              onClick={() => {
                onChange(key);
                setAberto(false);
              }}
              className={cn(
                "grid size-12 place-items-center rounded-xl transition-colors",
                atual === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-elevated text-foreground hover:bg-primary/20",
              )}
            >
              <Icon className="size-6" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
