import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useGameSession, TeamSize } from '@/hooks/useGameSession';
import { useAuth } from '@/contexts/AuthContext';
import { useGame } from '@/contexts/GameContext';
import { supabase } from '@/integrations/supabase/client';
import { Terminal, Play, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    loadPyodide: any;
  }
}





const RANKS = [
  'Bronze Techie', 'Silver Debugger', 'Gold Architect', 'Platinum Engineer',
  'Shadow Coder', 'Elite Exploiter', 'Cyber Overlord', 'Hacker Legend'
];

// Sabotage costs in seconds
const SABOTAGE_COSTS = {
  fog: 30,      // 30 seconds
  invert: 45,   // 45 seconds
  shake: 20,    // 20 seconds
  memeNuke: 120 // 2 minutes
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTimeVerbose = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

const Game: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { settings } = useGame();

  // Get match parameters from URL
  const matchId = searchParams.get('matchId') || undefined;
  const teamSizeParam = parseInt(searchParams.get('teamSize') || '5') as TeamSize;

  const {
    gameState,
    startGame,
    stopGame,
    deductMyTime,
    deductEnemyTime,
    initializeDemo,
    surrenderMatch,
    isLoading
  } = useGameSession(matchId);

  // Determine win status
  const isMatchCompleted = gameState.matchStatus === 'completed';
  const isWinner = isMatchCompleted && (
    (gameState._raw?.isTeamA && gameState.winnerTeam === 'team_a') ||
    (!gameState._raw?.isTeamA && gameState.winnerTeam === 'team_b')
  );

  const [wins, setWins] = useState(0);
  const [question, setQuestion] = useState<any>({ title: 'Loading...', description: 'Fetching question...' });
  const [code, setCode] = useState('// Loading environment...');
  const [logs, setLogs] = useState<string[]>(['Arena ready — fight begins!']);
  const [sabotageEffects, setSabotageEffects] = useState<{ fog: boolean; invert: boolean; shake: boolean }>({
    fog: false, invert: false, shake: false
  });
  const [memeCooldown, setMemeCooldown] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<{ type: 'log' | 'error' | 'warn'; content: string }[]>([]);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Audio Instance
  const [audio] = useState(() => {
    const a = new Audio('/game-music.mp3');
    a.loop = true;
    return a;
  });

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [`⚔ ${msg}`, ...prev].slice(0, 50));
  }, []);

  // Handle Play/Pause and Volume
  useEffect(() => {
    audio.volume = settings.musicVolume / 100;

    if (settings.bgmEnabled) {
      if (audio.paused) {
        audio.play().catch(error => {
          console.error("Audio play failed:", error);
        });
      }
    } else {
      audio.pause();
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [audio, settings.bgmEnabled, settings.musicVolume]);

  // Fetch questions from DB
  useEffect(() => {
    const fetchQuestions = async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('*');

      if (!error && data && data.length > 0) {
        // For now, just pick the first one or random
        setQuestion(data[0]);
        setCode(data[0].template_code || '# Write your solution here');
      } else {
        // Fallback if no questions in DB
        setQuestion({
          title: 'No Questions Found',
          description: 'Please add questions in Admin Dashboard.',
          id: '0',
          difficulty: 'Easy'
        } as any);
      }
    };
    fetchQuestions();
  }, []);

  const validateCode = () => {
    if (!code || code.trim() === '') {
      toast.error('❌ Submission rejected: Code cannot be empty.');
      return false;
    }
    if (code.trim().length < 5) {
      toast.error('❌ Submission rejected: Code is too short.');
      return false;
    }
    return true;
  };

  const [isExecuting, setIsExecuting] = useState(false);

  const runCode = async () => {
    if (!validateCode()) return;

    setConsoleOutput([]); // Clear previous output
    setIsExecuting(true);
    addLog('Executing code on secure backend...');

    try {
      const response = await fetch('http://localhost:3001/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          testCases: question.test_cases || []
        })
      });

      const data = await response.json();

      if (data.error) {
        setConsoleOutput([{ type: 'error', content: data.error }]);
        toast.error('❌ VALIDATION FAILED');
      } else {
        // Render test case results
        let outputLines = [];
        data.results.forEach((res: any) => {
          outputLines.push(`Test ${res.test_idx + 1}: ${res.status}`);
          if (res.status !== 'Passed') {
            if (res.error_message) outputLines.push(`  Error: ${res.error_message}`);
            else outputLines.push(`  Expected: ${res.expected_output} | Got: ${res.actual_output}`);
          }
          outputLines.push(`  Time: ${res.time_ms}ms`);
        });

        setConsoleOutput([{ type: 'log', content: outputLines.join('\\n') }]);

        if (data.all_passed) {
          deductEnemyTime(99999);
          toast.success('🔥 CODE PERFECT! CRITICAL HIT!');
          addLog('Code submitted and passed all tests! Enemy obliterated!');
        } else {
          toast.error('❌ Some tests failed.');
        }
      }
    } catch (err: any) {
      setConsoleOutput([{ type: 'error', content: 'Failed to connect to judge service.' }]);
      toast.error('❌ SERVER ERROR');
    } finally {
      setIsExecuting(false);
    }
  };

  const submitCode = () => {
    if (!validateCode()) return;

    // In a real scenario, submitCode might be exactly the same as runCode
    // but without showing the outputs, or it enforces passing all tests first.
    // For now, let's just trigger the massive damage.
    deductEnemyTime(30);
    toast.success('💥 FINISHER! Enemy -30s');
    addLog('Submission landed — massive damage!');
  };

  const useSabotage = (type: 'fog' | 'invert' | 'shake') => {
    if (!gameState.sabotagesUnlocked) {
      const halfwayPoint = gameState.matchDuration / 2;
      const remainingUntilUnlock = Math.max(0, gameState.myTeamTime - halfwayPoint);
      toast.error(`⏳ Sabotages unlock at halftime! (${formatTimeVerbose(remainingUntilUnlock)} remaining)`);
      return;
    }

    const cost = SABOTAGE_COSTS[type];

    if (gameState.myTeamTime < cost) {
      toast.error(`⏱ Not enough time! Need ${formatTimeVerbose(cost)}`);
      return;
    }

    deductMyTime(cost);
    addLog(`Used ${type.toUpperCase()} sabotage — cost ${formatTimeVerbose(cost)}`);

    setSabotageEffects((prev) => ({ ...prev, [type]: true }));
    setTimeout(() => {
      setSabotageEffects((prev) => ({ ...prev, [type]: false }));
    }, type === 'shake' ? 500 : 4000);

    toast.success(`😈 ${type.toUpperCase()} deployed on enemy!`);
  };

  const useMemeNuke = () => {
    if (!gameState.sabotagesUnlocked) {
      toast.error('⏳ Sabotages unlock at halftime!');
      return;
    }

    if (memeCooldown) {
      toast.error('⏳ Meme Nuke recharging');
      return;
    }

    const cost = SABOTAGE_COSTS.memeNuke;

    if (gameState.myTeamTime < cost) {
      toast.error(`⏱ Not enough time! Need ${formatTimeVerbose(cost)}`);
      return;
    }

    deductMyTime(cost);
    setMemeCooldown(true);
    addLog(`MEME NUKE DEPLOYED — cost ${formatTimeVerbose(cost)}`);

    toast.info(
      <div className="text-center">
        <div className="text-4xl mb-2">💀</div>
        <div className="font-bold">MEME NUKE DEPLOYED!</div>
        <div className="text-sm mt-1">Enemy will be distracted for 60s</div>
      </div>,
      { duration: 5000 }
    );

    // Cooldown is 3 minutes
    setTimeout(() => setMemeCooldown(false), 180000);
  };

  const handleExitMatch = async () => {
    if (gameState.isRunning && !isMatchCompleted) {
      if (confirm('⚠️ WARNING: Exiting the match will count as a SURRENDER.\\n\\nYou will lose 20 XP. Are you sure?')) {
        await surrenderMatch();
        toast.info('You threw in the towel. -20 XP');
        navigate('/lobby');
      }
    } else {
      navigate('/lobby');
    }
  };

  const currentRank = RANKS[Math.min(wins, RANKS.length - 1)];

  // Calculate progress percentages
  const myTimePercent = (gameState.myTeamTime / gameState.matchDuration) * 100;
  const enemyTimePercent = (gameState.enemyTeamTime / gameState.matchDuration) * 100;

  // Calculate halftime status
  const halfwayPoint = gameState.matchDuration / 2;
  const elapsedTime = gameState.matchDuration - gameState.myTeamTime;
  const timeUntilSabotage = Math.max(0, halfwayPoint - elapsedTime);

  return (
    <div className="min-h-screen p-3 md:p-4 relative">
      {/* Match Result Overlay */}
      {isMatchCompleted && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
          <div className={`relative overflow-hidden border p-1 rounded-3xl max-w-lg w-full text-center shadow-2xl ${isWinner ? 'bg-gradient-to-br from-gold/50 via-yellow-600/20 to-transparent border-gold/50 shadow-gold/20'
            : 'bg-gradient-to-br from-red-600/50 via-red-900/20 to-transparent border-red-500/50 shadow-red-500/20'
            }`}>
            <div className="bg-surface/90 backdrop-blur-xl p-8 rounded-[22px] space-y-6">

              <div className="relative">
                <div className={`text-8xl mb-2 drop-shadow-2xl animate-bounce ${isWinner ? 'text-gold' : 'text-red-500'}`}>
                  {isWinner ? '🏆' : '💀'}
                </div>
                {isWinner && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gold/20 rounded-full blur-2xl -z-10" />
                )}
              </div>

              <div>
                <h2 className={`text-5xl font-black font-orbitron tracking-wider uppercase mb-3 drop-shadow-lg ${isWinner ? 'text-gold' : 'text-red-500'}`}>
                  {isWinner ? 'VICTORY' : 'DEFEAT'}
                </h2>
                <p className="text-muted-foreground text-lg">
                  {isWinner ? 'You validated your dominance in the arena.' : 'Better luck next time, coder.'}
                </p>
              </div>

              {/* Reward/Loss Summary */}
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-widest">Coins</p>
                  <p className={`text-2xl font-bold font-mono ${isWinner ? 'text-gold' : 'text-white'}`}>
                    {isWinner ? '+100' : '+10'} <span className="text-base">🪙</span>
                  </p>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-widest">Experience</p>
                  <p className={`text-2xl font-bold font-mono ${isWinner ? 'text-blue-400' : 'text-white'}`}>
                    {isWinner ? '+50' : '+10'} <span className="text-base text-purple-400">⚡</span>
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => navigate('/lobby')}
                  className={`w-full h-14 text-lg font-bold tracking-widest uppercase transition-all hover:scale-[1.02] ${isWinner ? 'bg-gold hover:bg-gold/90 text-black shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]'
                    }`}
                >
                  Return to Lobby
                </Button>
              </div>

            </div>
          </div>
        </div>
      )}
      {/* Fog overlay */}
      {sabotageEffects.fog && (
        <div className="fixed inset-0 pointer-events-none z-50 bg-gradient-radial from-transparent via-black/70 to-black/95" />
      )}

      {/* Header */}
      <header className="glass-panel p-4 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 rounded-xl">
        <div>
          <h1 className="font-orbitron text-xl md:text-2xl font-bold">STUDYGROUND : CODEWAR</h1>
          <p className="text-sm text-primary">
            ⚔️ {gameState.teamSize}v{gameState.teamSize} Match — {formatTimeVerbose(gameState.matchDuration)} Total
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg border border-border bg-surface text-sm whitespace-nowrap">
            {gameState.sabotagesUnlocked ? (
              <span className="text-primary">🔓 Sabotages Active</span>
            ) : (
              <span className="text-muted-foreground">🔒 Unlocks in {formatTimeVerbose(timeUntilSabotage)}</span>
            )}
          </div>
          <div className="px-4 py-2 rounded-xl border border-gold/40 bg-gradient-to-br from-gold/25 to-gold/10 text-gold font-orbitron font-bold whitespace-nowrap">
            {currentRank}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left HUD */}
        <aside className="lg:col-span-3 space-y-4">
          {/* Team Members */}
          <div className="glass-panel p-4">
            <h3 className="font-bold mb-2">YOUR TEAM 👥</h3>
            <div className="text-sm space-y-1">
              {gameState.myTeam.map((member, i) => (
                <div key={member.user_id} className="flex items-center gap-2">
                  <span>{i === 0 ? '🔥' : i === 1 ? '🛡' : '⚙'}</span>
                  <span className={member.user_id === profile?.user_id ? 'text-primary font-bold' : ''}>
                    {member.username}
                    {member.user_id === profile?.user_id && ' (You)'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Timers */}
          <div className="glass-panel p-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-20 text-muted-foreground gap-2">
                <Loader2 className="animate-spin w-4 h-4" /> Syncing Timer...
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold">YOUR TEAM ⏱️</span>
                    <span className={gameState.myTeamTime < 60 ? 'text-accent animate-pulse' : ''} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatTime(gameState.myTeamTime)}
                    </span>
                  </div>
                  <div className="h-3 bg-black/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${myTimePercent > 50
                        ? 'bg-gradient-to-r from-primary to-primary/70'
                        : myTimePercent > 25
                          ? 'bg-gradient-to-r from-gold to-gold/80'
                          : 'bg-gradient-to-r from-accent to-accent/70'
                        }`}
                      style={{ width: `${myTimePercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-bold text-accent">ENEMY ⏱️</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(gameState.enemyTeamTime)}</span>
                  </div>
                  <div className="h-3 bg-black/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-red-900 transition-all duration-300"
                      style={{ width: `${enemyTimePercent}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sabotages */}
          <div className="glass-panel p-4">
            <h3 className="font-bold mb-3">
              SABOTAGES 😈
              {!gameState.sabotagesUnlocked && (
                <span className="text-xs text-muted-foreground ml-2">🔒 Halftime</span>
              )}
            </h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                className={`w-full justify-between ${!gameState.sabotagesUnlocked ? 'opacity-50' : ''}`}
                onClick={() => useSabotage('fog')}
                disabled={!gameState.sabotagesUnlocked}
              >
                <span>🌫 Fog</span>
                <span className="text-xs text-muted-foreground">{formatTimeVerbose(SABOTAGE_COSTS.fog)}</span>
              </Button>
              <Button
                variant="outline"
                className={`w-full justify-between ${!gameState.sabotagesUnlocked ? 'opacity-50' : ''}`}
                onClick={() => useSabotage('invert')}
                disabled={!gameState.sabotagesUnlocked}
              >
                <span>🔄 Invert</span>
                <span className="text-xs text-muted-foreground">{formatTimeVerbose(SABOTAGE_COSTS.invert)}</span>
              </Button>
              <Button
                variant="outline"
                className={`w-full justify-between ${!gameState.sabotagesUnlocked ? 'opacity-50' : ''}`}
                onClick={() => useSabotage('shake')}
                disabled={!gameState.sabotagesUnlocked}
              >
                <span>📳 Shake</span>
                <span className="text-xs text-muted-foreground">{formatTimeVerbose(SABOTAGE_COSTS.shake)}</span>
              </Button>
              <Button
                variant="outline"
                className={`w-full justify-between border-accent text-accent hover:bg-accent/20 ${!gameState.sabotagesUnlocked ? 'opacity-50' : ''}`}
                onClick={useMemeNuke}
                disabled={memeCooldown || !gameState.sabotagesUnlocked}
              >
                <span>💀 MEME NUKE</span>
                <span className="text-xs">{formatTimeVerbose(SABOTAGE_COSTS.memeNuke)}</span>
              </Button>
            </div>
            {gameState.sabotagesUnlocked && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                ⚠️ Sabotages cost YOUR team's time!
              </p>
            )}
          </div>
        </aside>

        {/* Center - Editor */}
        <main className={`lg:col-span-6 ${sabotageEffects.shake ? 'animate-shake' : ''}`}>
          <div className="glass-panel p-4 mb-3">
            <h2 className="font-bold text-lg">{question.title}</h2>
            <p className="text-sm text-muted-foreground">{question.description}</p>
          </div>

          <div className="relative mb-3 flex-1 flex flex-col gap-3">
            <textarea
              ref={editorRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`w-full h-[300px] bg-[#1e1e1e] border border-border rounded-xl p-4 font-mono text-sm text-green-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary ${sabotageEffects.invert ? 'invert hue-rotate-180' : ''
                }`}
              spellCheck={false}
              placeholder="# Write your Python solution here..."
            />

            {/* Console Output Panel */}
            <div className="bg-[#0c0c0c] border border-border rounded-xl p-3 h-[150px] overflow-y-auto font-mono text-xs">
              <div className="flex items-center gap-2 text-muted-foreground mb-2 border-b border-white/10 pb-1 justify-between">
                <div className="flex items-center gap-2">
                  <Terminal size={14} />
                  <span>PYTHON CONSOLE OUTPUT</span>
                </div>
                {isExecuting && (
                  <span className="flex items-center gap-1 text-accent text-[10px]">
                    <Loader2 className="animate-spin w-3 h-3" /> Executing on Judge...
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {consoleOutput.length === 0 ? (
                  <div className="text-white/20 italic">Ready to execute...</div>
                ) : (
                  consoleOutput.map((log, i) => (
                    <div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-red-500' :
                      log.type === 'warn' ? 'text-yellow-500' : 'text-green-300'
                      }`}>
                      <span className="opacity-50 select-none">{'>'}</span>
                      <pre className="whitespace-pre-wrap font-inherit">{log.content}</pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-3">
            <Button onClick={runCode} disabled={isExecuting} className="bg-primary hover:bg-primary/80 gap-2 flex-1 md:flex-none">
              <Play size={16} fill="currentColor" /> RUN CODE
            </Button>
            <Button onClick={submitCode} disabled={isExecuting} className="bg-gold text-gold-foreground hover:bg-gold/80 gap-2 flex-1 md:flex-none">
              <CheckCircle2 size={16} /> SUBMIT
            </Button>
            <Button variant="outline" onClick={handleExitMatch} className="gap-2 flex-1 md:flex-none">
              <XCircle size={16} /> {isMatchCompleted ? 'Leave' : 'Surrender'}
            </Button>
          </div>
        </main>

        {/* Right - Kill Feed & Enemy Team */}
        <aside className="lg:col-span-3 space-y-4">
          {/* Enemy Team */}
          <div className="glass-panel p-4">
            <h3 className="font-bold mb-2 text-accent">ENEMY TEAM 💀</h3>
            <div className="text-sm space-y-1">
              {gameState.enemyTeam.map((member, i) => (
                <div key={member.user_id} className="flex items-center gap-2 text-muted-foreground">
                  <span>👤</span>
                  <span>{member.username}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Kill Feed */}
          <div className="glass-panel p-4 h-full max-h-[400px]">
            <h3 className="font-bold mb-3">KILL FEED</h3>
            <div className="space-y-1 text-sm overflow-y-auto max-h-[320px] bg-white/5 rounded-lg p-3">
              {logs.map((log, i) => (
                <div key={i} className="text-muted-foreground">{log}</div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Game;