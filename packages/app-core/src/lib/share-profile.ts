import { LOCALE } from "../i18n";
/**
 * O que pode sair do app quando a pessoa compartilha o perfil.
 *
 * O cartão é montado só a partir de `PerfilPublicavel` — um tipo que não tem
 * e-mail, id, data de nascimento, altura nem peso em kg — e cada campo só
 * entra se a opção correspondente estiver marcada. Não existe página pública
 * de perfil: o que se compartilha é a imagem gerada no próprio aparelho.
 */

export type PerfilPublicavel = {
  nome: string | null;
  /** URL já resolvida da foto de perfil. */
  fotoUrl: string | null;
  objetivo: string | null;
  treinos: number | null;
  sequencia: number | null;
  recordes: { exerciseName: string; weightKg: number; reps: number }[];
  /** Quanto do caminho até a meta de peso (0–100). Só a porcentagem, nunca o peso. */
  metaPercent: number | null;
};

export type OpcoesCartao = Record<
  "nome" | "foto" | "objetivo" | "treinos" | "sequencia" | "recordes" | "meta",
  boolean
>;

/** Dados corporais (recordes, meta de peso) começam desmarcados: entram só se a pessoa escolher. */
export const OPCOES_PADRAO: OpcoesCartao = {
  nome: true,
  foto: true,
  objetivo: true,
  treinos: true,
  sequencia: true,
  recordes: false,
  meta: false,
};

export const NOME_ANONIMO = "Atleta Habitual Fit";

export type ConteudoCartao = {
  nome: string;
  fotoUrl: string | null;
  objetivo: string | null;
  treinos: number | null;
  sequencia: number | null;
  recordes: PerfilPublicavel["recordes"];
  metaPercent: number | null;
};

export function conteudoCartao(p: PerfilPublicavel, o: OpcoesCartao): ConteudoCartao {
  return {
    nome: (o.nome && p.nome?.trim()) || NOME_ANONIMO,
    fotoUrl: o.foto ? p.fotoUrl : null,
    objetivo: o.objetivo ? p.objetivo : null,
    treinos: o.treinos ? p.treinos : null,
    sequencia: o.sequencia ? p.sequencia : null,
    // Copia só os três campos: o que vier a mais no objeto (id, data) fica de fora.
    recordes: o.recordes
      ? p.recordes
          .slice(0, 3)
          .map(({ exerciseName, weightKg, reps }) => ({ exerciseName, weightKg, reps }))
      : [],
    metaPercent: o.meta ? p.metaPercent : null,
  };
}

const n = (v: number) => v.toLocaleString(LOCALE, { maximumFractionDigits: 1 });

/** Os números do cartão, lado a lado: treinos, sequência e meta (só os presentes). */
export function numerosCartao(c: ConteudoCartao): { valor: string; rotulo: string }[] {
  return [
    c.treinos !== null && { valor: n(c.treinos), rotulo: c.treinos === 1 ? "treino" : "treinos" },
    c.sequencia !== null && {
      valor: n(c.sequencia),
      rotulo: c.sequencia === 1 ? "dia seguido" : "dias seguidos",
    },
    c.metaPercent !== null && { valor: `${Math.round(c.metaPercent)}%`, rotulo: "da meta de peso" },
  ].filter((v): v is { valor: string; rotulo: string } => Boolean(v));
}

/** O cartão em texto — o que o app nativo envia pelo compartilhamento do sistema. */
export function textoCartao(c: ConteudoCartao): string {
  const linhas = [`${c.nome} no Habitual Fit`];
  if (c.objetivo) linhas.push(c.objetivo);
  const numeros = numerosCartao(c);
  if (numeros.length) linhas.push(numeros.map((x) => `${x.valor} ${x.rotulo}`).join(" · "));
  if (c.recordes.length) {
    linhas.push("", "Recordes:");
    for (const r of c.recordes) linhas.push(`${r.exerciseName}: ${n(r.weightKg)} kg × ${r.reps}`);
  }
  linhas.push("", "Treinando com o Habitual Fit");
  return linhas.join("\n");
}
