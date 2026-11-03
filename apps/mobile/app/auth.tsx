import { useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, TextInput, View, type TextInputProps } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Path, Svg } from "react-native-svg";
import { z } from "zod";
import { __iconNode as arrowRight } from "lucide-react/dist/esm/icons/arrow-right.js";
import { __iconNode as circleAlert } from "lucide-react/dist/esm/icons/circle-alert.js";
import { __iconNode as eye } from "lucide-react/dist/esm/icons/eye.js";
import { __iconNode as eyeOff } from "lucide-react/dist/esm/icons/eye-off.js";
import { __iconNode as lock } from "lucide-react/dist/esm/icons/lock.js";
import { __iconNode as mail } from "lucide-react/dist/esm/icons/mail.js";
import { __iconNode as user } from "lucide-react/dist/esm/icons/user.js";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { GOOGLE_WEB_CLIENT_ID } from "@forja/app-core/lib/google";
import { supabase } from "@/lib/supabase";
import { recuperandoSenha } from "@/lib/recuperacao";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { BrandSymbol } from "@/ui/brand-symbol";
import { Icon, type IconNode } from "@/ui/icon";
import { Punho } from "@/ui/punho";
import { Text } from "@/ui/text";

/**
 * Entrar e criar conta, na mesma tela — o `routes/auth.tsx` do web, no layout
 * de celular do `.auth-flip` (styles.css): painel verde com 30% da altura, o
 * formulário nos outros 70%, e a "bolha" verde que desce de um lado para o
 * outro na troca. Os dois formulários ficam montados: o que já foi digitado
 * não se perde.
 *
 * Depois de entrar, a raiz decide o destino: com plano, o Início; sem, o
 * questionário.
 */

type Modo = "login" | "signup";

// ponytail: termos e privacidade abrem no site; viram telas nativas na fase 6.
const SITE = "https://habitualfit.zubion.com.br";

/** Cores próprias da tela (`--auth-brand` e `--auth-ink` no web). */
const BRAND = "#3ad598";
const INK = "#04261a";

/** Curvas do web (`--auth-in`, `--auth-out`, `--auth-move`). */
const EASE_IN = Easing.bezier(0.55, 0, 0.75, 0.2);
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_MOVE = Easing.bezier(0.76, 0, 0.24, 1);

const emailSchema = z.string().trim().email("Informe um e-mail válido").max(255);
const loginPassSchema = z.string().min(1, "Informe sua senha").max(72);
const nameSchema = z.string().trim().min(2, "Informe seu nome").max(60);
const newPassSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres")
  .max(72)
  .regex(/[A-Za-z]/, "Use pelo menos uma letra")
  .regex(/[0-9]/, "Use pelo menos um número");

