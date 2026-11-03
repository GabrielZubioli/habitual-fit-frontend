/**
 * Codemod da tradução: envolve os textos de interface com `t()`.
 *
 *   node scripts/i18n-extract.mjs --dry   <arquivos ou pastas>   (só relata)
 *   node scripts/i18n-extract.mjs --write <arquivos ou pastas>   (grava)
 *
 * Usa o verificador de tipos do TypeScript, não regex:
 * - só troca uma string onde o tipo esperado aceita `string` — um valor de
 *   enum (`"lose" | "gain"`) nunca vira `t("lose")`;
 * - só junta `{expr}` numa frase quando `expr` é texto ou número (um ícone ou
 *   um `children` viraria "[object Object]");
 * - renomeia variáveis locais chamadas `t`, que esconderiam a tradução.
 *
 * Grava as frases novas em `scripts/.i18n-pending.json` (para traduzir) e
 * imprime o que pareceu texto mas ficou de fora, para revisão à mão.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PROJETOS = [
  { pasta: "apps/web", tsconfig: "apps/web/tsconfig.json" },
  { pasta: "apps/mobile", tsconfig: "apps/mobile/tsconfig.json" },
  { pasta: "packages/app-core", tsconfig: "packages/app-core/tsconfig.json" },
];
const PENDENTES = join(RAIZ, "scripts/.i18n-pending.json");
const EN = join(RAIZ, "packages/app-core/src/i18n/en.json");

/** Atributos JSX e chaves de objeto cujo valor é texto para a pessoa ler. */
const CAMPOS_DE_TEXTO = new Set([
  "placeholder",
  "title",
  "aria-label",
  "alt",
  "label",
  "description",
  "accessibilityLabel",
  "accessibilityHint",
  "subtitle",
  "hint",
  "confirmLabel",
  "cancelLabel",
  "emptyText",
  "message",
  "tooltip",
  "content",
  "titulo",
  "descricao",
  "rotulo",
  "texto",
  "subtitulo",
  "dica",
  "mensagem",
  "aviso",
  "detalhe",
  "legenda",
  "nome",
  "todos",
  "cta",
  "erro",
  "pergunta",
  "resposta",
  "unidade",
  "botao",
  "acao",
  "vazio",
  "text",
  "unit",
  "heading",
  "body",
  "measure",
  "grupo",
  "dialogTitle",
  "sub",
  "nota",
  "valor",
]);

/** Atributos JSX que nunca são texto, mesmo quando a string parece frase. */
const ATRIBUTOS_TECNICOS = new Set([
  "className",
  "class",
  "contentContainerClassName",
  "textClassName",
  "style",
  "href",
  "to",
  "src",
  "key",
  "id",
  "testID",
  "type",
  "variant",
  "name",
  "size",
  "mode",
  "autoComplete",
  "inputMode",
  "keyboardType",
  "textContentType",
  "role",
  "accessibilityRole",
  "rel",
  "target",
  "lang",
  "dir",
  "htmlFor",
  "d",
  "viewBox",
  "fill",
  "stroke",
  "transform",
  "fontFamily",
  "textBreakStrategy",
  "resizeMode",
  "pointerEvents",
  "animationType",
  "returnKeyType",
  "autoCapitalize",
  "value",
  "defaultValue",
  "method",
  "action",
  "sizes",
  "media",
  "as",
  "side",
  "align",
]);

/** Funções cujos argumentos são técnicos (classes, consultas, chaves, logs). */
const CHAMADAS_TECNICAS = new Set([
  "cn",
  "clsx",
  "twMerge",
  "cva",
  "require",
  "from",
  "select",
  "eq",
  "neq",
  "in",
  "is",
  "order",
  "match",
  "ilike",
  "like",
  "or",
  "not",
  "contains",
  "rpc",
  "channel",
  "on",
  "upsert",
  "insert",
  "update",
  "delete",
  "createFileRoute",
  "enum",
  "literal",
  "getItem",
  "setItem",
  "removeItem",
  "getItemAsync",
  "setItemAsync",
  "deleteItemAsync",
  "addEventListener",
  "removeEventListener",
  "querySelector",
  "querySelectorAll",
  "closest",
  "matches",
  "getElementById",
  "setAttribute",
  "getAttribute",
  "fetch",
  "useColor",
  "invalidateQueries",
  "matchMedia",
  "setStatusBarStyle",
  "navigate",
  "push",
  "replace",
  "router",
  "redirect",
  "setParams",
  "t",
  "parseISO",
  "storage",
  "remove",
  "download",
  "upload",
  "createSignedUrl",
  "getPublicUrl",
  "emit",
  "addListener",
  "error",
  "warn",
  "log",
  "info",
  "debug",
]);

