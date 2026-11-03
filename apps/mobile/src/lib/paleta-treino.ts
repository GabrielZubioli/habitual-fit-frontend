import tokens from "@/theme/tokens.gen.json";
import type { Scheme } from "@/theme/theme";

/**
 * Cores da tela do treino — os tokens `--t-*` de `.tela-treino` (styles.css).
 * Vendo o histórico, as do tema; com o treino rolando (`.ao-vivo`), a paleta
 * laranja: fundo laranja, tinta quase preta, cartões escuros com texto claro.
 *
 * Os valores ao vivo são os `oklch` do styles.css convertidos para hex pelo
 * mesmo conversor de `npm run tokens:mobile`.
 */
export type PaletaTreino = {
  page: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  surface: string;
  raised: string;
  on: string;
  onSoft: string;
  accent: string;
  accentFg: string;
  line: string;
};

/** `#rrggbb` + opacidade → `rgba()` (o `color-mix(... X%, transparent)` do web). */
export function comAlfa(hex: string, alfa: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

const TREINO = "#fb9f44"; // --treino: oklch(0.78 0.15 62)
const TREINO_INK = "#261000"; // --treino-ink: oklch(0.2 0.05 62)
const SUPERFICIE = "#21140a"; // oklch(0.205 0.028 60)
const ELEVADA = "#332418"; // oklch(0.275 0.03 60)
const TEXTO = "#fdfaf4"; // oklch(0.985 0.008 80)

export function paletaTreino(aoVivo: boolean, scheme: Scheme): PaletaTreino {
  if (aoVivo) {
    return {
      page: TREINO,
      ink: TREINO_INK,
      inkSoft: comAlfa(TREINO_INK, 0.7),
      inkFaint: comAlfa(TREINO_INK, 0.13),
      surface: SUPERFICIE,
      raised: ELEVADA,
      on: TEXTO,
      onSoft: comAlfa(TEXTO, 0.64),
      accent: TREINO,
      accentFg: TREINO_INK,
      line: comAlfa(TEXTO, 0.1),
    };
  }
  const t = tokens[scheme];
  return {
    page: t.background.hex,
    ink: t.foreground.hex,
    inkSoft: t["muted-foreground"].hex,
    inkFaint: comAlfa(t.foreground.hex, 0.1),
    surface: t.card.hex,
    raised: t.elevated.hex,
    on: t.foreground.hex,
    onSoft: t["muted-foreground"].hex,
    accent: t.primary.hex,
    accentFg: t["primary-foreground"].hex,
    line: t.border.hex,
  };
}

export const COR_TREINO = { treino: TREINO, tinta: TREINO_INK };
