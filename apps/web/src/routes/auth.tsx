import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { z } from "zod";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/data/supabase-helpers";
import { Button } from "@/components/ui/button";
import { GoogleSignIn } from "@/components/google-sign-in";
import { Input } from "@/components/ui/input";
import { BrandSymbol } from "@/components/brand-logo";
import { Punho } from "@/components/train-launch";
import { cn } from "@/lib/utils";

/**
 * Entrar e criar conta, na mesma tela.
 *
 * Os dois formulários ficam montados e o cartão só troca de `data-mode` — a
 * animação (em `styles.css`, `.auth-flip`) roda nos dois sentidos e o que já
 * foi digitado não se perde. O modo fica na URL (`?modo=cadastro`) para que
 * um link leve direto ao cadastro; /criar-conta redireciona para cá.
 *
 * Depois de entrar, a raiz decide o destino: com plano, o painel; sem plano
 * (conta nova, primeiro login com Google), o questionário.
 *
 * Erros aparecem na própria tela: os toasts ficam desligados em produção.
 */
export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Habitual Fit" },
      { name: "description", content: "Acesse ou crie sua conta Habitual Fit." },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  validateSearch: z.object({ modo: z.enum(["cadastro"]).optional().catch(undefined) }),
  component: AuthPage,
});

type Modo = "login" | "signup";

/** Quando os campos do formulário novo começam a entrar (`--auth-swap` e a cascata do CSS). */
const TROCA_MS = 650;

