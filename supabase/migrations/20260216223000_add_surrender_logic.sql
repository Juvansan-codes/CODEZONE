-- Add status column to match_players if it doesn't exist
ALTER TABLE public.match_players 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'surrendered', 'disconnected'));

-- RPC function to handle surrender
CREATE OR REPLACE FUNCTION public.surrender_match(match_id_param UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_match_record RECORD;
  v_team TEXT;
  v_opponent_team TEXT;
  v_teammates_count INTEGER;
  v_surrendered_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  -- 1. Mark player as surrendered
  UPDATE public.match_players
  SET status = 'surrendered'
  WHERE match_id = match_id_param AND user_id = v_user_id;
  
  -- 2. Get match details
  SELECT * INTO v_match_record FROM public.matches WHERE id = match_id_param;
  
  -- Determine team
  IF v_user_id = ANY(v_match_record.team_a) THEN
    v_team := 'team_a';
    v_opponent_team := 'team_b';
  ELSIF v_user_id = ANY(v_match_record.team_b) THEN
    v_team := 'team_b';
    v_opponent_team := 'team_a';
  ELSE
    RAISE EXCEPTION 'User not in match';
  END IF;

  -- 3. Check if strict 1v1 (Duel) -> Immediate loss
  IF v_match_record.game_mode = 'duel' OR v_match_record.team_size = 1 THEN
      UPDATE public.matches
      SET 
        status = 'completed',
        winner_team = v_opponent_team,
        ended_at = now()
      WHERE id = match_id_param;
      RETURN;
  END IF;

  -- 4. Check if ALL teammates have surrendered (for team modes)
  -- Count total players in this team for this match
  SELECT COUNT(*) INTO v_teammates_count 
  FROM public.match_players 
  WHERE match_id = match_id_param AND team = (CASE WHEN v_team = 'team_a' THEN 'team_a' ELSE 'team_b' END); -- Simplified check based on team array logic or match_players team column

  -- Actually match_players has a 'team' column ('team_a' or 'team_b')
  -- Let's use that for simpler counting
  
  SELECT COUNT(*) INTO v_teammates_count
  FROM public.match_players
  WHERE match_id = match_id_param 
  AND team = v_team;

  SELECT COUNT(*) INTO v_surrendered_count
  FROM public.match_players
  WHERE match_id = match_id_param 
  AND team = v_team
  AND status = 'surrendered';

  -- If all teammates surrendered, opponent wins
  IF v_surrendered_count >= v_teammates_count THEN
      UPDATE public.matches
      SET 
        status = 'completed',
        winner_team = v_opponent_team,
        ended_at = now()
      WHERE id = match_id_param;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
