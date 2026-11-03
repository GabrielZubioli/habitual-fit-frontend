import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@forja/app-core/i18n";

/**
 * Voltar para a tela de onde a pessoa veio, qualquer que seja. Se a tela foi
 * aberta direto (link, recarga), não há para onde voltar: vai ao `fallback`.
 */
export function BackButton({
  fallback = "/dashboard",
  className,
}: {
  fallback?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() =>
        router.history.canGoBack() ? router.history.back() : void router.navigate({ to: fallback })
      }
      aria-label={t("Voltar")}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full bg-card transition-colors hover:bg-elevated",
        className,
      )}
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}
