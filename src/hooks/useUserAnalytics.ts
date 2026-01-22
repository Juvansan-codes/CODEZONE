import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DailyAnalytics {
  date: string;
  matches_played: number;
  matches_won: number;
  problems_solved: number;
  time_played_seconds: number;
  xp_earned: number;
  coins_earned: number;
  sabotages_used: number;
}

interface AnalyticsSummary {
  totalMatches: number;
  totalWins: number;
  winRate: number;
  totalProblems: number;
  totalTimePlayed: number;
  totalXP: number;
  totalCoins: number;
  averageMatchesPerDay: number;
  currentStreak: number;
  bestStreak: number;
}

export const useUserAnalytics = (days: number = 30) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<DailyAnalytics[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary>({
    totalMatches: 0,
    totalWins: 0,
    winRate: 0,
    totalProblems: 0,
    totalTimePlayed: 0,
    totalXP: 0,
    totalCoins: 0,
    averageMatchesPerDay: 0,
    currentStreak: 0,
    bestStreak: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('user_analytics')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching analytics:', error);
      setLoading(false);
      return;
    }

    if (data) {
      const formattedData: DailyAnalytics[] = data.map(d => ({
        date: d.date,
        matches_played: d.matches_played,
        matches_won: d.matches_won,
        problems_solved: d.problems_solved,
        time_played_seconds: d.time_played_seconds,
        xp_earned: d.xp_earned,
        coins_earned: d.coins_earned,
        sabotages_used: d.sabotages_used,
      }));

      setAnalytics(formattedData);

      // Calculate summary
      const totalMatches = formattedData.reduce((sum, d) => sum + d.matches_played, 0);
      const totalWins = formattedData.reduce((sum, d) => sum + d.matches_won, 0);
      const totalProblems = formattedData.reduce((sum, d) => sum + d.problems_solved, 0);
      const totalTimePlayed = formattedData.reduce((sum, d) => sum + d.time_played_seconds, 0);
      const totalXP = formattedData.reduce((sum, d) => sum + d.xp_earned, 0);
      const totalCoins = formattedData.reduce((sum, d) => sum + d.coins_earned, 0);

      // Calculate streak
      let currentStreak = 0;
      let bestStreak = 0;
      let tempStreak = 0;

      const sortedByDate = [...formattedData].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      for (let i = 0; i < sortedByDate.length; i++) {
        if (sortedByDate[i].matches_played > 0) {
          tempStreak++;
          if (i === 0 || i === currentStreak) {
            currentStreak = tempStreak;
          }
          bestStreak = Math.max(bestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }

      setSummary({
        totalMatches,
        totalWins,
        winRate: totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0,
        totalProblems,
        totalTimePlayed,
        totalXP,
        totalCoins,
        averageMatchesPerDay: formattedData.length > 0 
          ? Math.round(totalMatches / formattedData.length * 10) / 10 
          : 0,
        currentStreak,
        bestStreak,
      });
    }

    setLoading(false);
  }, [user, days]);

  // Record today's activity
  const recordActivity = useCallback(async (activity: {
    matchesPlayed?: number;
    matchesWon?: number;
    problemsSolved?: number;
    timePlayedSeconds?: number;
    xpEarned?: number;
    coinsEarned?: number;
    sabotagesUsed?: number;
  }) => {
    if (!user) return { error: 'Not authenticated' };

    const today = new Date().toISOString().split('T')[0];

    // Check if today's record exists
    const { data: existing } = await supabase
      .from('user_analytics')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();

    if (existing) {
      // Update existing record
      await supabase
        .from('user_analytics')
        .update({
          matches_played: existing.matches_played + (activity.matchesPlayed || 0),
          matches_won: existing.matches_won + (activity.matchesWon || 0),
          problems_solved: existing.problems_solved + (activity.problemsSolved || 0),
          time_played_seconds: existing.time_played_seconds + (activity.timePlayedSeconds || 0),
          xp_earned: existing.xp_earned + (activity.xpEarned || 0),
          coins_earned: existing.coins_earned + (activity.coinsEarned || 0),
          sabotages_used: existing.sabotages_used + (activity.sabotagesUsed || 0),
        })
        .eq('id', existing.id);
    } else {
      // Create new record
      await supabase
        .from('user_analytics')
        .insert({
          user_id: user.id,
          date: today,
          matches_played: activity.matchesPlayed || 0,
          matches_won: activity.matchesWon || 0,
          problems_solved: activity.problemsSolved || 0,
          time_played_seconds: activity.timePlayedSeconds || 0,
          xp_earned: activity.xpEarned || 0,
          coins_earned: activity.coinsEarned || 0,
          sabotages_used: activity.sabotagesUsed || 0,
        });
    }

    await fetchAnalytics();
    return { error: null };
  }, [user, fetchAnalytics]);

  // Initial fetch
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    summary,
    loading,
    recordActivity,
    refetch: fetchAnalytics,
  };
};
