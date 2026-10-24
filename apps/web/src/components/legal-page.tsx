import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";
import { EMPRESA, VIGENCIA } from "@/lib/legal";

/**
 * Casca das páginas legais (Privacidade e Termos): públicas, sem login, legíveis
 * no celular e com a tipografia do app. O texto vem como filhos, em seções.
 */
export function LegalPage({
  titulo,
  resumo,
  children,
}: {
  titulo: string;
  /** Um parágrafo curto, em linguagem simples, antes do texto completo. */
  resumo: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-8">
        <Link to="/" aria-label="Habitual Fit — início" className="inline-flex">
          <BrandLogo className="h-10" />
        </Link>

        <h1 className="mt-8 text-[2rem] font-extrabold leading-tight tracking-tight">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Em vigor desde {VIGENCIA}.</p>

        <div className="mt-6 rounded-[1.25rem] border border-primary/30 bg-primary/[0.06] p-5 text-pretty leading-relaxed">
          {resumo}
        </div>

        <div className="mt-8 space-y-8 leading-relaxed text-foreground/90 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>

        <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            Dúvidas ou pedidos: <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>
          </p>
          <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-label="Documentos">
            <Link to="/privacidade" className="hover:text-foreground">
              Política de Privacidade
            </Link>
            <Link to="/termos" className="hover:text-foreground">
              Termos de Uso
            </Link>
            <Link to="/" className="hover:text-foreground">
              Voltar ao app
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-foreground">{titulo}</h2>
      {children}
    </section>
  );
}
