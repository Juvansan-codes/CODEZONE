
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getRankFromXP, getAdjacentTiers } from '@/lib/utils';
import { toast } from 'sonner';

type GameMode = 'duel' | 'campaign' | 'practice';
type MatchStatus = 'idle' | 'searching' | 'found' | 'error';

const QUEUE_TIMEOUT_MS = 30_000; // 30 seconds

export const useMatchmaking = () => {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<MatchStatus>('idle');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Compute current rank tier from profile XP
  const currentTier = getRankFromXP(profile?.xp ?? 0).rank.name;

  // Helper to handle match found (prevents duplicate navigation)
  const handleMatchFound = useCallback((foundMatchId: string) => {
    setMatchId((prev) => {
      if (prev) return prev; // Already found, don't re-trigger
      toast.success('Match Found! Entering arena...');
      return foundMatchId;
    });
    setStatus('found');

    // Clear timeout since we found a match
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup function for queue timeout + polling + realtime
  const cleanupAll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Subscribe to queue updates (Realtime) + Polling Fallback
  useEffect(() => {
    if (!queueId || !user) return;

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
          if (payload.new.status === 'matched' && payload.new.match_id) {
            handleMatchFound(payload.new.match_id);
          }
        }
      )
      // Also listen for new INSERT events — a new player joining could match us
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matchmaking_queue',
        },
        async (payload) => {
          // If we are still waiting and the new entry is a potential opponent
          if (
            payload.new.status === 'waiting' &&
            payload.new.user_id !== user?.id
          ) {
            // Re-check our queue status — the new opponent may have already matched us
            const { data: queueData } = await supabase
              .from('matchmaking_queue')
              .select('status, match_id')
              .eq('id', queueId)
              .single();

            if (queueData?.status === 'matched' && queueData?.match_id) {
              handleMatchFound(queueData.match_id);
            }
          }
        }
      )
      .subscribe();

    // --- Polling fallback (every 3s) ---
    pollRef.current = setInterval(async () => {
      // Check Queue (Fast check)
      const { data: queueData } = await supabase
        .from('matchmaking_queue')
        .select('status, match_id')
        .eq('id', queueId)
        .maybeSingle();

      if (queueData?.status === 'matched' && queueData?.match_id) {
        handleMatchFound(queueData.match_id);
        return;
      }

      // Check Matches table (Deep check - robustness against RLS)
      // "Find a match where (team_a has me OR team_b has me) AND status is in_progress"
      const { data: matchData } = await supabase
        .from('matches')
        .select('id')
        .or(`team_a.cs.{"${user.id}"},team_b.cs.{"${user.id}"}`)
        .eq('status', 'in_progress')
        .gt('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()) // Created in last 2 mins
        .limit(1)
        .maybeSingle();

      if (matchData) {
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
  }, [queueId, handleMatchFound, user]);

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

      // 2. Compute rank tier and adjacent tiers for filtering
      const myTier = getRankFromXP(profile?.xp ?? 0).rank.name;
      const allowedTiers = getAdjacentTiers(myTier);

      // 3. Search for a FRESH waiting opponent in same or adjacent rank tier
      const { data: potentialOpponents, error: searchError } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('game_mode', mode)
        .eq('team_size', teamSize)
        .eq('status', 'waiting')
        .neq('user_id', user.id) // Don't match with self
        .in('rank_tier', allowedTiers) // Same or adjacent rank tier
        .gte('created_at', twoMinutesAgo) // Only fresh entries
        .limit(10); // Fetch more than 1 to allow for filtering

      if (searchError) throw searchError;

      let validOpponent = null;

      if (potentialOpponents && potentialOpponents.length > 0) {
        // Check which of these opponents are actually online
        const opponentIds = potentialOpponents.map(op => op.user_id);

        const { data: onlineProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id')
          .in('user_id', opponentIds)
          .eq('is_online', true);

        if (!profilesError && onlineProfiles && onlineProfiles.length > 0) {
          // Find the first opponent in our queue list that is also in the onlineProfiles list
          // (This preserves the "first come first serve" order of the queue query)
          const onlineUserIds = new Set(onlineProfiles.map(p => p.user_id));
          validOpponent = potentialOpponents.find(op => onlineUserIds.has(op.user_id));
        }
      }

      if (validOpponent) {
        // --- FOUND A VALID ONLINE OPPONENT! MATCH THEM! ---
        const opponent = validOpponent;

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
          // console.warn('Failed to update opponent queue status (RLS?) - polling fallback will handle it.');
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
            rank_tier: myTier,
          })
          .select()
          .single();

        if (queueError) throw queueError;

        setQueueId(entry.id);
        toast.info('Searching for players...');

        // --- 30-SECOND TIMEOUT ---
        timeoutRef.current = setTimeout(async () => {
          // Auto-remove from queue and notify the user
          await supabase
            .from('matchmaking_queue')
            .delete()
            .eq('user_id', user.id);

          setStatus('idle');
          setQueueId(null);
          toast.error('No opponent found, try again.');
        }, QUEUE_TIMEOUT_MS);
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Matchmaking error:', err);
      toast.error('Failed to join matchmaking: ' + message);
      setStatus('error');
    }
  }, [user, profile]);

  const leaveQueue = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      setStatus('idle');
      setQueueId(null);
      cleanupAll();
      toast.info('Left matchmaking queue');
    } catch (err) {
      console.error('Error leaving queue:', err);
    }
  }, [user, cleanupAll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupAll();
  }, [cleanupAll]);

  return {
    joinQueue,
    leaveQueue,
    status,
    matchId,
  };
};
