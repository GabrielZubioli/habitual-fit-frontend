/**
 * Idioma do app, em "Dados e conta". "Automático" segue o país (ver
 * `resolveLanguage`); escolher um idioma grava e recarrega a página, porque o
 * i18n é decidido uma vez na carga.
 */
import { Languages } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LANGUAGE_NAMES,
  LANGUAGES,
  languagePreference,
  setLanguagePreference,
  t,
  type Language,
} from "@forja/app-core/i18n";

const AUTO = "auto";

export function LanguageCard() {
  const atual = languagePreference() ?? AUTO;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="size-4" aria-hidden />
          {t("Idioma")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Select
          value={atual}
          onValueChange={(v) => {
            if (v !== atual) setLanguagePreference(v === AUTO ? null : (v as Language));
          }}
        >
          <SelectTrigger aria-label={t("Idioma")} className="h-11 w-full rounded-2xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO}>{t("Automático (pelo país)")}</SelectItem>
            {LANGUAGES.map((l) => (
              <SelectItem key={l} value={l}>
                {LANGUAGE_NAMES[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