export default function AuthPage() {
  const params = useLocalSearchParams<{ modo?: string }>();
  const [modo, setModo] = useState<Modo>(params.modo === "cadastro" ? "signup" : "login");
  // Aqui para o cadastro poder mandar o e-mail já existente para o login.
  const [loginEmail, setLoginEmail] = useState("");
  // Altura medida uma vez, sem teclado: com o teclado aberto a tela encolhe e
  // o painel subiria por cima dos campos (o `useAlturaSemTeclado` do web).
  const [tela, setTela] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && !recuperandoSenha()) router.replace("/");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 0 = login, 1 = cadastro.
  const p = useSharedValue(modo === "signup" ? 1 : 0);
  const loginVisivel = useSharedValue(modo === "login" ? 1 : 0);
  const cadastroVisivel = useSharedValue(modo === "signup" ? 1 : 0);
  const painelLogin = useSharedValue(modo === "login" ? 1 : 0);
  const painelCadastro = useSharedValue(modo === "signup" ? 1 : 0);

  const trocar = (novo: Modo) => {
    setModo(novo);
    const alvo = novo === "signup" ? 1 : 0;
    p.value = withTiming(alvo, { duration: 1100, easing: EASE_MOVE });
    // Campos: saem juntos e rápido; entram quando a bolha libera a metade.
    const sai = { duration: 200, easing: EASE_IN };
    const entra = withDelay(600, withTiming(1, { duration: 500, easing: EASE_OUT }));
    loginVisivel.value = novo === "login" ? entra : withTiming(0, sai);
    cadastroVisivel.value = novo === "signup" ? entra : withTiming(0, sai);
    // Painéis: o que sai recua sem atraso; o que entra espera a bolha chegar.
    const painelSai = withTiming(0, { duration: 500, easing: EASE_IN });
    const painelEntra = withDelay(500, withTiming(1, { duration: 700, easing: EASE_OUT }));
    painelLogin.value = novo === "login" ? painelEntra : painelSai;
    painelCadastro.value = novo === "signup" ? painelEntra : painelSai;
  };

  const H = tela?.h ?? 0;
  const W = tela?.w ?? 0;
  const raio = 0.2 * W; // 20vw

  // A bolha: 300% da altura, de -270% (só os 30% de cima à vista) a 70%.
  const bolha = useAnimatedStyle(() => ({
    transform: [{ translateY: -2.7 * H + p.value * 3.4 * H }],
  }));
  const formLogin = useAnimatedStyle(() => ({ opacity: loginVisivel.value }));
  const formCadastro = useAnimatedStyle(() => ({ opacity: cadastroVisivel.value }));
  const estiloPainelLogin = useAnimatedStyle(() => ({
    opacity: painelLogin.value,
    transform: [{ translateY: interpolate(painelLogin.value, [0, 1], [-0.45 * 0.3 * H, 0]) }],
  }));
  const estiloPainelCadastro = useAnimatedStyle(() => ({
    opacity: painelCadastro.value,
    transform: [{ translateY: interpolate(painelCadastro.value, [0, 1], [0.45 * 0.3 * H, 0]) }],
  }));

  return (
    <ScrollView
      className="flex-1 bg-card"
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!!tela}
      onLayout={(e) => {
        if (!tela) setTela({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
      }}
    >
      {tela ? (
        <View style={{ height: H }} className="overflow-hidden">
          {/* Formulários: o do login embaixo (70%), o do cadastro em cima. */}
          <Animated.View
            pointerEvents={modo === "login" ? "auto" : "none"}
            style={[{ position: "absolute", top: 0.3 * H, height: 0.7 * H, width: W }, formLogin]}
          >
            <Formulario>
              <SignInForm email={loginEmail} setEmail={setLoginEmail} />
            </Formulario>
          </Animated.View>
          <Animated.View
            pointerEvents={modo === "signup" ? "auto" : "none"}
            style={[{ position: "absolute", top: 0, height: 0.7 * H, width: W }, formCadastro]}
          >
            <Formulario topo>
              <SignUpForm
                irParaLogin={(email) => {
                  setLoginEmail(email);
                  trocar("login");
                }}
              />
            </Formulario>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: 0,
                width: W,
                height: 3 * H,
                borderRadius: raio,
                backgroundColor: BRAND,
              },
              bolha,
            ]}
          />

          <Animated.View
            pointerEvents={modo === "login" ? "auto" : "none"}
            style={[
              {
                position: "absolute",
                top: 0,
                width: W,
                height: 0.3 * H,
                borderBottomLeftRadius: raio,
                borderBottomRightRadius: raio,
              },
              estiloPainelLogin,
            ]}
          >
            <Painel
              lado="topo"
              largura={W}
              titulo="Novo por aqui?"
              botao="Criar conta"
              onPress={() => trocar("signup")}
            />
          </Animated.View>
          <Animated.View
            pointerEvents={modo === "signup" ? "auto" : "none"}
            style={[
              {
                position: "absolute",
                bottom: 0,
                width: W,
                height: 0.3 * H,
                borderTopLeftRadius: raio,
                borderTopRightRadius: raio,
              },
              estiloPainelCadastro,
            ]}
          >
            <Painel
              lado="base"
              largura={W}
              titulo="Já tem conta?"
              botao="Entrar"
              onPress={() => trocar("login")}
            />
          </Animated.View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Formulario({ children, topo = false }: { children: ReactNode; topo?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: topo ? Math.max(24, insets.top + 8) : 24,
        paddingBottom: 28,
      }}
    >
      {children}
    </ScrollView>
  );
}

