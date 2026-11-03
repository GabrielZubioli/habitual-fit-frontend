import { Pressable, View } from "react-native";
import { cn } from "@/lib/cn";

/** O Switch do web (shadcn): trilho 36×20, bolinha 16, verde quando ligado. */
export function Switch({
  checked,
  onCheckedChange,
  accessibilityLabel,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      role="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => onCheckedChange(!checked)}
      hitSlop={8}
      className={cn(
        "h-5 w-9 justify-center rounded-full border-2 border-transparent",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <View
        className={cn(
          "h-4 w-4 rounded-full bg-background shadow-lg",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </Pressable>
  );
}
