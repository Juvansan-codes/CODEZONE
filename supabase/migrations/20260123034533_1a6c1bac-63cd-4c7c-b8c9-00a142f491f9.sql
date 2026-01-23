-- Fix PUBLIC_DATA_EXPOSURE: Restrict profiles to authenticated users only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" 
  ON public.profiles FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Fix PUBLIC_MATCHMAKING_DATA: Restrict matchmaking_queue to authenticated users
DROP POLICY IF EXISTS "Anyone can view queue" ON public.matchmaking_queue;
CREATE POLICY "Authenticated users can view queue" 
  ON public.matchmaking_queue FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Fix PUBLIC_MATCH_DATA: Restrict matches to participants only
DROP POLICY IF EXISTS "Anyone can view matches" ON public.matches;
CREATE POLICY "Match participants can view matches" 
  ON public.matches FOR SELECT 
  USING (auth.uid() = ANY(team_a) OR auth.uid() = ANY(team_b));

-- Fix PUBLIC_MATCH_PLAYERS: Restrict match_players to participants only
DROP POLICY IF EXISTS "Anyone can view match players" ON public.match_players;
CREATE POLICY "Match participants can view match players" 
  ON public.match_players FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = match_players.match_id 
      AND (auth.uid() = ANY(matches.team_a) OR auth.uid() = ANY(matches.team_b))
    )
  );