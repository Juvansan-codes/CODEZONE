import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Medal, Award, TrendingUp, Users, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Player {
  rank: number;
  name: string;
  score: number;
  wins: number;
  matches: number;
  streak?: number;
  tier: string;
}

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="text-yellow-400" size={24} />;
  if (rank === 2) return <Medal className="text-gray-300" size={24} />;
  if (rank === 3) return <Award className="text-orange-400" size={24} />;
  return <span className="w-6 text-center font-bold text-muted-foreground">#{rank}</span>;
};

const getRankColor = (rank: number) => {
  if (rank === 1) return 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50';
  if (rank === 2) return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/50';
  if (rank === 3) return 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-500/50';
  return 'bg-surface border-border';
};

const Leaderboard: React.FC = () => {
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState('weekly');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('total_wins', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching leaderboard:', error);
      } else if (data) {
        const formattedPlayers: Player[] = data.map((profile, index) => ({
          rank: index + 1,
          name: profile.username || 'Unknown',
          score: profile.xp || 0,
          wins: profile.total_wins || 0,
          matches: profile.total_matches || 0,
          streak: 0, // Streak logic pending
          tier: profile.rank || 'Novice'
        }));
        setPlayers(formattedPlayers);
      }

      setLoading(false);
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-[70px] bg-surface/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-6 z-50">
        <Button variant="outline" size="sm" onClick={() => navigate('/lobby')}>
          <ArrowLeft className="mr-2" size={16} />
          Back to Lobby
        </Button>
        <h1 className="font-orbitron text-xl font-bold text-primary flex items-center gap-2">
          <Trophy size={24} />
          LEADERBOARD
        </h1>
        <div className="w-32" />
      </header>

      <main className="pt-[90px] pb-10 px-4 max-w-5xl mx-auto">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel p-4 text-center">
            <Users className="mx-auto mb-2 text-primary" size={28} />
            <p className="text-2xl font-bold">1,247</p>
            <p className="text-sm text-muted-foreground">Active Players</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <TrendingUp className="mx-auto mb-2 text-primary" size={28} />
            <p className="text-2xl font-bold">5,892</p>
            <p className="text-sm text-muted-foreground">Matches Today</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <Star className="mx-auto mb-2 text-gold" size={28} />
            <p className="text-2xl font-bold">42</p>
            <p className="text-sm text-muted-foreground">Your Rank</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <Trophy className="mx-auto mb-2 text-yellow-400" size={28} />
            <p className="text-2xl font-bold">15,420</p>
            <p className="text-sm text-muted-foreground">Top Score</p>
          </div>
        </div>

        {/* Timeframe Tabs */}
        <Tabs value={timeframe} onValueChange={setTimeframe} className="mb-6">
          <TabsList className="grid w-full grid-cols-3 bg-surface">
            <TabsTrigger value="daily" className="font-orbitron">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="font-orbitron">Weekly</TabsTrigger>
            <TabsTrigger value="alltime" className="font-orbitron">All Time</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Top 3 Highlight */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {loading ? (
            <div className="col-span-3 text-center py-10">Loading champions...</div>
          ) : (
            players.slice(0, 3).map((player, index) => (
              <div
                key={player.rank}
                className={`glass-panel p-6 text-center ${index === 0 ? 'md:order-2 md:scale-105' : index === 1 ? 'md:order-1' : 'md:order-3'}`}
              >
                <div className="mb-4">
                  {player.rank === 1 && <Trophy className="mx-auto text-yellow-400" size={48} />}
                  {player.rank === 2 && <Medal className="mx-auto text-gray-300" size={40} />}
                  {player.rank === 3 && <Award className="mx-auto text-orange-400" size={40} />}
                </div>
                <h3 className="font-orbitron font-bold text-lg mb-1">{player.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{player.tier}</p>
                <p className="text-2xl font-bold text-primary">{player.score.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">points</p>
                <div className="flex justify-center gap-4 mt-4 text-sm">
                  <span>{player.wins} W</span>
                  <span className="text-muted-foreground">|</span>
                  <span>{player.matches - player.wins} L</span>
                </div>
              </div>
            ))}
        </div>

        {/* Full Leaderboard */}
        <div className="glass-panel overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-orbitron font-bold text-primary">Rankings</h2>
          </div>

          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-surface/50 text-sm text-muted-foreground font-semibold">
            <div className="col-span-1">Rank</div>
            <div className="col-span-3">Player</div>
            <div className="col-span-2">Tier</div>
            <div className="col-span-2 text-right">Score</div>
            <div className="col-span-2 text-center">W/L</div>
            <div className="col-span-2 text-center">Streak</div>
          </div>

          {/* Player Rows */}
          <div className="divide-y divide-border/50">
            {players.map((player) => (
              <div
                key={player.rank}
                className={`grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 items-center transition-colors hover:bg-white/5 ${getRankColor(player.rank)} border-l-4`}
              >
                <div className="col-span-1 flex items-center gap-2">
                  {getRankIcon(player.rank)}
                </div>
                <div className="col-span-3">
                  <p className="font-bold">{player.name}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-sm text-muted-foreground">{player.tier}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="font-bold text-primary">{player.score.toLocaleString()}</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-green-400">{player.wins}</span>
                  <span className="text-muted-foreground mx-1">/</span>
                  <span className="text-red-400">{player.matches - player.wins}</span>
                </div>
                <div className="col-span-2 text-center">
                  {player.streak > 0 ? (
                    <span className="px-2 py-1 bg-primary/20 text-primary rounded text-sm">
                      🔥 {player.streak}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Leaderboard;
