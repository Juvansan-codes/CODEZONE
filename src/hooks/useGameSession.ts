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
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Load match data and team members
  const loadMatchData = useCallback(async () => {
    if (!matchId || !user) return;

    // Get match details
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !matchData) return;

    const teamSize = matchData.team_size as TeamSize;
    const matchDuration = MATCH_DURATIONS[teamSize];

    // Determine which team user is on
    const isTeamA = matchData.team_a.includes(user.id);
    const myTeamIds = isTeamA ? matchData.team_a : matchData.team_b;
    const enemyTeamIds = isTeamA ? matchData.team_b : matchData.team_a;

    // Fetch profiles for all players
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

      setGameState((prev) => {
        // Calculate initial times
        const data = matchData as any; // Cast to any to access new columns until types are regenerated
        const myPenalties = isTeamA ? (data.team_a_penalties || 0) : (data.team_b_penalties || 0);
        const enemyPenalties = isTeamA ? (data.team_b_penalties || 0) : (data.team_a_penalties || 0);

        const myTime = calculateTimeRemaining(matchDuration, matchData.started_at, myPenalties);
        const enemyTime = calculateTimeRemaining(matchDuration, matchData.started_at, enemyPenalties);

        return {
          ...prev,
          matchId,
          teamSize,
          myTeam,
          enemyTeam,
          myTeamTime: myTime,
          enemyTeamTime: enemyTime,
          matchDuration,
          isRunning: matchData.status === 'in_progress',
          // Store raw values for potential recalculation
          _raw: {
            startedAt: matchData.started_at,
            myPenalties,
            enemyPenalties,
            isTeamA
          }
        };
      });

      // Subscribe to Realtime Updates
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
            const newData = payload.new;
            setGameState((prev) => {
              const isTeamA = prev._raw?.isTeamA;
              const myPenalties = isTeamA ? newData.team_a_penalties : newData.team_b_penalties;
              const enemyPenalties = isTeamA ? newData.team_b_penalties : newData.team_a_penalties;

              return {
                ...prev,
                _raw: { ...prev._raw, myPenalties, enemyPenalties }
              };
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
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
      // Cast to any to bypass type check until types are regenerated
      await (supabase.rpc as any)('apply_penalty', {
        match_id_param: matchId,
        team_side: teamSide,
        amount: seconds
      });
    }
  }, [matchId, gameState._raw]);

  // Deduct time from enemy team (for successful attacks)
  const deductEnemyTime = useCallback(async (seconds: number) => {
    // Optimistic update
    setGameState((prev) => ({
      ...prev,
      enemyTeamTime: Math.max(0, prev.enemyTeamTime - seconds),
    }));

    if (matchId && gameState._raw) {
      const teamSide = gameState._raw.isTeamA ? 'b' : 'a'; // Opposite team
      // Cast to any to bypass type check until types are regenerated
      await (supabase.rpc as any)('apply_penalty', {
        match_id_param: matchId,
        team_side: teamSide,
        amount: seconds
      });
    }
  }, [matchId, gameState._raw]);

  // Timer effect
  useEffect(() => {
    if (gameState.isRunning) {
      timerRef.current = setInterval(() => {
        setGameState((prev) => {
          const newMyTime = prev.isMyTurn ? prev.myTeamTime - 1 : prev.myTeamTime;
          const sabotagesUnlocked = checkSabotagesUnlocked(
            Math.min(newMyTime, prev.enemyTeamTime),
            prev.matchDuration
          );

          return {
            ...prev,
            myTeamTime: Math.max(0, newMyTime),
            sabotagesUnlocked,
          };
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameState.isRunning, checkSabotagesUnlocked]);

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
  };
};