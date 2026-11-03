/**
 * Palavras de uma busca, cada uma exigida no nome em qualquer ordem: "carne
 * bovina" acha "Carne, bovina, …". Tira o que quebraria o filtro do PostgREST.
 */
/**
 * `WHERE` de uma busca no banco local (SQLite): cada palavra no nome. O `LIKE`
 * do SQLite só ignora caixa em letras ASCII — "água" não acharia "Água" —, então
 * cada palavra também é tentada com a inicial maiúscula.
 * ponytail: acento em maiúscula no meio do nome ("SUCO DE AÇAÍ") escapa; um
 * nome normalizado gravado no catálogo resolve, se aparecer.
 */
export function localSearch(term: string, column = "name"): { where: string; params: string[] } {
  const words = searchWords(term);
  return {
    where: words.map(() => `(${column} LIKE ? OR ${column} LIKE ?)`).join(" AND ") || "1",
    params: words.flatMap((w) => [`%${w}%`, `%${w.charAt(0).toUpperCase()}${w.slice(1)}%`]),
  };
}

export function searchWords(term: string): string[] {
  return term
    .toLowerCase()
    .split(/[\s,]+/)
    .map((w) => w.replace(/[%_().*\\"]/g, ""))
    .filter(Boolean)
    .slice(0, 6);
}
