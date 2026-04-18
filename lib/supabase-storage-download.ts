import type { SupabaseClient } from "@supabase/supabase-js";

export type ParsedSupabaseObject = {
  bucket: string;
  /** Path inside bucket (not URL-encoded). */
  objectPath: string;
};

/**
 * Извлекает bucket и путь объекта из публичного или signed URL Supabase Storage.
 */
export function parseSupabaseStorageObjectUrl(url: string): ParsedSupabaseObject | null {
  try {
    const u = new URL(url);
    const pathname = u.pathname;
    const publicMatch = pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (publicMatch) {
      return {
        bucket: publicMatch[1],
        objectPath: decodeURIComponent(publicMatch[2])
      };
    }
    const signMatch = pathname.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
    if (signMatch) {
      return {
        bucket: signMatch[1],
        objectPath: decodeURIComponent(signMatch[2])
      };
    }
    return null;
  } catch {
    return null;
  }
}

function extensionFromPath(path: string): string {
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

export function guessFilenameFromUrl(url: string, fallbackBase: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").pop();
    if (seg && seg.includes(".")) return decodeURIComponent(seg);
  } catch {
    /* ignore */
  }
  const ext = extensionFromPath(url);
  return ext ? `${fallbackBase}${ext}` : fallbackBase;
}

/**
 * Скачивает байты оригинала: сначала через service role Storage (если URL распознан),
 * иначе прямой HTTP GET (публичный URL).
 */
export async function downloadStorageObjectBytes(
  supabase: SupabaseClient,
  publicOrSignedUrl: string
): Promise<{ data: ArrayBuffer; contentType: string | null }> {
  const trimmed = publicOrSignedUrl.trim();
  if (!trimmed) {
    throw new Error("Empty URL");
  }

  const parsed = parseSupabaseStorageObjectUrl(trimmed);
  if (parsed) {
    const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.objectPath);
    if (!error && data) {
      const buf = await data.arrayBuffer();
      return {
        data: buf,
        contentType: data.type && data.type.length > 0 ? data.type : null
      };
    }
  }

  const res = await fetch(trimmed, { cache: "no-store", redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to fetch asset: HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  return {
    data: buf,
    contentType: res.headers.get("content-type")
  };
}

export function contentDispositionAttachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
