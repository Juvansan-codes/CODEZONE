import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { gameData } = useGame();
  const [xpWidth, setXpWidth] = useState(0);

  useEffect(() => {
    setTimeout(() => setXpWidth(gameData.xpPercent), 300);
  }, [gameData.xpPercent]);

  return (
    <div className="min-h-screen">
      {/* Top Nav */}
      <header className="h-16 flex justify-between items-center px-4 md:px-6 border-b border-border bg-surface/90 backdrop-blur-sm">
        <Button variant="outline" size="sm" onClick={() => navigate('/lobby')}>
          <ArrowLeft className="mr-2" size={16} />
          BACK
        </Button>
        <span className="font-orbitron font-bold">PLAYER PROFILE</span>
        <Button variant="outline" size="icon" onClick={() => navigate('/settings')}>
          <Settings size={16} />
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-64px)]">
        {/* Left - 3D Character */}
        <div className="bg-gradient-to-b from-surface to-background border-r border-border flex items-center justify-center p-6">
          <div className="w-full max-w-md aspect-[3/4] rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent overflow-hidden">
            <iframe
              title="3D Character"
              className="w-full h-full"
              src="https://sketchfab.com/models/0fda28d637324d5694493bd2e0d6d071/embed?ui_theme=dark&autostart=1"
            />
          </div>
        </div>

        {/* Right - Profile Info */}
        <div className="flex flex-col">
          <div className="p-6 space-y-6">
            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-3xl shadow-lg glow-primary">
                {gameData.username.substring(0, 2).toUpperCase()}
                <div className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-green-500 border-[3px] border-background" />
              </div>
              <div className="flex-1">
                <h2 className="font-orbitron text-xl font-bold">{gameData.username}</h2>
                <p className="text-sm text-muted-foreground">
                  Level {gameData.level} • {gameData.rank}
                </p>
                {/* XP Progress Bar */}
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span style={{ color: gameData.rankColor }}>
                      {gameData.rankEmoji} {gameData.rank}
                    </span>
                    <span>
                      {gameData.xp} XP {gameData.nextRank !== 'MAX' && `→ ${gameData.nextRank}`}
                    </span>
                  </div>
                  <div className="h-3 bg-surface rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full transition-all duration-700 ease-out rounded-full"
                      style={{
                        width: `${xpWidth}%`,
                        backgroundColor: gameData.rankColor,
                        boxShadow: `0 0 8px ${gameData.rankColor}40`,
                      }}
                    />
                  </div>
                  {gameData.nextRank !== 'MAX' && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 text-right">
                      {gameData.xpToNextRank} XP to {gameData.nextRank}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span
                className="px-3 py-1.5 rounded-full text-xs font-semibold border"
                style={{
                  borderColor: `${gameData.rankColor}40`,
                  backgroundColor: `${gameData.rankColor}15`,
                  color: gameData.rankColor,
                }}
              >
                {gameData.rankEmoji} {gameData.rank}
              </span>
              <span className="px-3 py-1.5 bg-surface border border-border rounded-full text-xs">
                ⚡ LVL {gameData.level}
              </span>
              <span className="px-3 py-1.5 bg-surface border border-border rounded-full text-xs">
                🎯 {gameData.xp} XP
              </span>
            </div>

            {/* Ranks */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface border border-border rounded-xl p-4 text-center hover:glow-primary transition-shadow">
                <p className="text-xs text-muted-foreground mb-1">Current Rank</p>
                <div className="text-3xl my-2">{gameData.rankEmoji}</div>
                <p className="font-bold" style={{ color: gameData.rankColor }}>{gameData.rank}</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 text-center hover:glow-primary transition-shadow">
                <p className="text-xs text-muted-foreground mb-1">Highest Rank</p>
                <div className="text-3xl my-2">⭐</div>
                <p className="font-bold">{gameData.bestRank}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">Matches</p>
                <p className="font-bold text-lg mt-1">{gameData.stats.matches}</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">Wins</p>
                <p className="font-bold text-lg mt-1">{gameData.stats.wins}</p>
              </div>
              <div className="bg-surface border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="font-bold text-lg mt-1">{gameData.stats.winRate}%</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
