/**
 * Удаляет файлы релиза из хранилища: WAV после одобрения (экономит бесплатные лимиты Blob/Supabase)
 * или вообще всё — при удалении релиза из админки.
 * Best-effort: ошибки только логируются и не отменяют одобрение / удаление.
 */

import { del } from "@vercel/blob";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STORAGE_BUCKET_ARTWORK,
  STORAGE_BUCKET_AUDIO_LEGACY,
  STORAGE_BUCKET_RELEASE_TRACKS
} from "@/lib/storage-buckets";

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

/** Обложка или старый одиночный WAV этого релиза: `<владелец>/<releaseId>/cover.jpg|png` / `audio.wav`. */
function isOwnRootKey(key: string, releaseId: string, fileName: RegExp): boolean {
  const parts = key.replace(/^\/+/, "").split("/");
  return parts.length === 3 && /^\d+$/.test(parts[0]) && parts[1] === releaseId && fileName.test(parts[2]);
}

function blobKey(value: string): string {
  return decodeURIComponent(new URL(value).pathname);
}

/** Ключ объекта по публичному URL Supabase Storage этого бакета; null — URL не из бакета. */
function supabaseKey(value: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  if (!value.includes(marker)) return null;
  return decodeURIComponent(value.split(marker)[1].split("?")[0]);
}

async function removeTrackAudio(admin: SupabaseClient, releaseId: string, refs: string[]): Promise<void> {
  const blobUrls = refs.filter((v) => isBlobUrl(v) && isOwnTrackKey(blobKey(v), releaseId));
  if (blobUrls.length > 0) {
    await del(blobUrls);
  }

  const supabasePaths = refs
    .map((v) => supabaseKey(v, STORAGE_BUCKET_RELEASE_TRACKS))
    .filter((key): key is string => key != null && isOwnTrackKey(key, releaseId));
  if (supabasePaths.length > 0) {
    const { error: rmErr } = await admin.storage.from(STORAGE_BUCKET_RELEASE_TRACKS).remove(supabasePaths);
    if (rmErr) console.error("[audio-cleanup] supabase remove:", rmErr.message);
  }
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
    await removeTrackAudio(admin, releaseId, refs);
  } catch (e) {
    console.error("[audio-cleanup] failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Все файлы удалённого релиза: WAV треков, обложка и старый одиночный WAV.
 * Строки треков к этому моменту уже удалены каскадом, поэтому ссылки передаёт вызывающий.
 */
export async function deleteAllReleaseFiles(
  admin: SupabaseClient,
  release: { id: string; artwork_url?: string | null; audio_url?: string | null },
  trackRefs: string[]
): Promise<void> {
  const releaseId = release.id;
  try {
    const refs = trackRefs.map((v) => v.trim()).filter((v) => v.length > 0);
    await removeTrackAudio(admin, releaseId, refs);

    const artworkKey = supabaseKey(release.artwork_url ?? "", STORAGE_BUCKET_ARTWORK);
    if (artworkKey && isOwnRootKey(artworkKey, releaseId, /^cover\.(jpg|png)$/)) {
      const { error } = await admin.storage.from(STORAGE_BUCKET_ARTWORK).remove([artworkKey]);
      if (error) console.error("[release-files] artwork remove:", error.message);
    }

    const legacyKey = supabaseKey(release.audio_url ?? "", STORAGE_BUCKET_AUDIO_LEGACY);
    if (legacyKey && isOwnRootKey(legacyKey, releaseId, /^audio\.wav$/)) {
      const { error } = await admin.storage.from(STORAGE_BUCKET_AUDIO_LEGACY).remove([legacyKey]);
      if (error) console.error("[release-files] legacy audio remove:", error.message);
    }
  } catch (e) {
    console.error("[release-files] failed:", e instanceof Error ? e.message : e);
  }
}
