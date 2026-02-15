import { useState, useCallback, useEffect } from 'react';
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

  // Subscribe to queue updates (if someone matches with us)
  useEffect(() => {
    if (!queueId) return;

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
          console.log('Queue update:', payload);
          if (payload.new.status === 'matched' && payload.new.match_id) {
            setMatchId(payload.new.match_id);
            setStatus('found');
            toast.success('Match Found! Entering arena...');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queueId]);

  const joinQueue = useCallback(async (mode: GameMode, teamSize: number) => {
    if (!user) {
      toast.error('You must be logged in to play.');
      return;
    }

    setStatus('searching');
    setMatchId(null);

    try {
      // 1. Check if ANYONE is waiting in the queue (simple FIFO for now)
      // ignoring rank for now to ensure matching works easily
      const { data: opponents, error: searchError } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('game_mode', mode)
        .eq('team_size', teamSize)
        .eq('status', 'waiting')
        .neq('user_id', user.id) // Don't match with self
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
        await supabase
          .from('matchmaking_queue')
          .update({ status: 'matched', match_id: match.id })
          .eq('id', opponent.id);

        // C. Set my status -> found
        setMatchId(match.id);
        setStatus('found');
        toast.success('Opponent Found! Starting match...');

      } else {
        // --- NO OPPONENT. JOIN THE QUEUE ---
        // Clean up any old queue entries first
        await supabase
          .from('matchmaking_queue')
          .delete()
          .eq('user_id', user.id);

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
