// Metro configurado para monorepo (npm workspaces) + NativeWind.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Observa a raiz do monorepo para resolver @forja/domain e @forja/db (TS linkado).
// O `@gabrielzubioli/db` pode estar ligado por `npm link` ao forja-backend,
// fora do monorepo: o Metro só resolve o que observa, então entra o caminho
// real do pacote (publicado, ele já está dentro do node_modules).
const fs = require("fs");
const dbReal = fs.realpathSync(path.resolve(workspaceRoot, "node_modules/@gabrielzubioli/db"));
config.watchFolders = [workspaceRoot, ...(dbReal.startsWith(workspaceRoot) ? [] : [dbReal])];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = false;

// Uma cópia só do `@powersync/common`. Com o `@gabrielzubioli/db` ligado ao
// forja-backend, a cópia de lá seria a encontrada; duas cópias quebram o
// `instanceof` entre o schema e o banco. A do backend fica bloqueada e todo
// import de `@powersync/common` vai para o arquivo da cópia do frontend.
if (!dbReal.startsWith(workspaceRoot)) {
  const backendModules = path.resolve(dbReal, "../../node_modules");
  const escapar = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  config.resolver.blockList = [
    new RegExp(`^${escapar(path.join(backendModules, "@powersync"))}[\\\\/].*`),
  ];
  const powersyncCommon = path.resolve(
    workspaceRoot,
    "node_modules/@powersync/common/lib/index.js",
  );
  config.resolver.resolveRequest = (context, moduleName, platform) =>
    moduleName === "@powersync/common"
      ? { type: "sourceFile", filePath: powersyncCommon }
      : context.resolveRequest(context, moduleName, platform);
}

// `inlineRem: 16`: no celular o NativeWind usa 1rem = 14px; o web usa 16. Sem
// isto, todo texto e espaçamento sairia ~12% menor que no web.
module.exports = withNativeWind(config, { input: "./global.css", inlineRem: 16 });
