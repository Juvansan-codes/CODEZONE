import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useGameSession, TeamSize } from '@/hooks/useGameSession';
import { usePyodide } from '@/hooks/usePyodide';
import { useAuth } from '@/contexts/AuthContext';
import { useGame } from '@/contexts/GameContext';
import { supabase } from '@/integrations/supabase/client';
import { Terminal, Play, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [customInput, setCustomInput] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const { runPython, isInitializing: isPyodideLoading } = usePyodide();

  // Audio Instance
  const [audio] = useState(() => {
    // Determine the base path based on environment variables or Vite config
    const basePath = import.meta.env.BASE_URL || '/';
    const a = new Audio(`${basePath}game-music.mp3`);
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
          // Autoplay is blocked by default in modern browsers until user interacts with the document.
          // Silently ignore this specific error to avoid console spam.
          if (error.name !== 'NotAllowedError') {
            console.error("Audio play failed:", error);
          }
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

    if (isPyodideLoading) {
      toast.warning('Wait! Python local environment is still loading...');
      return;
    }

    setConsoleOutput([]); // Clear previous output
    setIsExecuting(true);
    addLog('Running preview locally (Pyodide)...');

    try {
      const startTime = performance.now();
      const result = await runPython(code, customInput);
      const execTimeMs = (performance.now() - startTime).toFixed(2);

      if (result.isTimeout) {
        setConsoleOutput([{ type: 'error', content: '❌ Time Limit Exceeded (Infinite loop detected)' }]);
        toast.error('Local Timeout.');
      } else if (result.error) {
        setConsoleOutput([{ type: 'error', content: result.error }]);
        toast.error('Runtime Error in Preview');
      } else {
        setConsoleOutput([{ type: 'log', content: result.output || '(No output)' }]);
        toast.success(`Ran in ${execTimeMs}ms (Not Validated)`);
      }
    } catch (err: any) {
      setConsoleOutput([{ type: 'error', content: 'Local execution failed.' }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const submitCode = async () => {
    if (!validateCode()) return;

    setConsoleOutput([]); // Clear previous output
    setIsExecuting(true);
    addLog('Submitting to secure backend judge...');

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
        toast.error('❌ VALIDATION SERVER ERROR');
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
          deductEnemyTime(30);
          toast.success('🔥 CODE PERFECT! CRITICAL HIT! -30s');
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
    <div className="h-screen flex flex-col overflow-hidden">
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

      {/* ─── TOP BAR ─── */}
      <header className="flex-shrink-0 px-3 pt-3">
        <div className="glass-panel px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Title + Match Info */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="font-orbitron text-sm md:text-base font-bold truncate">CODEWAR</h1>
              <p className="text-[10px] text-primary tracking-wide">
                ⚔ {gameState.teamSize}v{gameState.teamSize} · {formatTimeVerbose(gameState.matchDuration)}
              </p>
            </div>
            <div className="h-8 w-px bg-border hidden md:block" />
            {/* Inline Timers */}
            {!isLoading && (
              <div className="hidden md:flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-black/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${myTimePercent > 50 ? 'bg-primary' : myTimePercent > 25 ? 'bg-gold' : 'bg-accent'}`}
                      style={{ width: `${myTimePercent}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono font-bold min-w-[40px] ${gameState.myTeamTime < 60 ? 'text-accent animate-pulse' : 'text-primary'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(gameState.myTeamTime)}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-bold">VS</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-accent min-w-[40px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(gameState.enemyTeamTime)}
                  </span>
                  <div className="w-20 h-2 bg-black/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300 rounded-full"
                      style={{ width: `${enemyTimePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Sabotage pills + Rank */}
          <div className="flex items-center gap-2">
            {/* Sabotage Quick-Access */}
            <div className="hidden lg:flex items-center gap-1.5">
              {([['fog', '🌫', SABOTAGE_COSTS.fog], ['invert', '🔄', SABOTAGE_COSTS.invert], ['shake', '📳', SABOTAGE_COSTS.shake]] as const).map(([type, icon, cost]) => (
                <button
                  key={type}
                  onClick={() => useSabotage(type as 'fog' | 'invert' | 'shake')}
                  disabled={!gameState.sabotagesUnlocked}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all
                    ${gameState.sabotagesUnlocked
                      ? 'border-white/15 bg-white/5 hover:bg-white/10 hover:border-primary/50 cursor-pointer'
                      : 'border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed'}`}
                  title={`${type} (${formatTimeVerbose(cost as number)})`}
                >
                  {icon}
                </button>
              ))}
              <button
                onClick={useMemeNuke}
                disabled={memeCooldown || !gameState.sabotagesUnlocked}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all
                  ${gameState.sabotagesUnlocked && !memeCooldown
                    ? 'border-accent/40 bg-accent/10 hover:bg-accent/20 text-accent cursor-pointer'
                    : 'border-white/5 bg-white/[0.02] opacity-40 cursor-not-allowed'}`}
                title={`Meme Nuke (${formatTimeVerbose(SABOTAGE_COSTS.memeNuke)})`}
              >
                💀
              </button>
            </div>

            <div className="h-6 w-px bg-border hidden lg:block" />

            <div className="text-[10px] text-muted-foreground hidden sm:block">
              {gameState.sabotagesUnlocked
                ? <span className="text-primary">🔓 Active</span>
                : <span>🔒 {formatTimeVerbose(timeUntilSabotage)}</span>
              }
            </div>

            <div className="px-3 py-1 rounded-lg border border-gold/30 bg-gold/10 text-gold font-orbitron text-[11px] font-bold whitespace-nowrap">
              {currentRank}
            </div>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 min-h-0 overflow-hidden">

        {/* ─── LEFT PANEL: Problem + Teams ─── */}
        <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3 min-h-0 overflow-y-auto">

          {/* Problem Description */}
          <div className="glass-panel p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h2 className="font-bold text-base leading-tight">{question.title}</h2>
              {question.difficulty && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap border ${question.difficulty === 'Easy' ? 'text-green-400 border-green-400/30 bg-green-400/10' :
                  question.difficulty === 'Medium' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' :
                    question.difficulty === 'Hard' ? 'text-orange-400 border-orange-400/30 bg-orange-400/10' :
                      'text-red-400 border-red-400/30 bg-red-400/10'
                  }`}>
                  {question.difficulty}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{question.description}</p>

            {/* Sample Test Cases */}
            {(() => {
              let testCases: any[] = [];
              try {
                const raw = question.test_cases;
                if (Array.isArray(raw)) testCases = raw;
                else if (typeof raw === 'string') testCases = JSON.parse(raw);
              } catch { /* invalid */ }

              const visible = testCases.filter((tc: any) => tc && tc.visible !== false);
              if (visible.length === 0) return null;

              return (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Examples</p>
                  {visible.map((tc: any, i: number) => (
                    <div key={i} className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[9px] text-muted-foreground/60 uppercase">Input</span>
                        <pre className="bg-black/40 rounded-lg px-2.5 py-1.5 text-[11px] text-green-300 font-mono whitespace-pre-wrap mt-0.5 border border-white/5">{String(tc.input ?? '(none)')}</pre>
                      </div>
                      <div>
                        <span className="text-[9px] text-muted-foreground/60 uppercase">Output</span>
                        <pre className="bg-black/40 rounded-lg px-2.5 py-1.5 text-[11px] text-yellow-300 font-mono whitespace-pre-wrap mt-0.5 border border-white/5">{String(tc.output ?? '')}</pre>
                      </div>
                    </div>
                  ))}
                  {testCases.some((tc: any) => tc && tc.visible === false) && (
                    <p className="text-[9px] text-muted-foreground/50 italic">+ hidden tests on submit</p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Mobile Timers (visible on small screens) */}
          <div className="lg:hidden glass-panel p-3">
            {isLoading ? (
              <div className="flex justify-center items-center h-12 text-muted-foreground gap-2 text-sm">
                <Loader2 className="animate-spin w-4 h-4" /> Syncing...
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-primary">YOU</span>
                    <span className={`font-mono ${gameState.myTeamTime < 60 ? 'text-accent animate-pulse' : ''}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(gameState.myTeamTime)}</span>
                  </div>
                  <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${myTimePercent > 50 ? 'bg-primary' : myTimePercent > 25 ? 'bg-gold' : 'bg-accent'}`} style={{ width: `${myTimePercent}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground font-bold">VS</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-accent">ENEMY</span>
                    <span className="font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(gameState.enemyTeamTime)}</span>
                  </div>
                  <div className="h-2 bg-black/50 rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${enemyTimePercent}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Teams */}
          <div className="glass-panel p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Your Team</h4>
                <div className="space-y-1">
                  {gameState.myTeam.map((member, i) => (
                    <div key={member.user_id} className="flex items-center gap-1.5 text-xs">
                      <span className="text-[10px]">{i === 0 ? '🔥' : '⚙'}</span>
                      <span className={member.user_id === profile?.user_id ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                        {member.username}{member.user_id === profile?.user_id && ' (You)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-semibold text-accent/70 uppercase tracking-widest mb-1.5">Enemy Team</h4>
                <div className="space-y-1">
                  {gameState.enemyTeam.map((member) => (
                    <div key={member.user_id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="text-[10px]">💀</span>
                      <span>{member.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Kill Feed */}
          <div className="glass-panel p-3 flex-1 min-h-0 flex flex-col">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Battle Log</h4>
            <div className="flex-1 overflow-y-auto space-y-0.5 bg-black/20 rounded-lg p-2 min-h-[80px]">
              {logs.map((log, i) => (
                <div key={i} className={`text-[11px] leading-relaxed ${i === 0 ? 'text-foreground/80' : 'text-muted-foreground/60'}`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ─── RIGHT PANEL: Editor Zone ─── */}
        <main className={`lg:col-span-8 xl:col-span-9 flex flex-col gap-3 min-h-0 ${sabotageEffects.shake ? 'animate-shake' : ''}`}>

          {/* Code Editor */}
          <div className="flex-1 min-h-0 flex flex-col">
            <textarea
              ref={editorRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`flex-1 w-full bg-[#0d1117] border border-white/10 rounded-xl p-4 font-mono text-sm text-green-400 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 transition-shadow ${sabotageEffects.invert ? 'invert hue-rotate-180' : ''}`}
              spellCheck={false}
              placeholder="# Write your Python script here..."
              style={{ minHeight: '200px' }}
            />
          </div>

          {/* Bottom Zone: Input + Console side by side */}
          <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ height: '160px' }}>
            {/* Custom Input */}
            <div className="bg-[#0d1117] border border-white/10 rounded-xl p-3 flex flex-col min-h-0">
              <div className="flex items-center gap-2 text-muted-foreground mb-1.5 text-[10px] uppercase tracking-wider font-semibold">
                <span>Custom Input</span>
                <span className="text-muted-foreground/40">· RUN only</span>
              </div>
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="flex-1 w-full bg-transparent text-xs text-muted-foreground resize-none focus:outline-none font-mono"
                placeholder="stdin data..."
              />
            </div>

            {/* Console Output */}
            <div className="bg-[#0d1117] border border-white/10 rounded-xl p-3 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold mb-1.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Terminal size={12} />
                  <span>Console</span>
                </div>
                {isExecuting && (
                  <span className="flex items-center gap-1 text-accent">
                    <Loader2 className="animate-spin w-3 h-3" /> Running...
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5 font-mono text-[11px]">
                {consoleOutput.length === 0 ? (
                  <div className="text-white/15 italic">Ready...</div>
                ) : (
                  consoleOutput.map((log, i) => (
                    <div key={i} className={`flex gap-1.5 ${log.type === 'error' ? 'text-red-400' : log.type === 'warn' ? 'text-yellow-400' : 'text-green-300'}`}>
                      <span className="opacity-30 select-none">›</span>
                      <pre className="whitespace-pre-wrap font-inherit">{log.content}</pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 flex gap-2">
            <Button
              onClick={runCode}
              disabled={isExecuting}
              className="h-11 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-wide gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
            >
              <Play size={14} fill="currentColor" />
              {isExecuting ? 'RUNNING...' : 'RUN'}
            </Button>
            <Button
              onClick={submitCode}
              disabled={isExecuting}
              className="h-11 px-8 bg-gradient-to-r from-gold to-amber-500 text-black font-bold tracking-wide gap-2 transition-all shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] hover:scale-[1.01]"
            >
              <CheckCircle2 size={14} />
              {isExecuting ? 'JUDGING...' : 'SUBMIT'}
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              onClick={handleExitMatch}
              className="h-11 px-5 gap-2 border-accent/30 text-accent/80 hover:bg-accent/10 hover:text-accent hover:border-accent/50 transition-all"
            >
              <XCircle size={14} />
              {isMatchCompleted ? 'Leave' : 'Surrender'}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Game;
