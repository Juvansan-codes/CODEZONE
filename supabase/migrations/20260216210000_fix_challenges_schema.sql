-- Drop existing tables to resolve schema conflicts
drop table if exists public.user_challenges cascade;
drop table if exists public.challenges cascade;

-- Re-create challenges table for admin-managed quests
create table public.challenges (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  type text check (type in ('daily', 'weekly', 'achievement')) default 'daily',
  goal_type text check (goal_type in ('matches_won', 'problems_solved', 'login_streak')) default 'matches_won',
  goal_target integer default 1,
  reward_coins integer default 0,
  reward_gems integer default 0,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for challenges
alter table public.challenges enable row level security;

-- Policies for challenges
create policy "Challenges are viewable by everyone" 
  on public.challenges for select 
  using (true);

create policy "Admins can manage challenges" 
  on public.challenges for all 
  using (public.is_admin());

-- Re-create user_challenges table to track progress
create table public.user_challenges (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(user_id) on delete cascade not null,
  challenge_id uuid references public.challenges(id) on delete cascade not null,
  progress integer default 0,
  is_completed boolean default false,
  is_claimed boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, challenge_id)
);

-- Enable RLS for user_challenges
alter table public.user_challenges enable row level security;

-- Policies for user_challenges
create policy "Users can view own progress" 
  on public.user_challenges for select 
  using (auth.uid() = user_id);

create policy "Users can update own progress" 
  on public.user_challenges for update 
  using (auth.uid() = user_id);

create policy "Users can insert own progress" 
  on public.user_challenges for insert 
  with check (auth.uid() = user_id);


