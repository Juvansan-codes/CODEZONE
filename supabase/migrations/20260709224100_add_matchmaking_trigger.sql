-- Create a trigger function to automatically update matchmaking queue entries
-- when a match is successfully created, bypassing RLS update limitations.
CREATE OR REPLACE FUNCTION public.handle_match_creation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.matchmaking_queue
  SET status = 'matched', match_id = NEW.id, updated_at = now()
  WHERE user_id = ANY(NEW.team_a || NEW.team_b)
    AND status = 'waiting';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger runs AFTER INSERT on public.matches
DROP TRIGGER IF EXISTS on_match_created ON public.matches;
CREATE TRIGGER on_match_created
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_match_creation();
