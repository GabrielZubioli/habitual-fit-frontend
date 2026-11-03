import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { t } from "@forja/app-core/i18n";

/**
 * Cronômetro de descanso — o `use-rest-timer.ts` do web.
 *
 * Conta pela hora de término, não por um contador: com o app em segundo plano
 * (o celular no bolso entre as séries) o tempo continua certo. O aviso do fim
 * é uma notificação local agendada para essa hora — toca e vibra mesmo com a
 * tela bloqueada, onde o web dependia da aba estar aberta.
 */
export type RestTimer = {
  remaining: number | null;
  total: number;
  start: (seconds: number) => void;
  stop: () => void;
  adjust: (deltaSeconds: number) => void;
};

const SOUND_KEY = "forja.rest-sound";

// Com o app aberto, a notificação também aparece e toca (o "bip" do web).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let somLigado = true;
void SecureStore.getItemAsync(SOUND_KEY).then((v) => {
  somLigado = v !== "off";
});

export function restSoundEnabled(): boolean {
  return somLigado;
}

export function setRestSound(on: boolean): void {
  somLigado = on;
  void SecureStore.setItemAsync(SOUND_KEY, on ? "on" : "off");
}

let agendada: string | null = null;

async function cancelarAviso() {
  if (agendada) await Notifications.cancelScheduledNotificationAsync(agendada).catch(() => {});
  agendada = null;
}

async function agendarAviso(endsAt: number) {
  await cancelarAviso();
  const { status } = await Notifications.requestPermissionsAsync().catch(() => ({
    status: "denied",
  }));
  if (status !== "granted") return;
  agendada = await Notifications.scheduleNotificationAsync({
    content: {
      title: t("Descanso concluído"),
      body: t("Hora da próxima série."),
      sound: somLigado,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt) },
  }).catch(() => null);
}

export function useRestTimer(): RestTimer {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endsAtRef = useRef<number | null>(null);
  endsAtRef.current = endsAt;

  useEffect(() => {
    if (endsAt === null) {
      setRemaining(null);
      return;
    }
    let finished = false;
    const tick = () => {
      const left = Math.ceil((endsAt - Date.now()) / 1000);
      if (left <= 0) {
        if (finished) return;
        finished = true;
        setRemaining(null);
        setEndsAt(null);
        Vibration.vibrate([0, 200, 100, 200]);
        return;
      }
      setRemaining(left);
    };
    tick();
    const interval = setInterval(tick, 250);
    // Ao voltar para o app, atualiza na hora (o intervalo para em segundo plano).
    const sub = AppState.addEventListener("change", (s) => s === "active" && tick());
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [endsAt]);

  const start = useCallback((seconds: number) => {
    const duration = Math.max(1, Math.round(seconds));
    const target = Date.now() + duration * 1000;
    setTotal(duration);
    setEndsAt(target);
    void agendarAviso(target);
  }, []);

  const stop = useCallback(() => {
    setEndsAt(null);
    setRemaining(null);
    void cancelarAviso();
  }, []);

  const adjust = useCallback((deltaSeconds: number) => {
    const atual = endsAtRef.current;
    if (atual === null) return;
    const next = Math.max(Date.now() + 1000, atual + deltaSeconds * 1000);
    setTotal((item) => Math.max(1, item + deltaSeconds));
    setEndsAt(next);
    void agendarAviso(next);
  }, []);

  return { remaining, total, start, stop, adjust };
}
