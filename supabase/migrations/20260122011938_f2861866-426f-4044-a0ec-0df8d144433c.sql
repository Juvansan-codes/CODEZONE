-- Create challenges table
CREATE TABLE public.challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge_type TEXT NOT NULL DEFAULT 'daily',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  reward_coins INTEGER NOT NULL DEFAULT 100,
  reward_gems INTEGER NOT NULL DEFAULT 10,
  reward_xp INTEGER NOT NULL DEFAULT 50,
  requirements JSONB NOT NULL DEFAULT '{}',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_challenges to track progress
CREATE TABLE public.user_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL DEFAULT 1,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

-- Create match_history table
CREATE TABLE public.match_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  opponent_ids UUID[] NOT NULL DEFAULT '{}',
  result TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  problems_solved INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  coins_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create parties table for party/squad system
CREATE TABLE public.parties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_id UUID NOT NULL,
  game_mode TEXT NOT NULL DEFAULT 'duel',
  team_size INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'forming',
  match_id UUID REFERENCES public.matches(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create party_members table
CREATE TABLE public.party_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(party_id, user_id)
);

-- Create user_analytics table
CREATE TABLE public.user_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  matches_played INTEGER NOT NULL DEFAULT 0,
  matches_won INTEGER NOT NULL DEFAULT 0,
  problems_solved INTEGER NOT NULL DEFAULT 0,
  time_played_seconds INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  coins_earned INTEGER NOT NULL DEFAULT 0,
  sabotages_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Add presence columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'offline';

-- Enable RLS on new tables
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;

-- Challenges are viewable by everyone
CREATE POLICY "Challenges are viewable by everyone" 
ON public.challenges FOR SELECT USING (true);

-- User challenges policies
CREATE POLICY "Users can view their own challenges" 
ON public.user_challenges FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own challenges" 
ON public.user_challenges FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own challenges" 
ON public.user_challenges FOR UPDATE USING (auth.uid() = user_id);

-- Match history policies
CREATE POLICY "Users can view their own match history" 
ON public.match_history FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own match history" 
ON public.match_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Parties policies
CREATE POLICY "Party members can view their party" 
ON public.parties FOR SELECT USING (
  leader_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.party_members WHERE party_id = id AND user_id = auth.uid())
);

CREATE POLICY "Users can create parties" 
ON public.parties FOR INSERT WITH CHECK (auth.uid() = leader_id);

CREATE POLICY "Party leaders can update their party" 
ON public.parties FOR UPDATE USING (auth.uid() = leader_id);

CREATE POLICY "Party leaders can delete their party" 
ON public.parties FOR DELETE USING (auth.uid() = leader_id);

-- Party members policies
CREATE POLICY "Party members can view members" 
ON public.party_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.parties WHERE id = party_id AND (leader_id = auth.uid() OR EXISTS (SELECT 1 FROM public.party_members pm WHERE pm.party_id = party_id AND pm.user_id = auth.uid())))
);

CREATE POLICY "Users can join parties" 
ON public.party_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their member status" 
ON public.party_members FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can leave parties" 
ON public.party_members FOR DELETE USING (auth.uid() = user_id);

-- User analytics policies
CREATE POLICY "Users can view their own analytics" 
ON public.user_analytics FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics" 
ON public.user_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analytics" 
ON public.user_analytics FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.parties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.party_members;

-- Create trigger to update party updated_at
CREATE TRIGGER update_parties_updated_at
BEFORE UPDATE ON public.parties
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default challenges