function Painel({
  lado,
  largura,
  titulo,
  botao,
  onPress,
}: {
  lado: "topo" | "base";
  largura: number;
  titulo: string;
  botao: string;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  // A mão na largura do painel, base rente à borda (no painel de cima, de
  // cabeça para baixo, vindo de cima). As pontas dos dedos ficam cortadas.
  const alturaMao = (largura * 870) / 1092;
  return (
    <View
      className="flex-1 items-center justify-center overflow-hidden px-6"
      style={lado === "topo" ? { paddingTop: insets.top } : undefined}
    >
      <View
        pointerEvents="none"
        style={[
          { position: "absolute", left: 0, opacity: 0.12 },
          lado === "topo" ? { top: 0, transform: [{ rotate: "180deg" }] } : { bottom: 0 },
        ]}
      >
        <Punho width={largura} height={alturaMao} cor={INK} />
      </View>
      <Pressable onPress={() => router.replace("/")} accessibilityLabel="Habitual Fit — início">
        <BrandSymbol width={56} escuro />
      </Pressable>
      <Text className="mt-2 text-xl font-bold tracking-tight" style={{ color: INK }}>
        {titulo}
      </Text>
      <Pressable
        onPress={onPress}
        className="mt-3 h-12 min-w-[168px] flex-row items-center justify-center gap-2 rounded-full border-2 px-6 active:scale-[0.97]"
        style={{ borderColor: INK }}
      >
        <Text className="font-semibold" style={{ color: INK }}>
          {botao}
        </Text>
        <Icon node={arrowRight} color={INK} size={16} />
      </Pressable>
    </View>
  );
}

function SignInForm({ email, setEmail }: { email: string; setEmail: (v: string) => void }) {
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [erro, setErro] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
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
      return router.push({ pathname: "/confirme-email", params: { email: em.data } });
    }
    // Mensagem genérica de propósito: não confirma a terceiros quem tem conta.
    setErro(errorMessage(error));
  };

  return (
    <View className="gap-3">
      <Cabecalho>Entrar na sua conta</Cabecalho>
      <GoogleButton texto="Fazer login com o Google" onError={setErro} />
      <Divisor>ou com e-mail</Divisor>

      <IconField
        label="E-mail"
        icon={mail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <IconField
        label="Senha"
        icon={lock}
        revelavel
        error={errors.password}
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />

      <View className="items-end">
        <Text
          className="text-sm font-medium text-muted-foreground"
          onPress={() =>
            router.push({ pathname: "/esqueci-senha", params: { email: email.trim() } })
          }
        >
          Esqueceu sua senha?
        </Text>
      </View>

      {erro ? <Aviso>{erro}</Aviso> : null}

      <SubmitButton loading={loading} onPress={submit}>
        Entrar
      </SubmitButton>
    </View>
  );
}

