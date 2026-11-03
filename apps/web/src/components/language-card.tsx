/**
 * Idioma do app, em "Dados e conta". "Automático" segue o país (ver
 * `resolveLanguage`); escolher um idioma grava e recarrega a página, porque o
 * i18n é decidido uma vez na carga.
 */
import { Languages } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipRadio } from "@/components/ui/chip-group";
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
  const opcoes = [
    { value: AUTO, label: t("Automático (pelo país)") },
    ...LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="size-4" aria-hidden />
          {t("Idioma")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChipRadio
          label={t("Idioma")}
          options={opcoes}
          value={atual}
          onChange={(v) => {
            if (v !== atual) setLanguagePreference(v === AUTO ? null : (v as Language));
          }}
        />
      </CardContent>
    </Card>
  );
}
