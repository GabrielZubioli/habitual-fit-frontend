import { useEffect, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { z } from "zod";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { supabase } from "@/lib/supabase";
import { lerLinkDeRecuperacao, recuperandoSenha } from "@/lib/recuperacao";
import { useColor } from "@/theme/theme";
import { BrandLogo } from "@/ui/brand-logo";
import { Button } from "@/ui/button";
import { Text } from "@/ui/text";

/**
 * O `routes/nova-senha.tsx` do web. O link do e-mail ("esqueci a senha" pedido
 * pelo app) abre `habitualfit://nova-senha#access_token=…&refresh_token=…`: a
 * sessão de recuperação vem no fragmento e é aberta aqui, à mão
 * (`detectSessionInUrl` não existe no nativo).
 */
const passSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres")
  .max(72)
  .regex(/[A-Za-z]/, "Use pelo menos uma letra")
  .regex(/[0-9]/, "Use pelo menos um número");

export default function NovaSenha() {
  const url = Linking.useURL();
  const [estado, setEstado] = useState<"verificando" | "pronto" | "invalido">("verificando");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erros, setErros] = useState<{ senha?: string; confirma?: string; geral?: string }>({});
  const [salvando, setSalvando] = useState(false);
  const apagada = useColor("muted-foreground");
  const texto = useColor("foreground");

  useEffect(() => {
    if (!url) return;
    const link = lerLinkDeRecuperacao(url);
    if (link.erro || !link.access || !link.refresh) return setEstado("invalido");
    recuperandoSenha(true);
    void supabase.auth
      .setSession({ access_token: link.access, refresh_token: link.refresh })
      .then(({ error }) => setEstado(error ? "invalido" : "pronto"));
  }, [url]);

  // Sair da tela (salvando ou não) devolve os redirecionamentos normais.
  useEffect(() => () => void recuperandoSenha(false), []);

  const salvar = async () => {
    const pw = passSchema.safeParse(senha);
    const next: typeof erros = {};
    if (!pw.success) next.senha = pw.error.issues[0]?.message;
    else if (senha !== confirma) next.confirma = "As senhas não são iguais";
    setErros(next);
    if (next.senha || next.confirma) return;

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) return setErros({ geral: errorMessage(error) });
    recuperandoSenha(false);
    router.replace("/");
  };

  const campo = (
    valor: string,
    mudar: (v: string) => void,
    rotulo: string,
    erro: string | undefined,
  ) => (
    <View className="gap-1.5">
      <Text className="text-sm font-medium">{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={mudar}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        accessibilityLabel={rotulo}
        placeholderTextColor={apagada}
        className="h-12 rounded-xl border border-input bg-card px-3 font-sans text-base"
        style={{ color: texto }}
      />
      {erro ? <Text className="text-sm text-destructive">{erro}</Text> : null}
    </View>
  );

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow justify-center px-6 py-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="mb-8 items-center">
        <BrandLogo height={56} />
      </View>

      {estado === "invalido" ? (
        <View className="items-center">
          <Text className="text-center text-2xl font-bold tracking-tight">Link inválido</Text>
          <Text className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
            O link de redefinição vale por 1 hora e só pode ser usado uma vez. Peça um novo para
            continuar.
          </Text>
          <Button
            className="mt-8 h-12 w-full rounded-xl"
            onPress={() => router.replace("/esqueci-senha")}
          >
            Pedir um novo link
          </Button>
        </View>
      ) : (
        <View>
          <Text className="text-center text-2xl font-bold tracking-tight">Crie uma nova senha</Text>
          <Text className="mt-2 text-center text-sm text-muted-foreground">
            Use pelo menos 8 caracteres, com letras e números.
          </Text>
          <View className="mt-8 gap-3.5">
            {campo(senha, setSenha, "Nova senha", erros.senha)}
            {campo(confirma, setConfirma, "Confirme a nova senha", erros.confirma)}
            {erros.geral ? <Text className="text-sm text-destructive">{erros.geral}</Text> : null}
            <Button
              size="lg"
              className="h-14 w-full rounded-2xl"
              textClassName="text-base font-semibold"
              loading={salvando || estado === "verificando"}
              onPress={salvar}
            >
              Salvar nova senha
            </Button>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
