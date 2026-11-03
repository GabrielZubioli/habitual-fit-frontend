import { Pressable } from "react-native";
import { __iconNode as heart } from "lucide-react/dist/esm/icons/heart.js";
import { useFavoritos } from "@forja/app-core/data/exercise-favorites";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Icon } from "./icon";

/** O coração de favoritar — o `favorite-button.tsx` do web. */
const ROSA = "#FF4D6D";

export function FavoriteButton({
  exerciseId,
  nome,
  className,
}: {
  exerciseId: string;
  nome: string;
  className?: string;
}) {
  const { ids, alternar } = useFavoritos();
  const apagada = useColor("muted-foreground");
  const ativo = ids.has(exerciseId);
  return (
    <Pressable
      onPress={() => alternar(exerciseId)}
      accessibilityState={{ checked: ativo }}
      accessibilityLabel={ativo ? `Tirar ${nome} dos favoritos` : `Favoritar ${nome}`}
      className={cn(
        "h-10 w-10 items-center justify-center rounded-full active:scale-90",
        className,
      )}
    >
      <Icon node={heart} color={ativo ? ROSA : apagada} size={20} preenchido={ativo} />
    </Pressable>
  );
}
