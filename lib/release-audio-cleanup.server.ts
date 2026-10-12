/**
 * Удаляет WAV-файлы релиза из хранилища после одобрения (экономит бесплатные лимиты Blob/Supabase).
 * Best-effort: ошибки только логируются и не отменяют одобрение.
 */

import { del } from "@vercel/blob";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_BUCKET_RELEASE_TRACKS } from "@/lib/storage-buckets";

function isBlobUrl(value: string): boolean {
  try {
    return new URL(value).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Ключ файла трека этого релиза: `<владелец>/<releaseId>/tracks/<n>.wav` (см. getReleaseTrackAudioPath). */
function isOwnTrackKey(key: string, releaseId: string): boolean {
  const normalized = key.replace(/^\/+/, "");
  if (normalized.split("/").includes("..")) return false;
  const parts = normalized.split("/");
  return (
    parts.length === 4 &&
    /^\d+$/.test(parts[0]) &&
    parts[1] === releaseId &&
    parts[2] === "tracks" &&
    /^\d+\.wav$/.test(parts[3])
  );
}

function blobKey(value: string): string {
  return decodeURIComponent(new URL(value).pathname);
}

export async function deleteApprovedReleaseAudio(admin: SupabaseClient, releaseId: string): Promise<void> {
  try {
    const { data, error } = await admin.from("tracks").select("file_path").eq("release_id", releaseId);
    if (error) {
      console.error("[audio-cleanup] load tracks:", error.message);
      return;
    }
    const refs = (data ?? [])
      .map((r) => String((r as { file_path?: string | null }).file_path ?? "").trim())
      .filter((v) => v.length > 0);

    const blobUrls = refs.filter((v) => isBlobUrl(v) && isOwnTrackKey(blobKey(v), releaseId));
    if (blobUrls.length > 0) {
      await del(blobUrls);
    }

    const marker = `/object/public/${STORAGE_BUCKET_RELEASE_TRACKS}/`;
    const supabasePaths = refs
      .filter((v) => v.includes(marker))
      .map((v) => decodeURIComponent(v.split(marker)[1].split("?")[0]))
      .filter((key) => isOwnTrackKey(key, releaseId));
    if (supabasePaths.length > 0) {
      const { error: rmErr } = await admin.storage.from(STORAGE_BUCKET_RELEASE_TRACKS).remove(supabasePaths);
      if (rmErr) console.error("[audio-cleanup] supabase remove:", rmErr.message);
    }
  } catch (e) {
    console.error("[audio-cleanup] failed:", e instanceof Error ? e.message : e);
  }
}
