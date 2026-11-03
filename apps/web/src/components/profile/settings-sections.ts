import { Dumbbell, HeartPulse, ShieldCheck, Target, Utensils } from "lucide-react";
import { t } from "@forja/app-core/i18n";

/**
 * As seções de Configurações — cada uma é uma opção do Menu e abre sozinha
 * em `/settings?secao=…`.
 */
export const SETTINGS_SECTIONS = [
  { key: "metas", title: t("Metas nutricionais"), icon: Target },
  { key: "treino", title: t("Treino"), icon: Dumbbell },
  { key: "alimentacao", title: t("Alimentação"), icon: Utensils },
  { key: "saude", title: t("Saúde"), icon: HeartPulse },
  { key: "conta", title: t("Dados e conta"), icon: ShieldCheck },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["key"];

export function isSettingsSection(v: unknown): v is SettingsSection {
  return SETTINGS_SECTIONS.some((s) => s.key === v);
}
