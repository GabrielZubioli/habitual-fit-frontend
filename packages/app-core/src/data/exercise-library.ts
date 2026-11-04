import { supabase } from "../supabase";
import { DataError } from "./supabase-helpers";
import { exerciseMedia } from "./exercise-media";
import { jsonList, localDb, marcadores } from "../local";
import { language, t } from "../i18n";

/**
 * A biblioteca de exercícios (a tela Exercícios): os grupos, os equipamentos e
 * as consultas — as mesmas no web e no app nativo.
 */

/** Grupos musculares da navegação: cada um junta os músculos do catálogo que fazem parte dele. */
export const GRUPOS = [
  {
    key: "peito",
    nome: t("Peito"),
    musculos: ["chest"],
    recorte: { view: "front" as const, box: [150, 215, 424, 318] as const },
  },
  {
    key: "costas",
    nome: t("Costas"),
    musculos: ["back", "lats", "lower_back"],
    recorte: { view: "back" as const, box: [110, 190, 504, 378] as const },
  },
  {
    key: "ombros",
    nome: t("Ombros"),
    musculos: ["shoulders", "front_delts", "side_delts", "rear_delts"],
    recorte: { view: "front" as const, box: [90, 170, 544, 408] as const },
  },
  {
    key: "biceps",
    nome: t("Bíceps"),
    musculos: ["biceps"],
    recorte: { view: "front" as const, box: [30, 230, 664, 498] as const },
  },
  {
    key: "triceps",
    nome: t("Tríceps"),
    musculos: ["triceps"],
    recorte: { view: "back" as const, box: [30, 230, 664, 498] as const },
  },
  {
    key: "antebraco",
    nome: t("Antebraço"),
    musculos: ["forearms"],
    recorte: { view: "front" as const, box: [10, 430, 704, 528] as const },
  },
  {
    key: "abdomen",
    nome: t("Abdômen"),
    musculos: ["abs", "core", "obliques"],
    recorte: { view: "front" as const, box: [140, 370, 444, 333] as const },
  },
  {
    key: "quadriceps",
    nome: t("Quadríceps"),
    musculos: ["quads"],
    recorte: { view: "front" as const, box: [110, 690, 504, 378] as const },
  },
  {
    key: "posterior",
    nome: t("Posterior de coxa"),
    musculos: ["hamstrings"],
    recorte: { view: "back" as const, box: [110, 740, 504, 378] as const },
  },
  {
    key: "gluteos",
    nome: t("Glúteos"),
    musculos: ["glutes", "abductors", "adductors"],
    recorte: { view: "back" as const, box: [140, 600, 444, 333] as const },
  },
  {
    key: "panturrilhas",
    nome: t("Panturrilhas"),
    musculos: ["calves"],
    recorte: { view: "back" as const, box: [140, 1000, 444, 333] as const },
  },
  {
    key: "trapezio",
    nome: t("Trapézio e pescoço"),
    musculos: ["traps", "neck"],
    recorte: { view: "back" as const, box: [130, 110, 464, 348] as const },
  },
  { key: "cardio", nome: t("Cardio e corpo todo"), musculos: ["cardio", "full_body"] },
] as const;

export const EQUIPAMENTOS = [
  { key: "barbell", nome: t("Barra") },
  { key: "dumbbell", nome: t("Halteres") },
  { key: "machine", nome: t("Máquinas") },
  { key: "cable", nome: t("Polia") },
  { key: "bodyweight", nome: t("Peso corporal") },
  { key: "kettlebell", nome: t("Kettlebell") },
  { key: "band", nome: t("Elásticos") },
  { key: "cardio", nome: t("Cardio") },
  { key: "other", nome: t("Outros acessórios") },
] as const;

/** Estrutura de treino → equipamentos que ela tem. */
export const ESTRUTURAS = [
  { key: "completa", nome: t("Academia completa"), equipamentos: EQUIPAMENTOS.map((e) => e.key) },
  {
    key: "pequena",
    nome: t("Academia pequena"),
    equipamentos: ["barbell", "dumbbell", "bodyweight", "kettlebell", "band", "other"],
  },
  { key: "sem", nome: t("Sem equipamento"), equipamentos: ["bodyweight"] },
] as const;

export const NIVEIS = [
  { value: "beginner", label: t("Iniciante") },
  { value: "intermediate", label: t("Intermediário") },
  { value: "advanced", label: t("Avançado") },
];

export const PAGE_SIZE = 24;
const CAMPOS =
  "id, name, name_en, name_es, primary_muscle, secondary_muscles, equipment, category, owner_id, image_urls, external_id, media_id, media_ref, media_source, video_url";

