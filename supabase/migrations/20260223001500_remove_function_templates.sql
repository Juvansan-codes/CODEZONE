-- Remove function-based templates from existing questions
UPDATE public.questions
SET template_code = '# Write your code here',
    updated_at = timezone('utc'::text, now())
WHERE template_code LIKE '%def solution()%';
