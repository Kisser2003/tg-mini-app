-- Feedback table: support both Telegram and web auth actors.

BEGIN;

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS user_uuid uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS feedback_user_uuid_idx ON public.feedback (user_uuid);

ALTER TABLE public.feedback
  ALTER COLUMN user_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feedback_actor_present_chk'
      AND conrelid = 'public.feedback'::regclass
  ) THEN
    ALTER TABLE public.feedback
      ADD CONSTRAINT feedback_actor_present_chk
      CHECK (user_id IS NOT NULL OR user_uuid IS NOT NULL);
  END IF;
END
$$;

COMMIT;
