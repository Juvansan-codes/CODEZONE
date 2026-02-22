-- Create an RPC to safely finish a match, update stats, and reward players
CREATE OR REPLACE FUNCTION public.finish_match(match_id_param UUID, winner_team_param TEXT)
RETURNS VOID AS $$
DECLARE
  v_match_record RECORD;
  v_player RECORD;
  v_is_winner BOOLEAN;
  v_coins_reward INTEGER;
  v_xp_reward INTEGER;
BEGIN
  -- 1. Get the match and verify it relies on 'in_progress' to prevent duplicate finishes
  SELECT * INTO v_match_record FROM public.matches WHERE id = match_id_param FOR UPDATE;
  
  IF v_match_record.status = 'completed' THEN
    RETURN; -- Already finished
  END IF;

  -- 2. Mark match as completed
  UPDATE public.matches
  SET 
    status = 'completed',
    winner_team = winner_team_param,
    ended_at = now()
  WHERE id = match_id_param;

  -- 3. Loop through all players and distribute rewards based on winner_team
  FOR v_player IN SELECT * FROM public.match_players WHERE match_id = match_id_param LOOP
    
    -- Determine if this player is on the winning team
    v_is_winner := (v_player.team = winner_team_param);

    -- Base rewards
    IF v_is_winner THEN
      v_coins_reward := 100;
      v_xp_reward := 50;
    ELSE
      v_coins_reward := 10;
      v_xp_reward := 10;
    END IF;

    -- Update the match_players record to reflect if they won (for history purposes)
    UPDATE public.match_players
    SET is_winner = v_is_winner
    WHERE id = v_player.id;

    -- 4. Update the user profile with rewards and stats
    UPDATE public.profiles
    SET 
      coins = COALESCE(coins, 0) + v_coins_reward,
      xp = COALESCE(xp, 0) + v_xp_reward,
      total_matches = COALESCE(total_matches, 0) + 1,
      total_wins = COALESCE(total_wins, 0) + CASE WHEN v_is_winner THEN 1 ELSE 0 END,
      updated_at = now()
    WHERE user_id = v_player.user_id;

    -- 5. Add to match_history for individual tracking
    INSERT INTO public.match_history (
      user_id, match_id, result, score, coins_earned, xp_earned, duration_seconds
    ) VALUES (
      v_player.user_id,
      match_id_param,
      CASE WHEN v_is_winner THEN 'win' ELSE 'loss' END,
      v_player.score,
      v_coins_reward,
      v_xp_reward,
      EXTRACT(EPOCH FROM (now() - COALESCE(v_match_record.started_at, now())))::INTEGER
    );

  END LOOP;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
