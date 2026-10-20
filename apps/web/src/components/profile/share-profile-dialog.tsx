/**
 * Compartilhar o perfil como um cartão de imagem.
 *
 * O Habitual Fit não tem página pública de perfil, então não há link para
 * copiar: o cartão é desenhado aqui mesmo, num canvas, só com os campos que a
 * pessoa marcou (`conteudoCartao`). A prévia é a própria imagem que vai sair —
 * o que se vê é o que se envia. Enviar usa o compartilhamento do aparelho
 * (Web Share com arquivo); sem ele, a imagem é baixada para postar onde quiser.
 */
import { useEffect, useMemo, useState } from "react";
import { Download, Lock, Share2 } from "lucide-react";
import { toast } from "sonner";
import { initialsFrom, resolveAvatarUrl } from "@/data/avatar";
import { errorMessage } from "@/data/supabase-helpers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OPCOES_PADRAO,
  conteudoCartao,
  type ConteudoCartao,
  type OpcoesCartao,
  type PerfilPublicavel,
} from "@/lib/share-profile";

const ARQUIVO = "perfil-habitual-fit.png";

export function ShareProfileDialog({
  open,
  onOpenChange,
  perfil,
  avatarPath,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  perfil: Omit<PerfilPublicavel, "fotoUrl">;
  /** Caminho da foto no storage; a URL é resolvida só ao abrir. */
  avatarPath: string | null;
}) {
  const [opcoes, setOpcoes] = useState<OpcoesCartao>(OPCOES_PADRAO);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [imagem, setImagem] = useState<{ blob: Blob; url: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    void resolveAvatarUrl(avatarPath).then((u) => ativo && setFotoUrl(u));
    return () => {
      ativo = false;
    };
  }, [open, avatarPath]);

  // A chave em texto evita redesenhar a cada render do pai (objeto novo, mesmo conteúdo).
  const chave = JSON.stringify(conteudoCartao({ ...perfil, fotoUrl }, opcoes));

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    setErro(null);
    gerarCartao(JSON.parse(chave) as ConteudoCartao)
      .then((blob) => {
        if (!ativo) return;
        const url = URL.createObjectURL(blob);
        setImagem((antiga) => {
          if (antiga) URL.revokeObjectURL(antiga.url);
          return { blob, url };
        });
      })
      .catch((e) => ativo && setErro(errorMessage(e)));
    return () => {
      ativo = false;
    };
  }, [open, chave]);

  // Fechou: solta a imagem da memória.
  useEffect(() => {
    if (open) return;
    setImagem((antiga) => {
      if (antiga) URL.revokeObjectURL(antiga.url);
      return null;
    });
  }, [open]);

  const arquivo = useMemo(
    () => (imagem ? new File([imagem.blob], ARQUIVO, { type: "image/png" }) : null),
    [imagem],
  );
  const podeCompartilhar =
    arquivo !== null &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [arquivo] });

  const compartilhar = async () => {
    if (!arquivo) return;
    try {
      await navigator.share({ files: [arquivo], title: "Meu perfil no Habitual Fit" });
    } catch (e) {
      if ((e as DOMException).name !== "AbortError") {
        toast.error("Não foi possível compartilhar. Baixe a imagem e envie pelo app que preferir.");
      }
    }
  };

  const baixar = () => {
    if (!imagem) return;
    const a = document.createElement("a");
    a.href = imagem.url;
    a.download = ARQUIVO;
    a.click();
  };

  const itens: { k: keyof OpcoesCartao; rotulo: string; dica?: string; existe: boolean }[] = [
    { k: "nome", rotulo: "Nome", existe: Boolean(perfil.nome?.trim()) },
    { k: "foto", rotulo: "Foto de perfil", existe: Boolean(avatarPath) },
    { k: "objetivo", rotulo: "Objetivo", existe: Boolean(perfil.objetivo) },
    { k: "treinos", rotulo: "Treinos concluídos", existe: perfil.treinos !== null },
    { k: "sequencia", rotulo: "Sequência de treinos", existe: perfil.sequencia !== null },
    {
      k: "recordes",
      rotulo: "Melhores recordes",
      dica: "Até 3 exercícios, com carga e repetições",
      existe: perfil.recordes.length > 0,
    },
    {
      k: "meta",
      rotulo: "Progresso da meta de peso",
      dica: "Só a porcentagem — o peso não aparece",
      existe: perfil.metaPercent !== null,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-md grid-cols-[minmax(0,1fr)] overflow-y-auto overflow-x-hidden rounded-[1.75rem]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-bold">Compartilhar perfil</DialogTitle>
          <DialogDescription>
            Escolha o que entra no cartão e confira a prévia antes de enviar.
          </DialogDescription>
        </DialogHeader>

        {/* A prévia é a imagem final. */}
        <div className="mx-auto w-full max-w-[16rem]">
          {erro ? (
            <p className="grid aspect-[4/5] place-items-center rounded-2xl bg-card p-4 text-center text-sm text-destructive">
              {erro}
            </p>
          ) : imagem ? (
            <img
              src={imagem.url}
              alt="Prévia do cartão que será compartilhado"
              className="aspect-[4/5] w-full rounded-2xl shadow-lg ring-1 ring-border"
            />
          ) : (
            <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
          )}
        </div>

        <ul className="divide-y divide-border/60 rounded-2xl bg-card">
          {itens
            .filter((i) => i.existe)
            .map((i) => (
              <li key={i.k}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{i.rotulo}</span>
                    {i.dica && (
                      <span className="block text-xs text-muted-foreground">{i.dica}</span>
                    )}
                  </span>
                  <Switch
                    checked={opcoes[i.k]}
                    onCheckedChange={(v) => setOpcoes((o) => ({ ...o, [i.k]: v }))}
                  />
                </label>
              </li>
            ))}
        </ul>

        <p className="flex gap-2 text-xs leading-snug text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Seu perfil não fica público: só esta imagem sai do app, quando você enviar. E-mail, dados
          da conta, medidas e peso nunca entram no cartão.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant={podeCompartilhar ? "outline" : "default"}
            className="h-12 flex-1 rounded-xl"
            onClick={baixar}
            disabled={!imagem}
          >
            <Download className="mr-1.5 size-4" aria-hidden />
            Baixar imagem
          </Button>
          {podeCompartilhar && (
            <Button
              className="h-12 flex-1 rounded-xl font-bold"
              onClick={() => void compartilhar()}
            >
              <Share2 className="mr-1.5 size-4" aria-hidden />
              Compartilhar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── O desenho do cartão ─────────────────────────────────────────────────────

const W = 1080;
const H = 1350;
const VERDE = "#01D798";
const FUNDO = "#020306";
const BLOCO = "#12171E";
const APAGADO = "#9AA3AE";

async function gerarCartao(c: ConteudoCartao): Promise<Blob> {
  await document.fonts?.ready;
  const familia = getComputedStyle(document.body).fontFamily || "sans-serif";
  const foto = c.fotoUrl ? await carregarImagem(c.fotoUrl) : null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador não consegue gerar a imagem.");
  desenhar(ctx, c, foto, familia);
  try {
    return await paraBlob(canvas);
  } catch (e) {
    // Foto de outra origem sem CORS "suja" o canvas: refaz sem ela.
    if (!foto) throw e;
    desenhar(ctx, c, null, familia);
    return paraBlob(canvas);
  }
}

function carregarImagem(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function paraBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Não foi possível gerar a imagem."))),
        "image/png",
      );
    } catch (e) {
      reject(e);
    }
  });
}

