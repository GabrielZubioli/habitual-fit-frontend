/**
 * O app nativo importa os ícones direto dos arquivos do `lucide-react`
 * (`.../icons/<nome>.js` → `__iconNode`). Alguns nomes antigos são só apelidos
 * que reexportam outro ícone e não têm `__iconNode` — o import vira `undefined`
 * e a tela quebra só na hora de desenhar. O TypeScript não pega (o módulo é
 * declarado por curinga em `src/ui/lucide.d.ts`); este teste pega.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (nome === "node_modules" || nome.startsWith(".")) return [];
    return statSync(caminho).isDirectory()
      ? arquivos(caminho)
      : /\.tsx?$/.test(nome)
        ? [caminho]
        : [];
  });
}

test("todo ícone importado pelo app nativo exporta __iconNode", () => {
  const usados = new Set();
  for (const pasta of ["apps/mobile/app", "apps/mobile/src"]) {
    for (const f of arquivos(join(RAIZ, pasta))) {
      for (const m of readFileSync(f, "utf8").matchAll(
        /lucide-react\/dist\/esm\/icons\/([a-z0-9-]+)\.js/g,
      )) {
        usados.add(m[1]);
      }
    }
  }
  const sem = [...usados].filter(
    (nome) =>
      !readFileSync(
        join(RAIZ, "node_modules/lucide-react/dist/esm/icons", `${nome}.js`),
        "utf8",
      ).includes("__iconNode"),
  );
  assert.ok(usados.size > 0);
  assert.deepEqual(sem, [], `ícones que são só apelidos: ${sem.join(", ")}`);
});