function SignUpForm({ irParaLogin }: { irParaLogin: (email: string) => void }) {
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

  const submit = async () => {
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
      // O link de confirmação abre o site, que leva ao questionário.
      options: { emailRedirectTo: "https://habitualfit.zubion.com.br/", data: { name: nm.data } },
    });
    setLoading(false);

    // Conta já existente: com a confirmação desligada vem o erro; ligada, o
    // Supabase devolve um usuário sem identidades. Nos dois casos, o aviso.
    if (
      error?.code === "user_already_exists" ||
      /already registered/i.test(error?.message ?? "") ||
      (!error && data.user?.identities?.length === 0)
    ) {
      return setContaExiste(em.data);
    }
    if (error) return setErro(errorMessage(error));

    // Confirmação desligada no projeto: já veio sessão, segue para o questionário.
    if (data.session) return router.replace("/");
    router.push({ pathname: "/confirme-email", params: { email: em.data } });
  };

  return (
    <View className="gap-3">
      <Cabecalho>Criar sua conta</Cabecalho>
      <GoogleButton texto="Inscrever-se no Google" onError={setErro} />
      <Divisor>ou com e-mail</Divisor>

      <IconField
        label="Nome"
        icon={user}
        error={errors.name}
        autoComplete="given-name"
        value={name}
        onChangeText={setName}
      />
      <IconField
        label="E-mail"
        icon={mail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setContaExiste(null);
        }}
      />
      <IconField
        label="Senha (mín. 8 caracteres)"
        icon={lock}
        revelavel
        error={errors.password}
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      >
        <PasswordStrength value={password} />
      </IconField>
      <IconField
        label="Confirme a senha"
        icon={lock}
        revelavel
        error={errors.confirm}
        autoComplete="new-password"
        value={confirm}
        onChangeText={setConfirm}
        onSubmitEditing={submit}
      />

      {contaExiste ? (
        <View className="rounded-2xl border border-primary/40 bg-primary/10 p-4" role="alert">
          <Text className="font-semibold">Este e-mail já tem uma conta</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            <Text className="text-sm font-medium">{contaExiste}</Text> já está cadastrado. Entre com
            ele ou recupere a senha.
          </Text>
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => irParaLogin(contaExiste)}
              className="h-11 flex-1 items-center justify-center rounded-xl bg-primary"
            >
              <Text className="text-sm font-medium text-primary-foreground">Entrar</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({ pathname: "/esqueci-senha", params: { email: contaExiste } })
              }
              className="h-11 flex-1 items-center justify-center rounded-xl border border-border bg-card"
            >
              <Text className="text-sm font-medium">Esqueci a senha</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {erro ? <Aviso>{erro}</Aviso> : null}

      <SubmitButton loading={loading} onPress={submit}>
        Criar conta
      </SubmitButton>

      <Text className="text-center text-xs leading-relaxed text-muted-foreground">
        Ao criar a conta, você aceita os{" "}
        <Text
          className="text-xs font-medium"
          onPress={() => void Linking.openURL(`${SITE}/termos`)}
        >
          Termos de Uso
        </Text>{" "}
        e a{" "}
        <Text
          className="text-xs font-medium"
          onPress={() => void Linking.openURL(`${SITE}/privacidade`)}
        >
          Política de Privacidade
        </Text>
        .
      </Text>
    </View>
  );
}

function Cabecalho({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      className="pb-2 text-center text-[32px] font-bold leading-tight tracking-tight"
    >
      {children}
    </Text>
  );
}

/**
 * Campo com fundo cheio, sem borda, ícone à direita e o rótulo dentro, que
 * sobe ao focar ou preencher (o `IconField` do web).
 */
