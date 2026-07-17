-- Fix: Automatically insert team players into match_players on match creation.
CREATE OR REPLACE FUNCTION public.handle_match_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Update matchmaking queue entries
  UPDATE public.matchmaking_queue
  SET status = 'matched', match_id = NEW.id, updated_at = now()
  WHERE user_id = ANY(NEW.team_a || NEW.team_b)
    AND status = 'waiting';

  -- 2. Insert Team A players
  IF NEW.team_a IS NOT NULL THEN
    FOREACH v_user_id IN ARRAY NEW.team_a LOOP
      INSERT INTO public.match_players (match_id, user_id, team, status)
      VALUES (NEW.id, v_user_id, 'team_a', 'active');
    END LOOP;
  END IF;

  -- 3. Insert Team B players
  IF NEW.team_b IS NOT NULL THEN
    FOREACH v_user_id IN ARRAY NEW.team_b LOOP
      INSERT INTO public.match_players (match_id, user_id, team, status)
      VALUES (NEW.id, v_user_id, 'team_b', 'active');
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
