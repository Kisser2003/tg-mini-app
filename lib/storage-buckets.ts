/** WAV треков — отдельный bucket; загрузка только с клиента (не через Vercel). */
export const STORAGE_BUCKET_RELEASE_TRACKS = "releases";

export const STORAGE_BUCKET_AUDIO_LEGACY = "audio";
export const STORAGE_BUCKET_ARTWORK = "artwork";

/** Фото артиста для питчинга. Приватный: только signed URL из API. */
export const STORAGE_BUCKET_PRESS_PHOTOS = "press-photos";

/**
 * Максимальный размер одного WAV (МБ). Должен совпадать с глобальным лимитом файла в Supabase
 * (Dashboard → Storage → Settings): на бесплатном тарифе это 50 МБ, на Pro можно до 500 ГБ.
 * После смены лимита в Supabase задай NEXT_PUBLIC_MAX_WAV_MB (например 200) и пересобери приложение.
 */
export const MAX_WAV_MB = (() => {
  const n = Number(process.env.NEXT_PUBLIC_MAX_WAV_MB);
  return Number.isFinite(n) && n > 0 ? n : 50;
})();
