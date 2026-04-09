
CREATE TABLE public.notification_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  subject text,
  message_body text NOT NULL,
  cta_label text,
  cta_url text,
  audience_filter jsonb,
  audience_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  sent_by uuid REFERENCES public.profiles(user_id),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view send logs"
  ON public.notification_send_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert send logs"
  ON public.notification_send_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
