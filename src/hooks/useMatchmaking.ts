import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type GameMode = 'campaign' | 'duel' | 'practice';
type TeamSize = 1 | 3 | 5;
type QueueStatus = 'idle' | 'searching' | 'matched' | 'error';

interface QueueEntry {
  id: string;
  user_id: string;
  game_mode: string;
  team_size: number;
  status: string;
  match_id: string | null;
  created_at: string;
}

interface Match {
  id: string;
  game_mode: string;
  team_size: number;
  status: string;
  team_a: string[];
  team_b: string[];
}

export const useMatchmaking = () => {
  const { user, profile } = useAuth();
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle');
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [playersInQueue, setPlayersInQueue] = useState(0);
  const [searchTime, setSearchTime] = useState(0);

  // Subscribe to queue changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('matchmaking')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matchmaking_queue',
        },
        async (payload) => {
          // Check if our queue entry was matched
          if (payload.new && (payload.new as QueueEntry).user_id === user.id) {
            const entry = payload.new as QueueEntry;
            setQueueEntry(entry);
            
            if (entry.status === 'matched' && entry.match_id) {
              setQueueStatus('matched');
              // Fetch the match details
              const { data: matchData } = await supabase
                .from('matches')
                .select('*')
                .eq('id', entry.match_id)
                .single();
              
              if (matchData) {
                setCurrentMatch(matchData as Match);
              }
            }
          }
          
          // Update player count in queue
          const { count } = await supabase
            .from('matchmaking_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'waiting');
          
          setPlayersInQueue(count || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Timer for search time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (queueStatus === 'searching') {
      interval = setInterval(() => {
        setSearchTime((prev) => prev + 1);
      }, 1000);
    } else {
      setSearchTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [queueStatus]);

  const joinQueue = useCallback(async (gameMode: GameMode, teamSize: TeamSize) => {
    if (!user || !profile) return { error: new Error('Not authenticated') };

    // First, cancel any existing queue entries
    await supabase
      .from('matchmaking_queue')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'waiting');

    // Insert new queue entry
    const { data, error } = await supabase
      .from('matchmaking_queue')
      .insert({
        user_id: user.id,
        game_mode: gameMode,
        team_size: teamSize,
        rank_tier: profile.rank,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) {
      setQueueStatus('error');
      return { error };
    }

    setQueueEntry(data as QueueEntry);
    setQueueStatus('searching');

    // Try to find a match
    await tryMatchPlayers(gameMode, teamSize);

    return { error: null };
  }, [user, profile]);

  const tryMatchPlayers = async (gameMode: GameMode, teamSize: TeamSize) => {
    // Get all waiting players for this mode and team size
    const { data: waitingPlayers } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('game_mode', gameMode)
      .eq('team_size', teamSize)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });

    if (!waitingPlayers) return;

    const requiredPlayers = teamSize * 2; // e.g., 5v5 needs 10 players

    if (waitingPlayers.length >= requiredPlayers) {
      // We have enough players! Create a match
      const matchPlayers = waitingPlayers.slice(0, requiredPlayers);
      const teamA = matchPlayers.slice(0, teamSize).map((p) => p.user_id);
      const teamB = matchPlayers.slice(teamSize, requiredPlayers).map((p) => p.user_id);

      // Create the match
      const { data: newMatch, error: matchError } = await supabase
        .from('matches')
        .insert({
          game_mode: gameMode,
          team_size: teamSize,
          status: 'pending',
          team_a: teamA,
          team_b: teamB,
        })
        .select()
        .single();

      if (matchError || !newMatch) return;

      // Update all queue entries with the match ID
      for (const player of matchPlayers) {
        await supabase
          .from('matchmaking_queue')
          .update({
            status: 'matched',
            match_id: newMatch.id,
          })
          .eq('id', player.id);

        // Also create match_players entries
        await supabase
          .from('match_players')
          .insert({
            match_id: newMatch.id,
            user_id: player.user_id,
            team: teamA.includes(player.user_id) ? 'team_a' : 'team_b',
          });
      }
    }
  };

  const leaveQueue = useCallback(async () => {
    if (!user) return;

    await supabase
      .from('matchmaking_queue')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'waiting');

    setQueueStatus('idle');
    setQueueEntry(null);
  }, [user]);

  const resetMatch = useCallback(() => {
    setQueueStatus('idle');
    setQueueEntry(null);
    setCurrentMatch(null);
  }, []);

  return {
    queueStatus,
    queueEntry,
    currentMatch,
    playersInQueue,
    searchTime,
    joinQueue,
    leaveQueue,
    resetMatch,
  };
};
