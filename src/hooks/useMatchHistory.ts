import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MatchHistoryEntry {
  id: string;
  match_id: string;
  result: 'win' | 'loss' | 'draw';
  score: number;
  problems_solved: number;
  duration_seconds: number;
  xp_earned: number;
  coins_earned: number;
  opponent_names: string[];
  created_at: string;
}

export const useMatchHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalXP: 0,
    totalCoins: 0,
    avgScore: 0,
    avgDuration: 0,
  });

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('match_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching match history:', error);
      setLoading(false);
      return;
    }

    if (data) {
      // Fetch opponent names for each match
      const entries: MatchHistoryEntry[] = await Promise.all(
        data.map(async (entry) => {
          let opponentNames: string[] = [];
          
          if (entry.opponent_ids && entry.opponent_ids.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('username')
              .in('user_id', entry.opponent_ids);
            
            opponentNames = profiles?.map(p => p.username) || [];
          }

          return {
            id: entry.id,
            match_id: entry.match_id,
            result: entry.result as 'win' | 'loss' | 'draw',
            score: entry.score,
            problems_solved: entry.problems_solved,
            duration_seconds: entry.duration_seconds,
            xp_earned: entry.xp_earned,
            coins_earned: entry.coins_earned,
            opponent_names: opponentNames,
            created_at: entry.created_at,
          };
        })
      );

      setHistory(entries);

      // Calculate stats
      const wins = entries.filter(e => e.result === 'win').length;
      const losses = entries.filter(e => e.result === 'loss').length;
      const totalXP = entries.reduce((sum, e) => sum + e.xp_earned, 0);
      const totalCoins = entries.reduce((sum, e) => sum + e.coins_earned, 0);
      const totalScore = entries.reduce((sum, e) => sum + e.score, 0);
      const totalDuration = entries.reduce((sum, e) => sum + e.duration_seconds, 0);

      setStats({
        totalMatches: entries.length,
        wins,
        losses,
        winRate: entries.length > 0 ? Math.round((wins / entries.length) * 100) : 0,
        totalXP,
        totalCoins,
        avgScore: entries.length > 0 ? Math.round(totalScore / entries.length) : 0,
        avgDuration: entries.length > 0 ? Math.round(totalDuration / entries.length) : 0,
      });
    }

    setLoading(false);
  }, [user]);

  // Record a new match
  const recordMatch = useCallback(async (
    matchId: string,
    result: 'win' | 'loss' | 'draw',
    score: number,
    problemsSolved: number,
    durationSeconds: number,
    opponentIds: string[]
  ) => {
    if (!user) return { error: 'Not authenticated' };

    // Calculate rewards
    const xpEarned = result === 'win' ? 100 + (score * 2) : 25 + score;
    const coinsEarned = result === 'win' ? 50 + problemsSolved * 10 : 10 + problemsSolved * 5;

    const { error } = await supabase
      .from('match_history')
      .insert({
        user_id: user.id,
        match_id: matchId,
        result,
        score,
        problems_solved: problemsSolved,
        duration_seconds: durationSeconds,
        xp_earned: xpEarned,
        coins_earned: coinsEarned,
        opponent_ids: opponentIds,
      });

    if (error) {
      console.error('Error recording match:', error);
      return { error: error.message };
    }

    // Update user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_matches, total_wins, xp, coins')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      await supabase
        .from('profiles')
        .update({
          total_matches: profile.total_matches + 1,
          total_wins: result === 'win' ? profile.total_wins + 1 : profile.total_wins,
          xp: profile.xp + xpEarned,
          coins: profile.coins + coinsEarned,
        })
        .eq('user_id', user.id);
    }

    await fetchHistory();
    return { error: null, xpEarned, coinsEarned };
  }, [user, fetchHistory]);

  // Initial fetch
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    stats,
    loading,
    recordMatch,
    refetch: fetchHistory,
  };
};
