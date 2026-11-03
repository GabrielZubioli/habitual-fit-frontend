/**
 * Exportação de dados — exibida no perfil.
 *
 * Poder levar os próprios dados embora é requisito de confiança num app que
 * acumula anos de histórico, e a LGPD garante esse direito. Também serve de
 * backup manual enquanto não há sincronização multi-dispositivo.
 */
import { useState } from "react";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { downloadFile } from "@/lib/download";
import { buildExportFile, type ExportFormat } from "@forja/app-core/data/export";
import { t } from "@forja/app-core/i18n";

export function ExportDataCard() {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const exportar = async (format: ExportFormat) => {
    setExporting(format);
    try {
      const { conteudo, nome, mime } = await buildExportFile(format);
      downloadFile(conteudo, nome, mime);

      toast.success(t("Exportação concluída"), {
        description: t("O arquivo foi baixado para o seu dispositivo."),
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="size-4" aria-hidden />
          {t("Seus dados")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t(
            "Baixe tudo o que você registrou: treinos, séries, diário alimentar, receitas, pesos e medidas. Seus dados são seus — leve-os quando quiser.",
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void exportar("json")}
            disabled={exporting !== null}
          >
            <FileJson className="mr-1.5 size-4" />
            {exporting === "json" ? t("Exportando…") : t("Exportar JSON")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void exportar("csv")}
            disabled={exporting !== null}
          >
            <FileSpreadsheet className="mr-1.5 size-4" />
            {exporting === "csv" ? t("Exportando…") : t("Exportar CSV")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(
            "JSON preserva a estrutura completa (ideal para backup ou migração). CSV abre direto no Excel e no Google Planilhas.",
          )}
        </p>
      </CardContent>
    </Card>
  );
}
