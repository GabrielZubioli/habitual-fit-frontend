import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { initialsFrom, resolveAvatarUrl, uploadAvatarData } from "@forja/app-core/data/avatar";
import { updateProfile } from "@forja/app-core/data/profile";
import { queryKeys } from "@forja/app-core/data/query-keys";
import { errorMessage } from "@forja/app-core/data/supabase-helpers";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";
import { useColor } from "@/theme/theme";
import { Text } from "./text";

/** A URL assinada da foto (ou `null`): resolvida de novo quando o caminho muda. */
export function useAvatarUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    void resolveAvatarUrl(path ?? null).then((u) => ativo && setUrl(u));
    return () => {
      ativo = false;
    };
  }, [path]);
  return [url, setUrl] as const;
}

/**
 * Avatar com troca de foto — o `profile/avatar-picker.tsx` do web. A foto vem
 * da câmera ou da galeria, pelas telas do próprio sistema, já recortada em
 * quadrado (o avatar é redondo: um retrato inteiro sairia cortado).
 */
export function AvatarPicker({
  path,
  name,
  profileId,
  onError,
  className,
}: {
  path: string | null;
  name: string | null;
  profileId: string;
  onError: (mensagem: string) => void;
  className?: string;
}) {
  const qc = useQueryClient();
  const session = useSession();
  const [url, setUrl] = useAvatarUrl(path);
  const fundo = useColor("background");

  const enviar = useMutation({
    mutationFn: async (uri: string) => {
      const bytes = await (await fetch(uri)).arrayBuffer();
      const caminho = await uploadAvatarData(profileId, bytes, "image/jpeg", "jpg");
      await updateProfile(profileId, { avatar_url: caminho }, "salvar foto de perfil");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.profile() }),
    onError: (e) => onError(errorMessage(e)),
  });

  async function escolher(origem: "camera" | "galeria") {
    const opcoes: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    };
    if (origem === "camera") {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) return onError("Permita o uso da câmera nas configurações do aparelho.");
    }
    const r =
      origem === "camera"
        ? await ImagePicker.launchCameraAsync({
            ...opcoes,
            cameraType: ImagePicker.CameraType.front,
          })
        : await ImagePicker.launchImageLibraryAsync(opcoes);
    const uri = r.assets?.[0]?.uri;
    if (!r.canceled && uri) enviar.mutate(uri);
  }

  return (
    <>
      <Pressable
        onPress={() =>
          Alert.alert("Foto de perfil", undefined, [
            { text: "Tirar foto", onPress: () => void escolher("camera") },
            { text: "Escolher da galeria", onPress: () => void escolher("galeria") },
            { text: "Cancelar", style: "cancel" },
          ])
        }
        disabled={enviar.isPending}
        accessibilityLabel={url ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
        className={cn(
          "items-center justify-center overflow-hidden rounded-full border border-border bg-primary-soft",
          className,
        )}
        style={{ borderColor: fundo }}
      >
        {url ? (
          <Image source={{ uri: url }} className="h-full w-full" onError={() => setUrl(null)} />
        ) : (
          <Text className="text-4xl font-semibold text-primary-soft-foreground">
            {initialsFrom(name, session?.user.email)}
          </Text>
        )}
        {enviar.isPending ? (
          <View className="absolute inset-0 items-center justify-center bg-foreground/55">
            <ActivityIndicator color={fundo} />
          </View>
        ) : null}
      </Pressable>
    </>
  );
}
