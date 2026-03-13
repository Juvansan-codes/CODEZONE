import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Question {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    template_code: string | null;
    test_cases: any;
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

export const useQuestionProgress = (matchId?: string) => {
    const { user } = useAuth();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [solvedQuestionIds, setSolvedQuestionIds] = useState<Set<string>>(new Set());
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);

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
            if (!selectedQuestion) {
                setSelectedQuestion(data[0] as unknown as Question);
            }
        }
        setIsLoadingQuestions(false);
    }, []);

    // Fetch user's solved progress for this match
    const fetchProgress = useCallback(async () => {
        if (!matchId || !user) return;

        const { data, error } = await (supabase.from as any)('match_question_progress')
            .select('question_id, solved, sabotage_applied')
            .eq('match_id', matchId)
            .eq('user_id', user.id)
            .eq('solved', true);

        if (!error && data) {
            const solvedIds = new Set(
                (data as unknown as QuestionProgress[])
                    .filter((p) => p.solved)
                    .map((p) => p.question_id)
            );
            setSolvedQuestionIds(solvedIds);
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

            const { data, error } = await (supabase.rpc as any)('submit_question_solution', {
                match_id_param: matchId,
                question_id_param: questionId,
                is_correct: isCorrect,
            });

            if (error) {
                console.error('submit_question_solution RPC error:', error);
                return { blocked: false, passed: false, sabotage_applied: false, reason: 'rpc_error' };
            }

            const result = data as SubmitResult;

            // Update local state if solved
            if (result.passed && result.sabotage_applied) {
                setSolvedQuestionIds((prev) => new Set([...prev, questionId]));
            }

            return result;
        },
        [matchId, isQuestionSolved]
    );

    // Load on mount
    useEffect(() => {
        fetchQuestions();
    }, [fetchQuestions]);

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

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
