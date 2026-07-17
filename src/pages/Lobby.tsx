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
import { usePartySystem } from '@/hooks/usePartySystem';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Users, Shield, LogOut, Check, UserMinus } from 'lucide-react';

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
  const { user } = useAuth();
  const [selectedMode, setSelectedMode] = useState<GameMode>('campaign');
  const [teamSize, setTeamSize] = useState('5');
  const [friendsOpen, setFriendsOpen] = useState(false);
  
  // Solo matchmaking hook
  const { joinQueue, leaveQueue, status: soloStatus, matchId: soloMatchId } = useMatchmaking();

  // Squad / Party matchmaking hook
  const {
    party,
    isLeader,
    allReady,
    createParty,
    leaveParty,
    toggleReady,
    startQueue,
    kickMember,
    loading: partyLoading
  } = usePartySystem();

  const loading = soloStatus === 'searching' || soloStatus === 'found' || (party?.status === 'queuing') || (party?.status === 'matched');

  // Solo matchmaking route redirect
  useEffect(() => {
    if (soloStatus === 'found' && soloMatchId) {
      const timeout = setTimeout(() => {
        navigate(`/game?matchId=${soloMatchId}`);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [soloStatus, soloMatchId, navigate]);

  // Squad matchmaking route redirect
  useEffect(() => {
    if (party && party.status === 'matched' && party.match_id) {
      const timeout = setTimeout(() => {
        navigate(`/game?matchId=${party.match_id}&teamSize=${party.team_size}`);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [party, navigate]);

  // Sync selectedMode and teamSize with squad changes
  useEffect(() => {
    if (party) {
      setSelectedMode(party.game_mode as GameMode);
      setTeamSize(String(party.team_size));
    }
  }, [party?.game_mode, party?.team_size]);

  // Auto-initialize squad/party on lobby mount if not already in one
  useEffect(() => {
    const autoInitParty = async () => {
      if (user && !party && !partyLoading) {
        console.log('[Party] Auto-initializing solo squad...');
        await createParty(selectedMode, parseInt(teamSize));
      }
    };
    autoInitParty();
  }, [user, party, partyLoading, createParty, selectedMode, teamSize]);

  // Real-time broadcast invite listener
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`invites-${user.id}`);
    channel.on('broadcast', { event: 'invite' }, (payload) => {
      const { partyId, leaderName } = payload.payload;

      toast.custom((t) => (
        <div className="bg-surface border border-primary/30 p-4 rounded-lg shadow-glow flex flex-col gap-3 max-w-sm">
          <div className="flex items-start gap-2">
            <span className="text-xl">🎮</span>
            <div>
              <p className="font-orbitron font-bold text-primary text-sm">SQUAD INVITATION</p>
              <p className="text-xs text-foreground mt-1">
                <strong>{leaderName}</strong> invited you to join their squad!
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => toast.dismiss(t)}
            >
              Decline
            </Button>
            <Button 
              size="sm" 
              className="gradient-accent"
              onClick={async () => {
                toast.dismiss(t);
                
                // Leave current party if any
                await leaveParty();
                
                // Join new party
                const { error } = await supabase
                  .from('party_members')
                  .insert({ party_id: partyId, user_id: user.id });
                
                if (error) {
                  toast.error('Failed to join squad: ' + error.message);
                } else {
                  toast.success('Joined squad!');
                }
              }}
            >
              Accept
            </Button>
          </div>
        </div>
      ), { duration: 8000 });
    });

    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, leaveParty]);

  const handleStartMatch = async () => {
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

    if (party) {
      if (!isLeader) {
        toast.error('Only the squad leader can queue for a match!');
        return;
      }
      if (!allReady) {
        toast.error('All squad members must be ready to queue!');
        return;
      }
      // Start squad queue
      const res = await startQueue();
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Squad is searching for opponents...');
      }
    } else {
      // Join solo Matchmaking Queue
      joinQueue(selectedMode, parseInt(teamSize));
    }
  };

  const handleCancelQueue = async () => {
    if (party) {
      if (!isLeader) return;
      // Reset party status to forming
      await supabase
        .from('parties')
        .update({ status: 'forming' })
        .eq('id', party.id);
      toast.info('Squad matchmaking cancelled');
    } else {
      leaveQueue();
    }
  };

  const selectedMap = maps.find(m => m.mode === selectedMode) || maps[0];

  return (
    <>
      {loading && (
        <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center gap-5 z-[9999]">
          <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin" />
          <span className="font-orbitron text-primary text-lg">
            {party?.status === 'matched' || soloStatus === 'found' 
              ? 'Match Found! Launching...' 
              : 'Searching for opponents...'}
          </span>
          {(soloStatus === 'searching' || party?.status === 'queuing') && (
            <button
              onClick={handleCancelQueue}
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
          CODEZONE
        </h1>
        <p className="text-right text-primary"> </p>
      </div>

      {/* Inline Operator Character Panel */}
      <section className="glass-panel p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-orbitron font-bold text-primary text-xl flex items-center gap-2">
              {party ? <span>👥 Squad Operatives</span> : <span>👤 Active Operator</span>}
            </h2>
            {party && (
              <p className="text-xs text-muted-foreground mt-1">
                Lobby Size: {party.members.length}/{party.team_size} | Status: <strong className="text-primary uppercase font-orbitron">{party.status}</strong>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setFriendsOpen(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Users size={16} />
              Friends
            </Button>
            
            {!party && (
              <Button
                onClick={() => createParty(selectedMode, parseInt(teamSize))}
                size="sm"
                className="gradient-accent font-orbitron"
              >
                Create Squad
              </Button>
            )}
          </div>
        </div>

        {/* Characters Grid */}
        <div className="flex flex-wrap justify-center items-stretch gap-6 min-h-[340px] py-4 bg-black/20 rounded-xl border border-border/30">
          {!party ? (
            // Solo Mode
            <div className="flex flex-col items-center justify-between p-4 bg-black/40 border border-border/40 rounded-xl w-[220px] shadow-glow">
              <div className="w-[180px] h-[250px] bg-black/10 rounded-lg overflow-hidden relative">
                <CharacterViewer />
              </div>
              <div className="mt-3 text-center w-full">
                <span className="font-medium text-sm text-foreground flex items-center justify-center gap-1">
                  <Shield size={14} className="text-accent fill-accent" /> You
                </span>
                <p className="text-xs text-muted-foreground mt-1 font-mono">Eric/Alastor</p>
              </div>
            </div>
          ) : (
            // Squad Mode (Characters side-by-side)
            party.members.map((member) => {
              const isCurrentUser = member.user_id === user?.id;
              return (
                <div 
                  key={member.user_id}
                  className={`flex flex-col items-center justify-between p-4 bg-black/40 border rounded-xl w-[200px] shadow-glow transition-all duration-300 ${
                    isCurrentUser ? 'border-primary/40' : 'border-border/40'
                  }`}
                >
                  {/* character 3D model */}
                  <div className="w-[170px] h-[220px] bg-black/10 rounded-lg overflow-hidden relative">
                    <CharacterViewer />
                  </div>
                  
                  {/* member details */}
                  <div className="mt-3 text-center w-full flex flex-col items-center gap-2">
                    <div>
                      <span className="font-medium text-sm text-foreground flex items-center justify-center gap-1.5">
                        {member.is_leader && <Shield size={14} className="text-accent fill-accent" title="Leader" />}
                        {member.username} {isCurrentUser && <span className="text-xs text-primary/70">(You)</span>}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">Eric/Alastor</p>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded font-orbitron border ${
                      member.is_ready 
                        ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                        : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    }`}>
                      {member.is_ready ? 'READY' : 'NOT READY'}
                    </span>

                    {/* Inline actions inside member card */}
                    <div className="flex gap-1.5 w-full mt-1.5">
                      {isCurrentUser && (
                        <>
                          <Button
                            size="xs"
                            variant="outline"
                            className={`flex-1 text-[11px] ${
                              member.is_ready 
                                ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' 
                                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20'
                            }`}
                            onClick={toggleReady}
                          >
                            <Check size={12} className="mr-1" />
                            {member.is_ready ? 'Unready' : 'Ready'}
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-[11px] border-red-500/30 text-red-400 hover:bg-red-500/10 px-2"
                            onClick={leaveParty}
                            title="Leave Squad"
                          >
                            <LogOut size={12} />
                          </Button>
                        </>
                      )}

                      {isLeader && !isCurrentUser && (
                        <Button
                          size="xs"
                          variant="outline"
                          className="w-full text-[11px] border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => kickMember(member.user_id)}
                        >
                          <UserMinus size={12} className="mr-1" />
                          Kick
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Map Selection */}
      <section className="glass-panel p-5 mb-6">
        <h2 className="font-orbitron font-bold text-primary mb-4">Select Arena</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {maps.map(map => (
            <MapCard 
              key={map.mode} 
              mode={map.mode} 
              title={map.title} 
              description={map.description} 
              isActive={selectedMode === map.mode} 
              onClick={() => {
                setSelectedMode(map.mode);
                if (party && isLeader) {
                  // Synchronize mode change with squad
                  supabase.from('parties').update({ game_mode: map.mode }).eq('id', party.id);
                }
              }} 
            />
          ))}
        </div>
      </section>

      {/* Match Bar */}
      <section className="glass-panel p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-muted-foreground">
          Arena: <strong className="text-foreground">{selectedMap?.title}</strong>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Team Size:</span>
          <Select 
            value={party ? String(party.team_size) : teamSize} 
            onValueChange={(val) => {
              setTeamSize(val);
              if (party && isLeader) {
                // Synchronize team size with squad
                supabase.from('parties').update({ team_size: parseInt(val) }).eq('id', party.id);
              }
            }}
            disabled={party && !isLeader}
          >
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

        <Button 
          onClick={handleStartMatch} 
          disabled={party && party.status === 'queuing'}
          className="gradient-accent text-accent-foreground font-bold px-8 py-3 text-lg uppercase tracking-wide glow-accent"
        >
          {party ? 'START SQUAD MATCH' : 'START MATCH'}
        </Button>
      </section>

      <FriendsPanel isOpen={friendsOpen} onClose={() => setFriendsOpen(false)} />
    </>
  );
};

export default Lobby;