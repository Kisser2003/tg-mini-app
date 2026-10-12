import { presignS3Url } from "@/lib/s3-presign";

export type S3Config = {
  endpointHost: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Базовый публичный URL бакета без завершающего `/`. */
  publicBaseUrl: string;
};

/**
 * Хранилище для WAV вне Supabase (там на бесплатном тарифе потолок 50 МБ на файл).
 * Любой S3-совместимый сервис: Backblaze B2, Cloudflare R2 и т.п. Если переменные не заданы — null,
 * и приложение грузит аудио в Supabase Storage как раньше.
 */
export function getS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return null;
  }
  let host: string;
  try {
    host = new URL(endpoint.includes("://") ? endpoint : `https://${endpoint}`).host;
  } catch {
    return null;
  }
  return { endpointHost: host, region, bucket, accessKeyId, secretAccessKey, publicBaseUrl };
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** Тип, с которым WAV сохраняется в хранилище (входит в подпись, клиент обязан прислать то же). */
export const S3_AUDIO_CONTENT_TYPE = "audio/wav";

/**
 * Ссылка для одной загрузки: размер и тип файла зашиты в подпись, срок жизни короткий.
 * Хранилище отклонит запрос с другим `content-length` или `content-type`.
 */
export function createS3UploadUrls(
  cfg: S3Config,
  objectKey: string,
  sizeBytes: number,
  expiresSeconds = 600
): { uploadUrl: string; publicUrl: string } {
  const uploadUrl = presignS3Url({
    method: "PUT",
    host: cfg.endpointHost,
    path: `/${cfg.bucket}/${objectKey}`,
    region: cfg.region,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    expiresSeconds,
    signedHeaders: {
      "content-length": String(Math.trunc(sizeBytes)),
      "content-type": S3_AUDIO_CONTENT_TYPE
    }
  });
  return { uploadUrl, publicUrl: `${cfg.publicBaseUrl}/${encodeKey(objectKey)}` };
}
