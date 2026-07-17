import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Question {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    template_code: string | null;
    test_cases: unknown;
    game_mode: string;
}

interface QuestionProgress {
    question_id: string;
    solved: boolean;
    sabotage_applied: boolean;
}

interface SubmitResult {
    blocked: boolean;
    passed: boolean;
    sabotage_applied: boolean;
    reason: string;
}

type RpcInvoker = (fnName: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

export const useQuestionProgress = (matchId?: string) => {
    const { user } = useAuth();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [solvedQuestionIds, setSolvedQuestionIds] = useState<Set<string>>(new Set());
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

    const callRpc = useCallback(async (fnName: string, params: Record<string, unknown>) => {
        return supabase.rpc(fnName, params);
    }, []) as unknown as RpcInvoker;

    // Fetch all questions
    const fetchQuestions = useCallback(async () => {
        setIsLoadingQuestions(true);
        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .order('difficulty', { ascending: true });

        if (!error && data && data.length > 0) {
            setQuestions(data as unknown as Question[]);
            // Auto-select first question if none selected
            setSelectedQuestion((current) => current ?? (data[0] as unknown as Question));
        }
        setIsLoadingQuestions(false);
    }, []);

    // Fetch solved progress for this match (shared across team members)
    const fetchProgress = useCallback(async () => {
        if (!matchId || !user) return;

        try {
            // 1. Fetch match to determine my team
            const { data: matchData } = await supabase
                .from('matches')
                .select('team_a, team_b')
                .eq('id', matchId)
                .single();

            if (!matchData) return;

            const isTeamA = matchData.team_a.includes(user.id);
            const myTeamIds = isTeamA ? matchData.team_a : matchData.team_b;

            // 2. Fetch all solved progress rows for this match
            const { data, error } = await supabase
                .from('match_question_progress')
                .select('question_id, solved, user_id')
                .eq('match_id', matchId)
                .eq('solved', true);

            if (!error && data) {
                const solvedIds = new Set(
                    (data as unknown as { question_id: string; user_id: string }[])
                        .filter((p) => myTeamIds.includes(p.user_id))
                        .map((p) => p.question_id)
                );
                setSolvedQuestionIds(solvedIds);
            }
        } catch (err) {
            console.error('Error fetching progress:', err);
        }
    }, [matchId, user]);

    // Check if a specific question is solved
    const isQuestionSolved = useCallback(
        (questionId: string) => solvedQuestionIds.has(questionId),
        [solvedQuestionIds]
    );

    // Submit solution result to the backend RPC
    const recordSolution = useCallback(
        async (questionId: string, isCorrect: boolean): Promise<SubmitResult> => {
            if (!matchId) {
                return { blocked: false, passed: false, sabotage_applied: false, reason: 'no_match' };
            }

            // Quick client-side guard (backend also enforces)
            if (isCorrect && isQuestionSolved(questionId)) {
                return { blocked: true, passed: false, sabotage_applied: false, reason: 'already_solved' };
            }

            const { data, error } = await callRpc('submit_question_solution', {
                match_id_param: matchId,
                question_id_param: questionId,
                is_correct: isCorrect,
            });

            if (error) {
                console.error('submit_question_solution RPC error:', error);
                return { blocked: false, passed: false, sabotage_applied: false, reason: 'rpc_error' };
            }

            const result = (data as SubmitResult) || { blocked: false, passed: false, sabotage_applied: false, reason: 'no_data' };

            // Update local state if solved
            if (result && result.passed) {
                setSolvedQuestionIds((prev) => new Set([...prev, questionId]));
            }

            return result;
        },
        [matchId, isQuestionSolved, callRpc]
    );

    // Load on mount
    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

    // Realtime progress listener for team-wide updates
    useEffect(() => {
        if (!matchId) return;

        const channel = supabase
            .channel(`progress-changes-${matchId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'match_question_progress',
                    filter: `match_id=eq.${matchId}`,
                },
                async (payload) => {
                    const newProgress = payload.new as { question_id: string; user_id: string; solved: boolean } | null;
                    if (newProgress && newProgress.solved) {
                        // Refetch the full progress to sync local set
                        await fetchProgress();

                        // If solved by a teammate (and not us), display a nice toast notification
                        if (newProgress.user_id !== user?.id) {
                            // Find teammate profile details
                            const { data: profileData } = await supabase
                                .from('profiles')
                                .select('username')
                                .eq('user_id', newProgress.user_id)
                                .single();

                            const q = questions.find(question => question.id === newProgress.question_id);
                            const solverName = profileData?.username || 'A teammate';

                            toast.success(`🎉 ${solverName} solved "${q?.title || 'a question'}"!`);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [matchId, fetchProgress, user, questions]);

    return {
        questions,
        selectedQuestion,
        setSelectedQuestion,
        solvedQuestionIds,
        isQuestionSolved,
        recordSolution,
        isLoadingQuestions,
        fetchProgress,
    };
};
