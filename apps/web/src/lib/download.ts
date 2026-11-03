/** Dispara o download de um arquivo gerado no cliente. */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Libera a memória do blob assim que o navegador processa o clique.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
