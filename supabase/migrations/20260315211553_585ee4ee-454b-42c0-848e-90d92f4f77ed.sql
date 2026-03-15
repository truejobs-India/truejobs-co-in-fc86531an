
-- chatbot_analytics table
CREATE TABLE public.chatbot_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  query_text text,
  query_language text,
  intent text,
  retrieval_status text,
  retrieval_count integer DEFAULT 0,
  was_refused boolean DEFAULT false,
  refusal_reason text,
  response_time_ms integer,
  ip_hash text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.chatbot_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read chatbot analytics"
  ON public.chatbot_analytics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Security-definer insert RPC
CREATE OR REPLACE FUNCTION public.log_chatbot_event(
  p_session_id text, p_query_text text, p_query_language text,
  p_intent text, p_retrieval_status text, p_retrieval_count integer,
  p_was_refused boolean, p_refusal_reason text, p_response_time_ms integer,
  p_ip_hash text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO chatbot_analytics (session_id, query_text, query_language, intent,
    retrieval_status, retrieval_count, was_refused, refusal_reason, response_time_ms, ip_hash)
  VALUES (p_session_id, LEFT(p_query_text, 200), p_query_language, p_intent,
    p_retrieval_status, p_retrieval_count, p_was_refused, p_refusal_reason, p_response_time_ms, p_ip_hash);
END; $$;
