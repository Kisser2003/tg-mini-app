import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_BUCKET_PRESS_PHOTOS } from "@/lib/storage-buckets";
import type { PressKit } from "@/lib/press-kit";

/** Сколько живёт ссылка на превью / скачивание фото. */
const PHOTO_URL_TTL_SECONDS = 60 * 60;

export type PressKitRow = {
  release_id: string;
  press_text: string | null;
  photo_path: string | null;
  updated_at: string | null;
};

const PRESS_KIT_SELECT = "release_id, press_text, photo_path, updated_at";

/** Строки press-kit по релизам. Ошибка базы — пустой результат: питчинг не должен ронять экран. */
export async function loadPressKitRows(
  admin: SupabaseClient,
  releaseIds: string[]
): Promise<PressKitRow[]> {
  if (releaseIds.length === 0) return [];
  const { data, error } = await admin.from("release_press_kits").select(PRESS_KIT_SELECT).in("release_id", releaseIds);
  if (error) {
    console.error("[press-kit] load:", error.message);
    return [];
  }
  return (data ?? []) as PressKitRow[];
}

/** Строки → ответ API: путь фото заменяется короткоживущей ссылкой. */
export async function toPressKits(admin: SupabaseClient, rows: PressKitRow[]): Promise<PressKit[]> {
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data, error } = await admin.storage
      .from(STORAGE_BUCKET_PRESS_PHOTOS)
      .createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);
    if (error) console.error("[press-kit] signed urls:", error.message);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
  }
  return rows.map((r) => ({
    release_id: r.release_id,
    press_text: r.press_text,
    photo_url: r.photo_path ? (urls.get(r.photo_path) ?? null) : null,
    updated_at: r.updated_at
  }));
}

export async function loadPressKit(admin: SupabaseClient, releaseId: string): Promise<PressKit | null> {
  const rows = await loadPressKitRows(admin, [releaseId]);
  if (rows.length === 0) return null;
  const [kit] = await toPressKits(admin, rows);
  return kit ?? null;
}

/** Файлы в папке релиза, кроме `keepPath`. Best effort: старые фото не должны мешать сохранению. */
export async function removePressPhotos(
  admin: SupabaseClient,
  releaseId: string,
  keepPath?: string | null
): Promise<void> {
  const bucket = admin.storage.from(STORAGE_BUCKET_PRESS_PHOTOS);
  const { data, error } = await bucket.list(releaseId, { limit: 100 });
  if (error) {
    console.error("[press-kit] list photos:", error.message);
    return;
  }
  const stale = (data ?? []).map((f) => `${releaseId}/${f.name}`).filter((p) => p !== keepPath);
  if (stale.length === 0) return;
  const { error: rmErr } = await bucket.remove(stale);
  if (rmErr) console.error("[press-kit] remove photos:", rmErr.message);
}

/** Есть ли загруженный объект по пути (клиент грузит сам по signed upload URL). */
export async function pressPhotoExists(admin: SupabaseClient, path: string): Promise<boolean> {
  const slash = path.indexOf("/");
  const folder = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET_PRESS_PHOTOS)
    .list(folder, { limit: 1, search: name });
  if (error) {
    console.error("[press-kit] check photo:", error.message);
    return false;
  }
  return (data ?? []).some((f) => f.name === name);
}
