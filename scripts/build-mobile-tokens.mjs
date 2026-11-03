/**
 * Gera as cores do app mobile a partir dos tokens do web.
 *
 * Uso: `npm run tokens:mobile`
 *
 * O `styles.css` do web é a fonte única das cores: `:root` é o tema claro e
 * `.dark` o escuro. O React Native não entende `oklch`, então cada cor é
 * convertida para sRGB e gravada em `apps/mobile/src/theme/tokens.gen.json`
 * como canais "r g b" (para `rgb(var(--x) / <alpha-value>)` no Tailwind) e
 * como hex (para quem pede a cor no código: ícones, gráficos, StatusBar).
 *
 * Mudou uma cor no web? Rode o script de novo e o mobile acompanha.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS = join(ROOT, "apps", "web", "src", "styles.css");
const OUT = join(ROOT, "apps", "mobile", "src", "theme", "tokens.gen.json");

/** Conteúdo do primeiro bloco `seletor { ... }` no nível de cima do arquivo. */
function bloco(css, seletor) {
  const inicio = css.search(new RegExp(`^${seletor.replace(".", "\\.")}\\s*\\{`, "m"));
  if (inicio < 0) throw new Error(`bloco ${seletor} não encontrado em styles.css`);
  let nivel = 0;
  for (let i = css.indexOf("{", inicio); i < css.length; i++) {
    if (css[i] === "{") nivel++;
    if (css[i] === "}" && --nivel === 0) return css.slice(css.indexOf("{", inicio) + 1, i);
  }
  throw new Error(`bloco ${seletor} sem fechamento`);
}

/** oklch(L C H [/ A]) → [r, g, b, a] em sRGB 0–255 (fórmulas da CSS Color 4). */
export function oklchParaRgb(valor) {
  const m = valor.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/);
  if (!m) return null;
  const num = (s) => (s.endsWith("%") ? parseFloat(s) / 100 : parseFloat(s));
  const L = num(m[1]);
  const C = parseFloat(m[2]);
  const h = (parseFloat(m[3]) * Math.PI) / 180;
  const a = m[4] === undefined ? 1 : num(m[4]);
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const gama = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
  const [r, g, b] = lin.map((x) => Math.round(Math.min(1, Math.max(0, gama(x))) * 255));
  return [r, g, b, a];
}

function cores(corpo) {
  const out = {};
  for (const [, nome, valor] of corpo.matchAll(/--([\w-]+):\s*(oklch\([^)]*\))\s*;/g)) {
    const rgb = oklchParaRgb(valor.replace(/\s+/g, " "));
    if (rgb && rgb[3] === 1) out[nome] = rgb.slice(0, 3);
  }
  return out;
}

const hex = ([r, g, b]) => "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");

function main() {
  const css = readFileSync(CSS, "utf8");
  const claro = cores(bloco(css, ":root"));
  // O escuro só sobrescreve parte dos tokens; o resto herda do claro.
  const escuro = { ...claro, ...cores(bloco(css, ".dark")) };
  const tema = (t) =>
    Object.fromEntries(
      Object.entries(t).map(([k, rgb]) => [k, { rgb: rgb.join(" "), hex: hex(rgb) }]),
    );

  // JSON para o tailwind.config.js (CommonJS) e o TypeScript lerem o mesmo arquivo.
  // Não edite à mão: mude o styles.css e rode `npm run tokens:mobile`.
  const corpo = JSON.stringify({ light: tema(claro), dark: tema(escuro) }, null, 2) + "\n";
  writeFileSync(OUT, corpo);
  console.log(`${Object.keys(claro).length} cores → ${OUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
