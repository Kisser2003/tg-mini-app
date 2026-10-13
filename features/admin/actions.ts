"use client";

import type { ReleaseRecord } from "@/repositories/releases.repo";
import {
  getAdminTelegramIdForUi,
  getAdminApiAuthHeaders,
  isAdminUiByWebSession,
  telegramIdsEqual
} from "@/lib/admin";
import { getTelegramUserId } from "@/lib/telegram";

/**
 * В production: Telegram ID совпадает с ADMIN_TELEGRAM_ID **или** веб-сессия Supabase
 * с `public.users.role = 'admin'` (как в `requireAdminSupabaseClient` / `isAdminUiByWebSession`).
 */
async function assertAdminAsync(): Promise<void> {
  if (process.env.NODE_ENV === "development") {
    return;
  }
  const uid = getTelegramUserId();
  const adminId = getAdminTelegramIdForUi();
  if (uid != null && adminId != null && telegramIdsEqual(uid, adminId)) {
    return;
  }
  const webAdmin = await isAdminUiByWebSession();
  if (!webAdmin) {
    throw new Error("Доступ только для администратора.");
  }
}

async function postModeration(
  body: { releaseId: string; action: "approve" | "reject"; comment?: string; reasonKeys?: string[] }
): Promise<ReleaseRecord> {
  const authHeaders = await getAdminApiAuthHeaders();
  const res = await fetch("/api/admin/update-release-status", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("Не удалось обновить статус релиза.");
  }

  if (!res.ok) {
    const err =
      typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : "Не удалось обновить статус релиза.";
    throw new Error(err);
  }

  const parsed = json as { ok?: boolean; record?: ReleaseRecord };
  if (parsed.ok !== true || !parsed.record) {
    throw new Error("Не удалось обновить статус релиза.");
  }

  return parsed.record;
}

/**
 * Принять релиз: статус `ready` без ссылки, `error_message` очищается. Ссылку добавляют позже.
 * Обновление через API с service role (обходит RLS Mini App клиента).
 */
export async function approveRelease(releaseId: string): Promise<ReleaseRecord> {
  await assertAdminAsync();
  return postModeration({ releaseId, action: "approve" });
}

/**
 * Отклонить релиз: статус `failed`; причина в `error_message` / `admin_notes`.
 */
export async function rejectRelease(
  releaseId: string,
  comment: string,
  reasonKeys: string[] = []
): Promise<ReleaseRecord> {
  await assertAdminAsync();
  return postModeration({
    releaseId,
    action: "reject",
    comment,
    ...(reasonKeys.length > 0 ? { reasonKeys } : {})
  });
}

async function postPublishSmartLink(body: {
  releaseId: string;
  newStatus: string;
  smartLink: string;
  upc?: string;
}): Promise<ReleaseRecord> {
  const authHeaders = await getAdminApiAuthHeaders();
  const res = await fetch("/api/admin/publish-release-smart-link", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("Не удалось выпустить релиз со ссылкой.");
  }

  if (!res.ok) {
    const o = json as { error?: unknown; detail?: unknown };
    const base =
      typeof o.error === "string" && o.error.length > 0
        ? o.error
        : "Не удалось выпустить релиз со ссылкой.";
    const detail = typeof o.detail === "string" && o.detail.trim() ? o.detail.trim() : "";
    throw new Error(detail ? `${base} ${detail}` : base);
  }

  const parsed = json as { ok?: boolean; record?: ReleaseRecord };
  if (parsed.ok !== true || !parsed.record) {
    throw new Error("Не удалось выпустить релиз со ссылкой.");
  }

  return parsed.record;
}

/**
 * Выпуск релиза из модерации: статус `ready` в БД + `smart_link`.
 * `newStatus` с клиента обычно `RELEASED`; сервер нормализует под enum.
 */
export async function publishReleaseWithSmartLink(
  releaseId: string,
  newStatus: string,
  smartLink: string,
  upc?: string
): Promise<ReleaseRecord> {
  await assertAdminAsync();
  return postPublishSmartLink({ releaseId, newStatus, smartLink, ...(upc?.trim() ? { upc: upc.trim() } : {}) });
}

/** Напомнить артисту через бота, что релиз не отправлен. Бросает ошибку с понятным текстом. */
export async function remindArtist(releaseId: string): Promise<void> {
  await assertAdminAsync();
  const authHeaders = await getAdminApiAuthHeaders();
  const res = await fetch("/api/admin/remind-artist", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ releaseId }),
    cache: "no-store"
  });
  let json: { ok?: boolean; error?: string } | null = null;
  try {
    json = (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    json = null;
  }
  if (!res.ok || json?.ok !== true) {
    throw new Error(json?.error || "Не удалось отправить напоминание.");
  }
}

/**
 * Оплата из админки: отметить «оплачено» / «не оплачено» или ещё раз спросить Дениса в боте.
 * Возвращает обновлённые поля оплаты релиза.
 */
export async function updateReleasePayment(
  releaseId: string,
  action: "paid" | "unpaid" | "ask_studio"
): Promise<Pick<ReleaseRecord, "payment_status" | "payment_updated_at" | "payment_updated_by">> {
  await assertAdminAsync();
  const authHeaders = await getAdminApiAuthHeaders();
  const res = await fetch("/api/admin/release-payment", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ releaseId, action }),
    cache: "no-store"
  });
  type PaymentResponse = { ok?: boolean; error?: string; release?: Partial<ReleaseRecord> };
  let json: PaymentResponse | null = null;
  try {
    json = (await res.json()) as PaymentResponse;
  } catch {
    json = null;
  }
  if (!res.ok || json?.ok !== true || !json.release) {
    throw new Error(json?.error || "Не удалось сохранить оплату.");
  }
  return {
    payment_status: json.release.payment_status ?? null,
    payment_updated_at: json.release.payment_updated_at ?? null,
    payment_updated_by: json.release.payment_updated_by ?? null
  };
}
