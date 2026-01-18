import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Trophy, Clock, Star, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  reward: number;
  timeLimit: string;
  progress: number;
  isLocked: boolean;
}

const challenges: Challenge[] = [
  {
    id: '1',
    title: 'Array Master',
    description: 'Solve 5 array problems in under 30 minutes',
    difficulty: 'Easy',
    reward: 100,
    timeLimit: '30 min',
    progress: 80,
    isLocked: false,
  },
  {
    id: '2',
    title: 'Speed Demon',
    description: 'Win 3 matches in a row without losing',
    difficulty: 'Medium',
    reward: 250,
    timeLimit: '24 hours',
    progress: 33,
    isLocked: false,
  },
  {
    id: '3',
    title: 'Tree Climber',
    description: 'Complete all tree traversal challenges',
    difficulty: 'Medium',
    reward: 300,
    timeLimit: '1 week',
    progress: 60,
    isLocked: false,
  },
  {
    id: '4',
    title: 'Graph Explorer',
    description: 'Master BFS and DFS algorithms',
    difficulty: 'Hard',
    reward: 500,
    timeLimit: '2 weeks',
    progress: 25,
    isLocked: false,
  },
  {
    id: '5',
    title: 'Dynamic Master',
    description: 'Solve 10 DP problems with optimal solutions',
    difficulty: 'Expert',
    reward: 1000,
    timeLimit: '1 month',
    progress: 0,
    isLocked: true,
  },
];

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Easy':
      return 'text-green-400 bg-green-400/20';
    case 'Medium':
      return 'text-yellow-400 bg-yellow-400/20';
    case 'Hard':
      return 'text-orange-400 bg-orange-400/20';
    case 'Expert':
      return 'text-red-400 bg-red-400/20';
    default:
      return 'text-muted-foreground bg-muted/20';
  }
};

const Challenges: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 h-[70px] bg-surface/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-6 z-50">
        <Button variant="outline" size="sm" onClick={() => navigate('/lobby')}>
          <ArrowLeft className="mr-2" size={16} />
          Back to Lobby
        </Button>
        <h1 className="font-orbitron text-xl font-bold text-primary flex items-center gap-2">
          <Zap size={24} />
          CHALLENGES
        </h1>
        <div className="w-32" />
      </header>

      <main className="pt-[90px] pb-10 px-4 max-w-4xl mx-auto">
        {/* Daily Bonus */}
        <div className="glass-panel p-6 mb-8 text-center border-2 border-gold/30 bg-gradient-to-br from-gold/10 to-transparent">
          <Trophy className="mx-auto text-gold mb-3" size={48} />
          <h2 className="font-orbitron text-2xl font-bold mb-2">Daily Challenge</h2>
          <p className="text-muted-foreground mb-4">Complete today's challenge for bonus rewards!</p>
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-gold">500</p>
              <p className="text-sm text-muted-foreground">Coins</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gold">50</p>
              <p className="text-sm text-muted-foreground">Gems</p>
            </div>
          </div>
          <Button className="gradient-accent">Start Daily Challenge</Button>
        </div>

        {/* Challenge List */}
        <div className="space-y-4">
          {challenges.map((challenge) => (
            <div
              key={challenge.id}
              className={`glass-panel p-5 transition-all ${
                challenge.isLocked ? 'opacity-60' : 'hover:border-primary/50'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {challenge.isLocked ? (
                      <Lock className="text-muted-foreground" size={20} />
                    ) : (
                      <Star className="text-primary" size={20} />
                    )}
                    <h3 className="font-orbitron font-bold text-lg">{challenge.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getDifficultyColor(challenge.difficulty)}`}>
                      {challenge.difficulty}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm mb-3">{challenge.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Clock size={14} className="text-muted-foreground" />
                      <span className="text-muted-foreground">{challenge.timeLimit}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gold">🪙 {challenge.reward}</span>
                    </div>
                  </div>
                </div>

                <div className="md:w-48">
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold">{challenge.progress}%</span>
                    </div>
                    <Progress value={challenge.progress} className="h-2" />
                  </div>
                  <Button
                    className="w-full"
                    variant={challenge.isLocked ? 'outline' : 'default'}
                    disabled={challenge.isLocked}
                  >
                    {challenge.isLocked ? 'Locked' : challenge.progress === 100 ? 'Claim' : 'Continue'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Challenges;
