/**
 * `npm run i18n:check` — toda frase passada a `t("...")` precisa estar em
 * `en.json` e `es.json`, e nenhum dos dois pode ter frase que o código não usa
 * mais (o que acontece ao editar um texto em pt: a chave antiga fica órfã).
 *
 * Plural do i18next: `t("{{count}} treinos", { count })` aceita, no lugar da
 * chave, as variantes `_one`/`_other` (e as demais categorias do Intl).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PASTAS = ["apps/web/src", "apps/mobile/app", "apps/mobile/src", "packages/app-core/src"];
const IDIOMAS = ["en", "es"];
const PLURAL = /_(zero|one|two|few|many|other)$/;

/** Frases literais passadas a `t()` num trecho de código (comentários não contam). */
export function chavesDoCodigo(codigo, nome = "x.tsx") {
  const chaves = new Set();
  const visitar = (no) => {
    if (
      ts.isCallExpression(no) &&
      ts.isIdentifier(no.expression) &&
      no.expression.text === "t" &&
      no.arguments[0] &&
      ts.isStringLiteralLike(no.arguments[0])
    ) {
      chaves.add(no.arguments[0].text);
    }
    ts.forEachChild(no, visitar);
  };
  visitar(ts.createSourceFile(nome, codigo, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX));
  return chaves;
}

/** O que falta e o que sobra num dicionário, dadas as frases usadas. */
export function comparar(usadas, dicionario) {
  const tem = (k) =>
    Object.hasOwn(dicionario, k) ||
    Object.keys(dicionario).some((d) => PLURAL.test(d) && d.replace(PLURAL, "") === k);
  const faltando = [...usadas].filter((k) => !tem(k)).sort();
  const orfas = Object.keys(dicionario)
    .filter((d) => !usadas.has(d) && !usadas.has(d.replace(PLURAL, "")))
    .sort();
  return { faltando, orfas };
}

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (nome === "node_modules" || nome.startsWith(".")) return [];
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$|\.gen\.ts$/.test(nome) ? [caminho] : [];
  });
}

export function chavesDoProjeto(raiz = RAIZ) {
  const usadas = new Set();
  for (const pasta of PASTAS) {
    for (const f of arquivos(join(raiz, pasta))) {
      for (const k of chavesDoCodigo(readFileSync(f, "utf8"), f)) usadas.add(k);
    }
  }
  return usadas;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const usadas = chavesDoProjeto();
  let erro = false;
  for (const idioma of IDIOMAS) {
    const caminho = join(RAIZ, "packages/app-core/src/i18n", `${idioma}.json`);
    const { faltando, orfas } = comparar(usadas, JSON.parse(readFileSync(caminho, "utf8")));
    for (const k of faltando) console.error(`[${idioma}] sem tradução: ${JSON.stringify(k)}`);
    for (const k of orfas) console.error(`[${idioma}] não usada no código: ${JSON.stringify(k)}`);
    erro ||= faltando.length > 0 || orfas.length > 0;
  }
  if (erro) process.exit(1);
  console.log(`i18n: ${usadas.size} frases, todas traduzidas em ${IDIOMAS.join(" e ")}.`);
}
