import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export interface Friend {
  name: string;
  status: 'online' | 'offline';
}

export interface PlayerStats {
  matches: number;
  wins: number;
  winRate: number;
}

export interface GameData {
  coins: number;
  gems: number;
  energy: number;
  level: number;
  username: string;
  friends: Friend[];
  xpPercent: number;
  rank: string;
  bestRank: string;
  stats: PlayerStats;
}

export interface Settings {
  bgmEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  autosave: boolean;
  notifications: boolean;
  hints: boolean;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  theme: 'dark' | 'light' | 'cyberpunk';
  fpsCounter: boolean;
  animations: boolean;
  language: string;
  privacy: boolean;
}

interface GameContextType {
  gameData: GameData;
  settings: Settings;
  updateGameData: (data: Partial<GameData>) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  addCoins: (amount: number) => void;
  addGems: (amount: number) => void;
  addFriend: (name: string) => void;
  removeFriend: (index: number) => void;
}

const defaultGameData: GameData = {
  coins: 2450,
  gems: 850,
  energy: 100,
  level: 42,
  username: 'CodeWarrior',
  friends: [],
  xpPercent: 78,
  rank: 'Grandmaster',
  bestRank: 'Legend',
  stats: {
    matches: 129,
    wins: 54,
    winRate: 41,
  },
};

const defaultSettings: Settings = {
  bgmEnabled: true,
  sfxEnabled: true,
  musicVolume: 35,
  sfxVolume: 50,
  autosave: true,
  notifications: true,
  hints: true,
  difficulty: 'medium',
  theme: 'dark',
  fpsCounter: false,
  animations: true,
  language: 'en',
  privacy: false,
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [gameData, setGameData] = useState<GameData>(defaultGameData);
  const [settings, setSettings] = useState<Settings>(() => {
    // Load from local storage if available
    const saved = localStorage.getItem('codezone_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  // Save settings to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('codezone_settings', JSON.stringify(settings));
  }, [settings]);

  // Fetch initial data
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data && !error) {
        setGameData(prev => ({
          ...prev,
          username: data.username || prev.username,
          level: data.level || prev.level,
          xpPercent: data.xp ? (data.xp % 100) : prev.xpPercent,
          coins: data.coins || prev.coins,
          gems: data.gems || prev.gems,
          rank: data.rank || prev.rank,
          stats: {
            ...prev.stats,
            matches: data.total_matches || 0,
            wins: data.total_wins || 0,
            // Calculate win rate
            winRate: data.total_matches > 0
              ? Math.round((data.total_wins / data.total_matches) * 100)
              : 0
          }
        }));
      }
    };

    fetchProfile();

    // Realtime subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Realtime update:', payload);
          fetchProfile(); // Re-fetch on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateGameData = (data: Partial<GameData>) => {
    setGameData((prev) => ({ ...prev, ...data }));
  };

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const addCoins = (amount: number) => {
    setGameData((prev) => ({ ...prev, coins: prev.coins + amount }));
  };

  const addGems = (amount: number) => {
    setGameData((prev) => ({ ...prev, gems: prev.gems + amount }));
  };

  const addFriend = (name: string) => {
    const newFriend: Friend = {
      name,
      status: Math.random() > 0.5 ? 'online' : 'offline',
    };
    setGameData((prev) => ({
      ...prev,
      friends: [...prev.friends, newFriend],
    }));
  };

  const removeFriend = (index: number) => {
    setGameData((prev) => ({
      ...prev,
      friends: prev.friends.filter((_, i) => i !== index),
    }));
  };

  return (
    <GameContext.Provider
      value={{
        gameData,
        settings,
        updateGameData,
        updateSettings,
        addCoins,
        addGems,
        addFriend,
        removeFriend,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
