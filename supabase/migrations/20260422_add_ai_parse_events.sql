CREATE TABLE IF NOT EXISTS public.ai_parse_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_id      UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_parse_events_user_created_at
  ON public.ai_parse_events(user_id, created_at DESC);

ALTER TABLE public.ai_parse_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_parse_events'
      AND policyname = 'AI Parse: owner all'
  ) THEN
    CREATE POLICY "AI Parse: owner all"
      ON public.ai_parse_events
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;
