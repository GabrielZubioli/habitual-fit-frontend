import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";

/**
 * Entrar com o Google pelo botão oficial (Google Identity Services).
 *
 * ## Por que não o redirecionamento do Supabase
 *
 * No fluxo de redirecionamento, quem conversa com o Google é o servidor do
 * Supabase — e a tela do Google mostra "Prosseguir para <projeto>.supabase.co",
 * um domínio que não é nosso e que impede verificar a marca. Aqui o Google
 * entrega a identidade (um ID token) direto ao app, no nosso domínio, e o app
 * abre a sessão com `signInWithIdToken`. Com a marca verificada no Google
 * Cloud, a tela passa a mostrar "Habitual Fit".
 *
 * ## Nonce
 *
 * O Google recebe o hash SHA-256 de um valor aleatório e o grava no token; o
 * Supabase recebe o valor original e confere. Um token capturado não serve para
 * abrir outra sessão.
 *
 * ## Reserva
 *
 * Se o script do Google não carregar (bloqueador, rede), mostra o botão antigo
 * (`fallback`), que segue funcionando pelo redirecionamento.
 */

/** ID do cliente OAuth web — público por natureza (vai no HTML de qualquer app com login Google). */
export const GOOGLE_CLIENT_ID =
  "646199416785-18c092fk6l3fjs44a7pvea3gia7bmvjn.apps.googleusercontent.com";

const SCRIPT_URL = "https://accounts.google.com/gsi/client";

type GoogleId = {
  initialize: (config: {
    client_id: string;
    callback: (r: { credential: string }) => void;
    nonce?: string;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let carregando: Promise<GoogleId> | null = null;

function carregarGoogle(): Promise<GoogleId> {
  carregando ??= new Promise<GoogleId>((resolve, reject) => {
    const pronto = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google Identity Services indisponível"));
    };
    if (window.google?.accounts?.id) return pronto();
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = pronto;
    s.onerror = () => reject(new Error("Falha ao carregar o script do Google"));
    document.head.appendChild(s);
  }).catch((e) => {
    // Permite tentar de novo numa próxima montagem.
    carregando = null;
    throw e;
  });
  return carregando;
}

async function novoNonce(): Promise<{ bruto: string; hash: string }> {
  const bruto = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bruto));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { bruto, hash };
}

export function GoogleSignIn({
  texto = "continue_with",
  onSuccess,
  fallback,
}: {
  /** Rótulo do botão oficial: "Continuar com o Google", "Fazer login…", "Inscrever-se…". */
  texto?: "continue_with" | "signin_with" | "signup_with";
  /** Sessão aberta: para onde ir agora. */
  onSuccess: () => void;
  /** Botão de reserva (redirecionamento), se o do Google não puder ser exibido. */
  fallback: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [falhou, setFalhou] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const { resolvedTheme } = useTheme();
  const escuro = resolvedTheme === "dark";
  // O callback do Google é registrado uma vez; a ref evita usar um `onSuccess` velho.
  const sucesso = useRef(onSuccess);
  sucesso.current = onSuccess;

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const [google, nonce] = await Promise.all([carregarGoogle(), novoNonce()]);
        const el = ref.current;
        if (!ativo || !el) return;
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hash,
          use_fedcm_for_prompt: true,
          callback: async ({ credential }) => {
            setEntrando(true);
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: credential,
              nonce: nonce.bruto,
            });
            setEntrando(false);
            if (error) toast.error("Não foi possível entrar com o Google.");
            else sucesso.current();
          },
        });
        el.replaceChildren();
        google.renderButton(el, {
          type: "standard",
          theme: escuro ? "filled_black" : "outline",
          size: "large",
          shape: "pill",
          text: texto,
          logo_alignment: "center",
          locale: "pt-BR",
        });
      } catch {
        if (ativo) setFalhou(true);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [escuro, texto]);

  if (falhou) return <>{fallback}</>;
  return (
    <div
      ref={ref}
      aria-busy={entrando}
      className="flex min-h-11 w-full justify-center [color-scheme:normal]"
    />
  );
}
