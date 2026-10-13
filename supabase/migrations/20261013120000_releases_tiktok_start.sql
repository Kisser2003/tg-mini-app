-- Начало отрывка для TikTok / Reels (секунды от начала трека), задаёт артист в мастере.
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS tiktok_start_sec integer
  CHECK (tiktok_start_sec IS NULL OR (tiktok_start_sec >= 0 AND tiktok_start_sec <= 3600));
