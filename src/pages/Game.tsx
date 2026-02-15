import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useGameSession, TeamSize } from '@/hooks/useGameSession';
import { useAuth } from '@/contexts/AuthContext';
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

const QUESTIONS = [
  { title: 'Reverse String', description: 'Write a python function to reverse a string' },
  { title: 'Palindrome Check', description: 'Check if string is palindrome in Python' },
  { title: 'Two Sum', description: 'Return indices that sum to target using Python' },
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

  // Get match parameters from URL
  const matchId = searchParams.get('matchId') || undefined;
  const teamSizeParam = parseInt(searchParams.get('teamSize') || '5') as TeamSize;

  const {
    gameState,
    startGame,
    stopGame,
    deductMyTime,
    deductEnemyTime,
    initializeDemo
  } = useGameSession(matchId);

  const [wins, setWins] = useState(0);
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const [code, setCode] = useState('// Write your code. Earn glory.');
  const [logs, setLogs] = useState<string[]>(['Arena ready — fight begins!']);
  const [sabotageEffects, setSabotageEffects] = useState<{ fog: boolean; invert: boolean; shake: boolean }>({
    fog: false, invert: false, shake: false
  });
  const [memeCooldown, setMemeCooldown] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<{ type: 'log' | 'error' | 'warn'; content: string }[]>([]);
  const [isPyodideReady, setIsPyodideReady] = useState(false);
  const [pyodide, setPyodide] = useState<any>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Initialize game on mount
  useEffect(() => {
    setQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);

    if (!matchId) {
      // Demo mode - use team size from URL params
      initializeDemo(teamSizeParam);
    }

    // Start the game after a short delay
    const timer = setTimeout(() => startGame(), 1000);
    return () => clearTimeout(timer);
  }, [matchId, teamSizeParam, initializeDemo, startGame]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [`⚔ ${msg}`, ...prev].slice(0, 50));
  }, []);

  // Initialize Pyodide
  useEffect(() => {
    const initPyodide = async () => {
      try {
        if (window.loadPyodide) {
          const pyodideInstance = await window.loadPyodide();
          setPyodide(pyodideInstance);
          setIsPyodideReady(true);
          addLog('Python environment loaded successfully');
        } else {
          // Retry if script hasn't loaded yet
          setTimeout(initPyodide, 500);
        }
      } catch (err) {
        console.error('Failed to load Pyodide', err);
        addLog('Failed to load Python environment');
      }
    };
    initPyodide();
  }, [addLog]);

  const checkEnd = useCallback(() => {
    if (gameState.enemyTeamTime <= 0) {
      setWins((prev) => prev + 1);
      toast.success('🏆 VICTORY!');
      stopGame();
    }
    if (gameState.myTeamTime <= 0) {
      toast.error('💀 DEFEAT');
      stopGame();
    }
  }, [gameState.enemyTeamTime, gameState.myTeamTime, stopGame]);

  useEffect(() => {
    checkEnd();
  }, [gameState.myTeamTime, gameState.enemyTeamTime, checkEnd]);

  const runCode = async () => {
    setConsoleOutput([]); // Clear previous output

    if (!pyodide || !isPyodideReady) {
      toast.error('⏳ Python is still loading...');
      return;
    }

    try {
      // Capture stdout
      pyodide.setStdout({
        batched: (msg: string) => {
          setConsoleOutput(prev => [...prev, { type: 'log', content: msg }]);
        }
      });

      // Execute Python code
      await pyodide.runPythonAsync(code);

      deductEnemyTime(10);
      toast.success('🔥 EXECUTION SUCCESSFUL - Enemy -10s');
      addLog('Python code ran successfully');

    } catch (err: any) {
      setConsoleOutput(prev => [...prev, { type: 'error', content: err.toString() }]);
      toast.error('❌ RUNTIME ERROR');
    }
  };

  const submitCode = () => {
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

  const handleExitMatch = () => {
    stopGame();
    navigate('/lobby');
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
    <div className="min-h-screen p-3 md:p-4">
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
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg border border-border bg-surface text-sm">
            {gameState.sabotagesUnlocked ? (
              <span className="text-primary">🔓 Sabotages Active</span>
            ) : (
              <span className="text-muted-foreground">🔒 Unlocks in {formatTime(timeUntilSabotage)}</span>
            )}
          </div>
          <div className="px-4 py-2 rounded-xl border border-gold/40 bg-gradient-to-br from-gold/25 to-gold/10 text-gold font-orbitron font-bold">
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
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-bold">YOUR TEAM ⏱️</span>
                <span className={gameState.myTeamTime < 60 ? 'text-accent animate-pulse' : ''}>
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
                <span>{formatTime(gameState.enemyTeamTime)}</span>
              </div>
              <div className="h-3 bg-black/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-red-900 transition-all duration-300"
                  style={{ width: `${enemyTimePercent}%` }}
                />
              </div>
            </div>
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
                {!isPyodideReady && (
                  <span className="flex items-center gap-1 text-accent text-[10px]">
                    <Loader2 className="animate-spin w-3 h-3" /> Loading Python...
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

          <div className="flex gap-3">
            <Button onClick={runCode} className="bg-primary hover:bg-primary/80 gap-2">
              <Play size={16} fill="currentColor" /> RUN CODE
            </Button>
            <Button onClick={submitCode} className="bg-gold text-gold-foreground hover:bg-gold/80 gap-2">
              <CheckCircle2 size={16} /> SUBMIT
            </Button>
            <Button variant="outline" onClick={handleExitMatch} className="gap-2">
              <XCircle size={16} /> Exit
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