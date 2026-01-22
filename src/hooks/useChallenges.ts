import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Challenge {
  id: string;
  title: string;
  description: string;
  challenge_type: 'daily' | 'weekly' | 'special';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  reward_coins: number;
  reward_gems: number;
  reward_xp: number;
  requirements: Record<string, number>;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface UserChallenge {
  id: string;
  challenge: Challenge;
  progress: number;
  target: number;
  is_completed: boolean;
  completed_at: string | null;
  claimed_at: string | null;
}

export const useChallenges = () => {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyChallenges, setDailyChallenges] = useState<UserChallenge[]>([]);
  const [weeklyChallenges, setWeeklyChallenges] = useState<UserChallenge[]>([]);
  const [specialChallenges, setSpecialChallenges] = useState<UserChallenge[]>([]);

  const fetchChallenges = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    // Fetch all active challenges
    const { data: challengesData, error: challengesError } = await supabase
      .from('challenges')
      .select('*')
      .eq('is_active', true);

    if (challengesError) {
      console.error('Error fetching challenges:', challengesError);
      setLoading(false);
      return;
    }

    // Fetch user's challenge progress
    const { data: userChallenges } = await supabase
      .from('user_challenges')
      .select('*')
      .eq('user_id', user.id);

    // Combine challenges with user progress
    const combined: UserChallenge[] = (challengesData || []).map((challenge) => {
      const userProgress = userChallenges?.find(uc => uc.challenge_id === challenge.id);
      
      // Get target from requirements
      const requirements = challenge.requirements as Record<string, number>;
      const target = Object.values(requirements)[0] || 1;

      return {
        id: userProgress?.id || '',
        challenge: {
          id: challenge.id,
          title: challenge.title,
          description: challenge.description,
          challenge_type: challenge.challenge_type as 'daily' | 'weekly' | 'special',
          difficulty: challenge.difficulty as 'easy' | 'medium' | 'hard' | 'expert',
          reward_coins: challenge.reward_coins,
          reward_gems: challenge.reward_gems,
          reward_xp: challenge.reward_xp,
          requirements,
          start_date: challenge.start_date,
          end_date: challenge.end_date,
          is_active: challenge.is_active,
        },
        progress: userProgress?.progress || 0,
        target,
        is_completed: userProgress?.is_completed || false,
        completed_at: userProgress?.completed_at || null,
        claimed_at: userProgress?.claimed_at || null,
      };
    });

    setChallenges(combined);
    setDailyChallenges(combined.filter(c => c.challenge.challenge_type === 'daily'));
    setWeeklyChallenges(combined.filter(c => c.challenge.challenge_type === 'weekly'));
    setSpecialChallenges(combined.filter(c => c.challenge.challenge_type === 'special'));
    setLoading(false);
  }, [user]);

  // Update progress for a challenge
  const updateProgress = useCallback(async (
    challengeId: string,
    progressAmount: number = 1
  ) => {
    if (!user) return { error: 'Not authenticated' };

    // Check if user already has this challenge
    const { data: existing } = await supabase
      .from('user_challenges')
      .select('*')
      .eq('user_id', user.id)
      .eq('challenge_id', challengeId)
      .single();

    // Get challenge details
    const challenge = challenges.find(c => c.challenge.id === challengeId);
    if (!challenge) return { error: 'Challenge not found' };

    const newProgress = (existing?.progress || 0) + progressAmount;
    const isCompleted = newProgress >= challenge.target;

    if (existing) {
      // Update existing
      await supabase
        .from('user_challenges')
        .update({
          progress: newProgress,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', existing.id);
    } else {
      // Create new
      await supabase
        .from('user_challenges')
        .insert({
          user_id: user.id,
          challenge_id: challengeId,
          progress: newProgress,
          target: challenge.target,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        });
    }

    if (isCompleted) {
      toast.success(`🎉 Challenge completed: ${challenge.challenge.title}`);
    }

    await fetchChallenges();
    return { error: null };
  }, [user, challenges, fetchChallenges]);

  // Claim rewards
  const claimReward = useCallback(async (userChallengeId: string) => {
    if (!user) return { error: 'Not authenticated' };

    const challenge = challenges.find(c => c.id === userChallengeId);
    if (!challenge) return { error: 'Challenge not found' };

    if (!challenge.is_completed) return { error: 'Challenge not completed' };
    if (challenge.claimed_at) return { error: 'Already claimed' };

    // Update user_challenges
    await supabase
      .from('user_challenges')
      .update({ claimed_at: new Date().toISOString() })
      .eq('id', userChallengeId);

    // Add rewards to user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('coins, gems, xp')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      await supabase
        .from('profiles')
        .update({
          coins: profile.coins + challenge.challenge.reward_coins,
          gems: profile.gems + challenge.challenge.reward_gems,
          xp: profile.xp + challenge.challenge.reward_xp,
        })
        .eq('user_id', user.id);
    }

    toast.success(
      `Claimed: +${challenge.challenge.reward_coins} 🪙 +${challenge.challenge.reward_gems} 💎 +${challenge.challenge.reward_xp} XP`
    );

    await fetchChallenges();
    return { error: null };
  }, [user, challenges, fetchChallenges]);

  // Initial fetch
  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  return {
    challenges,
    dailyChallenges,
    weeklyChallenges,
    specialChallenges,
    loading,
    updateProgress,
    claimReward,
    refetch: fetchChallenges,
  };
};
