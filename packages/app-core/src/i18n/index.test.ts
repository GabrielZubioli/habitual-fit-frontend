import { describe, expect, it } from "vitest";
import { language, LOCALE, normalizeLanguage, resolveLanguage, t, tRich } from "./index";

describe("normalizeLanguage", () => {
  it("pt-* vira pt-BR, es-* vira es e o resto vira en", () => {
    expect(normalizeLanguage("pt-BR")).toBe("pt-BR");
    expect(normalizeLanguage("pt_PT")).toBe("pt-BR");
    expect(normalizeLanguage("es-419")).toBe("es");
    expect(normalizeLanguage("ES")).toBe("es");
    expect(normalizeLanguage("en-GB")).toBe("en");
    expect(normalizeLanguage("fr-FR")).toBe("en");
    expect(normalizeLanguage(undefined)).toBe("en");
  });
});

describe("t (ambiente de teste roda em pt-BR)", () => {
  it("devolve o próprio texto e interpola", () => {
    expect(language).toBe("pt-BR");
    expect(LOCALE).toBe("pt-BR");
    expect(t("Sua semana")).toBe("Sua semana");
    expect(t("{{n}} treinos", { n: 3 })).toBe("3 treinos");
    // Ponto e dois-pontos fazem parte do texto, não separam chaves.
    expect(t("Atenção: salvo.")).toBe("Atenção: salvo.");
  });
});

describe("tRich", () => {
  it("separa os trechos marcados e aplica cada parte", () => {
    const saida = tRich("Aceita os <0>Termos</0> e a <1>Política</1>.", [
      (s) => `[${s}]`,
      (s) => `{${s}}`,
    ]);
    const plano = saida.map((n) =>
      typeof n === "string" ? n : (n as { props: { children: string } }).props.children,
    );
    expect(plano).toEqual(["Aceita os ", "[Termos]", " e a ", "{Política}", "."]);
  });
});

describe("resolveLanguage", () => {
  it("usa a escolha salva antes de tudo", () => {
    expect(resolveLanguage({ pref: "es", pais: "BR", tag: "pt-BR" })).toBe("es");
  });
  it("ignora escolha inválida", () => {
    expect(resolveLanguage({ pref: "fr", pais: "BR" })).toBe("pt-BR");
  });
  it("decide pelo país", () => {
    expect(resolveLanguage({ pais: "AO", tag: "en-US" })).toBe("pt-BR");
    expect(resolveLanguage({ pais: "PT" })).toBe("pt-BR");
    expect(resolveLanguage({ pais: "mx", tag: "en" })).toBe("es");
    expect(resolveLanguage({ pais: "DE", tag: "pt-BR" })).toBe("en");
  });
  it("sem país, usa a região da tag e depois o idioma", () => {
    expect(resolveLanguage({ tag: "en-BR" })).toBe("pt-BR");
    expect(resolveLanguage({ tag: "es-419" })).toBe("es");
    expect(resolveLanguage({ tag: "pt" })).toBe("pt-BR");
    expect(resolveLanguage({ tag: "fr-FR" })).toBe("en");
    expect(resolveLanguage({})).toBe("en");
  });
});
