-- Реферальная программа: друг по ссылке получает −500 ₽ на первый релиз,
-- пригласивший — 500 ₽ бонуса, когда студия отметит этот релиз оплаченным.
-- Привязка по telegram_id (как в releases.telegram_id): пользователи мини-приложения
-- обычно не попадают в public.users. Пишет и читает только service role (API).

CREATE TABLE IF NOT EXISTS public.referral_codes (
  telegram_id text PRIMARY KEY CHECK (telegram_id ~ '^[1-9][0-9]{0,19}$'),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  -- У друга один пригласивший; привязываем только новых (без релизов).
  referee_telegram_id text PRIMARY KEY CHECK (referee_telegram_id ~ '^[1-9][0-9]{0,19}$'),
  referrer_telegram_id text NOT NULL REFERENCES public.referral_codes (telegram_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Первый оплаченный релиз друга: на нём скидка другу, с него же бонус пригласившему.
  paid_release_id uuid REFERENCES public.releases (id) ON DELETE SET NULL,
  paid_at timestamptz,
  -- Релиз пригласившего, в оплате которого бонус учли.
  reward_redeemed_release_id uuid REFERENCES public.releases (id) ON DELETE SET NULL,
  reward_redeemed_at timestamptz,
  CHECK (referee_telegram_id <> referrer_telegram_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_telegram_id);
CREATE INDEX IF NOT EXISTS referrals_paid_release_idx ON public.referrals (paid_release_id)
  WHERE paid_release_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS referrals_redeemed_release_idx ON public.referrals (reward_redeemed_release_id)
  WHERE reward_redeemed_release_id IS NOT NULL;

COMMENT ON TABLE public.referrals IS
  'Кто кого пригласил. paid_release_id — первый оплаченный релиз друга (бонус пригласившему доступен); reward_redeemed_release_id — где бонус учли.';

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_codes FROM anon, authenticated;
REVOKE ALL ON public.referrals FROM anon, authenticated;
