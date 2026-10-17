"use client";

import { releaseApiRequest } from "@/lib/api/release-client";
import { createSupabaseBrowser } from "@/lib/supabase";
import {
  PRESS_PHOTO_MAX_BYTES,
  PRESS_PHOTO_MAX_MB,
  PRESS_PHOTO_MIN_SIDE_PX,
  isPressPhotoMime,
  type PressKit
} from "@/lib/press-kit";

export async function fetchPressKits(releaseIds: string[]): Promise<PressKit[]> {
  if (releaseIds.length === 0) return [];
  const json = await releaseApiRequest<{ ok: true; kits: PressKit[] }>(
    `/api/releases/press-kits?ids=${releaseIds.map(encodeURIComponent).join(",")}`
  );
  return json.kits;
}

export async function savePressKit(
  releaseId: string,
  patch: { pressText?: string | null; photoPath?: string | null }
): Promise<PressKit | null> {
  const json = await releaseApiRequest<{ ok: true; kit: PressKit | null }>(
    `/api/releases/${releaseId}/press-kit`,
    { method: "POST", body: patch }
  );
  return json.kit;
}

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      reject(new Error("Не получилось открыть фото. Попробуй другой файл."));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/** Ошибка для артиста или null, если фото подходит. */
export async function validatePressPhoto(file: File): Promise<string | null> {
  if (!isPressPhotoMime(file.type)) return "Нужно фото в JPG, PNG или WEBP.";
  if (file.size > PRESS_PHOTO_MAX_BYTES) return `Фото больше ${PRESS_PHOTO_MAX_MB} МБ. Сожми его или выбери другое.`;
  const { width, height } = await readImageSize(file);
  if (Math.min(width, height) < PRESS_PHOTO_MIN_SIDE_PX) {
    return `Фото маленькое (${width}×${height}). Нужно от ${PRESS_PHOTO_MIN_SIDE_PX} пикселей по короткой стороне.`;
  }
  return null;
}

/** Грузит фото в приватный бакет по одноразовой ссылке и возвращает путь для `savePressKit`. */
export async function uploadPressPhoto(releaseId: string, file: File): Promise<string> {
  const ticket = await releaseApiRequest<{ ok: true; path: string; token: string; bucket: string }>(
    `/api/releases/${releaseId}/press-kit/photo-upload`,
    { method: "POST", body: { mime: file.type, size: file.size } }
  );
  const { error } = await createSupabaseBrowser()
    .storage.from(ticket.bucket)
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
  if (error) throw new Error("Фото не загрузилось. Проверь интернет и попробуй ещё раз.");
  return ticket.path;
}
