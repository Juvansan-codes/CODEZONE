import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Zap, Trophy, Clock, Star, Lock, Loader2, Coins, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty?: string;
  reward_coins: number;
  reward_gems: number;
  reward_xp: number;
  timeLimit: string;
  progress: number;
  isLocked: boolean;
  isCompleted: boolean;
  isClaimed: boolean;
  goal_target: number;
  current_progress: number;
}

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Easy':
      return 'text-green-400 bg-green-400/10 border-green-400/20';
    case 'Medium':
      return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    case 'Hard':
      return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    case 'Expert':
      return 'text-red-400 bg-red-400/10 border-red-400/20';
    default:
      return 'text-muted-foreground bg-muted/10 border-muted/20';
  }
};

const Challenges: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculate totals
  const totalCoins = challenges.reduce((acc, curr) => acc + (curr.reward_coins || 0), 0);
  const totalGems = challenges.reduce((acc, curr) => acc + (curr.reward_gems || 0), 0);

  const fetchChallenges = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch all active challenges
      const { data: allChallenges, error: cError } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true);

      if (cError) throw cError;

      // 2. Fetch user progress
      const { data: userProgress, error: uError } = await supabase
        .from('user_challenges')
        .select('*')
        .eq('user_id', user.id);

      if (uError) throw uError;

      // 3. Merge data
      const merged = (allChallenges as any[])?.map((c: any) => {
        const progressEntry = userProgress?.find((up: any) => up.challenge_id === c.id);
        const progressVal = progressEntry ? progressEntry.progress : 0;

        const target = c.goal_target || 1;
        const percentage = Math.min(100, Math.round((progressVal / target) * 100));
        const isCompleted = progressVal >= target;
        const isClaimed = !!progressEntry?.claimed_at;

        return {
          id: c.id,
          title: c.title,
          description: c.description,
          difficulty: c.type || 'Daily', // Use type as difficulty label
          reward_xp: c.reward_xp || 0,
          timeLimit: c.type === 'daily' ? '24h' : '7d',
          progress: percentage,
          isLocked: false,
          isCompleted,
          isClaimed,
          goal_target: target,
          current_progress: progressVal
        } as Challenge;
      });

      // Sort: Claimable -> In Progress -> Completed/Claimed
      // Removed sorting as per user's provided code snippet
      // merged.sort((a, b) => {
      //   const aClaimable = a.isCompleted && !a.isClaimed;
      //   const bClaimable = b.isCompleted && !b.isClaimed;
      //   if (aClaimable && !bClaimable) return -1;
      //   if (!aClaimable && bClaimable) return 1;

      //   if (a.isClaimed && !b.isClaimed) return 1;
      //   if (!a.isClaimed && b.isClaimed) return -1;

      //   return b.progress - a.progress; // High progress first
      // });

      setChallenges(merged);
    } catch (err) {
      console.error('Error fetching challenges:', err);
      toast.error('Failed to load challenges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, [user]);

  const handleClaim = async (challengeId: string, rewardCoins: number, rewardGems: number, rewardXp: number = 0) => {
    if (!user) return;

    try {
      // 1. Update user_challenges to claimed
      const { error: updateError } = await supabase
        .from('user_challenges')
        .update({ claimed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId);

      if (updateError) throw updateError;

      // 2. Add rewards to profile
      const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (pError || !profile) throw new Error('Profile not found');

      const updates: any = {
        coins: (profile.coins || 0) + rewardCoins,
        gems: (profile.gems || 0) + rewardGems
      };

      if (rewardXp > 0) {
        updates.xp = (profile.xp || 0) + rewardXp;
      }

      const { error: rewardError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (rewardError) throw rewardError;

      toast.success(`Claimed ${rewardCoins} Coins, ${rewardGems} Gems${rewardXp > 0 ? ` & ${rewardXp} XP` : ''}!`);

      // Refresh local state
      setChallenges(prev => prev.map(c =>
        c.id === challengeId ? { ...c, isClaimed: true } : c
      ));

    } catch (err) {
      console.error('Error claiming reward:', err);
      toast.error('Failed to claim reward');
    }
  };

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
          <h2 className="font-orbitron text-2xl font-bold mb-2">Daily Quests</h2>
          <p className="text-muted-foreground mb-4">Complete quests to earn rewards!</p>
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-gold">{totalCoins}</p>
              <p className="text-sm text-muted-foreground">Coins</p>
            </div>
            {totalGems > 0 && (
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-400">{totalGems}</p>
                <p className="text-sm text-muted-foreground">Gems</p>
              </div>
            )}
          </div>
        </div>
        {/* Challenge List */}
        <div className="space-y-4">
          {loading ? (
            // Skeleton Loader
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-panel p-5 border border-white/5">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-6 w-48" />
                    </div>
                    <Skeleton className="h-4 w-full max-w-md" />
                    <div className="flex gap-3">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                  <div className="md:w-48 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                </div>
              </div>
            ))
          ) : challenges.length === 0 ? (
            <div className="text-center py-10 flex flex-col items-center gap-3">
              <div className="bg-muted/20 p-4 rounded-full">
                <Lock className="text-muted-foreground" size={32} />
              </div>
              <p className="text-muted-foreground">No active quests available right now.</p>
              <p className="text-sm text-muted-foreground/60">Check back later for new challenges!</p>
            </div>
          ) : (
            challenges.map((challenge) => (
              <div
                key={challenge.id}
                className={`glass-panel p-5 transition-all duration-300 ${challenge.isClaimed
                  ? 'opacity-60 border-green-500/20 bg-green-500/5'
                  : challenge.isCompleted
                    ? 'border-gold/50 shadow-[0_0_15px_-5px_rgba(251,191,36,0.3)]'
                    : 'hover:border-primary/50'
                  }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {challenge.isClaimed ? (
                        <div className="p-1 rounded-full bg-green-500/20 text-green-400">
                          <Trophy size={16} />
                        </div>
                      ) : (
                        <div className="p-1 rounded-full bg-primary/20 text-primary">
                          <Star size={16} />
                        </div>
                      )}
                      <h3 className="font-orbitron font-bold text-lg flex items-center gap-3">
                        {challenge.title}
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${getDifficultyColor(challenge.difficulty)}`}>
                          {challenge.difficulty.toUpperCase()}
                        </span>
                      </h3>
                      {challenge.isClaimed && (
                        <span className="text-green-400 text-xs font-bold px-2 py-0.5 bg-green-400/10 rounded ml-auto md:ml-0">
                          COMPLETED
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm mb-3">{challenge.description}</p>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded text-xs text-muted-foreground">
                        <Clock size={12} />
                        <span>{challenge.timeLimit}</span>
                      </div>

                      {/* Rewards */}
                      <div className="flex items-center gap-3">
                        {challenge.reward_coins > 0 && (
                          <div className="flex items-center gap-1 text-gold font-medium">
                            <Coins size={14} />
                            <span>{challenge.reward_coins}</span>
                          </div>
                        )}
                        {challenge.reward_gems > 0 && (
                          <div className="flex items-center gap-1 text-blue-400 font-medium">
                            <Gem size={14} />
                            <span>{challenge.reward_gems}</span>
                          </div>
                        )}
                        {challenge.reward_xp > 0 && (
                          <div className="flex items-center gap-1 text-purple-400 font-medium">
                            <Zap size={14} />
                            <span>{challenge.reward_xp} XP</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="md:w-48 bg-black/20 p-3 rounded-lg border border-white/5">
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-mono text-primary">{challenge.current_progress} / {challenge.goal_target}</span>
                      </div>
                      <Progress value={challenge.progress} className="h-1.5" />
                    </div>
                    <Button
                      className={`w-full h-9 font-orbitron tracking-wide text-xs ${challenge.isCompleted && !challenge.isClaimed
                        ? 'animate-pulse bg-gold text-black hover:bg-gold/90 shadow-lg shadow-gold/20'
                        : ''
                        }`}
                      variant={challenge.isClaimed ? 'ghost' : challenge.isCompleted ? 'default' : 'outline'}
                      size="sm"
                      disabled={!challenge.isCompleted || challenge.isClaimed}
                      onClick={() => handleClaim(challenge.id, challenge.reward_coins, challenge.reward_gems, challenge.reward_xp)}
                    >
                      {challenge.isClaimed ? 'CLAIMED' : challenge.isCompleted ? 'CLAIM REWARD' : 'IN PROGRESS'}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Challenges;