/** Corta o texto com reticências até caber em `max` px. */
function caber(ctx: CanvasRenderingContext2D, texto: string, max: number): string {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function desenhar(
  ctx: CanvasRenderingContext2D,
  c: ConteudoCartao,
  foto: HTMLImageElement | null,
  familia: string,
) {
  const fonte = (peso: number, px: number) => `${peso} ${px}px ${familia}`;
  const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = FUNDO;
  ctx.fillRect(0, 0, W, H);

  // Formas da marca ao fundo.
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = VERDE;
  ctx.beginPath();
  ctx.arc(W - 40, 40, 420, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.07;
  ctx.beginPath();
  ctx.arc(-60, H - 160, 320, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = VERDE;
  ctx.font = fonte(800, 38);
  ctx.fillText("HABITUAL FIT", 80, 120);

  // Foto (ou iniciais) com o anel verde.
  const cx = W / 2;
  const cy = 350;
  const r = 150;
  ctx.fillStyle = VERDE;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (foto) {
    const lado = Math.min(foto.naturalWidth, foto.naturalHeight);
    ctx.drawImage(
      foto,
      (foto.naturalWidth - lado) / 2,
      (foto.naturalHeight - lado) / 2,
      lado,
      lado,
      cx - r,
      cy - r,
      r * 2,
      r * 2,
    );
  } else {
    ctx.fillStyle = BLOCO;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = VERDE;
    ctx.font = fonte(800, 110);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initialsFrom(c.nome), cx, cy + 6);
  }
  ctx.restore();

  // Nome: diminui a fonte até caber; se ainda não couber, reticências.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  let px = 84;
  ctx.font = fonte(800, px);
  while (ctx.measureText(c.nome).width > 920 && px > 52) {
    px -= 4;
    ctx.font = fonte(800, px);
  }
  ctx.fillText(caber(ctx, c.nome, 920), cx, 620);

  let y = 660;
  if (c.objetivo) {
    ctx.font = fonte(700, 34);
    const texto = caber(ctx, c.objetivo, 800);
    const largura = ctx.measureText(texto).width + 64;
    ctx.fillStyle = VERDE;
    ctx.beginPath();
    ctx.roundRect(cx - largura / 2, y, largura, 64, 32);
    ctx.fill();
    ctx.fillStyle = FUNDO;
    ctx.fillText(texto, cx, y + 44);
    y += 64;
  }

  // Números, lado a lado.
  const numeros = [
    c.treinos !== null && { valor: n(c.treinos), rotulo: c.treinos === 1 ? "treino" : "treinos" },
    c.sequencia !== null && {
      valor: n(c.sequencia),
      rotulo: c.sequencia === 1 ? "dia seguido" : "dias seguidos",
    },
    c.metaPercent !== null && { valor: `${Math.round(c.metaPercent)}%`, rotulo: "da meta de peso" },
  ].filter((v): v is { valor: string; rotulo: string } => Boolean(v));
  if (numeros.length > 0) {
    y += 56;
    const gap = 24;
    const largura = (920 - gap * (numeros.length - 1)) / numeros.length;
    numeros.forEach((num, i) => {
      const x = 80 + i * (largura + gap);
      ctx.fillStyle = BLOCO;
      ctx.beginPath();
      ctx.roundRect(x, y, largura, 200, 36);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = fonte(800, 88);
      ctx.fillText(caber(ctx, num.valor, largura - 32), x + largura / 2, y + 112);
      ctx.fillStyle = APAGADO;
      ctx.font = fonte(600, 30);
      ctx.fillText(caber(ctx, num.rotulo, largura - 32), x + largura / 2, y + 160);
    });
    y += 200;
  }

  if (c.recordes.length > 0) {
    y += 64;
    ctx.textAlign = "left";
    ctx.fillStyle = VERDE;
    ctx.font = fonte(800, 34);
    ctx.fillText("RECORDES", 80, y);
    y += 24;
    for (const rec of c.recordes) {
      y += 72;
      const carga = `${n(rec.weightKg)} kg × ${rec.reps}`;
      ctx.font = fonte(700, 36);
      ctx.textAlign = "right";
      ctx.fillStyle = APAGADO;
      ctx.fillText(carga, W - 80, y);
      const larguraCarga = ctx.measureText(carga).width;
      ctx.textAlign = "left";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(caber(ctx, rec.exerciseName, 920 - larguraCarga - 40), 80, y);
    }
  }

  ctx.textAlign = "center";
  ctx.fillStyle = APAGADO;
  ctx.font = fonte(600, 30);
  ctx.fillText("Treinando com o Habitual Fit", cx, H - 80);
}
