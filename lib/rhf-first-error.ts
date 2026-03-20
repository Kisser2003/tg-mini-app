import type { FieldValues } from "react-hook-form";

/** Первая строка message из дерева ошибок react-hook-form (для toast). */
export function firstRhfErrorMessage<T extends FieldValues>(errors: Partial<Record<keyof T, unknown>>): string {
  const walk = (obj: unknown): string | null => {
    if (!obj || typeof obj !== "object") return null;
    const rec = obj as Record<string, unknown>;
    if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
    for (const v of Object.values(rec)) {
      if (v && typeof v === "object") {
        const inner = walk(v);
        if (inner) return inner;
      }
    }
    return null;
  };
  return walk(errors) ?? "Проверьте форму.";
}
