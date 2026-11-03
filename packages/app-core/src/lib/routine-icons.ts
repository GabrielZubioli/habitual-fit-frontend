/**
 * Os ícones de rotina: a chave gravada em `workout_templates.icon` e o rótulo.
 * Cada app associa a chave ao seu desenho (lucide no web, react-native-svg no
 * app nativo); a lista e o palpite pelo nome são os mesmos.
 */
export const ROUTINE_ICON_KEYS = [
  { key: "braco", label: "Braço" },
  { key: "perna", label: "Perna" },
  { key: "tronco", label: "Peito" },
  { key: "halter", label: "Halter" },
  { key: "peso", label: "Peso" },
  { key: "punho", label: "Força" },
  { key: "corpo", label: "Corpo todo" },
  { key: "mobilidade", label: "Mobilidade" },
  { key: "corrida", label: "Corrida" },
  { key: "cardio", label: "Cardio" },
  { key: "queima", label: "Queima" },
  { key: "explosao", label: "Explosão" },
  { key: "foco", label: "Foco" },
  { key: "desafio", label: "Desafio" },
  { key: "meta", label: "Meta" },
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
