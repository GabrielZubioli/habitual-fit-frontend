import { DeviceEventEmitter } from "react-native";

/**
 * O quadradinho do botão central, dentro do treino, termina o treino — o
 * `TERMINAR_TREINO_EVENT` do web. A barra emite; a tela do treino escuta e
 * roda o mesmo fluxo do "Terminar treino".
 */
export const TERMINAR_TREINO = "habitualfit:terminar-treino";

export function emitirTerminarTreino(): void {
  DeviceEventEmitter.emit(TERMINAR_TREINO);
}
