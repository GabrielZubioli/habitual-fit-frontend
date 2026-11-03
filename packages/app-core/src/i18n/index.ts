/**
 * Idioma do app: pt-BR, en ou es, escolhido pelo aparelho/navegador.
 *
 * ## A chave é o próprio texto em pt-BR
 *
 * `t("Sua semana")` devolve "Sua semana" em pt-BR (não há arquivo de pt) e a
 * tradução de `en.json`/`es.json` nos outros idiomas. Sem tradução, sai o pt —
 * melhor que uma chave técnica na tela. `npm run i18n:check` pega a falta.
 *
 * ## Síncrono, e o idioma não muda em tempo de execução
 *
 * O i18next sobe com os recursos embutidos e `initAsync: false`, então `t()`
 * já funciona em constantes de módulo (`labels.ts`, opções do questionário).
 * Isso só vale porque o idioma é decidido uma vez, na carga. Se um dia houver
 * seletor de idioma, trocar recarrega o app.
 *
 * ## Onde o idioma é lido
 *
 * Web: `navigator.language`. App nativo (Hermes): `Intl`, que no Android e no
 * iOS reflete o idioma do sistema — sem módulo nativo extra. No servidor
 * (SSR do web) não há `navigator`: sai pt-BR.
 * ponytail: páginas públicas renderizadas no servidor saem em pt e o React
 * refaz no cliente para en/es (aviso de hidratação); ler o Accept-Language por
 * requisição se isso incomodar.
 */
import i18next from "i18next";
import type { Locale as DateFnsLocale } from "date-fns";
import { enUS, es as esLocale, ptBR } from "date-fns/locale";
import en from "./en.json";
import es from "./es.json";

export type Language = "pt-BR" | "en" | "es";

/** `pt-*` → pt-BR, `es-*` → es, qualquer outro → en. */
export function normalizeLanguage(tag: string | undefined | null): Language {
  const base = (tag ?? "").toLowerCase().split(/[-_]/)[0];
  if (base === "pt") return "pt-BR";
  if (base === "es") return "es";
  return "en";
}

function detect(): string | undefined {
  const nav = (globalThis as { navigator?: { language?: string; product?: string } }).navigator;
  // Servidor e testes (Node também tem `navigator.language`): pt-BR.
  if (typeof document === "undefined" && nav?.product !== "ReactNative") return "pt-BR";
  // No React Native o `navigator` não tem `language`: vale o `Intl`.
  if (nav?.language) return nav.language;
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

export const language: Language = normalizeLanguage(detect());

/** Locale para `Intl.*` e `toLocaleString`. */
export const LOCALE = { "pt-BR": "pt-BR", en: "en-US", es: "es" }[language];

/** Locale do date-fns (nomes de mês e dia da semana). */
export const dateFnsLocale: DateFnsLocale = { "pt-BR": ptBR, en: enUS, es: esLocale }[language];

const i18n = i18next.createInstance();
void i18n.init({
  lng: language,
  resources: { en: { translation: en }, es: { translation: es } },
  initAsync: false,
  fallbackLng: false,
  keySeparator: false,
  nsSeparator: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
});

/** Traduz um texto em pt-BR. Interpolação: `t("{{n}} treinos", { n })`. */
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options) as string;
}
