import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  server: { host: "::", port: 8080 },
  css: { transformer: "lightningcss" },
  resolve: {
    // Alias `@/*` lido do tsconfig, como no vitest.config.ts.
    tsconfigPaths: true,
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      // Entrada do servidor em src/server.ts (wrapper de erro do SSR).
      server: { entry: "server" },
      // Nada de `**/server/**` ou `server-only` no bundle do navegador.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Preset detectado pelo ambiente: na Vercel gera `.vercel/output`.
    command === "build" && nitro(),
    viteReact(),
  ],
}));
