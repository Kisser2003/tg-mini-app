-- Питчинг: пресс-релиз и фото артиста для редакций площадок (Яндекс Музыка, Сберзвук, VK).
-- Артист заполняет после выпуска (status = 'ready' + smart_link), админ забирает текст и фото.
-- Пишет и читает только service role (API): клиент ходит через /api/releases/[id]/press-kit.

CREATE TABLE IF NOT EXISTS public.release_press_kits (
  release_id uuid PRIMARY KEY REFERENCES public.releases (id) ON DELETE CASCADE,
  press_text text CHECK (press_text IS NULL OR char_length(press_text) <= 300),
  -- Путь объекта в приватном бакете press-photos: `<release_id>/<file>`.
  photo_path text CHECK (photo_path IS NULL OR photo_path LIKE release_id::text || '/%'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.release_press_kits IS
  'Питчинг: текст пресс-релиза (до 300 символов) и фото артиста на однотонном фоне.';

ALTER TABLE public.release_press_kits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.release_press_kits FROM anon, authenticated;

-- Фото людей не публикуем: бакет приватный, доступ по signed URL из API.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('press-photos', 'press-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
