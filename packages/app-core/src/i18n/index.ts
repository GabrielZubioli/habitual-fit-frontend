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
 * Isso só vale porque o idioma é decidido uma vez, na carga: trocar no seletor
 * grava a escolha e recarrega o app (web) ou pede para reabri-lo (nativo).
 *
 * ## Como o idioma é escolhido (`resolveLanguage`)
 *
 * 1. A escolha salva no seletor, se houver.
 * 2. O país: Brasil, Portugal, Angola e os outros lusófonos → pt-BR; países de
 *    língua espanhola → es; qualquer outro país → en.
 * 3. Sem país conhecido, o idioma do aparelho/navegador; não sendo pt nem es, en.
 *
 * O país vem, no web, do cookie `forja-pais`, gravado pelo servidor a partir da
 * geolocalização do IP (`x-vercel-ip-country`); na falta dele, da região do
 * `navigator.language` ("en-BR" → BR). No nativo, da região do sistema (`Intl`).
 * A escolha salva fica no `localStorage` (web) ou no SecureStore, lida pelo
 * `index.js` do app antes de tudo e exposta em `globalThis.__forjaIdioma`.
 *
 * No servidor (SSR do web) e nos testes sai pt-BR.
 * ponytail: páginas públicas renderizadas no servidor saem em pt e o React
 * refaz no cliente para en/es (aviso de hidratação); ler o cookie por
 * requisição se isso incomodar.
 */
import i18next from "i18next";
import { createElement, Fragment, type ReactNode } from "react";
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

export const LANGUAGES: readonly Language[] = ["pt-BR", "en", "es"];

/** Chave da escolha salva (localStorage no web, SecureStore no nativo). */
export const LANGUAGE_PREF_KEY = "forja.idioma";

const PAISES_PT = new Set(["BR", "PT", "AO", "MZ", "CV", "GW", "ST", "TL"]);
const PAISES_ES = new Set([
  "ES", "MX", "AR", "CO", "CL", "PE", "VE", "EC", "GT", "CU", "BO", "DO",
  "HN", "PY", "SV", "NI", "CR", "PA", "UY", "PR", "GQ",
]); // prettier-ignore

/** Idioma de um país (código ISO de 2 letras); `undefined` se não houver país. */
export function languageForCountry(pais: string | undefined | null): Language | undefined {
  const cc = (pais ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return undefined;
  if (PAISES_PT.has(cc)) return "pt-BR";
  if (PAISES_ES.has(cc)) return "es";
  return "en";
}

/** Região de uma tag de idioma: "en-BR" → "BR", "es-419" → undefined. */
function regiao(tag: string | undefined): string | undefined {
  return tag?.split(/[-_]/).find((p, i) => i > 0 && /^[A-Za-z]{2}$/.test(p));
}

/** Escolha salva → país → idioma do aparelho → en. */
export function resolveLanguage(entrada: {
  pref?: string | null;
  pais?: string | null;
  tag?: string | null;
}): Language {
  if (LANGUAGES.includes(entrada.pref as Language)) return entrada.pref as Language;
  return (
    languageForCountry(entrada.pais) ??
    languageForCountry(regiao(entrada.tag ?? undefined)) ??
    normalizeLanguage(entrada.tag)
  );
}

type Ambiente = {
  navigator?: { language?: string; product?: string };
  localStorage?: { getItem(k: string): string | null };
  __forjaIdioma?: string | null;
};

function detect(): Language {
  const g = globalThis as Ambiente;
  const nav = g.navigator;
  // Nativo: escolha salva vem do index.js; país e idioma, do `Intl`.
  if (nav?.product === "ReactNative") {
    let tag: string | undefined;
    try {
      tag = Intl.DateTimeFormat().resolvedOptions().locale;
    } catch {
      tag = undefined;
    }
    return resolveLanguage({ pref: g.__forjaIdioma, tag });
  }
  // Servidor e testes (Node também tem `navigator.language`): pt-BR.
  if (typeof document === "undefined") return "pt-BR";
  let pref: string | null = null;
  try {
    pref = g.localStorage?.getItem(LANGUAGE_PREF_KEY) ?? null;
  } catch {
    pref = null; // modo privado bloqueia o storage
  }
  const pais = /(?:^|;\s*)forja-pais=([A-Za-z]{2})/.exec(document.cookie)?.[1];
  return resolveLanguage({ pref, pais, tag: nav?.language });
}

export const language: Language = detect();

/** Nome de cada idioma nele mesmo, para o seletor. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  "pt-BR": "Português",
  en: "English",
  es: "Español",
};

/**
 * Grava a escolha do seletor e recarrega a página (web). `null` volta ao
 * automático. No nativo quem grava é o app (SecureStore).
 */
export function setLanguagePreference(lang: Language | null): void {
  const g = globalThis as Ambiente & {
    localStorage?: { setItem(k: string, v: string): void; removeItem(k: string): void };
    location?: { reload(): void };
  };
  try {
    if (lang) g.localStorage?.setItem(LANGUAGE_PREF_KEY, lang);
    else g.localStorage?.removeItem(LANGUAGE_PREF_KEY);
  } catch {
    // sem storage, a escolha vale só até recarregar
  }
  g.location?.reload();
}

/** Escolha salva no web (`null` = automático). */
export function languagePreference(): Language | null {
  try {
    const v = (globalThis as Ambiente).localStorage?.getItem(LANGUAGE_PREF_KEY);
    return LANGUAGES.includes(v as Language) ? (v as Language) : null;
  } catch {
    return null;
  }
}

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

/**
 * Frase com trechos marcados — link, negrito — traduzida inteira:
 *
 *   tRich("Aceita os <0>Termos</0> e a <1>Política</1>.", [
 *     (s) => <Link to="/termos">{s}</Link>,
 *     (s) => <Link to="/privacidade">{s}</Link>,
 *   ])
 *
 * Traduzir os pedaços em separado quebra a gramática dos outros idiomas.
 */
export function tRich(
  key: string,
  partes: ((texto: string) => ReactNode)[],
  options?: Record<string, unknown>,
): ReactNode[] {
  const frase = t(key, options);
  const saida: ReactNode[] = [];
  const marca = /<(\d+)>([\s\S]*?)<\/\1>/g;
  let fim = 0;
  for (const m of frase.matchAll(marca)) {
    if (m.index > fim) saida.push(frase.slice(fim, m.index));
    const parte = partes[Number(m[1])];
    saida.push(createElement(Fragment, { key: saida.length }, parte ? parte(m[2] ?? "") : m[2]));
    fim = m.index + m[0].length;
  }
  if (fim < frase.length) saida.push(frase.slice(fim));
  return saida;
}
