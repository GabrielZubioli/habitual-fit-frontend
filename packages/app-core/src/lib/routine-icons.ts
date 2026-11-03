import { t } from "../i18n";
/**
 * Os ícones de rotina: a chave gravada em `workout_templates.icon` e o rótulo.
 * Cada app associa a chave ao seu desenho (lucide no web, react-native-svg no
 * app nativo); a lista e o palpite pelo nome são os mesmos.
 */
export const ROUTINE_ICON_KEYS = [
  { key: "braco", label: t("Braço") },
  { key: "perna", label: t("Perna") },
  { key: "tronco", label: t("Peito") },
  { key: "halter", label: t("Halter") },
  { key: "peso", label: t("Peso") },
  { key: "punho", label: t("Força") },
  { key: "corpo", label: t("Corpo todo") },
  { key: "mobilidade", label: t("Mobilidade") },
  { key: "corrida", label: t("Corrida") },
  { key: "cardio", label: t("Cardio") },
  { key: "queima", label: t("Queima") },
  { key: "explosao", label: t("Explosão") },
  { key: "foco", label: t("Foco") },
  { key: "desafio", label: t("Desafio") },
  { key: "meta", label: t("Meta") },
] as const;

export type RoutineIconKey = (typeof ROUTINE_ICON_KEYS)[number]["key"];

/** Sem ícone escolhido: um palpite pelo nome da rotina. */
export function guessRoutineIcon(name: string): RoutineIconKey {
  const n = name.toLowerCase();
  if (/infer|perna|gl[uú]te|quadr|posterior|panturr|coxa/.test(n)) return "perna";
  if (/peito|costas|dorsal|tronco|push|pull|empurr|pux/.test(n)) return "tronco";
  if (/bra[cç]|b[ií]ceps|tr[ií]ceps|ombro|superior/.test(n)) return "braco";
  if (/cardio|aer[oó]b|hiit/.test(n)) return "cardio";
  if (/corpo|full|total|geral/.test(n)) return "corpo";
  return "halter";
}
