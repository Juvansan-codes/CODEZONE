import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type TeamSize = 1 | 3 | 5;

interface TeamMember {
  user_id: string;
  username: string;
  unique_id: string;
}

interface GameSessionState {
  matchId: string | null;
  teamSize: TeamSize;
  myTeam: TeamMember[];
  enemyTeam: TeamMember[];
  myTeamTime: number; // in seconds
  enemyTeamTime: number;
  matchDuration: number; // total match time in seconds
  isRunning: boolean;
  sabotagesUnlocked: boolean;
  isMyTurn: boolean;
  matchStatus: string;
  winnerTeam: string | null;
  isFinishing?: boolean;
  _raw?: {
    startedAt: string | null;
    myPenalties: number;
    enemyPenalties: number;
    isTeamA: boolean;
  };
}

// Match duration based on team size (in seconds)
const MATCH_DURATIONS: Record<TeamSize, number> = {
  1: 45 * 60, // 45 minutes for 1v1
  3: 30 * 60, // 30 minutes for 3v3
  5: 15 * 60, // 15 minutes for 5v5
};

// Extended match type including new penalty columns
interface MatchData {
  id: string;
  created_at: string;
  status: string;
  game_mode: string;
  team_size: number;
  team_a: string[];
  team_b: string[];
  winner_team: string | null;
  started_at: string | null;
  ended_at: string | null;
  team_a_penalties: number;
  team_b_penalties: number;
}

// Penalty payload interface
interface PenaltyPayload {
  match_id_param: string;
  team_side: 'a' | 'b';
  amount: number;
}

type RpcInvoker = (fnName: string, params: Record<string, unknown>) => Promise<unknown>;

