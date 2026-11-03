// `npm run test:scripts` — confere a conversão contra os hex anotados no styles.css.
import { test } from "node:test";
import assert from "node:assert/strict";
import { oklchParaRgb } from "./build-mobile-tokens.mjs";

const hex = (c) =>
  "#" +
  c
    .slice(0, 3)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");

test("oklch → hex igual ao anotado no styles.css", () => {
  assert.equal(hex(oklchParaRgb("oklch(0.502 0.107 162)")), "#0b7651");
  assert.equal(hex(oklchParaRgb("oklch(0.636 0.136 162)")), "#12a471");
  assert.equal(hex(oklchParaRgb("oklch(0.955 0.033 162)")), "#def8e9");
  assert.equal(hex(oklchParaRgb("oklch(0.56 0.21 27)")), "#d42325");
  assert.equal(hex(oklchParaRgb("oklch(1 0 0)")), "#ffffff");
  assert.deepEqual(oklchParaRgb("oklch(1 0 0 / 0.75)")[3], 0.75);
});
