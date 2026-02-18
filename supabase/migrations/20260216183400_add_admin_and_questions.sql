-- Add is_admin column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create questions table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Expert')),
    template_code TEXT,
    test_cases JSONB,
    game_mode TEXT DEFAULT 'duel',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on questions
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Create policies for questions
-- admins can do everything
CREATE POLICY "Admins can do everything on questions" 
ON public.questions 
FOR ALL 
USING (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
    and profiles.is_admin = true
  )
);

-- Everyone can read questions (for gameplay)
CREATE POLICY "Everyone can read questions" 
ON public.questions 
FOR SELECT 
USING (true);

-- Update RLS for profiles to allow admins to see everything (optional, but good for admin lists)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
    and profiles.is_admin = true
  )
);