const PROPRIEDADES_TECNICAS = new Set([
  "value",
  "id",
  "key",
  "type",
  "kind",
  "slug",
  "icon",
  "color",
  "variant",
  "category",
  "table",
  "column",
  "queryKey",
  "className",
  "href",
  "to",
  "path",
  "src",
  "mode",
  "status",
  "role",
  "name",
  "pathname",
  "unit",
  "format",
  "pattern",
  "locale",
  "lang",
  "method",
  "event",
  "code",
  "letter",
]);

/** Parâmetros que recebem o nome da operação para o log, não para a tela. */
const ROTULO_DE_LOG = /^(operation|operacao|acao|contexto|context|sql|query)$/i;

/** Parece texto de interface: tem letra, começa como frase e não é classe/rota/chave. */
export function pareceTexto(s) {
  const v = s.trim();
  if (!/\p{L}/u.test(v) || /^[a-z]+:\/\//i.test(v)) return false;
  if (/^(no)?(index|follow)(,\s*(no)?(index|follow))*$/.test(v)) return false; // meta robots
  if (
    /^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP|PRAGMA|ORDER BY|GROUP BY|WHERE|LIMIT|FROM|AND|OR)\s/i.test(
      v,
    )
  )
    return false; // SQL
  if (/^[MmLlHhVvCcSsQqTtAaZz][\d\s.,MmLlHhVvCcSsQqTtAaZz-]*$/.test(v)) return false; // path SVG
  if (/[;{}=]|rgba?\(|\dpx\b/.test(v)) return false; // CSS, script, cookie, fonte do canvas
  if (/^[a-z_]+(,\s*[a-z_]+)+$/.test(v)) return false; // colunas do SELECT
  if (/\b(IS NULL|IS NOT NULL|IN \(|= \?)/.test(v)) return false; // condição SQL
  if (!/^[\p{L}¿¡"“(«…0-9+]/u.test(v)) return false;
  if (/^[\w.-]+\/[\w./-]*$/.test(v) || /^\/[\w/$.-]*$/.test(v)) return false; // rotas, caminhos
  const palavras = v.split(/\s+/);
  // Classes do Tailwind: todas as "palavras" técnicas e pelo menos uma com hífen.
  if (
    palavras.every((p) => /^[!a-z0-9:\-[\]./%#()_,&>*=@]+$/.test(p)) &&
    palavras.some((p) => p.includes("-"))
  ) {
    return false;
  }
  if (/^[a-z][a-z0-9]*([_.:-][a-z0-9]+)+$/.test(v)) return false; // chaves e enums: lose_weight, a.b
  if (/\s/.test(v) || /[^\x00-\x7F]/.test(v)) return true;
  return /^\p{Lu}-?\p{Ll}/u.test(v); // uma palavra só, com inicial maiúscula: "Salvar", "E-mail"
}

/** Junta as linhas de um texto JSX como o React faz. */
export function textoJsx(raw) {
  const linhas = raw.split(/\r?\n/);
  if (linhas.length === 1) return raw;
  return linhas
    .map((l, i) => {
      let x = l;
      if (i > 0) x = x.replace(/^\s+/, "");
      if (i < linhas.length - 1) x = x.replace(/\s+$/, "");
      return x;
    })
    .filter((l) => l.length > 0)
    .join(" ");
}

const ENTIDADES = {
  "&nbsp;": " ",
  "&quot;": '"',
  "&amp;": "&",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
};
const decodificar = (s) => s.replace(/&(nbsp|quot|amp|apos|lt|gt|#39);/g, (m) => ENTIDADES[m]);

function projetoDe(arquivo) {
  const rel = relative(RAIZ, arquivo).split(sep).join("/");
  return PROJETOS.find((p) => rel.startsWith(p.pasta + "/"));
}

/** Dados, não interface: nomes do banco usados como chave e geometria gerada. */
const ARQUIVOS_DE_DADOS = /(name-index|muscle-paths)\.ts$/;

function listar(alvo) {
  const abs = resolve(RAIZ, alvo);
  if (ARQUIVOS_DE_DADOS.test(abs)) return [];
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap((n) => {
    if (n === "node_modules" || n.startsWith(".")) return [];
    const p = join(abs, n);
    if (statSync(p).isDirectory()) return listar(p);
    return /\.tsx?$/.test(n) &&
      !/\.test\.tsx?$|\.gen\.ts$|\.d\.ts$/.test(n) &&
      !ARQUIVOS_DE_DADOS.test(n) &&
      !p.includes(`${sep}i18n${sep}`)
      ? [p]
      : [];
  });
}

function programa(tsconfig) {
  const caminho = join(RAIZ, tsconfig);
  const cfg = ts.readConfigFile(caminho, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, dirname(caminho));
  return ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true });
}

/** Processa um arquivo; devolve o texto novo, as frases e as dúvidas. */
export function processar(sf, checker, { importacao }) {
  const texto = sf.getFullText();
  const edicoes = [];
  const frases = new Set();
  const duvidas = [];
  const linha = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  // Variáveis locais chamadas `t` escondem a tradução: renomeia antes de tudo,
  // e o texto das expressões copiadas para dentro de t() já sai renomeado.
  const renomes = renomearTLocal(sf, checker, texto);
  const txt = (e) => {
    const ini = e.getStart(sf);
    let out = texto.slice(ini, e.getEnd());
    for (const [a, b, sub] of [...renomes].sort((x, y) => y[0] - x[0])) {
      if (a >= ini && b <= e.getEnd()) out = out.slice(0, a - ini) + sub + out.slice(b - ini);
    }
    return out;
  };
  const duvida = (n, motivo) =>
    duvidas.push(`${linha(n)}: ${motivo}: ${JSON.stringify(n.getText(sf).slice(0, 90))}`);

  const aceitaString = (n) => {
    const tipo = checker.getContextualType(n);
    if (!tipo) return true;
    const partes = tipo.isUnion() ? tipo.types : [tipo];
    return partes.some(
      (p) =>
        p.flags & (ts.TypeFlags.String | ts.TypeFlags.Any | ts.TypeFlags.Unknown) ||
        p.flags & ts.TypeFlags.TypeParameter ||
        checker.isTypeAssignableTo(checker.getStringType(), p),
    );
  };
  const ehTextoOuNumero = (expr) => {
    const tipo = checker.getTypeAtLocation(expr);
    const partes = tipo.isUnion() ? tipo.types : [tipo];
    return partes.every((p) => p.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike));
  };

  /** Nomes de interpolação legíveis: `nome`, `total`, `v1`… */
  const nomear = (exprs) => {
    const usados = new Map();
    return exprs.map((e, i) => {
      let base = ts.isIdentifier(e)
        ? txt(e)
        : ts.isPropertyAccessExpression(e)
          ? e.name.text
          : `v${i}`;
      if (base === "t") base = `v${i}`;
      const texto = txt(e);
      for (let k = 0; ; k++) {
        const nome = k === 0 ? base : `${base}${k + 1}`;
        if (!usados.has(nome) || usados.get(nome) === texto) {
          usados.set(nome, texto);
          return nome;
        }
      }
    });
  };
  const chamada = (frase, exprs) => {
    frases.add(frase);
    if (!exprs.length) return `t(${JSON.stringify(frase)})`;
    const nomes = nomear(exprs);
    const vistos = new Set();
    const campos = exprs
      .map((e, i) => {
        if (vistos.has(nomes[i])) return null;
        vistos.add(nomes[i]);
        const codigo = txt(e);
        return codigo === nomes[i] ? nomes[i] : `${nomes[i]}: ${codigo}`;
      })
      .filter(Boolean);
    return `t(${JSON.stringify(frase)}, { ${campos.join(", ")} })`;
  };
  /** `\`${n} treinos\`` → frase "{{n}} treinos" e as expressões. */
  const doTemplate = (n) => {
    if (ts.isNoSubstitutionTemplateLiteral(n)) return { frase: n.text, exprs: [] };
    const exprs = n.templateSpans.map((s) => s.expression);
    const nomes = nomear(exprs);
    let frase = n.head.text;
    n.templateSpans.forEach((s, i) => (frase += `{{${nomes[i]}}}${s.literal.text}`));
    return { frase, exprs };
  };

  const tecnico = (n) => {
    const p = n.parent;
    if (!p) return true;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p))
      return true;
    if (ts.isLiteralTypeNode(p) || ts.isTypeNode(p)) return true;
    if (
      ts.isBinaryExpression(p) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
        ts.SyntaxKind.InKeyword,
      ].includes(p.operatorToken.kind)
    )
      return true;
    if (ts.isCaseClause(p) || ts.isElementAccessExpression(p)) return true;
    if (ts.isPropertyAssignment(p) && p.name === n) return true;
    if (
      ts.isPropertyAssignment(p) &&
      !ts.isComputedPropertyName(p.name) &&
      PROPRIEDADES_TECNICAS.has(p.name.getText(sf).replace(/["']/g, ""))
    )
      return true;
    if (ts.isEnumMember(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p)) return true;
    if (ts.isParameter(p) && ts.isIdentifier(p.name) && ROTULO_DE_LOG.test(p.name.text))
      return true;
    if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
      // Rótulo de operação (`unwrap("salvar perfil", …)`) só vai para o log.
      const assinatura = checker.getResolvedSignature(p);
      const i = (p.arguments ?? []).indexOf(n);
      const param = assinatura?.parameters[Math.min(i, (assinatura?.parameters.length ?? 1) - 1)];
      if (param && ROTULO_DE_LOG.test(param.name)) return true;
      const alvo = p.expression;
      const nome = ts.isIdentifier(alvo)
        ? alvo.text
        : ts.isPropertyAccessExpression(alvo)
          ? alvo.name.text
          : "";
      if (CHAMADAS_TECNICAS.has(nome)) return true;
      if (
        ts.isPropertyAccessExpression(alvo) &&
        ["console", "z", "Intl", "Object", "JSON", "Number", "Math"].includes(
          alvo.expression.getText(sf),
        )
      )
        return true;
      if (ts.isNewExpression(p) && ["Error", "TypeError", "RangeError"].includes(nome))
        return "erro";
      if (ts.isNewExpression(p) && ["URL", "RegExp", "Date", "Intl.NumberFormat"].includes(nome))
        return true;
    }
    if (ts.isTaggedTemplateExpression(p)) return true;
    // "use client", `X.displayName = "Card"` e `this.name = "DataError"`.
    if (ts.isExpressionStatement(p)) return true;
    if (
      ts.isBinaryExpression(p) &&
      ts.isPropertyAccessExpression(p.left) &&
      ["displayName", "displayname", "name"].includes(p.left.name.text)
    ) {
      return true;
    }
    return false;
  };

  const visitar = (n) => {
    // Texto direto no JSX (com as expressões simples ao lado, numa frase só).
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      if (ts.isJsxElement(n)) visitar(n.openingElement);
      tratarFilhos(n.children);
      return;
    }
    if (ts.isJsxAttribute(n)) {
      const nome = n.name.getText(sf);
      const ini = n.initializer;
      if (ini && ts.isStringLiteral(ini) && pareceTexto(ini.text)) {
        if (CAMPOS_DE_TEXTO.has(nome)) {
          edicoes.push([ini.getStart(sf), ini.getEnd(), `{${chamada(ini.text, [])}}`]);
        } else if (!ATRIBUTOS_TECNICOS.has(nome)) {
          duvida(n, `atributo "${nome}" com cara de texto`);
        }
        return;
      }
      if (ATRIBUTOS_TECNICOS.has(nome)) return;
    }
    if (
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateExpression(n)
    ) {
      tratarString(n);
      return;
    }
    ts.forEachChild(n, visitar);
  };

  const tratarString = (n) => {
    if (ts.isJsxAttribute(n.parent)) return; // já tratado acima
    const { frase, exprs } = ts.isStringLiteral(n) ? { frase: n.text, exprs: [] } : doTemplate(n);
    // As variáveis contam como número: "{{a}} {{b}}" não é frase, "{{n}} treinos" é.
    if (!pareceTexto(frase.replace(/\{\{\w+\}\}/g, "0"))) {
      exprs.forEach(visitar);
      return;
    }
    const motivo = tecnico(n);
    // Mensagem de erro em frase (maiúscula) chega à tela pelo errorMessage().
    if (motivo === "erro" && !/^\p{Lu}/u.test(frase)) return duvida(n, "mensagem de Error");
    if (motivo) return;
    // Dentro de uma propriedade: só os campos de texto conhecidos.
    const prop = n.parent;
    // Mapa de rótulos (`const BMI_LABELS = { under: "Abaixo do peso" }`): todo valor é texto.
    const declaracao = prop.parent?.parent;
    const mapaDeRotulos =
      declaracao &&
      ts.isVariableDeclaration(declaracao) &&
      /(LABELS|TITLES|HINTS|TEXTS)$/.test(declaracao.name.getText(sf));
    if (
      ts.isPropertyAssignment(prop) &&
      !mapaDeRotulos &&
      !ts.isNumericLiteral(prop.name) && // { 3: "Empurrar / Puxar / Pernas" }
      !CAMPOS_DE_TEXTO.has(prop.name.getText(sf).replace(/["']/g, ""))
    ) {
      return duvida(n, `propriedade "${prop.name.getText(sf)}" com cara de texto`);
    }
    if (!aceitaString(n)) return;
    // Na camada de dados, listas de strings costumam ser palavras-chave
    // comparadas com o nome vindo do banco — traduzir quebraria a busca.
    if (
      ts.isArrayLiteralExpression(n.parent) &&
      sf.fileName.replace(/\\/g, "/").includes("/app-core/src/data/")
    ) {
      return duvida(n, "string em lista da camada de dados");
    }
    edicoes.push([n.getStart(sf), n.getEnd(), chamada(frase, exprs)]);
  };

  const tratarFilhos = (filhos) => {
    // Frase partida por <b>, <Link>, <Text>… não se traduz em pedaços: fica
    // para a mão (tRich), e só os filhos de dentro seguem pelo codemod.
    const internos = filhos.filter((c) => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c));
    const temTexto = filhos.some((c) => ts.isJsxText(c) && /\p{L}/u.test(c.text));
    const inline = internos.some((e) =>
      /^(b|strong|em|i|a|Link|Text|span|code|u)$/.test(
        (ts.isJsxElement(e) ? e.openingElement : e).tagName.getText(sf),
      ),
    );
    const jsxEmExpressao = filhos.some(
      (c) => ts.isJsxExpression(c) && c.expression && hasJsx(c.expression),
    );
    if (temTexto && (inline || jsxEmExpressao)) {
      duvida(filhos[0].parent, "frase partida por elemento interno: converter à mão com tRich");
      for (const c of filhos) if (!ts.isJsxText(c)) visitar(c);
      return;
    }
    // Sequências de texto + {expr simples} viram uma frase.
    let grupo = [];
    const fechar = () => {
      const comLetra = grupo.some((c) => ts.isJsxText(c) && /\p{L}/u.test(c.text));
      if (comLetra) emitirGrupo(grupo);
      else grupo.forEach((c) => ts.isJsxExpression(c) && c.expression && visitar(c.expression));
      grupo = [];
    };
    const simples = (c) =>
      ts.isJsxExpression(c) &&
      c.expression &&
      ((ts.isStringLiteral(c.expression) && !/\p{L}/u.test(c.expression.text)) ||
        ((ts.isIdentifier(c.expression) ||
          ts.isPropertyAccessExpression(c.expression) ||
          ts.isCallExpression(c.expression) ||
          ts.isElementAccessExpression(c.expression) ||
          ts.isBinaryExpression(c.expression)) &&
          !hasJsx(c.expression) &&
          ehTextoOuNumero(c.expression)));
    for (const c of filhos) {
      if (ts.isJsxText(c) || simples(c)) grupo.push(c);
      else {
        fechar();
        visitar(c);
      }
    }
    fechar();
  };

  const hasJsx = (n) => {
    let achou = false;
    const v = (x) => {
      if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) achou = true;
      else ts.forEachChild(x, v);
    };
    v(n);
    return achou;
  };

  const emitirGrupo = (grupo) => {
    // Remove as pontas que são só espaço sem quebra de linha (viram {" "}).
    let frase = "";
    const exprs = [];
    const partes = grupo.map((c) => {
      if (ts.isJsxText(c)) return { tipo: "texto", valor: decodificar(c.text) };
      if (ts.isStringLiteral(c.expression)) return { tipo: "texto", valor: c.expression.text };
      return { tipo: "expr", valor: c.expression };
    });
    for (const p of partes) {
      if (p.tipo === "texto") frase += p.valor;
      else {
        exprs.push(p.valor);
        frase += `\u0000${exprs.length - 1}\u0000`;
      }
    }
    const juntado = textoJsx(frase);
    const antes = /^[ \t]+\S/.test(juntado) ? '{" "}' : "";
    const depois = /\S[ \t]+$/.test(juntado) ? '{" "}' : "";
    const nomes = nomear(exprs);
    const chave = juntado.trim().replace(/\u0000(\d+)\u0000/g, (_, i) => `{{${nomes[Number(i)]}}}`);
    const ini = grupo[0].pos;
    const fim = grupo[grupo.length - 1].getEnd();
    // Preserva a quebra de linha/indentação em volta (o prettier arruma depois).
    const bruto = texto.slice(ini, fim);
    const lead = bruto.match(/^\s*/)[0].includes("\n") ? bruto.match(/^\s*/)[0] : "";
    const trail = bruto.match(/\s*$/)[0].includes("\n") ? bruto.match(/\s*$/)[0] : "";
    edicoes.push([ini, fim, `${lead}${antes}{${chamada(chave, exprs)}}${depois}${trail}`]);
  };

  visitar(sf);
  if (!edicoes.length) return { novo: null, frases, duvidas };

  // Uma edição dentro de outra já foi aplicada no texto da externa.
  const todas = [...edicoes, ...renomes];
  const finais = todas.filter(
    (e) =>
      !todas.some((o) => o !== e && o[0] <= e[0] && o[1] >= e[1] && (o[0] < e[0] || o[1] > e[1])),
  );
  finais.sort((a, b) => b[0] - a[0]);
  let novo = texto;
  for (const [ini, fim, sub] of finais) novo = novo.slice(0, ini) + sub + novo.slice(fim);
  if (!/import \{[^}]*\bt\b[^}]*\} from "[^"]*i18n"/.test(novo))
    novo = inserirImport(novo, importacao);
  return { novo, frases, duvidas };
}

function renomearTLocal(sf, checker, texto) {
  const edicoes = [];
  const declaracoes = new Set();
  const v = (n) => {
    if (
      (ts.isParameter(n) ||
        ts.isVariableDeclaration(n) ||
        ts.isBindingElement(n) ||
        ts.isFunctionDeclaration(n)) &&
      n.name &&
      ts.isIdentifier(n.name) &&
      n.name.text === "t"
    ) {
      const s = checker.getSymbolAtLocation(n.name);
      if (s) declaracoes.add(s);
    }
    ts.forEachChild(n, v);
  };
  v(sf);
  if (!declaracoes.size) return edicoes;
  const livre = (base) => {
    for (let k = 0; ; k++) {
      const nome = k ? `${base}${k + 1}` : base;
      if (!new RegExp(`\\b${nome}\\b`).test(texto)) return nome;
    }
  };
  const nomePara = new Map();
  for (const s of declaracoes) {
    const d = s.declarations?.[0];
    const ini = d && ts.isVariableDeclaration(d) && d.initializer ? d.initializer.getText(sf) : "";
    nomePara.set(
      s,
      /setTimeout|setInterval/.test(ini) ||
        /timer|Timeout/i.test(d?.type?.getText(sf) ?? "") ||
        (d && ts.isVariableDeclaration(d) && d.type?.getText(sf) === "number")
        ? livre("timer")
        : livre("item"),
    );
  }
  const w = (n) => {
    if (ts.isShorthandPropertyAssignment(n) && n.name.text === "t") {
      const s = checker.getShorthandAssignmentValueSymbol(n);
      if (s && nomePara.has(s))
        edicoes.push([n.name.getStart(sf), n.name.getEnd(), `t: ${nomePara.get(s)}`]);
      return;
    }
    if (
      ts.isIdentifier(n) &&
      n.text === "t" &&
      !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) &&
      !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)
    ) {
      const s = checker.getSymbolAtLocation(n);
      if (s && nomePara.has(s)) edicoes.push([n.getStart(sf), n.getEnd(), nomePara.get(s)]);
    }
    ts.forEachChild(n, w);
  };
  w(sf);
  return edicoes;
}

