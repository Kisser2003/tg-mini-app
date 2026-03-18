import { useState } from "react";

/**
 * @deprecated Старый одноступенчатый флоу создания релиза.
 * Используйте новый 2‑шаговый флоу (паспорт + треки) через страницу create.
 */
export function useCreateRelease() {
  const [isSaving] = useState(false);
  const [error] = useState<string | null>(null);

  const create = async () => {
    throw new Error("useCreateRelease is deprecated. Use the new 2-step release flow.");
  };

  return { create, isSaving, error };
}
