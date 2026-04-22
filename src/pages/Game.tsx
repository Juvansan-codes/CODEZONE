import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useGameSession, TeamSize } from '@/hooks/useGameSession';
import { useQuestionProgress } from '@/hooks/useQuestionProgress';
import { usePyodide } from '@/hooks/usePyodide';
import { useAuth } from '@/contexts/AuthContext';
import { useGame } from '@/contexts/GameContext';
import { supabase } from '@/integrations/supabase/client';
import { Terminal, Play, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, List, Lock } from 'lucide-react';
import { getRankFromXP } from '@/lib/utils';
import Editor from '@monaco-editor/react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

declare global {
  interface Window {
    loadPyodide: unknown;
  }
}

interface JudgeTestResult {
  test_idx: number;
  status: string;
  error_message?: string | null;
  expected_output?: string | null;
  actual_output?: string | null;
  time_ms: number;
}

interface JudgeSubmitResponse {
  error?: string;
  all_passed?: boolean;
  results?: JudgeTestResult[];
}

interface QuestionTestCase {
  input?: unknown;
  output?: unknown;
  visible?: boolean;
}





// Rank is now computed from XP via getRankFromXP() in utils.ts

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
    leaveMatch,
    isLoading
  } = useGameSession(matchId);

  // Determine win status
  const isMatchCompleted = gameState.matchStatus === 'completed';
  const isWinner = isMatchCompleted && (
    (gameState._raw?.isTeamA && gameState.winnerTeam === 'team_a') ||
    (!gameState._raw?.isTeamA && gameState.winnerTeam === 'team_b')
  );

  // Question progress hook
  const {
    questions,
    selectedQuestion: question,
    setSelectedQuestion,
    isQuestionSolved,
    recordSolution,
    isLoadingQuestions,
  } = useQuestionProgress(matchId);

  const [wins, setWins] = useState(0);
  const [code, setCode] = useState('// Loading environment...');
  const [logs, setLogs] = useState<string[]>(['Arena ready — fight begins!']);
  const [sabotageEffects, setSabotageEffects] = useState<{ fog: boolean; invert: boolean; shake: boolean }>({
    fog: false, invert: false, shake: false
  });
  const [memeCooldown, setMemeCooldown] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<{ type: 'log' | 'error' | 'warn'; content: string }[]>([]);
  const [customInput, setCustomInput] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [showQuestionList, setShowQuestionList] = useState(false);
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

  // Detect browser back button / tab close / refresh → auto-leave match
  const matchStateRef = useRef({ isRunning: gameState.isRunning, isCompleted: isMatchCompleted });
  useEffect(() => {
    matchStateRef.current = { isRunning: gameState.isRunning, isCompleted: isMatchCompleted };
  }, [gameState.isRunning, isMatchCompleted]);

  useEffect(() => {
    // beforeunload fires on tab close, refresh, or navigating to external URL
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (matchStateRef.current.isRunning && !matchStateRef.current.isCompleted) {
        // Fire leave_match via sendBeacon for reliability during page unload
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/leave_match`;
        const body = JSON.stringify({ match_id_param: matchId });
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));

        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup fires when the component unmounts (browser back button in SPA)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (matchStateRef.current.isRunning && !matchStateRef.current.isCompleted) {
        leaveMatch();
      }
    };
  }, [matchId, leaveMatch]);

  // Load template code when question changes
  useEffect(() => {
    if (question) {
      setCode(question.template_code || '# Write your solution here');
    }
  }, [question]);

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
    } catch {
      setConsoleOutput([{ type: 'error', content: 'Local execution failed.' }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const submitCode = async () => {
    if (!validateCode()) return;
    if (!question) return;

    // Client-side guard: block if already solved
    if (isQuestionSolved(question.id)) {
      toast.error('🔒 You already solved this question!');
      return;
    }

    setConsoleOutput([]); // Clear previous output
    setIsExecuting(true);
    addLog('Submitting to secure backend judge...');

    try {
      const judgeUrl = import.meta.env.VITE_JUDGE_URL || 'http://localhost:3001';
      const response = await fetch(`${judgeUrl}/api/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          testCases: question.test_cases || []
        })
      });

      const data = (await response.json()) as JudgeSubmitResponse;

      if (data.error) {
        setConsoleOutput([{ type: 'error', content: data.error }]);
        toast.error('❌ VALIDATION SERVER ERROR');
      } else {
        // Render test case results
        const outputLines: string[] = [];
        (data.results || []).forEach((res) => {
          outputLines.push(`Test ${res.test_idx + 1}: ${res.status}`);
          if (res.status !== 'Passed') {
            if (res.error_message) outputLines.push(`  Error: ${res.error_message}`);
            else outputLines.push(`  Expected: ${res.expected_output} | Got: ${res.actual_output}`);
          }
          outputLines.push(`  Time: ${res.time_ms}ms`);
        });

        setConsoleOutput([{ type: 'log', content: outputLines.join('\n') }]);

        if (data.all_passed) {
          // Call the RPC to record the solve and apply sabotage
          const result = await recordSolution(question.id, true);

          if (result.blocked) {
            toast.error('🔒 Already solved — no sabotage applied.');
            addLog(`Question "${question.title}" was already solved.`);
          } else if (result.sabotage_applied) {
            toast.success('🔥 CODE PERFECT! CRITICAL HIT! -30s enemy penalty!');
            addLog(`Solved "${question.title}"! Enemy obliterated with -30s penalty!`);
          } else {
            toast.success('✅ All tests passed!');
          }
        } else {
          // Incorrect — record for stats but allow retry
          await recordSolution(question.id, false);
          toast.error('❌ Some tests failed. Try again!');
          addLog(`Submission for "${question.title}" failed. Keep trying!`);
        }
      }
    } catch {
      setConsoleOutput([{ type: 'error', content: 'Failed to connect to judge service.' }]);
      toast.error('❌ SERVER ERROR');
    } finally {
      setIsExecuting(false);
    }
  };

  const triggerSabotage = (type: 'fog' | 'invert' | 'shake') => {
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

  const triggerMemeNuke = () => {
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
      if (confirm('⚠️ WARNING: Leaving the match will deduct 20 XP. Are you sure?')) {
        await leaveMatch();
        toast.info('You left the match. -20 XP');
        navigate('/lobby');
      }
    } else {
      navigate('/lobby');
    }
  };

  const currentRank = getRankFromXP(profile?.xp || 0).rank;

  // Calculate progress percentages
  const myTimePercent = (gameState.myTeamTime / gameState.matchDuration) * 100;
  const enemyTimePercent = (gameState.enemyTeamTime / gameState.matchDuration) * 100;

  // Calculate halftime status
  const halfwayPoint = gameState.matchDuration / 2;
  const elapsedTime = gameState.matchDuration - gameState.myTeamTime;
  const timeUntilSabotage = Math.max(0, halfwayPoint - elapsedTime);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#09090b] text-foreground">
      {/* Match Result Overlay */}
      {isMatchCompleted && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
          <div className={`relative overflow-hidden border p-1 rounded-3xl max-w-lg w-full text-center shadow-2xl ${isWinner ? 'bg-gradient-to-br from-gold/50 via-yellow-600/20 to-transparent border-gold/50 shadow-gold/20' : 'bg-gradient-to-br from-red-600/50 via-red-900/20 to-transparent border-red-500/50 shadow-red-500/20'}`}>
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
                <Button onClick={() => navigate('/lobby')} className={`w-full h-14 text-lg font-bold tracking-widest uppercase transition-all hover:scale-[1.02] ${isWinner ? 'bg-gold hover:bg-gold/90 text-black shadow-[0_0_20px_rgba(251,191,36,0.4)]' : 'bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]'}`}>
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
      <header className="flex-shrink-0 px-2 pt-2 z-10">
        <div className="glass-panel px-4 py-2 flex items-center justify-between gap-4 border-b border-white/10 bg-[#161b22]/90 backdrop-blur-xl">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="font-orbitron text-sm md:text-base font-bold truncate text-primary/90 tracking-widest uppercase">Codewar</h1>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
                {gameState.teamSize}v{gameState.teamSize} <span className="text-white/20 px-1">|</span> {formatTimeVerbose(gameState.matchDuration)}
              </p>
            </div>
            <div className="h-8 w-px bg-border hidden md:block" />

            {!isLoading && (
              <div className="hidden md:flex items-center gap-4">
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-mono font-bold ${gameState.myTeamTime < 60 ? 'text-accent animate-pulse' : 'text-primary'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(gameState.myTeamTime)}
                  </span>
                  <div className="w-24 h-1.5 bg-black/50 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 rounded-full shadow-[0_0_10px_currentColor] ${myTimePercent > 50 ? 'bg-primary' : myTimePercent > 25 ? 'bg-gold' : 'bg-accent'}`} style={{ width: `${myTimePercent}%` }} />
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[9px] text-muted-foreground/50 font-black tracking-widest uppercase">VS</span>
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-[10px] font-mono font-bold text-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(gameState.enemyTeamTime)}
                  </span>
                  <div className="w-24 h-1.5 bg-black/50 rounded-full overflow-hidden">
                    <div className="h-full bg-accent shadow-[0_0_10px_currentColor] transition-all duration-300 rounded-full" style={{ width: `${enemyTimePercent}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1.5 bg-black/20 p-1 rounded-xl border border-white/5">
              {([['fog', '🌫', SABOTAGE_COSTS.fog], ['invert', '🔄', SABOTAGE_COSTS.invert], ['shake', '📳', SABOTAGE_COSTS.shake]] as const).map(([type, icon, cost]) => (
                <button
                  key={type}
                  onClick={() => triggerSabotage(type)}
                  disabled={!gameState.sabotagesUnlocked}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5
                    ${gameState.sabotagesUnlocked ? 'bg-white/5 hover:bg-white/10 hover:shadow-[0_0_10px_rgba(255,255,255,0.1)] text-white cursor-pointer' : 'bg-white/[0.02] opacity-30 cursor-not-allowed'}`}
                  title={`${type} (${formatTimeVerbose(cost as number)})`}
                >
                  <span>{icon}</span>
                </button>
              ))}
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button
                onClick={triggerMemeNuke}
                disabled={memeCooldown || !gameState.sabotagesUnlocked}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5
                  ${gameState.sabotagesUnlocked && !memeCooldown ? 'bg-accent/10 hover:bg-accent/20 text-accent hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] cursor-pointer' : 'bg-white/[0.02] opacity-30 cursor-not-allowed'}`}
                title={`Meme Nuke (${formatTimeVerbose(SABOTAGE_COSTS.memeNuke)})`}
              >
                💀
              </button>
            </div>

            <div className="text-[10px] font-mono tracking-widest text-muted-foreground hidden sm:block bg-black/30 px-2 py-1 rounded border border-white/5">
              {gameState.sabotagesUnlocked ? <span className="text-primary font-bold">🔓 WEAPONS HOT</span> : <span>🔒 {formatTimeVerbose(timeUntilSabotage)}</span>}
            </div>

            <div className="px-3 py-1.5 rounded-lg border border-gold/30 bg-gold/10 text-gold font-orbitron text-[11px] font-bold whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.15)]">
              <span>{currentRank.emoji}</span> {currentRank.name}
            </div>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 p-2 min-h-0 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full rounded-xl border border-white/10 overflow-hidden bg-[#0d1117] shadow-2xl">

          {/* ─── LEFT PANEL ─── */}
          <ResizablePanel defaultSize={35} minSize={25} className="flex flex-col">
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={60} minSize={30} className="flex flex-col overflow-hidden bg-surface/30">
                {/* Question List / Detail Toggle */}
                <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-white/5">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    <List size={12} />
                    {showQuestionList ? 'Select Question' : (question?.title || 'No Question')}
                  </div>
                  <button
                    onClick={() => setShowQuestionList(!showQuestionList)}
                    className="text-[10px] text-primary hover:text-primary/80 font-bold uppercase tracking-widest transition-colors"
                  >
                    {showQuestionList ? 'Back' : `All (${questions.length})`}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {showQuestionList ? (
                    /* ─── QUESTION LIST ─── */
                    <div className="space-y-2">
                      {isLoadingQuestions ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="animate-spin text-primary" />
                        </div>
                      ) : questions.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">No questions available</div>
                      ) : (
                        questions.map((q) => {
                          const solved = isQuestionSolved(q.id);
                          const isSelected = question?.id === q.id;
                          return (
                            <button
                              key={q.id}
                              onClick={() => {
                                setSelectedQuestion(q);
                                setShowQuestionList(false);
                              }}
                              className={`w-full text-left p-3 rounded-lg border transition-all group ${isSelected
                                ? 'border-primary/40 bg-primary/10 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                                : 'border-white/5 bg-black/20 hover:border-white/10 hover:bg-white/5'
                                }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`font-medium text-sm truncate ${isSelected ? 'text-primary' : 'text-white/80'}`}>
                                  {q.title}
                                </span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {solved && (
                                    <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                                      <CheckCircle2 size={10} /> Solved
                                    </span>
                                  )}
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest border ${q.difficulty === 'Easy' ? 'text-green-400 border-green-400/30 bg-green-400/10'
                                    : q.difficulty === 'Medium' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
                                      : q.difficulty === 'Hard' ? 'text-orange-400 border-orange-400/30 bg-orange-400/10'
                                        : 'text-red-400 border-red-400/30 bg-red-400/10'
                                    }`}>
                                    {q.difficulty}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground/60 mt-1 line-clamp-2">{q.description}</p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  ) : (
                    /* ─── QUESTION DETAIL ─── */
                    question ? (
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <h2 className="font-bold text-lg leading-tight text-white/90">{question.title}</h2>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isQuestionSolved(question.id) && (
                              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                                <CheckCircle2 size={10} /> Solved
                              </span>
                            )}
                            {question.difficulty && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap uppercase tracking-widest border shadow-sm ${question.difficulty === 'Easy' ? 'text-green-400 border-green-400/30 bg-green-400/10' : question.difficulty === 'Medium' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' : question.difficulty === 'Hard' ? 'text-orange-400 border-orange-400/30 bg-orange-400/10' : 'text-red-400 border-red-400/30 bg-red-400/10'}`}>
                                {question.difficulty}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-[13px] text-muted-foreground/80 leading-relaxed space-y-4">
                          <p>{question.description}</p>
                        </div>

                        {(() => {
                          let testCases: QuestionTestCase[] = [];
                          try {
                            const raw = question.test_cases;
                            if (Array.isArray(raw)) testCases = raw as QuestionTestCase[];
                            else if (typeof raw === 'string') testCases = JSON.parse(raw) as QuestionTestCase[];
                          } catch {
                            testCases = [];
                          }

                          const visible = testCases.filter((tc) => tc && tc.visible !== false);
                          if (visible.length === 0) return null;

                          return (
                            <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
                              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                                <Terminal size={12} /> Test Cases
                              </p>
                              {visible.map((tc, i: number) => (
                                <div key={i} className="bg-black/40 rounded-lg p-3 border border-white/5 space-y-2">
                                  <div>
                                    <span className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest mb-1 block">Input</span>
                                    <pre className="text-[12px] text-green-300 font-mono whitespace-pre-wrap">{String(tc.input ?? '(none)')}</pre>
                                  </div>
                                  <div className="w-full h-px bg-white/5" />
                                  <div>
                                    <span className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-widest mb-1 block">Output</span>
                                    <pre className="text-[12px] text-zinc-300 font-mono whitespace-pre-wrap">{String(tc.output ?? '')}</pre>
                                  </div>
                                </div>
                              ))}
                              {testCases.some((tc) => tc && tc.visible === false) && (
                                <p className="text-[9px] text-accent/50 font-mono italic text-center mt-2">✨ Hidden test cases will run on submit</p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <p className="text-sm">No question selected</p>
                        <button onClick={() => setShowQuestionList(true)} className="text-primary text-xs mt-2 hover:underline">Browse questions →</button>
                      </div>
                    )
                  )}
                </div>
              </ResizablePanel>

              <ResizableHandle className="bg-white/5 h-[2px] transition-colors hover:bg-primary/30" />

              <ResizablePanel defaultSize={40} minSize={20} className="bg-surface/20 flex flex-col pt-2">
                <Tabs defaultValue="battle" className="flex-1 flex flex-col min-h-0">
                  <TabsList className="bg-transparent border-b border-white/5 w-full justify-start rounded-none px-4 h-9 gap-4">
                    <TabsTrigger value="battle" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-1 py-2 text-[10px] uppercase tracking-widest font-bold">Battle Log</TabsTrigger>
                    <TabsTrigger value="teams" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-1 py-2 text-[10px] uppercase tracking-widest font-bold">Teams</TabsTrigger>
                  </TabsList>

                  <TabsContent value="battle" className="flex-1 min-h-0 mt-0 flex flex-col p-3 m-0 data-[state=inactive]:hidden">
                    <div className="flex-1 overflow-y-auto space-y-1 bg-[#09090b]/50 rounded-lg p-2 border border-white/5 shadow-inner custom-scrollbar flex flex-col-reverse">
                      {logs.map((log, i) => (
                        <div key={i} className={`text-[11px] leading-relaxed p-2 rounded-md border font-mono animate-in slide-in-from-left-2 fade-in duration-300 ${i === 0 ? 'text-primary font-bold border-primary/20 bg-primary/10 shadow-[0_0_10px_rgba(16,185,129,0.05)]' : 'text-muted-foreground/70 border-white/[0.02] bg-white/[0.02]'}`}>
                          {log}
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="teams" className="flex-1 min-h-0 mt-0 overflow-y-auto p-4 m-0 data-[state=inactive]:hidden custom-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h4 className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5 pb-2 border-b border-primary/20">
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Your Team
                        </h4>
                        <div className="space-y-2">
                          {gameState.myTeam.map((member, i) => (
                            <div key={member.user_id} className="flex items-center gap-2 text-xs bg-white/5 p-2 rounded-lg border border-white/5">
                              <span className="text-[12px] opacity-70">{i === 0 ? '👑' : '⚔'}</span>
                              <span className={`font-mono truncate ${member.user_id === profile?.user_id ? 'text-primary font-bold' : 'text-zinc-300'}`}>
                                {member.username}{member.user_id === profile?.user_id && ' (You)'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h4 className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-widest mb-1.5 pb-2 border-b border-accent/20">
                          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" /> Enemy Team
                        </h4>
                        <div className="space-y-2">
                          {gameState.enemyTeam.map((member) => (
                            <div key={member.user_id} className="flex items-center gap-2 text-xs bg-red-950/20 p-2 rounded-lg border border-accent/10">
                              <span className="text-[12px] opacity-70">💀</span>
                              <span className="font-mono text-zinc-400 truncate">{member.username}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle className="w-[2px] bg-background border-x border-white/5 transition-colors hover:bg-primary/30 z-20" />

          {/* ─── RIGHT PANEL: Editor Zone ─── */}
          <ResizablePanel defaultSize={65} minSize={40} className={`flex flex-col bg-[#0d1117] relative ${sabotageEffects.shake ? 'animate-shake' : ''}`}>

            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={75} minSize={30} className="flex flex-col relative z-0">
                <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-white/5">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                    Solution.py
                  </div>
                  <div className="text-[9px] text-white/20 font-mono tracking-widest uppercase">Monaco Editor</div>
                </div>
                <div className={`flex-1 pt-2 ${sabotageEffects.invert ? 'invert hue-rotate-180' : ''}`}>
                  <Editor
                    height="100%"
                    defaultLanguage="python"
                    theme="vs-dark"
                    value={code}
                    onChange={(value) => setCode(value || '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      fontLigatures: true,
                      padding: { top: 16, bottom: 16 },
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                      cursorSmoothCaretAnimation: "on",
                      formatOnPaste: true,
                      renderLineHighlight: "all",
                      parameterHints: { enabled: true },
                      suggestOnTriggerCharacters: true
                    }}
                  />
                </div>
              </ResizablePanel>

              <ResizableHandle className="bg-white/5 h-[2px] transition-colors hover:bg-primary/30 z-20" />

              <ResizablePanel defaultSize={25} minSize={15} className="flex flex-col z-0">
                <Tabs defaultValue="console" className="flex-1 flex flex-col min-h-0 bg-[#0d1117]">
                  <div className="flex items-center justify-between px-4 py-0 bg-[#161b22] border-b border-white/5">
                    <TabsList className="bg-transparent h-9 p-0 gap-6">
                      <TabsTrigger value="console" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-1 text-[10px] uppercase tracking-widest font-bold">
                        <Terminal size={12} className="mr-1.5 opacity-70" /> Console
                      </TabsTrigger>
                      <TabsTrigger value="input" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-1 text-[10px] uppercase tracking-widest font-bold">
                        Custom Input
                      </TabsTrigger>
                    </TabsList>
                    {isExecuting && (
                      <span className="flex items-center gap-1.5 text-[10px] text-accent font-bold uppercase tracking-widest animate-pulse">
                        <Loader2 className="animate-spin w-3 h-3" /> Executing
                      </span>
                    )}
                  </div>

                  <TabsContent value="console" className="flex-1 min-h-0 p-3 m-0 overflow-y-auto font-mono text-[12px] custom-scrollbar data-[state=inactive]:hidden">
                    {consoleOutput.length === 0 ? (
                      <div className="text-white/10 italic h-full flex items-center justify-center font-bold tracking-widest uppercase">Awaiting execution...</div>
                    ) : (
                      <div className="space-y-1">
                        {consoleOutput.map((log, i) => (
                          <div key={i} className={`flex gap-2 ${log.type === 'error' ? 'text-red-400 bg-red-500/5 p-1.5 rounded' : log.type === 'warn' ? 'text-yellow-400 bg-yellow-500/5 p-1.5 rounded' : 'text-zinc-300'}`}>
                            <span className="opacity-30 select-none">›</span>
                            <pre className="whitespace-pre-wrap font-inherit leading-relaxed">{log.content}</pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="input" className="flex-1 min-h-0 p-0 m-0 flex flex-col data-[state=inactive]:hidden">
                    <textarea
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      className="flex-1 w-full bg-transparent text-[13px] text-zinc-300 resize-none focus:outline-none p-4 font-mono placeholder:text-muted-foreground/30 custom-scrollbar"
                      placeholder="Enter standard input here..."
                    />
                  </TabsContent>
                </Tabs>
              </ResizablePanel>
            </ResizablePanelGroup>

            <div className="flex-shrink-0 p-4 bg-[#161b22] border-t border-white/5 flex gap-3 items-center z-10">
              <div className="text-[10px] text-muted-foreground/40 tracking-widest font-mono hidden sm:block font-bold">
                {isExecuting ? 'JUDGE ACTIVE...' : 'READY TO COMPILE'}
              </div>
              <div className="flex-1" />
              <Button variant="outline" onClick={handleExitMatch} className="h-10 px-5 gap-2 border-white/5 bg-transparent text-muted-foreground hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all text-[11px] font-bold tracking-widest uppercase">
                <XCircle size={14} />
                {isMatchCompleted ? 'Leave' : 'Surrender'}
              </Button>
              <Button onClick={runCode} disabled={isExecuting} className="h-10 px-6 bg-emerald-600/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold tracking-widest uppercase gap-2 transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] text-[11px]">
                <Play size={14} fill="currentColor" />
                {isExecuting ? 'Running' : 'Run'}
              </Button>
              <Button
                onClick={submitCode}
                disabled={isExecuting || (question ? isQuestionSolved(question.id) : true)}
                className={`h-10 px-8 font-extrabold tracking-widest uppercase gap-2 transition-all text-[11px] ${question && isQuestionSolved(question.id)
                  ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed opacity-60'
                  : 'bg-gradient-to-r from-gold to-amber-500 text-black shadow-[0_0_15px_rgba(251,191,36,0.2)] hover:shadow-[0_0_30px_rgba(251,191,36,0.4)] hover:scale-[1.02]'
                  }`}
              >
                {question && isQuestionSolved(question.id) ? (
                  <><Lock size={14} /> Solved</>
                ) : (
                  <><CheckCircle2 size={14} /> {isExecuting ? 'Judging' : 'Submit'}</>
                )}
              </Button>
            </div>

          </ResizablePanel>

        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default Game;
