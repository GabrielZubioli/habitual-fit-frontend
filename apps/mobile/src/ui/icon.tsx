import { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect, Svg } from "react-native-svg";

/**
 * Ícones do lucide — os mesmos do web, desenhados com react-native-svg a partir
 * dos dados de cada ícone (`__iconNode`).
 *
 *     import { __iconNode as house } from "lucide-react/dist/esm/icons/house.js";
 *     <Icon node={house} color={cor} />
 *
 * ponytail: lê os dados do `lucide-react` (pacote do web). Trocar por
 * `lucide-react-native` quando o npm install estiver liberado.
 */
export type IconNode = readonly (readonly [string, Record<string, string | number>])[];

const ELEMENTOS = {
  path: Path,
  circle: Circle,
  rect: Rect,
  line: Line,
  polyline: Polyline,
  polygon: Polygon,
  ellipse: Ellipse,
} as const;

export function Icon({
  node,
  color,
  size = 24,
  strokeWidth = 2,
  preenchido = false,
  fill,
}: {
  node: IconNode;
  color: string;
  size?: number;
  strokeWidth?: number;
  /** O `fill-current` do web: pinta o miolo com a mesma cor do traço. */
  preenchido?: boolean;
  /** Miolo de outra cor que o traço (o fogo da sequência). */
  fill?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ?? (preenchido ? color : "none")}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {node.map(([tag, { key, ...attrs }]) => {
        const El = ELEMENTOS[tag as keyof typeof ELEMENTOS];
        return El ? <El key={String(key)} {...attrs} /> : null;
      })}
    </Svg>
  );
}
