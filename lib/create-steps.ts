export const CREATE_FLOW_STEPS = [
  { key: "metadata", label: "Паспорт" },
  { key: "assets", label: "Обложка" },
  { key: "tracks", label: "Треки" },
  { key: "review", label: "Проверка" },
  { key: "success", label: "Готово" }
] as const;

export type CreateFlowStepKey = (typeof CREATE_FLOW_STEPS)[number]["key"];

export function getCreateStepIndexFromPath(pathname: string): number {
  const last = pathname.split("/").filter(Boolean).slice(-1)[0] ?? "metadata";
  const idx = CREATE_FLOW_STEPS.findIndex((s) => s.key === (last as CreateFlowStepKey));
  return idx >= 0 ? idx : 0;
}

const CREATE_BACK_PATH: Partial<Record<CreateFlowStepKey, string>> = {
  success: "/create/review",
  review: "/create/tracks",
  tracks: "/create/assets",
  assets: "/create/metadata",
  metadata: "/library"
};

/**
 * Куда вести по «Назад» в мастере создания (не history.back — чтобы после Library → review
 * возвращать на предыдущий шаг мастера, а не на список релизов).
 */
export function getCreateBackPath(pathname: string): string {
  const last = pathname.split("/").filter(Boolean).slice(-1)[0] ?? "metadata";
  const key = last as CreateFlowStepKey;
  return CREATE_BACK_PATH[key] ?? "/library";
}
