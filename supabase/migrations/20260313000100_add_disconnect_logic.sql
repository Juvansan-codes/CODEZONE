-- =========================================================================
-- ADD STATUS COLUMN + DISCONNECT LOGIC
-- =========================================================================

-- 1. Add status column if it doesn't exist
ALTER TABLE public.match_players
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 2. Drop any existing check constraints on match_players
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.match_players'::regclass AND contype = 'c'
    LOOP
        EXECUTE 'ALTER TABLE public.match_players DROP CONSTRAINT ' || quote_ident(constraint_record.conname);
    END LOOP;
END $$;

-- 3. Add new constraint with all valid statuses
ALTER TABLE public.match_players
ADD CONSTRAINT match_players_status_check
CHECK (status IN ('active', 'surrendered', 'disconnected', 'left'));


-- =========================================================================
-- RPC: leave_match
-- Called when a player explicitly exits the match.
-- Marks them as 'left', deducts 20 XP, checks if their team is empty.
-- If empty → finish_match awards win to opposing team.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.leave_match(match_id_param UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_match RECORD;
  v_team TEXT;
  v_opponent TEXT;
  v_active_count INTEGER;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_match FROM public.matches WHERE id = match_id_param;
  IF v_match IS NULL OR v_match.status != 'in_progress' THEN
    RETURN;
  END IF;

  -- Determine teams
  IF v_user_id = ANY(v_match.team_a) THEN
    v_team := 'team_a';
    v_opponent := 'team_b';
  ELSIF v_user_id = ANY(v_match.team_b) THEN
    v_team := 'team_b';
    v_opponent := 'team_a';
  ELSE
    RAISE EXCEPTION 'User not in match';
  END IF;

  -- Mark player as left
  UPDATE public.match_players
  SET status = 'left'
  WHERE match_id = match_id_param AND user_id = v_user_id;

  -- Deduct 20 XP
  UPDATE public.profiles
  SET xp = GREATEST(COALESCE(xp, 0) - 20, 0)
  WHERE user_id = v_user_id;

  -- Count remaining active players on this team
  SELECT COUNT(*) INTO v_active_count
  FROM public.match_players
  WHERE match_id = match_id_param
    AND team = v_team
    AND status = 'active';

  -- If team is empty, opponent wins
  IF v_active_count = 0 THEN
    PERFORM public.finish_match(match_id_param, v_opponent);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =========================================================================
-- RPC: check_match_timeouts
-- Polled by active clients every 15s. Detects players who stopped
-- heartbeating (last_seen > 60s ago) and marks them disconnected.
-- If a team hits 0 active players, ends the match.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.check_match_timeouts(match_id_param UUID)
RETURNS VOID AS $$
DECLARE
  v_match RECORD;
  v_team_a_active INTEGER;
  v_team_b_active INTEGER;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = match_id_param;
  IF v_match IS NULL OR v_match.status != 'in_progress' THEN
    RETURN;
  END IF;

  -- Mark timed-out players as disconnected
  UPDATE public.match_players
  SET status = 'disconnected'
  WHERE match_id = match_id_param
    AND status = 'active'
    AND user_id IN (
      SELECT user_id FROM public.profiles
      WHERE last_seen < now() - interval '60 seconds'
         OR is_online = false
    );

  -- Count active players per team
  SELECT COUNT(*) INTO v_team_a_active
  FROM public.match_players
  WHERE match_id = match_id_param AND team = 'team_a' AND status = 'active';

  SELECT COUNT(*) INTO v_team_b_active
  FROM public.match_players
  WHERE match_id = match_id_param AND team = 'team_b' AND status = 'active';

  -- End match if a team is empty
  IF v_team_a_active = 0 AND v_team_b_active = 0 THEN
    PERFORM public.finish_match(match_id_param, 'draw');
  ELSIF v_team_a_active = 0 THEN
    PERFORM public.finish_match(match_id_param, 'team_b');
  ELSIF v_team_b_active = 0 THEN
    PERFORM public.finish_match(match_id_param, 'team_a');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
