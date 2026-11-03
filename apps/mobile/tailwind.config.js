/**
 * Cores e raios iguais aos do web. As cores vêm de `src/theme/tokens.gen.json`
 * (gerado do styles.css por `npm run tokens:mobile`) e chegam às classes como
 * variáveis, aplicadas na raiz por `ThemeProvider` — `bg-primary`,
 * `text-muted-foreground`, `border-border`, com o mesmo nome do web.
 */
const tokens = require("./src/theme/tokens.gen.json");

const colors = Object.fromEntries(
  Object.keys(tokens.light).map((nome) => [nome, `rgb(var(--${nome}) / <alpha-value>)`]),
);

// `--radius: 1rem` no web; os degraus seguem o `@theme inline` de lá.
const R = 16;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
      // Inter em todo aparelho, com os pesos remapeados como no web
      // (styles.css: medium → 600, extrabold → 900).
      fontFamily: { sans: ["Inter"] },
      fontWeight: { medium: "600", extrabold: "900" },
      borderRadius: {
        sm: `${R - 4}px`,
        md: `${R - 2}px`,
        lg: `${R}px`,
        xl: `${R + 4}px`,
        "2xl": `${R + 8}px`,
        "3xl": `${R + 12}px`,
        "4xl": `${R + 16}px`,
      },
    },
  },
  plugins: [],
};
