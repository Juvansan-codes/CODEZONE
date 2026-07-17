-- Atomic matchmaking RPC: finds a waiting opponent and creates a match in one transaction.
-- Uses SELECT ... FOR UPDATE SKIP LOCKED to prevent two players from claiming the same opponent.

CREATE OR REPLACE FUNCTION public.find_or_create_match(
  p_queue_id UUID,
  p_user_id UUID,
  p_game_mode TEXT,
  p_team_size INTEGER,
  p_allowed_tiers TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opponent RECORD;
  v_match_id UUID;
BEGIN
  -- 1. Try to find and lock a single waiting opponent in an allowed rank tier.
  --    FOR UPDATE SKIP LOCKED ensures that if another concurrent call is already
  --    trying to claim this same row, we skip it and move on to the next.
  SELECT id, user_id
    INTO v_opponent
    FROM public.matchmaking_queue
   WHERE game_mode   = p_game_mode
     AND team_size   = p_team_size
     AND status      = 'waiting'
     AND user_id    != p_user_id        -- don't match with self
     AND id         != p_queue_id       -- don't match own queue entry
     AND rank_tier   = ANY(p_allowed_tiers)
     AND created_at  > now() - INTERVAL '2 minutes'  -- freshness
   ORDER BY created_at ASC              -- FIFO: oldest waiter gets matched first
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  -- 2. If no opponent found, return NULL — the caller stays in the queue.
  IF v_opponent IS NULL THEN
    RETURN NULL;
  END IF;

  -- 3. Create the match. Opponent waited longer → team_a. Caller → team_b.
  INSERT INTO public.matches (game_mode, team_size, status, team_a, team_b, started_at)
  VALUES (p_game_mode, p_team_size, 'in_progress', ARRAY[v_opponent.user_id], ARRAY[p_user_id], now())
  RETURNING id INTO v_match_id;

  -- 4. Mark BOTH queue entries as matched.
  UPDATE public.matchmaking_queue
     SET status   = 'matched',
         match_id = v_match_id,
         updated_at = now()
   WHERE id IN (v_opponent.id, p_queue_id)
     AND status = 'waiting';

  RETURN v_match_id;
END;
$$;
