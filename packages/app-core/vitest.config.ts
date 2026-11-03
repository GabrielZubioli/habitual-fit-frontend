import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Os testes de data são escritos no fuso do público (BRT); o CI roda em UTC.
    env: { TZ: "America/Sao_Paulo" },
    include: ["src/**/*.test.ts"],
  },
});