function IconField({
  label,
  icon,
  revelavel = false,
  error,
  children,
  value,
  ...props
}: {
  label: string;
  icon: IconNode;
  /** Senha: troca o ícone por um botão de mostrar/ocultar. */
  revelavel?: boolean;
  error?: string;
  children?: ReactNode;
} & TextInputProps) {
  const [visivel, setVisivel] = useState(false);
  const [foco, setFoco] = useState(false);
  const apagada = useColor("muted-foreground");
  const primaria = useColor("primary");
  const destrutiva = useColor("destructive");
  const texto = useColor("foreground");
  const cheio = foco || !!value;

  return (
    <View>
      <View
        className={cn("h-14 justify-center rounded-xl border bg-muted", foco && "bg-card")}
        style={{ borderColor: foco ? BRAND : "transparent" }}
      >
        <Text
          numberOfLines={1}
          pointerEvents="none"
          className={cn(
            "absolute left-4 right-12",
            cheio ? "top-2 text-xs font-medium" : "text-[15px] font-normal",
            foco ? "text-primary" : "text-muted-foreground",
          )}
        >
          {label}
        </Text>
        <TextInput
          value={value}
          secureTextEntry={revelavel && !visivel}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          accessibilityLabel={label}
          className="h-14 pb-1.5 pl-4 pr-12 pt-5 font-sans text-base font-semibold text-foreground"
          style={{ color: texto }}
          {...props}
        />
        {revelavel ? (
          <Pressable
            onPress={() => setVisivel((v) => !v)}
            accessibilityLabel={visivel ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-2 h-10 w-10 items-center justify-center rounded-lg"
          >
            <Icon node={visivel ? eyeOff : eye} color={apagada} size={18} />
          </Pressable>
        ) : (
          <View pointerEvents="none" className="absolute right-4">
            <Icon node={icon} color={foco ? primaria : apagada} size={18} />
          </View>
        )}
      </View>
      {children}
      {error ? (
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <Icon node={circleAlert} color={destrutiva} size={14} />
          <Text className="text-sm text-destructive">{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SubmitButton({
  loading,
  onPress,
  children,
}: {
  loading: boolean;
  onPress: () => void;
  children: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
      className={cn(
        "h-[52px] w-full flex-row items-center justify-center gap-3 rounded-xl active:scale-[0.99]",
        loading && "opacity-50",
      )}
      style={{
        backgroundColor: BRAND,
        shadowColor: BRAND,
        shadowOpacity: 0.9,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      }}
    >
      <Text className="text-base font-semibold" style={{ color: INK }}>
        {children}
      </Text>
      <Icon node={arrowRight} color={INK} size={16} />
    </Pressable>
  );
}

function Aviso({ children }: { children: string }) {
  const destrutiva = useColor("destructive");
  return (
    <View
      role="alert"
      className="flex-row items-start gap-2 rounded-xl bg-destructive-soft px-3.5 py-3"
    >
      <View className="mt-0.5">
        <Icon node={circleAlert} color={destrutiva} size={16} />
      </View>
      <Text className="flex-1 text-sm font-medium text-destructive">{children}</Text>
    </View>
  );
}

function Divisor({ children }: { children: string }) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <View className="h-px flex-1 bg-border" />
      <Text className="text-xs text-muted-foreground">{children}</Text>
      <View className="h-px flex-1 bg-border" />
    </View>
  );
}

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

/**
 * O botão do Google, no formato do botão oficial que o web mostra.
 *
 * Login nativo: a conta é escolhida na folha do próprio Android, o Google
 * entrega um ID token e o Supabase abre a sessão com ele — o mesmo
 * `signInWithIdToken` do web. Sucesso: `onAuthStateChange` redireciona.
 *
 * DEVELOPER_ERROR é o Google recusando o app: o SHA-1 de quem assinou o APK não
 * está num cliente Android do Google Cloud (ver apps/mobile/README.md).
 */
function GoogleButton({ texto, onError }: { texto: string; onError: (m: string) => void }) {
  const [entrando, setEntrando] = useState(false);

  async function entrar() {
    setEntrando(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const r = await GoogleSignin.signIn();
      if (!isSuccessResponse(r)) return; // a pessoa fechou a escolha de conta
      const token = r.data.idToken;
      if (!token) throw new Error("sem idToken");
      const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token });
      if (error) onError(errorMessage(error));
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return;
      if (isErrorWithCode(e) && e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        onError("Este aparelho não tem o Google Play Services. Entre com seu e-mail.");
        return;
      }
      console.error("[google] login falhou:", e);
      onError("Não foi possível entrar com o Google. Tente de novo ou use seu e-mail.");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <View className="h-12 items-center pt-1">
      <Pressable
        onPress={() => void entrar()}
        disabled={entrando}
        accessibilityState={{ busy: entrando }}
        className={cn(
          "h-10 flex-row items-center gap-3 rounded-full bg-[#131314] pl-1 pr-4",
          entrando && "opacity-60",
        )}
      >
        <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
          <GoogleIcon />
        </View>
        <Text className="text-sm font-medium text-[#e3e3e3]">{texto}</Text>
      </Pressable>
    </View>
  );
}

/** Força da senha: mostra o que dá para melhorar sem virar obstáculo. */
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
    <View className="flex-row items-center gap-2 pt-1.5">
      <View className="flex-1 flex-row gap-1">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
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
      </View>
      <Text className="w-20 text-right text-xs text-muted-foreground">{rotulos[nivel]}</Text>
    </View>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.12A6.98 6.98 0 015.5 12c0-.74.13-1.45.34-2.12V7.04H2.18A11 11 0 001 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </Svg>
  );
}
