
CREATE TABLE public.telegram_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT NOT NULL UNIQUE,
  telegram_username TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  states TEXT[] NOT NULL DEFAULT '{}',
  qualifications TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_subscribers ENABLE ROW LEVEL SECURITY;

-- Service role can manage (used by edge function)
CREATE POLICY "Service role can manage telegram subscribers"
  ON public.telegram_subscribers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admins can view
CREATE POLICY "Admins can view telegram subscribers"
  ON public.telegram_subscribers
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
