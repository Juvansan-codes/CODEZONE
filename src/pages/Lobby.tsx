import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MapCard from '@/components/MapCard';
import LoadingScreen from '@/components/LoadingScreen';
import CharacterViewer from '@/components/CharacterViewer';
import FriendsPanel from '@/components/FriendsPanel';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { Users } from 'lucide-react';

// Fallback for missing jQuery types if still an issue
declare global {
  interface Window {
    $: unknown;
    jQuery: unknown;
  }
}

type GameMode = 'campaign' | 'duel' | 'practice';

const maps = [{
  mode: 'campaign' as GameMode,
  title: 'StudyGround: The Quiet Ascent',
  description: 'Story mode progression'
}, {
  mode: 'duel' as GameMode,
  title: 'Clash Code',
  description: 'Competitive battlefield'
}, {
  mode: 'practice' as GameMode,
  title: 'Practice Arena',
  description: 'Unranked sandbox'
}];

const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState<GameMode>('campaign');
  const [teamSize, setTeamSize] = useState('5');
  const [friendsOpen, setFriendsOpen] = useState(false);
  const { joinQueue, leaveQueue, status, matchId } = useMatchmaking();
  const loading = status === 'searching' || status === 'found';

  useEffect(() => {
    if (status === 'found' && matchId) {
      // Small delay to show "Match Found!" toast before navigating
      const timeout = setTimeout(() => {
        navigate(`/game?matchId=${matchId}`);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [status, matchId, navigate]);

  const handleStartMatch = () => {
    if (selectedMode === 'campaign') {
      toast.info(
        <div className="text-center">
          <div className="text-3xl mb-2">⚔️</div>
          <div className="font-bold text-accent">WOAH WOAH CHILL DOWN</div>
          <div className="text-primary text-sm mt-1">We're cooking something down here...</div>
        </div>
      );
      return;
    }

    if (selectedMode === 'practice') {
      window.open('https://codelab.612151820.xyz/login', '_blank');
      return;
    }

    // Join Matchmaking Queue
    joinQueue(selectedMode, parseInt(teamSize));
  };

  const selectedMap = maps.find(m => m.mode === selectedMode) || maps[0];

  return (
    <>
      {loading && (
        <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center gap-5 z-[9999]">
          <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin" />
          <span className="font-orbitron text-primary text-lg">
            {status === 'found' ? 'Match Found! Launching...' : 'Searching for opponents...'}
          </span>
          {status === 'searching' && (
            <button
              onClick={leaveQueue}
              className="mt-4 px-6 py-2 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors font-orbitron text-sm"
            >
              CANCEL SEARCH
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-orbitron text-2xl md:text-3xl font-bold text-primary mb-2">
          STUDYGROUND: BATTLEFIELD
        </h1>
        <p className="text-right text-primary"> </p>
      </div>

      {/* Character Panel */}
      <section className="glass-panel p-5 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-orbitron font-bold text-primary">Operator</h2>
          <Button
            onClick={() => setFriendsOpen(true)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10"
          >
            <Users size={16} />
            Friends
          </Button>
        </div>
        <div className="w-full h-[250px] md:h-[300px] bg-black/30 rounded-lg overflow-hidden mb-3">
          <CharacterViewer />
        </div>
        <p className="text-center text-muted-foreground">Code Operative</p>
      </section>

      {/* Map Selection */}
      <section className="glass-panel p-5 mb-6">
        <h2 className="font-orbitron font-bold text-primary mb-4">Select Arena</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {maps.map(map => <MapCard key={map.mode} mode={map.mode} title={map.title} description={map.description} isActive={selectedMode === map.mode} onClick={() => setSelectedMode(map.mode)} />)}
        </div>
      </section>

      {/* Match Bar */}
      <section className="glass-panel p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-muted-foreground">
          Arena: <strong className="text-foreground">{selectedMap?.title}</strong>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Team Size:</span>
          <Select value={teamSize} onValueChange={setTeamSize}>
            <SelectTrigger className="w-24 bg-surface border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border">
              <SelectItem value="1">1v1</SelectItem>
              <SelectItem value="3">3v3</SelectItem>
              <SelectItem value="5">5v5</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleStartMatch} className="gradient-accent text-accent-foreground font-bold px-8 py-3 text-lg uppercase tracking-wide glow-accent">
          START MATCH
        </Button>
      </section>
      <FriendsPanel isOpen={friendsOpen} onClose={() => setFriendsOpen(false)} />
    </>
  );
};
export default Lobby;