-- Дедупликация короткого вебхук-уведомления «релиз получен» при pending + треки только в `tracks`.
ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS telegram_pending_ack_sent_at timestamptz;

COMMENT ON COLUMN public.releases.telegram_pending_ack_sent_at IS
  'Время первой отправки короткого Telegram-уведомления из вебхука (pending + готовность по tracks).';