export const useGameSession = (matchId?: string) => {
  const { user, profile } = useAuth();
  const [gameState, setGameState] = useState<GameSessionState>({
    matchId: matchId || null,
    teamSize: 5,
    myTeam: [],
    enemyTeam: [],
    myTeamTime: MATCH_DURATIONS[5],
    enemyTeamTime: MATCH_DURATIONS[5],
    matchDuration: MATCH_DURATIONS[5],
    isRunning: false,
    sabotagesUnlocked: false,
    isMyTurn: true,
    matchStatus: 'pending',
    winnerTeam: null,
    isFinishing: false
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTimesRef = useRef({ myTime: MATCH_DURATIONS[5], enemyTime: MATCH_DURATIONS[5] });
  const callRpc = supabase.rpc as unknown as RpcInvoker;

  // Calculate if sabotages are unlocked (after half-time)
  const checkSabotagesUnlocked = useCallback((currentTime: number, totalTime: number) => {
    const halfTime = totalTime / 2;
    const elapsedTime = totalTime - currentTime;
    return elapsedTime >= halfTime;
  }, []);

  // Calculate time remaining based on server state
  const calculateTimeRemaining = useCallback((matchDuration: number, startedAt: string | null, penalties: number) => {
    if (!startedAt) return matchDuration;

    const startTime = new Date(startedAt).getTime();
    const now = new Date().getTime();
    const elapsedSeconds = Math.floor((now - startTime) / 1000);

    return Math.max(0, matchDuration - elapsedSeconds - penalties);
  }, []);

  const [isLoading, setIsLoading] = useState(true);

  // Load match data and team members
  const loadMatchData = useCallback(async () => {
    if (!matchId || !user) return;

    setIsLoading(true);

    // Get match details
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !matchData) {
      setIsLoading(false);
      return;
    }

    const teamSize = matchData.team_size as TeamSize;
    const matchDuration = MATCH_DURATIONS[teamSize];

    // Determine which team user is on
    const isTeamA = matchData.team_a.includes(user.id);
    const myTeamIds = isTeamA ? matchData.team_a : matchData.team_b;
    const enemyTeamIds = isTeamA ? matchData.team_b : matchData.team_a;

    // IMMEDIATE: Update time-critical state
    setGameState((prev) => {
      // Calculate initial times
      const data = matchData as unknown as MatchData;
      const myPenalties = isTeamA ? (data.team_a_penalties || 0) : (data.team_b_penalties || 0);
      const enemyPenalties = isTeamA ? (data.team_b_penalties || 0) : (data.team_a_penalties || 0);

      const myTime = calculateTimeRemaining(matchDuration, matchData.started_at, myPenalties);
      const enemyTime = calculateTimeRemaining(matchDuration, matchData.started_at, enemyPenalties);

      return {
        ...prev,
        matchId,
        teamSize,
        myTeamTime: myTime,
        enemyTeamTime: enemyTime,
        matchDuration,
        isRunning: matchData.status === 'in_progress',
        matchStatus: matchData.status,
        winnerTeam: matchData.winner_team,
        // Store raw values for potential recalculation
        _raw: {
          startedAt: matchData.started_at,
          myPenalties,
          enemyPenalties,
          isTeamA
        },
        // Initialize empty teams first to show something
        myTeam: prev.myTeam.length ? prev.myTeam : [],
        enemyTeam: prev.enemyTeam.length ? prev.enemyTeam : []
      };
    });

    // Subscribe to Realtime Updates immediately
    // Store channel in a ref to clean up on subsequent loads
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const newData = payload.new as MatchData;
          setGameState((prev) => {
            const isTeamA = prev._raw?.isTeamA;
            // Recalculate everything fresh on update
            const myPenalties = isTeamA ? newData.team_a_penalties : newData.team_b_penalties;
            const enemyPenalties = isTeamA ? newData.team_b_penalties : newData.team_a_penalties;

            // Also update time immediately if started_at changed
            const myTime = calculateTimeRemaining(matchDuration, newData.started_at, myPenalties);
            const enemyTime = calculateTimeRemaining(matchDuration, newData.started_at, enemyPenalties);

            return {
              ...prev,
              myTeamTime: myTime,
              enemyTeamTime: enemyTime,
              isRunning: newData.status === 'in_progress',
              matchStatus: newData.status,
              winnerTeam: newData.winner_team,
              _raw: {
                startedAt: newData.started_at,
                myPenalties,
                enemyPenalties,
                isTeamA: !!isTeamA
              }
            };
          });
        }
      )
      .subscribe();


    channelRef.current = channel;

    // SECONDARY: Fetch profiles for all players (less time critical)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, unique_id')
      .in('user_id', [...myTeamIds, ...enemyTeamIds]);

    if (profiles) {
      const myTeam = myTeamIds.map((id: string) => {
        const p = profiles.find((pr) => pr.user_id === id);
        return {
          user_id: id,
          username: p?.username || 'Unknown',
          unique_id: p?.unique_id || '',
        };
      });

      const enemyTeam = enemyTeamIds.map((id: string) => {
        const p = profiles.find((pr) => pr.user_id === id);
        return {
          user_id: id,
          username: p?.username || 'Unknown',
          unique_id: p?.unique_id || '',
        };
      });

      setGameState((prev) => ({
        ...prev,
        myTeam,
        enemyTeam
      }));
    }

    setIsLoading(false);

    // Clean up function just for component unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [matchId, user, calculateTimeRemaining]);

  // Initialize with team size for demo/practice mode
  const initializeDemo = useCallback((teamSize: TeamSize) => {
    const matchDuration = MATCH_DURATIONS[teamSize];
    setGameState((prev) => ({
      ...prev,
      teamSize,
      matchDuration,
      myTeamTime: matchDuration,
      enemyTeamTime: matchDuration,
      myTeam: [
        { user_id: user?.id || '1', username: profile?.username || 'You', unique_id: '' },
        ...(teamSize >= 3 ? [{ user_id: '2', username: 'Teammate-1', unique_id: '' }] : []),
        ...(teamSize >= 3 ? [{ user_id: '3', username: 'Teammate-2', unique_id: '' }] : []),
        ...(teamSize === 5 ? [{ user_id: '4', username: 'Teammate-3', unique_id: '' }] : []),
        ...(teamSize === 5 ? [{ user_id: '5', username: 'Teammate-4', unique_id: '' }] : []),
      ].slice(0, teamSize),
      enemyTeam: Array.from({ length: teamSize }, (_, i) => ({
        user_id: `enemy-${i}`,
        username: `Enemy-${i + 1}`,
        unique_id: '',
      })),
    }));
  }, [user, profile]);

  // Start the game timer
  const startGame = useCallback(() => {
    setGameState((prev) => ({ ...prev, isRunning: true }));
  }, []);

  // Stop the game timer
  const stopGame = useCallback(() => {
    setGameState((prev) => ({ ...prev, isRunning: false }));
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Deduct time from my team (for sabotage cost)
  const deductMyTime = useCallback(async (seconds: number) => {
    // Optimistic update
    setGameState((prev) => ({
      ...prev,
      myTeamTime: Math.max(0, prev.myTeamTime - seconds),
    }));

    if (matchId && gameState._raw) {
      const teamSide = gameState._raw.isTeamA ? 'a' : 'b';

      const payload: PenaltyPayload = {
        match_id_param: matchId,
        team_side: teamSide,
        amount: seconds
      };

      await callRpc('apply_penalty', payload);
    }
  }, [matchId, gameState._raw, callRpc]);

  // Finish match via RPC
  const finishMatch = useCallback(async (winnerTeam: 'team_a' | 'team_b') => {
    if (!matchId) return;

    // Prevent multiple calls
    setGameState(prev => {
      if (prev.isFinishing || prev.matchStatus === 'completed') return prev;
      return { ...prev, isFinishing: true, isRunning: false };
    });

    try {
      await callRpc('finish_match', {
        match_id_param: matchId,
        winner_team_param: winnerTeam
      });
    } catch (error) {
      console.error('Failed to finish match:', error);
      // Revert lock on failure so it can be retried
      setGameState(prev => ({ ...prev, isFinishing: false }));
    }
  }, [matchId, callRpc]);

  // Deduct time from enemy team (for successful attacks)
  const deductEnemyTime = useCallback(async (seconds: number) => {
    // Optimistic update
    setGameState((prev) => ({
      ...prev,
      enemyTeamTime: Math.max(0, prev.enemyTeamTime - seconds),
    }));

    if (matchId && gameState._raw) {
      const teamSide = gameState._raw.isTeamA ? 'b' : 'a'; // Opposite team

      const payload: PenaltyPayload = {
        match_id_param: matchId,
        team_side: teamSide,
        amount: seconds
      };

      await callRpc('apply_penalty', payload);
    }
  }, [matchId, gameState._raw, callRpc]);

  // Leave match (replaces surrender)
  const leaveMatch = useCallback(async () => {
    if (!matchId) return;

    // Optimistic update (stop game logic locally)
    setGameState(prev => ({ ...prev, isRunning: false }));

    try {
      await callRpc('leave_match', { match_id_param: matchId });
    } catch (error) {
      console.error('Leave match failed:', error);
    }
  }, [matchId, callRpc]);

  // Poll for disconnected players every 15s
  useEffect(() => {
    if (!matchId || !gameState.isRunning) return;

    const interval = setInterval(async () => {
      try {
        await callRpc('check_match_timeouts', { match_id_param: matchId });
      } catch (err) {
        console.error('Timeout check failed:', err);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [matchId, gameState.isRunning, callRpc]);

  useEffect(() => {
    lastTimesRef.current = {
      myTime: gameState.myTeamTime,
      enemyTime: gameState.enemyTeamTime,
    };
  }, [gameState.myTeamTime, gameState.enemyTeamTime]);

  // Timer effect
  useEffect(() => {
    if (!gameState.isRunning) return;

    let lastMyTime = lastTimesRef.current.myTime;
    let lastEnemyTime = lastTimesRef.current.enemyTime;

    timerRef.current = setInterval(() => {
      setGameState((prev) => {
        let newMyTime = prev.myTeamTime;
        let newEnemyTime = prev.enemyTeamTime;

        if (!prev._raw?.startedAt) {
          // Fallback if no start time: manual decrement (for demo/practice)
          newMyTime = prev.isMyTurn ? prev.myTeamTime - 1 : prev.myTeamTime;
          newMyTime = Math.max(0, newMyTime);
          newEnemyTime = Math.max(0, prev.enemyTeamTime - (prev.isMyTurn ? 1 : 0));
        } else {
          // Real Match: Calculate from database state
          newMyTime = calculateTimeRemaining(prev.matchDuration, prev._raw.startedAt, prev._raw.myPenalties);
          newEnemyTime = calculateTimeRemaining(prev.matchDuration, prev._raw.startedAt, prev._raw.enemyPenalties);
        }

        const sabotagesUnlocked = checkSabotagesUnlocked(
          Math.min(newMyTime, newEnemyTime),
          prev.matchDuration
        );

        // Check Win/Loss Condition
        if (newMyTime <= 0 && newEnemyTime > 0) {
          if (!prev.isFinishing && prev.matchStatus !== 'completed') {
            finishMatch(prev._raw?.isTeamA ? 'team_b' : 'team_a');
          }
        } else if (newEnemyTime <= 0 && newMyTime > 0) {
          if (!prev.isFinishing && prev.matchStatus !== 'completed') {
            finishMatch(prev._raw?.isTeamA ? 'team_a' : 'team_b');
          }
        } else if (newMyTime <= 0 && newEnemyTime <= 0) {
          if (!prev.isFinishing && prev.matchStatus !== 'completed') {
            finishMatch('team_a');
          }
        }

        // Only return a new object if time actually changed to prevent React rendering glitches
        if (newMyTime === lastMyTime && newEnemyTime === lastEnemyTime && prev.sabotagesUnlocked === sabotagesUnlocked) {
          return prev;
        }

        lastMyTime = newMyTime;
        lastEnemyTime = newEnemyTime;

        return {
          ...prev,
          myTeamTime: newMyTime,
          enemyTeamTime: newEnemyTime,
          sabotagesUnlocked,
        };
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameState.isRunning, checkSabotagesUnlocked, calculateTimeRemaining, finishMatch]);

  // Load match data on mount
  useEffect(() => {
    if (matchId) {
      loadMatchData();
    }
  }, [matchId, loadMatchData]);

  return {
    gameState,
    startGame,
    stopGame,
    deductMyTime,
    deductEnemyTime,
    initializeDemo,
    loadMatchData,
    leaveMatch,
    finishMatch,
    isLoading
  };
};