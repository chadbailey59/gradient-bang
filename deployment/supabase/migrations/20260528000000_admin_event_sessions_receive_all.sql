-- Opt-in private-server observer sessions. Normal sessions keep scoped fanout.

ALTER TABLE public.event_sessions
  ADD COLUMN IF NOT EXISTS receive_all boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_event_sessions_receive_all
  ON public.event_sessions (receive_all)
  WHERE receive_all = true;

CREATE OR REPLACE FUNCTION public.event_session_set_receive_all(
  p_session_id uuid,
  p_edge_token text,
  p_receive_all boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_valid_edge_token(p_edge_token);

  UPDATE public.event_sessions
     SET receive_all = COALESCE(p_receive_all, false)
   WHERE session_id = p_session_id
     AND expires_at > now()
     AND hard_expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_session_not_found' USING ERRCODE = '02000';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.event_session_set_receive_all(uuid, text, boolean) IS
  'Service-token-only private server observer flag. receive_all sessions get every online gameplay event.';

REVOKE ALL ON FUNCTION public.event_session_set_receive_all(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_session_set_receive_all(uuid, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.event_session_publish(
  p_msg jsonb,
  p_recipient_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_corp_id uuid DEFAULT NULL,
  p_is_broadcast boolean DEFAULT false
) RETURNS bigint[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq, extensions, pg_temp
AS $$
DECLARE
  v_session record;
  v_msg_ids bigint[] := ARRAY[]::bigint[];
  v_msg_id bigint;
BEGIN
  FOR v_session IN
    SELECT DISTINCT session_id, queue_name
    FROM public.event_sessions
    WHERE expires_at > now()
      AND hard_expires_at > now()
      AND (
        COALESCE(receive_all, false)
        OR COALESCE(p_is_broadcast, false)
        OR (p_corp_id IS NOT NULL AND corp_id = p_corp_id)
        OR scope_character_ids && COALESCE(p_recipient_ids, ARRAY[]::uuid[])
      )
  LOOP
    BEGIN
      v_msg_id := pgmq.send(v_session.queue_name, p_msg);
      v_msg_ids := array_append(v_msg_ids, v_msg_id);
    EXCEPTION
      WHEN undefined_table THEN
        DELETE FROM public.event_sessions
         WHERE session_id = v_session.session_id;
    END;
  END LOOP;

  RETURN v_msg_ids;
END;
$$;

COMMENT ON FUNCTION public.event_session_publish(jsonb, uuid[], uuid, boolean) IS
  'Internal gameplay event fanout. Publishes to scoped sessions, broadcasts, and opt-in receive_all observer sessions.';

REVOKE ALL ON FUNCTION public.event_session_publish(jsonb, uuid[], uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_session_publish(jsonb, uuid[], uuid, boolean) TO service_role;
