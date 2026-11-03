// `npm run test:scripts` — as heurísticas do codemod de tradução.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pareceTexto, textoJsx } from "./i18n-extract.mjs";

test("separa texto de interface de classes, rotas e chaves", () => {
  for (const s of [
    "Salvar",
    "Sua semana",
    "Informe um e-mail válido",
    "Já tem conta?",
    "2 min",
    "E-mail",
  ]) {
    assert.equal(pareceTexto(s), true, s);
  }
  for (const s of [
    "flex items-center gap-2",
    "text-sm font-bold",
    "/dashboard",
    "lose_weight",
    "salvar",
    "https://exemplo.com",
    "·",
    "",
  ]) {
    assert.equal(pareceTexto(s), false, s);
  }
});

test("junta as linhas de um texto JSX como o React", () => {
  assert.equal(textoJsx("\n    Olá,\n    mundo\n  "), "Olá, mundo");
  assert.equal(textoJsx("Já tem conta? "), "Já tem conta? ");
});
