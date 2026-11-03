import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// A busca por palavras é a mesma no app nativo.
export { searchWords } from "@forja/app-core/lib/search";
