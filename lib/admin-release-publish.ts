import { RELEASE_STATUS_VALUES, type ReleaseStatus } from "@/lib/db-enums";

const PUBLISH_READY_ALIASES = new Set(["released", "live", "approved", "ready"]);

/**
 * Маппинг «продуктового» статуса (например RELEASED) в значение enum колонки `releases.status`.
 * В БД используется `ready`; значение `RELEASED` в Postgres enum отсутствует — не передавать его в SQL.
 */
export function mapAdminPublishStatusToDb(newStatus: string): ReleaseStatus {
  const key = newStatus.trim().toLowerCase();
  if (PUBLISH_READY_ALIASES.has(key)) return "ready";
  if ((RELEASE_STATUS_VALUES as readonly string[]).includes(key)) {
    return key as ReleaseStatus;
  }
  throw new Error(`Недопустимый newStatus: ожидался выпуск (RELEASED/ready), получено «${newStatus}».`);
}

export function assertHttpsUrl(raw: string): string {
  const t = raw.trim();
  if (!t) throw new Error("Укажите ссылку.");
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    throw new Error("Некорректный URL. Пример: https://…");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("Разрешены только ссылки http(s).");
  }
  return u.toString();
}
