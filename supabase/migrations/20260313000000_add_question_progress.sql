-- ============================================================
-- Match Question Progress: tracks per-user, per-question solve
-- state within a match, and prevents duplicate sabotage.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.match_question_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    solved BOOLEAN DEFAULT false,
    sabotage_applied BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    -- One row per (match, user, question) — prevents duplicates
    UNIQUE (match_id, user_id, question_id)
);

-- RLS
ALTER TABLE public.match_question_progress ENABLE ROW LEVEL SECURITY;

-- Users can read their own progress
CREATE POLICY "Users can read own progress"
ON public.match_question_progress
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own progress rows
CREATE POLICY "Users can insert own progress"
ON public.match_question_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress rows
CREATE POLICY "Users can update own progress"
ON public.match_question_progress
FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================================
-- RPC: submit_question_solution
--
-- Called AFTER the external judge confirms the result.
-- Enforces the "solve once, sabotage once" rule atomically.
--
-- Returns JSON: { blocked, passed, sabotage_applied, reason }
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_question_solution(
    match_id_param UUID,
    question_id_param UUID,
    is_correct BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_match RECORD;
    v_progress RECORD;
    v_is_team_a BOOLEAN;
    v_opponent_side TEXT;
    v_penalty_seconds INTEGER := 30;
BEGIN
    v_user_id := auth.uid();

    -- 1. Get the match to determine teams
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = match_id_param;

    IF v_match IS NULL THEN
        RETURN jsonb_build_object(
            'blocked', true,
            'passed', false,
            'sabotage_applied', false,
            'reason', 'match_not_found'
        );
    END IF;

    -- 2. Check if already solved
    SELECT * INTO v_progress
    FROM public.match_question_progress
    WHERE match_id = match_id_param
      AND user_id = v_user_id
      AND question_id = question_id_param;

    IF v_progress IS NOT NULL AND v_progress.solved = true THEN
        RETURN jsonb_build_object(
            'blocked', true,
            'passed', false,
            'sabotage_applied', false,
            'reason', 'already_solved'
        );
    END IF;

    -- 3. If incorrect, just return (no state change needed)
    IF NOT is_correct THEN
        RETURN jsonb_build_object(
            'blocked', false,
            'passed', false,
            'sabotage_applied', false,
            'reason', 'incorrect'
        );
    END IF;

    -- 4. Correct & not yet solved → record progress
    INSERT INTO public.match_question_progress (match_id, user_id, question_id, solved, sabotage_applied)
    VALUES (match_id_param, v_user_id, question_id_param, true, true)
    ON CONFLICT (match_id, user_id, question_id)
    DO UPDATE SET solved = true, sabotage_applied = true, updated_at = now();

    -- 5. Apply time penalty to opponent team
    v_is_team_a := v_user_id = ANY(v_match.team_a);
    v_opponent_side := CASE WHEN v_is_team_a THEN 'b' ELSE 'a' END;

    IF v_opponent_side = 'a' THEN
        UPDATE public.matches
        SET team_a_penalties = team_a_penalties + v_penalty_seconds
        WHERE id = match_id_param;
    ELSE
        UPDATE public.matches
        SET team_b_penalties = team_b_penalties + v_penalty_seconds
        WHERE id = match_id_param;
    END IF;

    RETURN jsonb_build_object(
        'blocked', false,
        'passed', true,
        'sabotage_applied', true,
        'reason', 'solved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
