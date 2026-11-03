/**
 * "Estou trocando a senha pelo link do e-mail." Enquanto vale, a tela de login
 * (que pode estar aberta por baixo) não redireciona para a Início ao ver a
 * sessão de recuperação — senão a pessoa sairia da tela de nova senha antes de
 * trocá-la.
 */
let ativa = false;

export function recuperandoSenha(valor?: boolean): boolean {
  if (valor !== undefined) ativa = valor;
  return ativa;
}

/** Tokens (ou erro) do link: no fragmento, e por garantia na query. */
export function lerLinkDeRecuperacao(url: string) {
  const [, depoisDoHash = ""] = url.split("#");
  const query = url.split("?")[1]?.split("#")[0] ?? "";
  const p = new URLSearchParams(`${query}&${depoisDoHash}`);
  return {
    erro: p.has("error") || p.has("error_code"),
    access: p.get("access_token"),
    refresh: p.get("refresh_token"),
  };
}
