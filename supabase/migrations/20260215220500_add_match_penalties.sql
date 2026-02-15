-- Add penalty columns to matches table
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS team_a_penalties INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS team_b_penalties INTEGER DEFAULT 0;

-- Function to apply penalty atomically
CREATE OR REPLACE FUNCTION apply_penalty(
  match_id_param UUID, 
  team_side TEXT, -- 'a' or 'b'
  amount INTEGER
)
RETURNS VOID AS $$
BEGIN
  IF team_side = 'a' THEN
    UPDATE matches 
    SET team_a_penalties = team_a_penalties + amount
    WHERE id = match_id_param;
  ELSIF team_side = 'b' THEN
    UPDATE matches 
    SET team_b_penalties = team_b_penalties + amount
    WHERE id = match_id_param;
  END IF;
END;
$$ LANGUAGE plpgsql;
