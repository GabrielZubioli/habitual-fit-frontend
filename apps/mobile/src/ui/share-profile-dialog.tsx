import { useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Share, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { __iconNode as lock } from "lucide-react/dist/esm/icons/lock.js";
import { __iconNode as share2 } from "lucide-react/dist/esm/icons/share-2.js";
import { __iconNode as x } from "lucide-react/dist/esm/icons/x.js";
import { initialsFrom } from "@forja/app-core/data/avatar";
import {
  OPCOES_PADRAO,
  conteudoCartao,
  numerosCartao,
  textoCartao,
  type ConteudoCartao,
  type OpcoesCartao,
  type PerfilPublicavel,
} from "@forja/app-core/lib/share-profile";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { useAvatarUrl } from "./avatar";
import { Button } from "./button";
import { Icon } from "./icon";
import { Switch } from "./switch";
import { Text } from "./text";

/**
 * Compartilhar o perfil — o `profile/share-profile-dialog.tsx` do web: as
 * mesmas opções e a prévia do cartão, enviada como imagem (a própria prévia,
 * capturada em PNG). Se a captura falhar, vai o cartão em texto.
 */
const VERDE = "#01D798";
const FUNDO = "#020306";
const BLOCO = "#12171E";
const APAGADO = "#9AA3AE";

export function ShareProfileDialog({
  open,
  onClose,
  perfil,
  avatarPath,
}: {
  open: boolean;
  onClose: () => void;
  perfil: Omit<PerfilPublicavel, "fotoUrl">;
  avatarPath: string | null;
}) {
  const [opcoes, setOpcoes] = useState<OpcoesCartao>(OPCOES_PADRAO);
  const [fotoUrl] = useAvatarUrl(open ? avatarPath : null);
  const apagada = useColor("muted-foreground");
  const branco = useColor("primary-foreground");
  const c = conteudoCartao({ ...perfil, fotoUrl }, opcoes);
  const cartao = useRef<View>(null);
  const [enviando, setEnviando] = useState(false);

  async function compartilhar() {
    setEnviando(true);
    try {
      // 1080 px de largura: nítido no story e no feed, como a imagem do web.
      const uri = await captureRef(cartao, { format: "png", result: "tmpfile", width: 1080 });
      if (!(await Sharing.isAvailableAsync())) throw new Error("sem compartilhamento");
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Meu perfil no Habitual Fit",
      });
    } catch {
      await Share.share({ message: textoCartao(c), title: "Meu perfil no Habitual Fit" });
    } finally {
      setEnviando(false);
    }
  }

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
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable className="flex-1 items-center justify-center bg-black/80 px-4" onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          className="max-h-[92%] w-full max-w-md overflow-hidden rounded-[28px] border border-border bg-background"
        >
          <ScrollView contentContainerClassName="gap-4 p-6">
            <View className="pr-8">
              <Text className="text-xl font-bold">Compartilhar perfil</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Escolha o que entra no cartão e confira a prévia antes de enviar.
              </Text>
            </View>

            <View ref={cartao} collapsable={false} className="w-full max-w-[256px] self-center">
              <Cartao c={c} />
            </View>

            <View className="rounded-2xl bg-card">
              {itens
                .filter((i) => i.existe)
                .map((i, k) => (
                  <View
                    key={i.k}
                    className={cn(
                      "flex-row items-center gap-3 px-4 py-3",
                      k > 0 && "border-t border-border/60",
                    )}
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-semibold">{i.rotulo}</Text>
                      {i.dica ? (
                        <Text className="text-xs text-muted-foreground">{i.dica}</Text>
                      ) : null}
                    </View>
                    <Switch
                      checked={opcoes[i.k]}
                      onCheckedChange={(v) => setOpcoes((o) => ({ ...o, [i.k]: v }))}
                      accessibilityLabel={i.rotulo}
                    />
                  </View>
                ))}
            </View>

            <View className="flex-row gap-2">
              <Icon node={lock} color={apagada} size={14} />
              <Text className="flex-1 text-xs leading-snug text-muted-foreground">
                Seu perfil não fica público: só este resumo sai do app, quando você enviar. E-mail,
                dados da conta, medidas e peso nunca entram no cartão.
              </Text>
            </View>

            <Button
              className="h-12 rounded-xl"
              loading={enviando}
              onPress={() => void compartilhar()}
            >
              <Icon node={share2} color={branco} size={16} />
              <Text className="text-base font-bold text-primary-foreground">Compartilhar</Text>
            </Button>
          </ScrollView>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Fechar"
            className="absolute right-4 top-4 h-8 w-8 items-center justify-center rounded-full"
          >
            <Icon node={x} color={apagada} size={18} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A prévia: o mesmo desenho do cartão do web (4:5, fundo escuro, faixa verde). */
function Cartao({ c }: { c: ConteudoCartao }) {
  const numeros = numerosCartao(c);
  return (
    <View
      className="aspect-[4/5] w-full max-w-[256px] self-center overflow-hidden rounded-2xl border border-border"
      style={{ backgroundColor: FUNDO }}
    >
      <View className="h-1.5" style={{ backgroundColor: VERDE }} />
      <View className="flex-1 items-center px-4 pt-4">
        <Text
          className="self-start text-[9px] font-extrabold tracking-[2px]"
          style={{ color: VERDE }}
        >
          HABITUAL FIT
        </Text>
        <View
          className="mt-3 h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2"
          style={{ backgroundColor: BLOCO, borderColor: VERDE }}
        >
          {c.fotoUrl ? (
            <Image source={{ uri: c.fotoUrl }} className="h-full w-full" />
          ) : (
            <Text className="text-2xl font-extrabold" style={{ color: VERDE }}>
              {initialsFrom(c.nome)}
            </Text>
          )}
        </View>
        <Text numberOfLines={1} className="mt-2 text-lg font-extrabold text-white">
          {c.nome}
        </Text>
        {c.objetivo ? (
          <View className="mt-1.5 rounded-full px-3 py-0.5" style={{ backgroundColor: VERDE }}>
            <Text className="text-[10px] font-bold" style={{ color: FUNDO }}>
              {c.objetivo}
            </Text>
          </View>
        ) : null}
        {numeros.length ? (
          <View className="mt-3 w-full flex-row gap-1.5">
            {numeros.map((n) => (
              <View
                key={n.rotulo}
                className="flex-1 items-center rounded-xl py-2"
                style={{ backgroundColor: BLOCO }}
              >
                <Text className="text-xl font-extrabold text-white">{n.valor}</Text>
                <Text
                  numberOfLines={1}
                  className="text-[8px] font-semibold"
                  style={{ color: APAGADO }}
                >
                  {n.rotulo}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {c.recordes.length ? (
          <View className="mt-3 w-full">
            <Text className="text-[9px] font-extrabold" style={{ color: VERDE }}>
              RECORDES
            </Text>
            {c.recordes.map((r) => (
              <View key={r.exerciseName} className="mt-1 flex-row justify-between gap-2">
                <Text numberOfLines={1} className="flex-1 text-[10px] font-bold text-white">
                  {r.exerciseName}
                </Text>
                <Text className="text-[10px] font-bold" style={{ color: APAGADO }}>
                  {r.weightKg.toLocaleString("pt-BR")} kg × {r.reps}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text className="absolute bottom-3 text-[8px] font-semibold" style={{ color: APAGADO }}>
          Treinando com o Habitual Fit
        </Text>
      </View>
    </View>
  );
}
