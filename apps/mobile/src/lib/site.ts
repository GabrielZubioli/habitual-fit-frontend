/**
 * Endereço do site: as fotos das receitas (`/receitas/...`) moram em
 * `apps/web/public` e o app as carrega de lá, em vez de levá-las no pacote.
 */
const SITE = (process.env.EXPO_PUBLIC_SITE_URL ?? "https://habitualfit.vercel.app").replace(
  /\/$/,
  "",
);

/** URL absoluta: caminhos do site ganham o domínio; URLs completas passam direto. */
export function urlDoSite(caminho: string): string {
  return /^https?:\/\//i.test(caminho)
    ? caminho
    : `${SITE}${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}