const emailSchema = z.string().trim().email("Informe um e-mail válido").max(255);
const loginPassSchema = z.string().min(1, "Informe sua senha").max(72);
const nameSchema = z.string().trim().min(2, "Informe seu nome").max(60);
const newPassSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres")
  .max(72)
  .regex(/[A-Za-z]/, "Use pelo menos uma letra")
  .regex(/[0-9]/, "Use pelo menos um número");

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const modo: Modo = search.modo === "cadastro" ? "signup" : "login";
  // Fica aqui para o cadastro poder mandar o e-mail já existente para o login.
  const [loginEmail, setLoginEmail] = useState("");
  const tituloLogin = useRef<HTMLHeadingElement>(null);
  const tituloCadastro = useRef<HTMLHeadingElement>(null);
  const trocou = useRef(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) void navigate({ to: "/", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  // O botão clicado some (painel inerte); o foco vai para o título do
  // formulário novo assim que ele aparece, para o teclado não se perder. No
  // efeito, e não no clique, para rodar depois que o formulário deixa de ser
  // inerte.
  useEffect(() => {
    if (!trocou.current) return;
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const titulo = modo === "signup" ? tituloCadastro : tituloLogin;
    const t = window.setTimeout(
      () => titulo.current?.focus({ preventScroll: true }),
      reduzido ? 0 : TROCA_MS,
    );
    return () => window.clearTimeout(t);
  }, [modo]);

  const trocar = (novo: Modo) => {
    void navigate({
      to: "/auth",
      search: novo === "signup" ? { modo: "cadastro" } : {},
      replace: true,
    });
    trocou.current = true;
  };

  return (
    <div className="auth-page grid min-h-dvh place-items-center min-[650px]:p-5">
      <div className="auth-flip" data-mode={modo}>
        <section className="auth-flip__form auth-flip__form--login" inert={modo !== "login"}>
          <SignInForm
            ativo={modo === "login"}
            titulo={tituloLogin}
            email={loginEmail}
            setEmail={setLoginEmail}
          />
        </section>

        <section className="auth-flip__form auth-flip__form--signup" inert={modo !== "signup"}>
          <SignUpForm
            ativo={modo === "signup"}
            titulo={tituloCadastro}
            irParaLogin={(email) => {
              setLoginEmail(email);
              trocar("login");
            }}
          />
        </section>

        <div className="auth-flip__toggle">
          <Painel
            lado="left"
            inativo={modo !== "login"}
            titulo="Novo por aqui?"
            texto="Crie sua conta e receba seu plano de treino."
            botao="Criar conta"
            onClick={() => trocar("signup")}
          />
          <Painel
            lado="right"
            inativo={modo !== "signup"}
            titulo="Já tem conta?"
            texto="Entre para continuar de onde parou."
            botao="Entrar"
            onClick={() => trocar("login")}
          />
        </div>
      </div>
    </div>
  );
}

function Painel({
  lado,
  inativo,
  titulo,
  texto,
  botao,
  onClick,
}: {
  lado: "left" | "right";
  inativo: boolean;
  titulo: string;
  texto: string;
  botao: string;
  onClick: () => void;
}) {
  return (
    <div className={`auth-flip__panel auth-flip__panel--${lado}`} inert={inativo}>
      <Punho className="auth-flip__marca" />
      <Link to="/" aria-label="Habitual Fit — início" className="rounded-lg">
        <BrandSymbol
          escuro
          className="w-24 drop-shadow-[0_6px_14px_rgb(4_38_26/0.18)] max-[649px]:w-14"
        />
      </Link>
      {/* Menor que o título do formulário: o painel só convida para o outro modo. */}
      <h2 className="mt-6 text-2xl font-bold tracking-tight max-[649px]:mt-2 max-[649px]:text-xl">
        {titulo}
      </h2>
      <p className="mt-1.5 text-pretty text-sm opacity-80 max-[649px]:hidden">{texto}</p>
      <button
        type="button"
        className="auth-flip__panel-btn mt-6 max-[649px]:mt-3"
        onClick={onClick}
      >
        {botao}
        <ArrowRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function SignInForm({
  ativo,
  titulo,
  email,
  setEmail,
}: {
  ativo: boolean;
  titulo: React.RefObject<HTMLHeadingElement | null>;
  email: string;
  setEmail: (v: string) => void;
}) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [erro, setErro] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const em = emailSchema.safeParse(email);
    const pw = loginPassSchema.safeParse(password);
    setErrors({
      email: em.success ? undefined : em.error.issues[0]?.message,
      password: pw.success ? undefined : pw.error.issues[0]?.message,
    });
    setErro(undefined);
    if (!em.success || !pw.success) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: em.data, password: pw.data });
    setLoading(false);

    if (!error) return; // sucesso: `onAuthStateChange` redireciona

    if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
      return void navigate({ to: "/confirme-email", search: { email: em.data } });
    }
    // Mensagem genérica de propósito: distinguir "e-mail não existe" de "senha
    // errada" confirma a terceiros quem tem conta no app.
    setErro(errorMessage(error));
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-center" noValidate aria-busy={loading}>
      <Cabecalho titulo={titulo}>Entrar na sua conta</Cabecalho>

      {/* Altura fixa: o botão do Google muda de tamanho enquanto monta, e o
          formulário centralizado pularia inteiro junto. */}
      <div className="h-12 overflow-hidden pt-1">
        <GoogleButton ativo={ativo} texto="signin_with" onError={setErro} />
      </div>
      <Divisor>ou com e-mail</Divisor>

      <IconField
        id="login-email"
        label="E-mail"
        icon={Mail}
        error={errors.email}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <IconField
        id="login-password"
        label="Senha"
        icon={Lock}
        revelavel
        error={errors.password}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div className="text-right">
        <Link
          to="/esqueci-senha"
          search={{ email: email.trim() || undefined }}
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Esqueceu sua senha?
        </Link>
      </div>

      {erro && <Aviso>{erro}</Aviso>}

      <SubmitButton loading={loading}>Entrar</SubmitButton>
    </form>
  );
}

