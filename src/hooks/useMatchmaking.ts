
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getRankFromXP, getAdjacentTiers } from '@/lib/utils';
import { toast } from 'sonner';

type GameMode = 'duel' | 'campaign' | 'practice';
type MatchStatus = 'idle' | 'searching' | 'found' | 'error';

interface QueueParams {
  queueId: string;
  mode: GameMode;
  teamSize: number;
  allowedTiers: string[];
}

const QUEUE_TIMEOUT_MS = 30_000; // 30 seconds
const POLL_INTERVAL_MS = 3_000;  // 3 seconds

export const useMatchmaking = () => {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<MatchStatus>('idle');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [queueId, setQueueId] = useState<string | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const matchFoundRef = useRef(false);
  const queueParamsRef = useRef<QueueParams | null>(null);
  const rpcAvailableRef = useRef(true); // Track if the RPC function exists

  // ─── Cleanup helpers ───────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const stopTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const unsubscribeChannel = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const cleanupAll = useCallback(() => {
    stopPolling();
    stopTimeout();
    unsubscribeChannel();
  }, [stopPolling, stopTimeout, unsubscribeChannel]);

  // ─── Handle match found (idempotent) ──────────────────────────────

  const handleMatchFound = useCallback((foundMatchId: string) => {
    if (matchFoundRef.current) return;
    matchFoundRef.current = true;

    setMatchId(foundMatchId);
    setStatus('found');
    toast.success('Match Found! Entering arena...');

    stopPolling();
    stopTimeout();
  }, [stopPolling, stopTimeout]);

  // ─── Try to match via RPC (atomic, race-condition-safe) ───────────

  const tryMatchViaRPC = useCallback(async (params: QueueParams): Promise<boolean> => {
    if (!user || !rpcAvailableRef.current) return false;

    try {
      const { data: foundMatchId, error: rpcError } = await supabase.rpc(
        'find_or_create_match' as never,
        {
          p_queue_id: params.queueId,
          p_user_id: user.id,
          p_game_mode: params.mode,
          p_team_size: params.teamSize,
          p_allowed_tiers: params.allowedTiers,
        } as never
      );

      if (rpcError) {
        // If the function doesn't exist, disable RPC and use client-side fallback
        if (rpcError.message?.includes('function') || rpcError.code === '42883') {
          console.warn('Matchmaking RPC not available, using client-side fallback');
          rpcAvailableRef.current = false;
          return false;
        }
        console.error('Matchmaking RPC error:', rpcError);
        return false;
      }

      if (foundMatchId) {
        handleMatchFound(foundMatchId as string);
        return true;
      }

      return false; // No opponent found yet
    } catch (err) {
      console.error('RPC call failed:', err);
      rpcAvailableRef.current = false;
      return false;
    }
  }, [user, handleMatchFound]);

  // ─── Client-side matching fallback (when RPC isn't available) ─────

  const tryMatchClientSide = useCallback(async (params: QueueParams): Promise<boolean> => {
    if (!user) return false;

    try {
      // Search for a waiting opponent
      const { data: opponents, error: searchError } = await supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('game_mode', params.mode)
        .eq('team_size', params.teamSize)
        .eq('status', 'waiting')
        .neq('user_id', user.id)
        .in('rank_tier', params.allowedTiers)
        .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })
        .limit(1);

      if (searchError || !opponents || opponents.length === 0) {
        return false;
      }

      const opponent = opponents[0];

      // Create the match
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
          game_mode: params.mode,
          team_size: params.teamSize,
          status: 'in_progress',
          team_a: [opponent.user_id],
          team_b: [user.id],
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (matchError) {
        console.error('Failed to create match:', matchError);
        return false;
      }

      // Try to update opponent's queue entry (may fail due to RLS, trigger handles it)
      await supabase
        .from('matchmaking_queue')
        .update({ status: 'matched', match_id: match.id })
        .eq('id', opponent.id)
        .eq('status', 'waiting'); // Only update if still waiting (prevents double-match)

      // Update our own queue entry
      await supabase
        .from('matchmaking_queue')
        .update({ status: 'matched', match_id: match.id })
        .eq('id', params.queueId);

      handleMatchFound(match.id);
      return true;
    } catch (err) {
      console.error('Client-side matching failed:', err);
      return false;
    }
  }, [user, handleMatchFound]);

  // ─── Active match attempt (tries RPC first, then client-side) ─────

  const tryMatch = useCallback(async (params: QueueParams): Promise<boolean> => {
    // Try RPC first (atomic, no race conditions)
    if (rpcAvailableRef.current) {
      const matched = await tryMatchViaRPC(params);
      if (matched) return true;
    }

    // Fallback to client-side matching
    if (!rpcAvailableRef.current) {
      return await tryMatchClientSide(params);
    }

    return false;
  }, [tryMatchViaRPC, tryMatchClientSide]);

  // ─── Realtime + Active Polling (activated when queueId is set) ────

  useEffect(() => {
    if (!queueId || !user) return;

    const params = queueParamsRef.current;
    if (!params) return;

    // ── Realtime: listen for our queue entry being updated to "matched" ──
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
      // Listen for new queue entries — a new player joining could be our opponent
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matchmaking_queue',
        },
        async (payload) => {
          if (
            matchFoundRef.current ||
            payload.new.user_id === user.id ||
            payload.new.status !== 'waiting'
          ) return;

          // New player joined! Try to match with them
          await tryMatch(params);
        }
      )
      .subscribe();

    channelRef.current = channel;

    // ── Active Polling (every 3s) ──
    // Retries matching AND checks for status updates
    pollRef.current = setInterval(async () => {
      if (matchFoundRef.current) return;

      // 1. Check if our queue entry was already matched (by another player's RPC or trigger)
      const { data: queueData } = await supabase
        .from('matchmaking_queue')
        .select('status, match_id')
        .eq('id', queueId)
        .maybeSingle();

      if (queueData?.status === 'matched' && queueData?.match_id) {
        handleMatchFound(queueData.match_id);
        return;
      }

      // If our queue entry is gone, reset
      if (!queueData) {
        if (!matchFoundRef.current) {
          setStatus('idle');
          setQueueId(null);
          cleanupAll();
        }
        return;
      }

      // 2. Actively try to find and match with an opponent
      const matched = await tryMatch(params);
      if (matched) return;

      // 3. Deep fallback: check matches table directly
      const { data: matchData } = await supabase
        .from('matches')
        .select('id')
        .or(`team_a.cs.{"${user.id}"},team_b.cs.{"${user.id}"}`)
        .eq('status', 'in_progress')
        .gt('created_at', new Date(Date.now() - 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (matchData) {
        handleMatchFound(matchData.id);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [queueId, user, handleMatchFound, cleanupAll, tryMatch]);

  // ─── Join Queue ───────────────────────────────────────────────────

  const joinQueue = useCallback(async (mode: GameMode, teamSize: number) => {
    if (!user) {
      toast.error('You must be logged in to play.');
      return;
    }

    // Reset state for new search
    matchFoundRef.current = false;
    rpcAvailableRef.current = true; // Re-check RPC availability each search
    cleanupAll();
    setStatus('searching');
    setMatchId(null);
    setQueueId(null);
    queueParamsRef.current = null;

    try {
      // 0. Clean up MY old queue entries (from previous sessions/crashes)
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

      // 2. Compute rank tier and adjacent tiers
      const myTier = getRankFromXP(profile?.xp ?? 0).rank.name;
      const allowedTiers = getAdjacentTiers(myTier);

      // 3. Insert into the queue
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

      const myQueueId = entry.id;
      const params: QueueParams = {
        queueId: myQueueId,
        mode,
        teamSize,
        allowedTiers,
      };

      // Store params so polling/realtime can use them
      queueParamsRef.current = params;

      // 4. Immediately try to find a match
      const matched = await tryMatch(params);

      if (matched) {
        return; // Done!
      }

      // 5. No opponent yet — set queueId to activate polling/realtime
      setQueueId(myQueueId);
      toast.info('Searching for players...');

      // 6. Set a timeout to auto-leave after 30s
      timeoutRef.current = setTimeout(async () => {
        if (matchFoundRef.current) return;

        await supabase
          .from('matchmaking_queue')
          .delete()
          .eq('user_id', user.id);

        setStatus('idle');
        setQueueId(null);
        queueParamsRef.current = null;
        cleanupAll();
        toast.error('No opponent found, try again.');
      }, QUEUE_TIMEOUT_MS);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Matchmaking error:', err);
      toast.error('Failed to join matchmaking: ' + message);
      setStatus('error');
      cleanupAll();
    }
  }, [user, profile, cleanupAll, tryMatch]);

  // ─── Leave Queue ──────────────────────────────────────────────────

  const leaveQueue = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      matchFoundRef.current = false;
      setStatus('idle');
      setQueueId(null);
      setMatchId(null);
      queueParamsRef.current = null;
      cleanupAll();
      toast.info('Left matchmaking queue');
    } catch (err) {
      console.error('Error leaving queue:', err);
    }
  }, [user, cleanupAll]);

  // ─── Cleanup on unmount ───────────────────────────────────────────

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