export type ExerciseRow = {
  id: string;
  name: string;
  name_en: string | null;
  name_es: string | null;
  primary_muscle: string | null;
  secondary_muscles: string[] | null;
  equipment: string | null;
  category: string | null;
  owner_id: string | null;
  image_urls: string[] | null;
  external_id: string | null;
  media_id: string | null;
  media_ref: string | null;
  media_source: string | null;
  video_url: string | null;
};

type Idioma = "pt" | "en" | "es";

/**
 * Nome do exercício no idioma do app: es → `name_es`, en → `name_en`; sem
 * tradução, o nome em português. Só para exibir — a mídia e o vídeo são
 * achados pelo `name` original.
 */
export function exerciseName(ex: {
  name: string;
  name_en?: string | null;
  name_es?: string | null;
}): string {
  if (language === "es") return ex.name_es || ex.name;
  if (language === "en") return ex.name_en || ex.name;
  return ex.name;
}

/**
 * Passo a passo no idioma do app, caindo no idioma mais próximo que houver:
 * es → espanhol, português, inglês; en → inglês (passos, ou o texto corrido
 * original), português; pt → português, inglês. `idioma` diz de onde veio,
 * para a tela avisar quando não é o do app.
 *
 * Sempre em passos, qualquer que seja a fonte: a tela tem um formato só.
 */
export function exerciseSteps(ex: {
  execution?: string[] | null;
  execution_en?: string[] | null;
  execution_es?: string[] | null;
  instructions?: string | null;
}): { passos: string[]; idioma: Idioma | null } {
  // O inglês da base de origem muitas vezes só existe como texto corrido
  // (`instructions`, os passos originais colados num parágrafo).
  const en = limpos(ex.execution_en);
  const fontes: Record<Idioma, string[]> = {
    pt: limpos(ex.execution),
    en: en.length ? en : passosDoTexto(ex.instructions),
    es: limpos(ex.execution_es),
  };
  const ordem: Idioma[] =
    language === "es" ? ["es", "pt", "en"] : language === "en" ? ["en", "pt"] : ["pt", "en"];
  for (const idioma of ordem) {
    if (fontes[idioma].length) return { passos: fontes[idioma], idioma };
  }
  return { passos: [], idioma: null };
}

/**
 * Um passo por item: quebra o que veio com linhas dentro e tira os vazios. A
 * coluna vem do SQLite como JSON: o que não for lista de textos é descartado,
 * em vez de derrubar a tela.
 */
