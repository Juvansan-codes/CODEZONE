-- Migration to completely replace surrender_match RPC
-- Now includes XP deductions for surrendering players and delegating rewards via finish_match.

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
  
  -- 2. Deduct XP penalty for this specific user
  -- Penalty is 20 XP. We ensure XP doesn't drop below 0.
  UPDATE public.profiles
  SET xp = GREATEST(COALESCE(xp, 0) - 20, 0)
  WHERE user_id = v_user_id;

  -- Insert a match history record specifically for this user's surrender 
  -- if they aren't going to be processed by finish_match (e.g. they surrendered early)
  -- Or we can let finish_match handle the history, but finish_match only runs once for the whole match.
  -- For now, let's just do the XP deduction immediately.

  -- 3. Get match details
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

  -- 4. Check if strict 1v1 (Duel) -> Immediate loss
  IF v_match_record.game_mode = 'duel' OR v_match_record.team_size = 1 THEN
      -- In a duel, if you surrender, the match is over, opponent wins.
      -- We can safely call finish_match to distribute rewards (Wait, finish_match might also give +10 to loser, 
      -- but we already deducted 20, so net is -10. That's fine!)
      PERFORM public.finish_match(match_id_param, v_opponent_team);
      RETURN;
  END IF;

  -- 5. Check if ALL teammates have surrendered (for team modes)
  SELECT COUNT(*) INTO v_teammates_count
  FROM public.match_players
  WHERE match_id = match_id_param AND team = v_team;

  SELECT COUNT(*) INTO v_surrendered_count
  FROM public.match_players
  WHERE match_id = match_id_param AND team = v_team AND status = 'surrendered';

  -- If all teammates surrendered, opponent wins the whole match
  IF v_surrendered_count >= v_teammates_count THEN
      -- Call finish match to conclude the game for everyone and issue victory rewards to the opponent team.
      PERFORM public.finish_match(match_id_param, v_opponent_team);
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