function SignUpForm({
  ativo,
  titulo,
  irParaLogin,
}: {
  ativo: boolean;
  titulo: React.RefObject<HTMLHeadingElement | null>;
  irParaLogin: (email: string) => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [erro, setErro] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [contaExiste, setContaExiste] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const nm = nameSchema.safeParse(name);
    const em = emailSchema.safeParse(email);
    const pw = newPassSchema.safeParse(password);
    const confere = confirm === password;
    setErrors({
      name: nm.success ? undefined : nm.error.issues[0]?.message,
      email: em.success ? undefined : em.error.issues[0]?.message,
      password: pw.success ? undefined : pw.error.issues[0]?.message,
      confirm: confere ? undefined : "As senhas não conferem",
    });
    setErro(undefined);
    if (!nm.success || !em.success || !pw.success || !confere) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: em.data,
      password: pw.data,
      options: {
        // O link de confirmação leva ao questionário, já logado.
        emailRedirectTo: `${window.location.origin}/`,
        data: { name: nm.data },
      },
    });
    setLoading(false);

    // Conta já existente: com a confirmação desligada vem o erro; ligada, o
    // Supabase não acusa (para não revelar contas) e devolve um usuário sem
    // identidades — nos dois casos, o aviso fica na tela.
    if (
      error?.code === "user_already_exists" ||
      /already registered/i.test(error?.message ?? "") ||
      (!error && data.user?.identities?.length === 0)
    ) {
      return setContaExiste(em.data);
    }
    if (error) return setErro(errorMessage(error));

    // Confirmação desligada no projeto: já veio sessão, segue para o questionário.
    if (data.session) return void navigate({ to: "/", replace: true });

    void navigate({ to: "/confirme-email", search: { email: em.data } });
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-center" noValidate aria-busy={loading}>
      <Cabecalho titulo={titulo}>Criar sua conta</Cabecalho>

      {/* Altura fixa: o botão do Google muda de tamanho enquanto monta, e o
          formulário centralizado pularia inteiro junto. */}
      <div className="h-12 overflow-hidden pt-1">
        <GoogleButton ativo={ativo} texto="signup_with" onError={setErro} />
      </div>
      <Divisor>ou com e-mail</Divisor>

      <IconField
        id="signup-name"
        label="Nome"
        icon={User}
        error={errors.name}
        autoComplete="given-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <IconField
        id="signup-email"
        label="E-mail"
        icon={Mail}
        error={errors.email}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setContaExiste(null);
        }}
      />
      <IconField
        id="signup-password"
        label="Senha (mín. 8 caracteres)"
        icon={Lock}
        revelavel
        error={errors.password}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      >
        <PasswordStrength value={password} />
      </IconField>
      <IconField
        id="signup-confirm"
        label="Confirme a senha"
        icon={Lock}
        revelavel
        error={errors.confirm}
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      {contaExiste && (
        <div>
          <div
            role="alert"
            className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-left animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            <p className="font-semibold">Este e-mail já tem uma conta</p>
            <p className="mt-1 text-pretty text-sm text-muted-foreground">
              <span className="break-all font-medium text-foreground">{contaExiste}</span> já está
              cadastrado. Entre com ele ou recupere a senha.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="h-11 rounded-xl"
                onClick={() => irParaLogin(contaExiste)}
              >
                Entrar
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl">
                <Link to="/esqueci-senha" search={{ email: contaExiste }}>
                  Esqueci a senha
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {erro && <Aviso>{erro}</Aviso>}

      <SubmitButton loading={loading}>Criar conta</SubmitButton>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Ao criar a conta, você aceita os{" "}
        <Link
          to="/termos"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link
          to="/privacidade"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Política de Privacidade
        </Link>
        .
      </p>
    </form>
  );
}

function Cabecalho({
  titulo,
  children,
}: {
  titulo: React.RefObject<HTMLHeadingElement | null>;
  children: React.ReactNode;
}) {
  return (
    <div className="pb-2">
      <h1
        ref={titulo}
        tabIndex={-1}
        className="text-[2rem] font-bold leading-tight tracking-tight outline-none"
      >
        {children}
      </h1>
    </div>
  );
}

/**
 * Campo no estilo da referência — fundo cheio, sem borda, ícone à direita —
 * com o rótulo dentro do campo, que sobe ao focar ou preencher: o nome do
 * campo continua à vista depois de digitar (um placeholder sumiria).
 */
