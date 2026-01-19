-- Drop the SECURITY DEFINER view and recreate as regular view with SECURITY INVOKER
DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW public.leaderboard WITH (security_invoker = true) AS
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