CREATE TABLE public.user_zen_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  decks JSONB NOT NULL DEFAULT '[]'::jsonb,
  logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  journals JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_zen_state TO authenticated;
GRANT ALL ON public.user_zen_state TO service_role;

ALTER TABLE public.user_zen_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own zen state"
  ON public.user_zen_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER user_zen_state_touch
  BEFORE UPDATE ON public.user_zen_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();