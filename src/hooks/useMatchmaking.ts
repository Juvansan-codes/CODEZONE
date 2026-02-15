import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type GameMode = 'duel' | 'campaign' | 'practice';
type MatchStatus = 'idle' | 'searching' | 'found' | 'error';

export const useMatchmaking = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<MatchStatus>('idle');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to handle match found (prevents duplicate navigation)
  const handleMatchFound = useCallback((foundMatchId: string) => {
    setMatchId((prev) => {
      if (prev) return prev; // Already found, don't re-trigger
      toast.success('Match Found! Entering arena...');
      return foundMatchId;
    });
    setStatus('found');
  }, []);

  // Subscribe to queue updates (Realtime) + Polling Fallback
  useEffect(() => {
    if (!queueId) return;

    // --- Realtime subscription (fast path) ---
    const channel = supabase
      .channel(`queue-${queueId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matchmaking_queue',
          filter: `id=eq.${queueId}`,
        },
        (payload) => {
          console.log('Queue update (Realtime):', payload);
          if (payload.new.status === 'matched' && payload.new.match_id) {
            handleMatchFound(payload.new.match_id);
          }
        }
      )
      .subscribe();

    // --- Polling fallback (every 3s) ---
    // Polls 1) The queue for status updates
    // Polls 2) The MATCHES table directly (in case RLS blocked the queue update)
    pollRef.current = setInterval(async () => {
      // Check Queue (Fast check)
      const { data: queueData } = await supabase
        .from('matchmaking_queue')
        .select('status, match_id')
        .eq('id', queueId)
        .single();

      if (queueData?.status === 'matched' && queueData?.match_id) {
        console.log('Match found via Queue poll:', queueData);
        handleMatchFound(queueData.match_id);
        return;
      }

      // Check Matches table (Deep check - robustness against RLS)
      // "Find a match where (team_a has me OR team_b has me) AND status is in_progress"
      const { data: matchData } = await supabase
        .from('matches')
        .select('id')
        .or(`team_a.cs.{${user.id}},team_b.cs.{${user.id}}`)
        .eq('status', 'in_progress')
        .gt('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()) // Created in last 2 mins
        .limit(1)
        .single();

      if (matchData) {
        console.log('Match found via Matches table poll:', matchData);
        handleMatchFound(matchData.id);
      }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [queueId, handleMatchFound]);

  const joinQueue = useCallback(async (mode: GameMode, teamSize: number) => {
    if (!user) {
      toast.error('You must be logged in to play.');
      return;
    }

    setStatus('searching');
    setMatchId(null);

    try {
      // 0. Clean up MY old queue entries first (from previous sessions/crashes)
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      // 1. Purge ALL stale entries older than 2 minutes (ghost prevention)
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('status', 'waiting')
        .lt('created_at', twoMinutesAgo);

      // 2. Search for a FRESH waiting opponent
      const { data: opponents, error: searchError } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('game_mode', mode)
        .eq('team_size', teamSize)
        .eq('status', 'waiting')
        .neq('user_id', user.id) // Don't match with self
        .gte('created_at', twoMinutesAgo) // Only fresh entries
        .limit(1);

      if (searchError) throw searchError;

      if (opponents && opponents.length > 0) {
        // --- FOUND AN OPPONENT! MATCH THEM! ---
        const opponent = opponents[0];

        // A. Create the match
        const { data: match, error: matchError } = await supabase
          .from('matches')
          .insert({
            game_mode: mode,
            team_size: teamSize,
            status: 'in_progress',
            team_a: [opponent.user_id], // Opponent is Team A (waiting longer)
            team_b: [user.id],          // I am Team B
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (matchError) throw matchError;

        // B. Update opponent's queue status -> matched
        const { error: updateError } = await supabase
          .from('matchmaking_queue')
          .update({ status: 'matched', match_id: match.id })
          .eq('id', opponent.id);

        if (updateError) {
          console.error('Failed to update opponent queue status (RLS?):', updateError);
          // We continue anyway, because the polling fallback will catch it!
        }

        // C. Set my status -> found
        setMatchId(match.id);
        setStatus('found');
        toast.success('Opponent Found! Starting match...');

      } else {
        // --- NO OPPONENT. JOIN THE QUEUE ---
        const { data: entry, error: queueError } = await supabase
          .from('matchmaking_queue')
          .insert({
            user_id: user.id,
            game_mode: mode,
            team_size: teamSize,
            status: 'waiting',
          })
          .select()
          .single();

        if (queueError) throw queueError;

        setQueueId(entry.id);
        toast.info('Searching for players...');
      }

    } catch (err: any) {
      console.error('Matchmaking error:', err);
      toast.error('Failed to join matchmaking: ' + err.message);
      setStatus('error');
    }
  }, [user]);

  const leaveQueue = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      setStatus('idle');
      setQueueId(null);
      toast.info('Left matchmaking queue');
    } catch (err) {
      console.error('Error leaving queue:', err);
    }
  }, [user]);

  return {
    joinQueue,
    leaveQueue,
    status,
    matchId,
  };
};
