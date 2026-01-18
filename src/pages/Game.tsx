import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const RANKS = [
  'Bronze Techie', 'Silver Debugger', 'Gold Architect', 'Platinum Engineer',
  'Shadow Coder', 'Elite Exploiter', 'Cyber Overlord', 'Hacker Legend'
];

const QUESTIONS = [
  { title: 'Reverse String', description: 'Write a function to reverse a string' },
  { title: 'Palindrome Check', description: 'Check if string is palindrome' },
  { title: 'Two Sum', description: 'Return indices that sum to target' },
];

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const Game: React.FC = () => {
  const navigate = useNavigate();
  const [teamTime, setTeamTime] = useState(900);
  const [enemyTime, setEnemyTime] = useState(900);
  const [wins, setWins] = useState(0);
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const [code, setCode] = useState('// Write your code. Earn glory.');
  const [logs, setLogs] = useState<string[]>(['Arena ready — fight begins!']);
  const [sabotageEffects, setSabotageEffects] = useState<{ fog: boolean; invert: boolean; shake: boolean }>({
    fog: false, invert: false, shake: false
  });
  const [memeCooldown, setMemeCooldown] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setQuestion(QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]);
  }, []);

  const addLog = (msg: string) => {
    setLogs((prev) => [`⚔ ${msg}`, ...prev].slice(0, 50));
  };

  const checkEnd = () => {
    if (enemyTime <= 0) {
      setWins((prev) => prev + 1);
      toast.success('🏆 VICTORY!');
      setEnemyTime(900);
      setTeamTime(900);
    }
    if (teamTime <= 0) {
      toast.error('💀 DEFEAT');
      setEnemyTime(900);
      setTeamTime(900);
    }
  };

  const runCode = () => {
    setEnemyTime((prev) => Math.max(0, prev - 10));
    toast.success('🔥 ENEMY LOST 10s');
    addLog('Run successful — chip damage dealt');
    checkEnd();
  };

  const submitCode = () => {
    setEnemyTime((prev) => Math.max(0, prev - 20));
    toast.success('💥 FINISHER! Enemy -20s');
    addLog('Submission landed');
    checkEnd();
  };

  const useSabotage = (type: 'fog' | 'invert' | 'shake', cost: number) => {
    if (teamTime < cost) {
      toast.error('⏱ Not enough Time Tokens!');
      return;
    }
    setTeamTime((prev) => prev - cost);

    setSabotageEffects((prev) => ({ ...prev, [type]: true }));
    setTimeout(() => {
      setSabotageEffects((prev) => ({ ...prev, [type]: false }));
    }, type === 'shake' ? 500 : 4000);
  };

  const useMemeNuke = () => {
    if (memeCooldown) {
      toast.error('⏳ Meme Nuke recharging');
      return;
    }
    if (teamTime < 60) {
      toast.error('⏱ Not enough Time Tokens');
      return;
    }

    setTeamTime((prev) => prev - 60);
    setMemeCooldown(true);

    toast.info(
      <div className="text-center">
        <div className="text-4xl mb-2">💀</div>
        <div className="font-bold">MEME NUKE DEPLOYED!</div>
        <div className="text-sm mt-1">Enemy will be distracted for 60s</div>
      </div>,
      { duration: 5000 }
    );

    setTimeout(() => setMemeCooldown(false), 60000);
  };

  const currentRank = RANKS[Math.min(wins, RANKS.length - 1)];

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
          <p className="text-sm text-primary">⚔️ Match Active — Solve to Survive</p>
        </div>
        <div className="px-4 py-2 rounded-xl border border-gold/40 bg-gradient-to-br from-gold/25 to-gold/10 text-gold font-orbitron font-bold">
          {currentRank}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left HUD */}
        <aside className="lg:col-span-3 space-y-4">
          {/* Team Members */}
          <div className="glass-panel p-4">
            <h3 className="font-bold mb-2">TEAM MEMBERS 👥</h3>
            <div className="text-sm space-y-1">
              <div>🔥 You</div>
              <div>🛡 teammate-1</div>
              <div>⚙ teammate-2</div>
            </div>
          </div>

          {/* Timers */}
          <div className="glass-panel p-4">
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-bold">YOUR TEAM ⏱️</span>
                <span>{formatTime(teamTime)}</span>
              </div>
              <div className="h-3 bg-black/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-300"
                  style={{ width: `${(teamTime / 900) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-bold text-accent">ENEMY ⏱️</span>
                <span>{formatTime(enemyTime)}</span>
              </div>
              <div className="h-3 bg-black/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-red-900 transition-all duration-300"
                  style={{ width: `${(enemyTime / 900) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Sabotages */}
          <div className="glass-panel p-4">
            <h3 className="font-bold mb-3">SABOTAGES 😈</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => useSabotage('fog', 10)}>
                Fog (10 Tokens)
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => useSabotage('invert', 15)}>
                Invert (15 Tokens)
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => useSabotage('shake', 8)}>
                Shake (8 Tokens)
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-accent text-accent hover:bg-accent/20"
                onClick={useMemeNuke}
                disabled={memeCooldown}
              >
                💀 MEME NUKE (60 Tokens)
              </Button>
            </div>
          </div>
        </aside>

        {/* Center - Editor */}
        <main className={`lg:col-span-6 ${sabotageEffects.shake ? 'animate-shake' : ''}`}>
          <div className="glass-panel p-4 mb-3">
            <h2 className="font-bold text-lg">{question.title}</h2>
            <p className="text-sm text-muted-foreground">{question.description}</p>
          </div>

          <div className="relative mb-3">
            <textarea
              ref={editorRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`w-full h-[350px] md:h-[400px] bg-[#1e1e1e] border border-border rounded-xl p-4 font-mono text-sm text-green-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary ${
                sabotageEffects.invert ? 'invert hue-rotate-180' : ''
              }`}
              spellCheck={false}
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={runCode} className="bg-green-600 hover:bg-green-700">
              RUN
            </Button>
            <Button onClick={submitCode} className="bg-yellow-600 hover:bg-yellow-700">
              SUBMIT
            </Button>
            <Button variant="outline" onClick={() => navigate('/lobby')}>
              Exit Match
            </Button>
          </div>
        </main>

        {/* Right - Kill Feed */}
        <aside className="lg:col-span-3">
          <div className="glass-panel p-4 h-full max-h-[500px]">
            <h3 className="font-bold mb-3">KILL FEED</h3>
            <div className="space-y-1 text-sm overflow-y-auto max-h-[400px] bg-white/5 rounded-lg p-3">
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
