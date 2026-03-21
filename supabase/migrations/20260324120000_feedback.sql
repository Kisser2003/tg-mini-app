-- Обратная связь из приложения. Запись только через сервер (service_role).
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id bigint NOT NULL,
  message text NOT NULL CHECK (char_length(trim(message)) >= 1),
  route text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON public.feedback (created_at DESC);

COMMENT ON TABLE public.feedback IS 'Отзывы пользователей Mini App; insert только через API с service role.';

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Нет политик для anon/authenticated — клиентский SDK не пишет/не читает.
