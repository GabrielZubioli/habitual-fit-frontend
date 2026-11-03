import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { z } from "zod";
import { __iconNode as arrowLeft } from "lucide-react/dist/esm/icons/arrow-left.js";
import { __iconNode as mailCheck } from "lucide-react/dist/esm/icons/mail-check.js";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { supabase } from "@/lib/supabase";
import { useColor } from "@/theme/theme";
import { BrandLogo } from "@/ui/brand-logo";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Text } from "@/ui/text";

/** O `routes/esqueci-senha.tsx` do web. O link do e-mail abre o app (`nova-senha`). */
const emailSchema = z.string().trim().email("Informe um e-mail válido").max(255);

export default function EsqueciSenha() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [erro, setErro] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const primaria = useColor("primary");
  const apagada = useColor("muted-foreground");
  const texto = useColor("foreground");

  const submit = async () => {
    const em = emailSchema.safeParse(email);
    setErro(em.success ? undefined : em.error.issues[0]?.message);
    if (!em.success) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(em.data, {
      // O link abre o app (app/nova-senha.tsx), não o site.
      redirectTo: Linking.createURL("/nova-senha"),
    });
    setLoading(false);
    if (error) return setErro(errorMessage(error));
    // Mesma tela havendo conta ou não: não confirma a terceiros quem tem conta.
    setEnviadoPara(em.data);
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow justify-center px-6 py-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="mb-8 items-center">
        <BrandLogo height={56} />
      </View>

      {enviadoPara ? (
        <View className="items-center">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Icon node={mailCheck} color={primaria} size={32} />
          </View>
          <Text className="mt-6 text-2xl font-bold tracking-tight">Verifique seu e-mail</Text>
          <Text className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
            Se houver uma conta com <Text className="text-sm font-medium">{enviadoPara}</Text>,
            enviamos um link para criar uma nova senha. Ele vale por 1 hora.
          </Text>
          <Button
            variant="outline"
            className="mt-8 h-12 w-full rounded-xl"
            onPress={() => setEnviadoPara(null)}
          >
            Usar outro e-mail
          </Button>
          <Text className="mt-6 text-xs text-muted-foreground">
            Não chegou? Verifique a caixa de spam ou de promoções.
          </Text>
        </View>
      ) : (
        <View>
          <Text className="text-center text-2xl font-bold tracking-tight">Esqueceu a senha?</Text>
          <Text className="mt-2 text-center text-sm text-muted-foreground">
            Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
          </Text>
          <View className="mt-8 gap-3.5">
            <View className="gap-1.5">
              <Text className="text-sm font-medium">E-mail</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="voce@email.com"
                placeholderTextColor={apagada}
                accessibilityLabel="E-mail"
                onSubmitEditing={submit}
                className="h-12 rounded-xl border border-input bg-card px-3 font-sans text-base"
                style={{ color: texto }}
              />
              {erro ? <Text className="text-sm text-destructive">{erro}</Text> : null}
            </View>
            <Button
              size="lg"
              className="h-14 w-full rounded-2xl"
              textClassName="text-base font-semibold"
              loading={loading}
              onPress={submit}
            >
              Enviar link
            </Button>
          </View>
        </View>
      )}

      <Pressable
        onPress={() => router.replace("/auth")}
        className="mt-8 flex-row items-center justify-center gap-1.5"
      >
        <Icon node={arrowLeft} color={apagada} size={16} />
        <Text className="text-sm font-medium text-muted-foreground">Voltar para o login</Text>
      </Pressable>
    </ScrollView>
  );
}
