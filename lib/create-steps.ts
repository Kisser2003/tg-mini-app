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
