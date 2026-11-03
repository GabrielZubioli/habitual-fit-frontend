/**
 * Roda só no build do EAS (hook `eas-build-pre-install`), antes do `npm ci`.
 *
 * O `@gabrielzubioli/db` vem do GitHub Packages, que exige token até para
 * leitura. O `.npmrc` do repositório não guarda token (ver o comentário nele);
 * aqui ele entra no `~/.npmrc` da máquina de build, vindo do segredo
 * `GITHUB_PACKAGES_TOKEN` do EAS (um PAT com `read:packages`).
 */
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const token = process.env.GITHUB_PACKAGES_TOKEN;
if (!token) {
  console.error(
    "GITHUB_PACKAGES_TOKEN ausente: crie o segredo no EAS (apps/mobile/README.md, 'Publicar na Play Store').",
  );
  process.exit(1);
}
appendFileSync(join(homedir(), ".npmrc"), `\n//npm.pkg.github.com/:_authToken=${token}\n`);
console.log("Token do GitHub Packages configurado para o npm.");
