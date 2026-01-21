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

      setGameState((prev) => ({
        ...prev,
        matchId,
        teamSize,
        myTeam,
        enemyTeam,
        myTeamTime: matchDuration,
        enemyTeamTime: matchDuration,
        matchDuration,
      }));
    }
  }, [matchId, user]);

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
  const deductMyTime = useCallback((seconds: number) => {
    setGameState((prev) => ({
      ...prev,
      myTeamTime: Math.max(0, prev.myTeamTime - seconds),
    }));
  }, []);

  // Deduct time from enemy team (for successful attacks)
  const deductEnemyTime = useCallback((seconds: number) => {
    setGameState((prev) => ({
      ...prev,
      enemyTeamTime: Math.max(0, prev.enemyTeamTime - seconds),
    }));
  }, []);

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