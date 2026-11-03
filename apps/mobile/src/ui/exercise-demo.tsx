import { useEffect, useState } from "react";
import { AccessibilityInfo, Image, Linking, Pressable, View } from "react-native";
import { __iconNode as imageOff } from "lucide-react/dist/esm/icons/image-off.js";
import { isSafeUrl, type ExerciseMedia } from "@forja/app-core/data/exercise-media";
import { cn } from "@/lib/cn";
import { useColor } from "@/theme/theme";
import { Icon } from "./icon";
import { Text } from "./text";
import { t } from "@forja/app-core/i18n";

/**
 * A demonstração do exercício — o `ExerciseDemo` do web: as fotos de início e
 * fim alternando a cada 0,9 s (tocar pausa), com os pontinhos de posição.
 * Sem imagem ou com erro, um quadro vazio com o ícone.
 */
export function ExerciseDemo({
  images,
  name,
  className,
  autoPlay = true,
}: {
  images: readonly string[];
  name: string;
  className?: string;
  autoPlay?: boolean;
}) {
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(autoPlay);
  const [reduzido, setReduzido] = useState(false);
  const apagada = useColor("muted-foreground");
  const temMultiplas = images.length > 1;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduzido);
  }, []);

  useEffect(() => {
    if (!playing || !temMultiplas || failed || reduzido) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % images.length), 900);
    return () => clearInterval(timer);
  }, [playing, temMultiplas, images.length, failed, reduzido]);

  if (images.length === 0 || failed) {
    return (
      <View
        accessibilityLabel={t("Sem demonstração disponível para {{name}}", { name })}
        className={cn(
          "aspect-[4/3] w-full items-center justify-center rounded-xl bg-muted",
          className,
        )}
      >
        <Icon node={imageOff} color={apagada} size={24} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => (temMultiplas ? setPlaying((p) => !p) : undefined)}
      accessibilityLabel={
        temMultiplas
          ? t("{{v0}} demonstração de {{name}}", { v0: playing ? "Pausar" : "Reproduzir", name })
          : t("Demonstração de {{name}}", { name })
      }
      className={cn("aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted", className)}
    >
      {images.map((src, i) => (
        <Image
          key={src}
          source={{ uri: src }}
          onError={() => setFailed(true)}
          resizeMode="cover"
          className="absolute inset-0 h-full w-full"
          style={{ opacity: i === frame ? 1 : 0 }}
        />
      ))}
      {temMultiplas ? (
        <View className="absolute bottom-1.5 right-1.5 flex-row gap-1">
          {images.map((src, i) => (
            <View
              key={src}
              className={cn("h-1.5 w-1.5 rounded-full", i === frame ? "bg-white" : "bg-white/40")}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * A mídia do exercício — o `ExerciseMediaView` do web: o GIF quando a fonte
 * tem, senão as fotos alternando; o crédito da fonte sobre a imagem quando a
 * licença exige. No app só a ficha usa, então o GIF anima direto.
 */
export function ExerciseMediaView({ media, name }: { media: ExerciseMedia; name: string }) {
  const [falhou, setFalhou] = useState(false);
  const { label: credito, href } = media.attribution;
  return (
    <View>
      {media.gif && !falhou ? (
        <Image
          source={{ uri: media.gif }}
          onError={() => setFalhou(true)}
          resizeMode="contain"
          accessibilityLabel={t("{{name}} — demonstração", { name })}
          className="aspect-square w-full bg-white"
        />
      ) : (
        <ExerciseDemo images={media.images} name={name} className="aspect-square rounded-none" />
      )}
      {credito ? (
        <Text
          onPress={href && isSafeUrl(href) ? () => void Linking.openURL(href) : undefined}
          numberOfLines={1}
          className="absolute bottom-1 left-1 max-w-[85%] rounded bg-foreground/55 px-1.5 py-0.5 text-[10px] leading-none text-background"
        >
          {credito}
        </Text>
      ) : null}
    </View>
  );
}
