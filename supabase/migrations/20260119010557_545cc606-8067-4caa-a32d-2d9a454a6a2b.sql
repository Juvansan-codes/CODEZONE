-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 500,
  gems INTEGER NOT NULL DEFAULT 100,
  rank TEXT NOT NULL DEFAULT 'Bronze',
  best_rank TEXT NOT NULL DEFAULT 'Bronze',
  total_matches INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create matchmaking queue table
CREATE TABLE public.matchmaking_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_mode TEXT NOT NULL CHECK (game_mode IN ('duel', 'campaign', 'practice')),
  team_size INTEGER NOT NULL CHECK (team_size IN (1, 3, 5)),
  rank_tier TEXT NOT NULL DEFAULT 'Bronze',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'cancelled')),
  match_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on matchmaking_queue
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Matchmaking queue policies
CREATE POLICY "Users can view all queue entries" ON public.matchmaking_queue FOR SELECT USING (true);
CREATE POLICY "Users can insert own queue entry" ON public.matchmaking_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own queue entry" ON public.matchmaking_queue FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own queue entry" ON public.matchmaking_queue FOR DELETE USING (auth.uid() = user_id);

-- Create matches table
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_mode TEXT NOT NULL CHECK (game_mode IN ('duel', 'campaign', 'practice')),
  team_size INTEGER NOT NULL CHECK (team_size IN (1, 3, 5)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  team_a UUID[] NOT NULL DEFAULT '{}',
  team_b UUID[] NOT NULL DEFAULT '{}',
  winner_team TEXT CHECK (winner_team IN ('team_a', 'team_b', 'draw')),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on matches
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Matches policies
CREATE POLICY "Users can view all matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create matches" ON public.matches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update matches" ON public.matches FOR UPDATE USING (auth.role() = 'authenticated');

-- Create match_players table for individual player stats per match
CREATE TABLE public.match_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team TEXT NOT NULL CHECK (team IN ('team_a', 'team_b')),
  score INTEGER NOT NULL DEFAULT 0,
  problems_solved INTEGER NOT NULL DEFAULT 0,
  is_winner BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on match_players
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;

-- Match players policies
CREATE POLICY "Users can view all match players" ON public.match_players FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert match players" ON public.match_players FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update match players" ON public.match_players FOR UPDATE USING (auth.role() = 'authenticated');

-- Create friendships table
CREATE TABLE public.friendships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Enable RLS on friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Friendships policies
CREATE POLICY "Users can view their own friendships" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can insert friendships" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own friendships" ON public.friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can delete their own friendships" ON public.friendships FOR DELETE USING (auth.uid() = user_id);

-- Create leaderboard view
CREATE VIEW public.leaderboard AS
SELECT 
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.level,
  p.rank,
  p.total_matches,
  p.total_wins,
  CASE WHEN p.total_matches > 0 THEN ROUND((p.total_wins::DECIMAL / p.total_matches) * 100, 1) ELSE 0 END as win_rate
FROM public.profiles p
ORDER BY p.total_wins DESC, p.level DESC;

-- Enable realtime for matchmaking queue and matches
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_matchmaking_queue_updated_at
BEFORE UPDATE ON public.matchmaking_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();