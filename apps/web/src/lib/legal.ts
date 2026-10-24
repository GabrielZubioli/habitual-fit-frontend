/**
 * Quem responde pelo Habitual Fit nos documentos legais (Política de
 * Privacidade e Termos de Uso). Um lugar só: mudar aqui muda as duas páginas.
 *
 * Razão social e CNPJ ficam `null` até serem informados — a página omite a
 * linha em vez de mostrar um valor inventado.
 */
export const EMPRESA = {
  nome: "Zubion",
  razaoSocial: "64.825.159 Gabriel da Silva Zubioli" as string | null,
  cnpj: "64.825.159/0001-28" as string | null,
  email: "suporte@zubion.com.br",
};

/** Data em que a versão atual dos dois documentos passou a valer. */
export const VIGENCIA = "24 de outubro de 2026";

/** "Zubion (Razão Social Ltda., CNPJ 00.000.000/0001-00)" — só com o que existir. */
export function identificacaoEmpresa(): string {
  const extras = [EMPRESA.razaoSocial, EMPRESA.cnpj && `CNPJ ${EMPRESA.cnpj}`].filter(Boolean);
  return extras.length ? `${EMPRESA.nome} (${extras.join(", ")})` : EMPRESA.nome;
}