function inserirImport(texto, importacao) {
  const linhas = texto.split("\n");
  let ultimo = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (/^import\s/.test(linhas[i])) {
      let j = i;
      while (
        j < linhas.length &&
        !/(from\s+["'][^"']+["']|^import\s+["'][^"']+["']);?\s*$/.test(linhas[j])
      )
        j++;
      ultimo = j;
      i = j;
    }
  }
  linhas.splice(ultimo + 1, 0, importacao);
  return linhas.join("\n");
}

function importacaoPara(arquivo) {
  const rel = relative(RAIZ, arquivo).split(sep).join("/");
  if (!rel.startsWith("packages/app-core/")) return 'import { t } from "@forja/app-core/i18n";';
  let caminho = relative(dirname(arquivo), join(RAIZ, "packages/app-core/src/i18n"))
    .split(sep)
    .join("/");
  if (!caminho.startsWith(".")) caminho = `./${caminho}`;
  return `import { t } from "${caminho}";`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const gravar = args.includes("--write");
  const alvos = args.filter((a) => !a.startsWith("--"));
  if (!alvos.length) {
    console.error("uso: node scripts/i18n-extract.mjs --dry|--write <arquivos ou pastas>");
    process.exit(1);
  }
  const arquivos = alvos.flatMap(listar);
  const porProjeto = new Map();
  for (const a of arquivos) {
    const p = projetoDe(a);
    if (!p) continue;
    if (!porProjeto.has(p)) porProjeto.set(p, []);
    porProjeto.get(p).push(a);
  }
  const traduzidas = existsSync(EN) ? JSON.parse(readFileSync(EN, "utf8")) : {};
  const pendentes = new Set(
    existsSync(PENDENTES) ? JSON.parse(readFileSync(PENDENTES, "utf8")) : [],
  );
  let total = 0;
  for (const [projeto, lista] of porProjeto) {
    const prog = programa(projeto.tsconfig);
    const checker = prog.getTypeChecker();
    for (const arquivo of lista) {
      const sf =
        prog.getSourceFile(arquivo) ??
        prog.getSourceFiles().find((s) => resolve(s.fileName) === resolve(arquivo));
      if (!sf) {
        console.warn(`(fora do tsconfig) ${relative(RAIZ, arquivo)}`);
        continue;
      }
      const { novo, frases, duvidas } = processar(sf, checker, {
        importacao: importacaoPara(arquivo),
      });
      const rel = relative(RAIZ, arquivo);
      if (frases.size || duvidas.length) console.log(`\n${rel}: ${frases.size} frases`);
      if (!gravar) for (const f of frases) console.log(`  + ${JSON.stringify(f)}`);
      for (const d of duvidas) console.log(`  ? ${d}`);
      for (const f of frases) if (!Object.hasOwn(traduzidas, f)) pendentes.add(f);
      total += frases.size;
      if (gravar && novo) writeFileSync(arquivo, novo);
    }
  }
  if (gravar) writeFileSync(PENDENTES, JSON.stringify([...pendentes].sort(), null, 2) + "\n");
  console.log(
    `\n${total} frases em ${arquivos.length} arquivos${gravar ? `; ${pendentes.size} pendentes de tradução em scripts/.i18n-pending.json` : ""}.`,
  );
}