function limpos(passos: unknown): string[] {
  if (!Array.isArray(passos)) return [];
  return passos
    .filter((p): p is string => typeof p === "string")
    .flatMap((p) => p.split(/\n+/))
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Texto corrido → um passo por frase. Só corta em ". " seguido de maiúscula ou
 * parêntese, então "2.5 kg" e "(Note: ...)." ficam inteiros.
 */
function passosDoTexto(texto: string | null | undefined): string[] {
  if (typeof texto !== "string" || !texto.trim()) return [];
  return limpos([texto.replace(/([.!?][)"']?)\s+(?=[A-Z(¿¡])/g, "$1\n")]);
}

/** Selo de "texto em outro idioma", quando o passo a passo não é o do app. */
export function idiomaDiferente(idioma: Idioma | null): string | null {
  const doApp: Idioma = language === "pt-BR" ? "pt" : language;
  if (!idioma || idioma === doApp) return null;
  return { pt: t("em português"), en: t("em inglês"), es: t("em espanhol") }[idioma];
}

/** Linha do SQLite (arrays em texto JSON) → `ExerciseRow`. */
export function exerciseRowLocal(
  r: Omit<ExerciseRow, "secondary_muscles" | "image_urls"> & {
    secondary_muscles: string | null;
    image_urls: string | null;
  },
): ExerciseRow {
  return {
    ...r,
    secondary_muscles: jsonList(r.secondary_muscles),
    image_urls: jsonList(r.image_urls),
  };
}

async function exerciciosLocais(
  where: string,
  params: unknown[],
  resto = "",
): Promise<ExerciseRow[]> {
  return (
    await localDb()!.getAll<Parameters<typeof exerciseRowLocal>[0]>(
      `SELECT ${CAMPOS} FROM exercises WHERE ${where} ${resto}`,
      params,
    )
  ).map(exerciseRowLocal);
}

/** A miniatura do exercício: o GIF (o movimento) quando houver, senão a foto. */
export function miniaturaDe(exercise: ExerciseRow): string | null {
  const media = exerciseMedia({
    name: exercise.name,
    imageUrls: exercise.image_urls,
    externalId: exercise.external_id,
    mediaId: exercise.media_id,
    mediaRef: exercise.media_ref,
    mediaSource: exercise.media_source,
    videoUrl: exercise.video_url,
  });
  return media.gif ?? media.images[0] ?? null;
}

/** Quantos exercícios há por músculo e por equipamento (uma leitura só, leve). */
export async function fetchExerciseCounts() {
  const db = localDb();
  const { data, error } = db
    ? {
        data: await db.getAll<{ primary_muscle: string | null; equipment: string | null }>(
          "SELECT primary_muscle, equipment FROM exercises WHERE deleted_at IS NULL LIMIT 5000",
        ),
        error: null,
      }
    : await supabase
        .from("exercises")
        .select("primary_muscle, equipment")
        .is("deleted_at", null)
        .limit(5000);
  if (error) throw error;
  const porMusculo = new Map<string, number>();
  const porEquip = new Map<string, number>();
  for (const r of data ?? []) {
    if (r.primary_muscle)
      porMusculo.set(r.primary_muscle, (porMusculo.get(r.primary_muscle) ?? 0) + 1);
    if (r.equipment) porEquip.set(r.equipment, (porEquip.get(r.equipment) ?? 0) + 1);
  }
  return { total: data?.length ?? 0, porMusculo, porEquip };
}

/** Capa de um equipamento: a miniatura do exercício mais popular que tenha uma. */
export async function fetchEquipmentCover(equipamento: string) {
  const { data } = localDb()
    ? {
        data: await exerciciosLocais(
          "deleted_at IS NULL AND equipment = ?",
          [equipamento],
          "ORDER BY popularity DESC LIMIT 6",
        ),
      }
    : await supabase
        .from("exercises")
        .select(CAMPOS)
        .is("deleted_at", null)
        .eq("equipment", equipamento as never)
        .order("popularity", { ascending: false })
        .limit(6);
  for (const ex of data ?? []) {
    const m = miniaturaDe(ex as ExerciseRow);
    if (m) return m;
  }
  return null;
}

/** Os favoritos, na ordem em que foram favoritados. */
export async function fetchFavoriteExercises(ordem: readonly string[]): Promise<ExerciseRow[]> {
  const { data, error } = localDb()
    ? {
        data: ordem.length
          ? await exerciciosLocais(`id IN (${marcadores(ordem.length)})`, [...ordem])
          : [],
        error: null,
      }
    : await supabase
        .from("exercises")
        .select(CAMPOS)
        .in("id", [...ordem]);
  if (error) throw error;
  const porId = new Map((data ?? []).map((x) => [x.id, x]));
  return ordem.flatMap((id) => {
    const x = porId.get(id);
    return x ? [x as ExerciseRow] : [];
  });
}

/** Uma página da lista, com os filtros. Popularidade antes do nome. */
export async function fetchExercisePage({
  page,
  termo,
  musculos,
  equipamentos,
  nivel,
}: {
  page: number;
  termo: string;
  musculos?: readonly string[];
  equipamentos?: readonly string[];
  nivel?: string | null;
}): Promise<ExerciseRow[]> {
  if (localDb()) {
    const cond = ["deleted_at IS NULL"];
    const params: unknown[] = [];
    if (termo) {
      cond.push("(name LIKE ? OR name LIKE ? OR name_en LIKE ? OR name_es LIKE ?)");
      const item = termo.trim();
      params.push(
        `%${item}%`,
        `%${item.charAt(0).toUpperCase()}${item.slice(1)}%`,
        `%${item}%`,
        `%${item}%`,
      );
    }
    if (musculos?.length) {
      cond.push(`primary_muscle IN (${marcadores(musculos.length)})`);
      params.push(...musculos);
    }
    if (equipamentos?.length) {
      cond.push(`equipment IN (${marcadores(equipamentos.length)})`);
      params.push(...equipamentos);
    }
    if (nivel) {
      cond.push("level = ?");
      params.push(nivel);
    }
    return exerciciosLocais(
      cond.join(" AND "),
      [...params, PAGE_SIZE, page * PAGE_SIZE],
      "ORDER BY popularity DESC, name LIMIT ? OFFSET ?",
    );
  }
  let query = supabase
    .from("exercises")
    .select(CAMPOS)
    .is("deleted_at", null)
    .order("popularity", { ascending: false })
    .order("name")
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (termo) {
    // Busca no nome em português, no original em inglês e em espanhol.
    const escapado = termo.replace(/[%,()]/g, " ");
    query = query.or(
      `name.ilike.%${escapado}%,name_en.ilike.%${escapado}%,name_es.ilike.%${escapado}%`,
    );
  }
  if (musculos?.length) query = query.in("primary_muscle", musculos as never[]);
  if (equipamentos?.length) query = query.in("equipment", equipamentos as never[]);
  if (nivel) query = query.eq("level", nivel as "beginner");
  const { data, error } = await query;
  if (error) throw new DataError("carregar os exercícios", error);
  return (data ?? []) as ExerciseRow[];
}
