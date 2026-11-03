import { MUSCLES_BY_VIEW, VIEW_BOX, resolveMuscle, type BodyView } from "./muscle-paths";

/**
 * A parte do mapa muscular que não depende de onde ele é desenhado: o web
 * (SVG do navegador) e o app nativo (react-native-svg) usam as mesmas contas.
 */

export interface MuscleIntensity {
  /** Valor de `muscle_t`. */
  muscle: string;
  /** 0 a 1. */
  intensity: number;
  /** Cor própria do músculo (ex.: fadiga em laranja); sem ela, o verde da marca. */
  color?: string;
}

/**
 * Agrega as contribuições de uma lista de exercícios num conjunto de
 * intensidades normalizado.
 *
 * A normalização é pelo **máximo**, não pela soma: o que interessa é a
 * proporção entre os músculos daquele treino. Dividir pela soma faria um treino
 * de seis exercícios parecer inteiro mais fraco que um de dois.
 */
export function aggregateMuscleIntensities(
  contributions: readonly { muscle: string; contribution: number }[],
): MuscleIntensity[] {
  const soma = new Map<string, number>();
  for (const c of contributions) {
    soma.set(c.muscle, (soma.get(c.muscle) ?? 0) + c.contribution);
  }
  const maximo = Math.max(...soma.values(), 1);
  return [...soma.entries()].map(([muscle, valor]) => ({ muscle, intensity: valor / maximo }));
}

/**
 * Intensidade por grupo desenhável, resolvendo os apelidos. Fica com o **maior**
 * valor, não a soma: vários músculos do banco podem apontar para o mesmo grupo
 * desenhado (costas + dorsais), e somar saturaria os que têm mais apelidos.
 */
export function intensityByGroup(muscles: readonly MuscleIntensity[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const m of muscles) {
    const grupo = resolveMuscle(m.muscle);
    if (grupo) mapa.set(grupo, Math.max(mapa.get(grupo) ?? 0, m.intensity));
  }
  return mapa;
}

/** Vista com mais estímulo. Empate vai para a frente, leitura mais familiar. */
export function suggestedView(porGrupo: ReadonlyMap<string, number>): BodyView {
  const soma = (view: BodyView) =>
    Object.keys(MUSCLES_BY_VIEW[view]).reduce((s, m) => s + (porGrupo.get(m) ?? 0), 0);
  return soma("back") > soma("front") * 1.05 ? "back" : "front";
}

type Caixa = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * Caixa de um path SVG, pelos pontos de cada comando (os de controle das
 * curvas também entram: a caixa sai um pouco maior que o desenho, o que a
 * folga do enquadramento absorve). Arcos contam só o ponto final.
 *
 * Faz o papel do `getBBox()` do navegador, que o react-native-svg não tem.
 */
export function pathBounds(d: string): Caixa | null {
  const tokens = tokenize(d);
  const caixa: Caixa = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const ponto = (x: number, y: number) => {
    caixa.minX = Math.min(caixa.minX, x);
    caixa.minY = Math.min(caixa.minY, y);
    caixa.maxX = Math.max(caixa.maxX, x);
    caixa.maxY = Math.max(caixa.maxY, y);
  };
  /** Quantos números cada comando consome, e quais pares são pontos. */
  const ARIDADE: Record<string, number> = {
    M: 2,
    L: 2,
    T: 2,
    H: 1,
    V: 1,
    C: 6,
    S: 4,
    Q: 4,
    A: 7,
    Z: 0,
  };
  let x = 0;
  let y = 0;
  let inicioX = 0;
  let inicioY = 0;
  let cmd = "";
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
      if (cmd.toUpperCase() === "Z") {
        x = inicioX;
        y = inicioY;
      }
      continue;
    }
    const tipo = cmd.toUpperCase();
    const n = ARIDADE[tipo];
    if (!n) return null;
    const nums = tokens.slice(i, i + n).map(Number);
    if (nums.length < n) break;
    i += n;
    const rel = cmd !== tipo;
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (tipo === "H") {
      x = ox + nums[0]!;
    } else if (tipo === "V") {
      y = oy + nums[0]!;
    } else if (tipo === "A") {
      x = ox + nums[5]!;
      y = oy + nums[6]!;
    } else {
      // Pares (controle…, ponto final): todos entram na caixa.
      for (let k = 0; k < n; k += 2) ponto(ox + nums[k]!, oy + nums[k + 1]!);
      x = ox + nums[n - 2]!;
      y = oy + nums[n - 1]!;
    }
    ponto(x, y);
    if (tipo === "M") {
      inicioX = x;
      inicioY = y;
      // Pares depois de um M são linhas.
      cmd = rel ? "l" : "L";
    }
  }
  return Number.isFinite(caixa.minX) ? caixa : null;
}

/**
 * Comandos e números de um path. As duas flags do arco (4º e 5º parâmetros)
 * são um dígito cada e o SVG compacto as cola: `a.23.23 0 01-.19-.21` é
 * flags 0 e 1, não o número 01.
 */
function tokenize(d: string): string[] {
  const numero = /-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/y;
  const tokens: string[] = [];
  let arco = -1; // posição dentro dos 7 parâmetros do arco; -1 fora de arco
  let i = 0;
  while (i < d.length) {
    const c = d[i]!;
    if (/[\s,]/.test(c)) {
      i++;
    } else if (/[a-zA-Z]/.test(c)) {
      tokens.push(c);
      arco = c === "a" || c === "A" ? 0 : -1;
      i++;
    } else if (arco === 3 || arco === 4) {
      tokens.push(c);
      arco++;
      i++;
    } else {
      numero.lastIndex = i;
      const m = numero.exec(d);
      if (!m) return [];
      tokens.push(m[0]);
      if (arco >= 0) arco = (arco + 1) % 7;
      i += m[0].length;
    }
  }
  return tokens;
}

/**
 * O enquadramento do web (`enquadrar`): a região dos músculos destacados, com
 * folga de 30% e no mínimo 360 × 270 (meia figura), numa moldura 4:3 centrada
 * no que foi trabalhado. Sem músculo destacado, a vista inteira.
 */
export function framedViewBox(view: BodyView, porGrupo: ReadonlyMap<string, number>): string {
  const caixa: Caixa = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [muscle, paths] of Object.entries(MUSCLES_BY_VIEW[view])) {
    if ((porGrupo.get(muscle) ?? 0) <= 0) continue;
    for (const d of paths) {
      const b = pathBounds(d);
      if (!b) continue;
      caixa.minX = Math.min(caixa.minX, b.minX);
      caixa.minY = Math.min(caixa.minY, b.minY);
      caixa.maxX = Math.max(caixa.maxX, b.maxX);
      caixa.maxY = Math.max(caixa.maxY, b.maxY);
    }
  }
  if (!Number.isFinite(caixa.minX)) return VIEW_BOX[view];
  const bw = caixa.maxX - caixa.minX;
  const bh = caixa.maxY - caixa.minY;
  let w = Math.max(bw * 1.3, 360);
  let h = Math.max(bh * 1.3, 270);
  if (w / h > 4 / 3) h = (w * 3) / 4;
  else w = (h * 4) / 3;
  const cx = caixa.minX + bw / 2;
  const cy = caixa.minY + bh / 2;
  return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
}