function IconField({
  id,
  label,
  icon: Icon,
  revelavel = false,
  error,
  children,
  type,
  ...props
}: {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Senha: troca o ícone por um botão de mostrar/ocultar. */
  revelavel?: boolean;
  error?: string;
  children?: React.ReactNode;
} & React.ComponentProps<"input">) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="text-left">
      <div className="group relative">
        <Input
          id={id}
          type={revelavel && visivel ? "text" : type}
          placeholder=" "
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="peer h-14 rounded-xl border-transparent bg-muted pb-1.5 pl-4 pr-12 pt-5 font-medium shadow-none hover:border-[var(--auth-brand)]/40 focus:border-[var(--auth-brand)] focus:bg-card"
          {...props}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-4 right-12 top-2 truncate text-xs font-medium text-muted-foreground transition-all duration-200 ease-out peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-[15px] peer-placeholder-shown:font-normal peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-primary"
        >
          {label}
        </label>
        {revelavel ? (
          <button
            type="button"
            onClick={() => setVisivel((v) => !v)}
            aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={visivel}
            className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
          >
            {visivel ? (
              <EyeOff className="size-[18px]" aria-hidden />
            ) : (
              <Eye className="size-[18px]" aria-hidden />
            )}
          </button>
        ) : (
          <Icon
            aria-hidden
            className="pointer-events-none absolute right-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
          />
        )}
      </div>
      {children}
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1.5 flex items-center gap-1.5 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Dentro de um `div` de propósito: a entrada em cascata do formulário anima os
 * filhos diretos, e a transição própria do botão (hover) a sobrescreveria — ele
 * apareceria antes dos outros, fora de sincronia.
 */
function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Button
        type="submit"
        size="lg"
        className="group/btn h-13 w-full rounded-xl bg-[var(--auth-brand)] text-base font-semibold text-[var(--auth-ink)] shadow-[0_10px_24px_-12px_rgb(58_213_152/0.9)] transition-[background-color,box-shadow,transform] duration-200 hover:bg-[color-mix(in_oklab,var(--auth-brand)_90%,black)] hover:shadow-[0_14px_28px_-12px_rgb(58_213_152/1)] active:scale-[0.99]"
        disabled={loading}
      >
        {children}
        {loading ? (
          <Loader2 className="ml-1 size-4 animate-spin" aria-hidden />
        ) : (
          <ArrowRight
            className="ml-1 size-4 transition-transform duration-200 group-hover/btn:translate-x-0.5"
            aria-hidden
          />
        )}
      </Button>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  // No `div` pelo mesmo motivo do botão: a animação de entrada do aviso brigaria
  // com a da cascata.
  return (
    <div>
      <p
        role="alert"
        className="flex items-start gap-2 rounded-xl bg-destructive-soft px-3.5 py-3 text-left text-sm font-medium text-destructive animate-in fade-in slide-in-from-top-1 duration-200"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {children}
      </p>
    </div>
  );
}

function Divisor({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      {children}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleButton({
  ativo,
  texto,
  onError,
}: {
  ativo: boolean;
  texto: "signin_with" | "signup_with";
  onError: (mensagem: string) => void;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    const res = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (res.error) {
      onError("Não foi possível entrar com o Google.");
      setLoading(false);
    }
  };

  // Só o formulário à vista monta o botão: o Google guarda uma configuração
  // por página, e dois botões vivos disputariam o mesmo `initialize`.
  if (!ativo) return <div className="min-h-11" />;

  // Botão oficial do Google; o redirecionamento do Supabase fica de reserva.
  return (
    <GoogleSignIn
      texto={texto}
      onSuccess={() => void navigate({ to: "/", replace: true })}
      onError={onError}
      fallback={
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-lg text-base"
          onClick={signIn}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <GoogleIcon />}
          Continuar com Google
        </Button>
      }
    />
  );
}

/**
 * Força da senha.
 *
 * O mínimo é 8 caracteres, mas a barra mostra o que ainda dá para melhorar sem
 * transformar isso em obstáculo: nenhuma regra bloqueia o cadastro além do
 * comprimento. Exigir símbolo e maiúscula produz senhas piores, anotadas em
 * papel, não melhores.
 */
function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;

  const criterios = [
    value.length >= 8,
    value.length >= 12,
    /[a-z]/.test(value) && /[A-Z]/.test(value),
    /\d/.test(value) || /[^A-Za-z0-9]/.test(value),
  ];
  const nivel = criterios.filter(Boolean).length;
  const rotulos = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];

  return (
    <div className="flex items-center gap-2 pt-1.5">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < nivel
                ? nivel <= 1
                  ? "bg-destructive"
                  : nivel <= 2
                    ? "bg-chart-4"
                    : "bg-primary"
                : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="w-20 text-right text-xs text-muted-foreground">{rotulos[nivel]}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.12A6.98 6.98 0 015.5 12c0-.74.13-1.45.34-2.12V7.04H2.18A11 11 0 001 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}
