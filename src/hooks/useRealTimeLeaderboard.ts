import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardEntry {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  rank: string;
  level: number;
  total_matches: number;
  total_wins: number;
  win_rate: number;
  position: number;
}

type TimeFrame = 'daily' | 'weekly' | 'alltime';

export const useRealTimeLeaderboard = (timeframe: TimeFrame = 'weekly') => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);

    // Fetch from leaderboard view
    const { data, error, count } = await supabase
      .from('leaderboard')
      .select('*', { count: 'exact' })
      .order('win_rate', { ascending: false })
      .order('total_wins', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      setLoading(false);
      return;
    }

    if (data) {
      const entries: LeaderboardEntry[] = data.map((entry, index) => ({
        id: entry.id || '',
        user_id: entry.id || '',
        username: entry.username || 'Unknown',
        display_name: entry.display_name,
        avatar_url: entry.avatar_url,
        rank: entry.rank || 'Bronze Techie',
        level: entry.level || 1,
        total_matches: entry.total_matches || 0,
        total_wins: entry.total_wins || 0,
        win_rate: entry.win_rate || 0,
        position: index + 1,
      }));

      setLeaderboard(entries);
      setTotalPlayers(count || entries.length);
    }

    setLoading(false);
  }, [timeframe]);

  // Get current user's rank
  const fetchMyRank = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .order('win_rate', { ascending: false })
      .order('total_wins', { ascending: false });

    if (data) {
      const myIndex = data.findIndex(entry => entry.id === userId);
      if (myIndex !== -1) {
        setMyRank(myIndex + 1);
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Subscribe to real-time changes on profiles
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          // Refetch leaderboard when any profile updates
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeaderboard]);

  return {
    leaderboard,
    loading,
    myRank,
    totalPlayers,
    refetch: fetchLeaderboard,
    fetchMyRank,
  };
};
