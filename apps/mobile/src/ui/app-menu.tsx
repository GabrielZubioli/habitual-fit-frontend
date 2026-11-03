import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { fetchProfile } from "@forja/app-core/data/profile";
import { initialsFrom, resolveAvatarUrl } from "@forja/app-core/data/avatar";
import { useSession } from "@/lib/session";
import { router, type Href } from "expo-router";
import { __iconNode as chartColumn } from "lucide-react/dist/esm/icons/chart-column.js";
import { __iconNode as heartPulse } from "lucide-react/dist/esm/icons/heart-pulse.js";
import { __iconNode as list } from "lucide-react/dist/esm/icons/list.js";
import { __iconNode as bookOpen } from "lucide-react/dist/esm/icons/book-open.js";
import { __iconNode as target } from "lucide-react/dist/esm/icons/target.js";
import { __iconNode as dumbbell } from "lucide-react/dist/esm/icons/dumbbell.js";
import { __iconNode as utensils } from "lucide-react/dist/esm/icons/utensils.js";
import { __iconNode as shieldCheck } from "lucide-react/dist/esm/icons/shield-check.js";
import { __iconNode as chevronRight } from "lucide-react/dist/esm/icons/chevron-right.js";
import { __iconNode as moon } from "lucide-react/dist/esm/icons/moon.js";
import { __iconNode as sun } from "lucide-react/dist/esm/icons/sun.js";
import { useColor, useTheme } from "@/theme/theme";
import { Icon, type IconNode } from "./icon";
import { Sheet } from "./sheet";
import { Switch } from "./switch";
import { Text } from "./text";

/**
 * O Menu do web (`components/app-menu.tsx`): cartão do perfil, os dois
 * destaques ("estou evoluindo?") e o resto numa lista única.
 */
const DESTAQUES: { to: Href; label: string; hint: string; icon: IconNode }[] = [
  { to: "/stats", label: "Estatísticas", hint: "Sua evolução", icon: chartColumn },
  { to: "/body", label: "Progresso", hint: "Peso e medidas", icon: heartPulse },
];

const ITENS: { to: Href; label: string; icon: IconNode }[] = [
  { to: "/exercises", label: "Exercícios", icon: list },
  { to: "/recipes", label: "Receitas", icon: bookOpen },
  { to: "/settings?secao=metas", label: "Metas nutricionais", icon: target },
  { to: "/settings?secao=treino", label: "Treino", icon: dumbbell },
  { to: "/settings?secao=alimentacao", label: "Alimentação", icon: utensils },
  { to: "/settings?secao=saude", label: "Saúde", icon: heartPulse },
  { to: "/settings?secao=conta", label: "Dados e conta", icon: shieldCheck },
];

export function AppMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { scheme, setMode } = useTheme();
  const primaria = useColor("primary");
  const apagada = useColor("muted-foreground");
  const ir = (to: Href) => {
    onClose();
    router.push(to);
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <ScrollView contentContainerClassName="px-4 pb-5 pt-2">
        <CartaoPerfil onPress={() => ir("/profile")} />

        <View className="mt-3 flex-row gap-2.5">
          {DESTAQUES.map((d) => (
            <Pressable
              key={d.label}
              onPress={() => ir(d.to)}
              className="flex-1 gap-3 rounded-[20px] border border-border bg-card p-4 active:scale-[0.98]"
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Icon node={d.icon} color={primaria} size={20} />
              </View>
              <View>
                <Text className="font-bold">{d.label}</Text>
                <Text className="text-xs text-muted-foreground">{d.hint}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View className="mt-3 overflow-hidden rounded-[20px] border border-border bg-card">
          {ITENS.map((it) => (
            <Pressable
              key={it.label}
              onPress={() => ir(it.to)}
              className="flex-row items-center gap-3 border-b border-border/60 px-4 py-3 active:bg-elevated"
            >
              <Icon node={it.icon} color={apagada} size={20} />
              <Text className="flex-1 font-medium">{it.label}</Text>
              <Icon node={chevronRight} color={apagada} size={16} />
            </Pressable>
          ))}
          <View className="flex-row items-center gap-3 px-4 py-2.5">
            <Icon node={scheme === "dark" ? moon : sun} color={apagada} size={20} />
            <Text className="flex-1 font-medium">Modo escuro</Text>
            <Switch
              checked={scheme === "dark"}
              onCheckedChange={(v) => setMode(v ? "dark" : "light")}
              accessibilityLabel="Modo escuro"
            />
          </View>
        </View>
      </ScrollView>
    </Sheet>
  );
}

/** O cartão verde do topo: foto (ou iniciais), nome e o atalho para o Perfil. */
function CartaoPerfil({ onPress }: { onPress: () => void }) {
  const session = useSession();
  const perfil = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: fetchProfile,
  });
  const nome = perfil.data?.display_name?.trim() || "Seu perfil";
  const [foto, setFoto] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    void resolveAvatarUrl(perfil.data?.avatar_url ?? null).then((u) => ativo && setFoto(u));
    return () => {
      ativo = false;
    };
  }, [perfil.data?.avatar_url]);

  return (
    <Pressable
      onPress={onPress}
      className="relative flex-row items-center gap-4 overflow-hidden rounded-3xl bg-[#01D798] p-4"
    >
      <View className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/20" />
      <View className="absolute -bottom-12 right-16 h-24 w-24 rounded-full bg-black/10" />
      {/* `ring-4 ring-white/40` do web: anel de 4 px por fora do círculo de 56.
          Cor já misturada (branco 40% sobre #01D798): com transparência, a
          borda seria composta sobre o fundo preto do próprio círculo. */}
      <View className="-m-1 h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-[#67E7C1] bg-[#020306]">
        {foto ? (
          <Image source={{ uri: foto }} className="h-full w-full" onError={() => setFoto(null)} />
        ) : (
          <Text className="text-lg font-bold text-[#01D798]">
            {initialsFrom(perfil.data?.display_name, session?.user.email)}
          </Text>
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-xl font-extrabold text-[#020306]">
          {nome}
        </Text>
        <Text className="text-sm font-medium text-[#020306]/70">Ver perfil</Text>
      </View>
      <Icon node={chevronRight} color="#020306" />
    </Pressable>
  );
}
