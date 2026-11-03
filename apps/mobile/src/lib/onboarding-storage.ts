import * as SecureStore from "expo-secure-store";
import { answersSchema, EMPTY_ANSWERS, type Answers } from "@forja/app-core/lib/onboarding/schema";

/**
 * Rascunho do questionário — o `lib/onboarding/storage.ts` do web, com o
 * SecureStore no lugar do `localStorage`. Mesma chave, versão e validação: um
 * rascunho de versão antiga ou corrompido vira questionário em branco.
 *
 * As chaves do SecureStore não aceitam ":", então o separador vira ".".
 */
const KEY = "forja.onboarding-draft";
const STEP_KEY = "forja.onboarding-step";
const VERSION = 1;

export async function loadDraft(): Promise<Answers> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return EMPTY_ANSWERS;
    const draft = JSON.parse(raw) as { version: number; answers: unknown };
    if (draft.version !== VERSION) return EMPTY_ANSWERS;
    const parsed = answersSchema.safeParse(draft.answers);
    return parsed.success ? parsed.data : EMPTY_ANSWERS;
  } catch {
    return EMPTY_ANSWERS;
  }
}

export function saveDraft(answers: Answers): void {
  const draft = { version: VERSION, answers, updatedAt: new Date().toISOString() };
  // Perder o rascunho só faz a pessoa responder de novo; não trava a tela.
  void SecureStore.setItemAsync(KEY, JSON.stringify(draft)).catch(() => undefined);
}

export async function loadStep(): Promise<number> {
  const n = Number(await SecureStore.getItemAsync(STEP_KEY).catch(() => null));
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export function saveStep(step: number): void {
  void SecureStore.setItemAsync(STEP_KEY, String(step)).catch(() => undefined);
}

export async function clearDraft(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(STEP_KEY).catch(() => undefined),
  ]);
}
