import { describe, expect, it } from "vitest";
import { measureInvalid } from "./body";

describe("measureInvalid", () => {
  it("vazio não é erro; fora da faixa é; vírgula decimal vale", () => {
    expect(measureInvalid("arm_cm", "")).toBe(false);
    expect(measureInvalid("arm_cm", "180")).toBe(true);
    expect(measureInvalid("arm_cm", "35,5")).toBe(false);
    expect(measureInvalid("body_fat_pct", "abc")).toBe(true);
  });
});
