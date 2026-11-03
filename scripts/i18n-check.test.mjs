// `npm run test:scripts` — a extração das frases e a comparação do i18n-check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chavesDoCodigo, comparar } from "./i18n-check.mjs";

test("pega as frases literais de t(), e só elas", () => {
  const codigo = `
    t("Sua semana");
    t('Olá, {{nome}}', { nome });
    t(\`Sem "aspas" quebradas\`);
    t("Linha com \\"aspas\\"");
    t(\`com \${variavel}\`);
    split("não é t");
    obj.t("método de outro objeto");
    const x = t(variavel);
    // t("em comentário não conta")
  `;
  assert.deepEqual(
    [...chavesDoCodigo(codigo)].sort(),
    ['Linha com "aspas"', "Olá, {{nome}}", 'Sem "aspas" quebradas', "Sua semana"].sort(),
  );
});

test("falta, sobra e plural", () => {
  const usadas = new Set(["Salvar", "{{count}} treinos", "Novo"]);
  const dicionario = {
    Salvar: "Save",
    "{{count}} treinos_one": "{{count}} workout",
    "{{count}} treinos_other": "{{count}} workouts",
    Antigo: "Old",
  };
  assert.deepEqual(comparar(usadas, dicionario), { faltando: ["Novo"], orfas: ["Antigo"] });
});
