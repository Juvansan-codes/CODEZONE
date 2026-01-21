import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import MapCard from '@/components/MapCard';
import FriendsPanel from '@/components/FriendsPanel';
import LoadingScreen from '@/components/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Menu, Users } from 'lucide-react';
import { toast } from 'sonner';
type GameMode = 'campaign' | 'duel' | 'practice';
const maps = [{
  mode: 'campaign' as GameMode,
  title: 'DSA Campaign',
  description: 'Ranked progression'
}, {
  mode: 'duel' as GameMode,
  title: 'Clash Code',
  description: 'Competitive battlefield'
}, {
  mode: 'practice' as GameMode,
  title: 'Practice Lab',
  description: 'Unranked sandbox'
}];
const Lobby: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>('campaign');
  const [teamSize, setTeamSize] = useState('5');
  const [loading, setLoading] = useState(false);
  const handleStartMatch = () => {
    if (selectedMode === 'campaign') {
      toast.info(<div className="text-center">
          <div className="text-3xl mb-2">⚔️</div>
          <div className="font-bold text-accent">WOAH WOAH CHILL DOWN</div>
          <div className="text-primary text-sm mt-1">We're cooking something down here...</div>
        </div>);
      return;
    }
    setLoading(true);
    setTimeout(() => {
      if (selectedMode === 'practice') {
        window.open('https://codelab.612151820.xyz/login', '_blank');
        setLoading(false);
      } else {
        // Navigate to game with team size parameter
        navigate(`/game?teamSize=${teamSize}`);
        setLoading(false);
      }
    }, 1500);
  };
  const selectedMap = maps.find(m => m.mode === selectedMode);
  return <>
      {loading && <LoadingScreen message="Entering battlefield..." />}
      <TopBar />

      {/* Float buttons for mobile */}
      <button onClick={() => setSidebarOpen(true)} className="fixed bottom-6 left-6 z-30 md:hidden bg-primary text-primary-foreground px-4 py-3 rounded-full font-semibold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
        <Menu size={18} />
        Menu
      </button>

      <button onClick={() => setFriendsOpen(true)} className="fixed bottom-6 right-6 z-30 bg-primary text-primary-foreground px-4 py-3 rounded-full font-semibold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
        <Users size={18} />
        Friends
      </button>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <FriendsPanel isOpen={friendsOpen} onClose={() => setFriendsOpen(false)} />

      {/* Main Content */}
      <main className="pt-[70px] md:pl-[250px] min-h-screen p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-orbitron text-2xl md:text-3xl font-bold text-primary mb-2">
            STUDYGROUND: BATTLEFIELD
          </h1>
          <p className="text-right text-primary">​       </p>
        </div>

        {/* Character Panel */}
        <section className="glass-panel p-5 mb-6">
          <h2 className="font-orbitron font-bold text-primary mb-4">Operator</h2>
          <div className="w-full h-[250px] md:h-[300px] bg-black/30 rounded-lg overflow-hidden mb-3">
            <iframe title="Operator" className="w-full h-full" allow="autoplay; fullscreen" src="https://sketchfab.com/models/0fda28d637324d5694493bd2e0d6d071/embed?autospin=0.2&autostart=1&ui_theme=dark&ui_controls=0&ui_hint=0&camera=0&dnt=1" />
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
      </main>
    </>;
};
export default Lobby;