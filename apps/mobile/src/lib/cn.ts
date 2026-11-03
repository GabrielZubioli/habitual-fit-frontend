import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** O mesmo `cn` do web: junta classes e resolve conflitos (a última vence). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
