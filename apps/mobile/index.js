// Entrada do app. Lê o idioma escolhido no seletor (SecureStore, síncrono)
// antes de carregar qualquer tela: o i18n do app-core decide o idioma uma vez,
// na importação, e procura a escolha em `globalThis.__forjaIdioma`.
// `require` e não `import`: imports sobem para o topo e rodariam antes.
const SecureStore = require("expo-secure-store");

try {
  globalThis.__forjaIdioma = SecureStore.getItem("forja.idioma");
} catch {
  globalThis.__forjaIdioma = null;
}

require("expo-router/entry");
