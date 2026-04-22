import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

export interface AnalyticsData {
  stats: {
    winRate: number;
    totalMatches: number;
    totalWins: number;
    currentStreak: number;
    rank: string;
    xp: number;
    avgSolveTime: number; // in seconds
  };
  performanceData: {
    day: string;
    xp: number;
    matches: number;
    date: string;
  }[];
  gameModeData: {
    name: string;
    value: number;
    color: string;
  }[];
  recentActivity: {
    id: string;
    action: string;
    time: string;
    points: string;
    type: 'success' | 'error' | 'gold';
  }[];
  loading: boolean;
}

const COLORS = ['#68c3a3', '#4a9d7f', '#ff4655', '#fbbf24', '#3b82f6'];

interface RecentMatch {
  id: string;
  created_at: string;
  result: string;
  xp_earned: number;
  matches: {
    game_mode?: string;
    winner_team?: string;
  } | null;
}

export const useUserAnalytics = () => {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData>({
    stats: {
      winRate: 0,
      totalMatches: 0,
      totalWins: 0,
      currentStreak: 0,
      rank: 'Unranked',
      xp: 0,
      avgSolveTime: 0,
    },
    performanceData: [],
    gameModeData: [],
    recentActivity: [],
    loading: true,
  });

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Fetch Profile Stats
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_matches, total_wins, rank, xp')
        .eq('user_id', user.id)
        .single();

      // 2. Fetch User Analytics (Daily Performance) - Last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: dailyStats } = await supabase
        .from('user_analytics')
        .select('date, matches_played, xp_earned, time_played_seconds')
        .eq('user_id', user.id)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      // 3. Fetch Recent Details from Match History
      const { data: recentMatches } = await supabase
        .from('match_history')
        .select(`
          id,
          created_at,
          result,
          xp_earned,
          matches (
            game_mode,
            winner_team
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Process Data

      // Calculate Avg Solve Time (based on daily stats)
      const totalTime = dailyStats?.reduce((acc, curr) => acc + curr.time_played_seconds, 0) || 0;
      const totalMatchesCalculated = dailyStats?.reduce((acc, curr) => acc + curr.matches_played, 0) || 0;
      const avgSolveTime = totalMatchesCalculated > 0 ? Math.round(totalTime / totalMatchesCalculated) : 0;

      // Format Performance Data (Graph)
      const performanceData = dailyStats?.map(day => ({
        day: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
        date: day.date,
        xp: day.xp_earned,
        matches: day.matches_played,
      })) || [];

      // Calculate Game Mode Distribution
      const gameModes: Record<string, number> = {};
      const typedRecentMatches = (recentMatches ?? []) as RecentMatch[];
      typedRecentMatches.forEach((match) => {
        const mode = match.matches?.game_mode || 'Unknown';
        gameModes[mode] = (gameModes[mode] || 0) + 1;
      });

      const gameModeData = Object.entries(gameModes).map(([name, value], index) => ({
        name: name.replace('_', ' ').toUpperCase(),
        value,
        color: COLORS[index % COLORS.length],
      }));

      // Format Recent Activity
      const recentActivity = typedRecentMatches.map((match) => {
        const isWin = match.result === 'win';
        const points = match.xp_earned > 0 ? `+${match.xp_earned} XP` : `${match.xp_earned} XP`;

        let action = '';
        const mode = match.matches?.game_mode;

        if (mode === '1v1') action = isWin ? 'Won 1v1 Match' : 'Lost 1v1 Match';
        else if (mode === 'team') action = isWin ? 'Won Team Match' : 'Lost Team Match';
        else if (mode === 'battle_royale') action = `Battle Royale Match`;
        else action = isWin ? 'Match Victory' : 'Match Defeat';

        return {
          id: match.id,
          action,
          time: formatDistanceToNow(new Date(match.created_at), { addSuffix: true }),
          points,
          type: isWin ? 'success' as const : 'error' as const,
        };
      });

      setData({
        stats: {
          winRate: profile?.total_matches ? Math.round((profile.total_wins / profile.total_matches) * 100) : 0,
          totalMatches: profile?.total_matches || 0,
          totalWins: profile?.total_wins || 0,
          currentStreak: 0, // Streak calculation is complex, omitting for now to keep it simple
          rank: profile?.rank || 'Unranked',
          xp: profile?.xp || 0,
          avgSolveTime,
        },
        performanceData,
        gameModeData,
        recentActivity,
        loading: false,
      });

    } catch (error) {
      console.error('Error fetching analytics:', error);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { ...data, refetch: fetchAnalytics };
};
