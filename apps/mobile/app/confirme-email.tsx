import { useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { __iconNode as mailCheck } from "lucide-react/dist/esm/icons/mail-check.js";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { supabase } from "@/lib/supabase";
import { useColor } from "@/theme/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Text } from "@/ui/text";

/** O `routes/confirme-email.tsx` do web: o e-mail vem por parâmetro para poder reenviar. */
export default function ConfirmeEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [resending, setResending] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const primaria = useColor("primary");

  const resend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: "https://habitualfit.zubion.com.br/" },
    });
    setResending(false);
    if (error) return setMensagem({ ok: false, texto: errorMessage(error) });
    setSentAt(Date.now());
    setMensagem({ ok: true, texto: "E-mail reenviado." });
  };

  // O reenvio tem limite no Supabase: um minuto entre tentativas.
  const podeReenviar = !sentAt || Date.now() - sentAt > 60_000;

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Icon node={mailCheck} color={primaria} size={32} />
      </View>
      <Text className="mt-6 text-2xl font-bold tracking-tight">Confirme seu e-mail</Text>
      <Text className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
        Enviamos um link para{" "}
        {email ? <Text className="text-sm font-medium">{email}</Text> : "o seu e-mail"}. Toque no
        botão do e-mail para confirmar sua conta e montar seu plano.
      </Text>

      <View className="mt-8 w-full gap-3">
        {email ? (
          <Button
            variant="outline"
            className="h-12 w-full rounded-xl"
            onPress={resend}
            loading={resending}
            disabled={!podeReenviar}
          >
            {podeReenviar ? "Reenviar e-mail" : "Aguarde um minuto para reenviar"}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="h-12 w-full rounded-xl"
          onPress={() => router.replace("/auth")}
        >
          Já confirmei — entrar
        </Button>
      </View>

      {mensagem ? (
        <Text
          className={mensagem.ok ? "mt-4 text-sm text-primary" : "mt-4 text-sm text-destructive"}
        >
          {mensagem.texto}
        </Text>
      ) : null}
      <Text className="mt-6 text-xs text-muted-foreground">
        Não chegou? Verifique a caixa de spam ou de promoções.
      </Text>
    </View>
  );
}
