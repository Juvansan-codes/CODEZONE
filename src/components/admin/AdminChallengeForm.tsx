import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Json } from '@/integrations/supabase/types';

interface AdminChallengeFormProps {
    questionId?: string | null;
    onClose: () => void;
}

const AdminChallengeForm: React.FC<AdminChallengeFormProps> = ({ questionId, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        difficulty: 'Easy',
        game_mode: 'duel',
        template_code: '# Write your code here',
        test_cases: '[]'
    });

    useEffect(() => {
        if (questionId) {
            loadQuestion();
        }
    }, [questionId]);

    const loadQuestion = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .eq('id', questionId!)
            .single();

        if (error) {
            toast.error('Error loading question');
        } else if (data) {
            setFormData({
                title: data.title,
                description: data.description,
                difficulty: data.difficulty || 'Easy',
                game_mode: data.game_mode || 'duel',
                template_code: data.template_code || '',
                test_cases: JSON.stringify(data.test_cases || [], null, 2)
            });
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Validate JSON
            let parsedTestCases: Json;
            try {
                parsedTestCases = JSON.parse(formData.test_cases);
            } catch (e) {
                toast.error('Invalid JSON for Test Cases');
                setLoading(false);
                return;
            }

            const payload = {
                title: formData.title,
                description: formData.description,
                difficulty: formData.difficulty as any,
                game_mode: formData.game_mode,
                template_code: formData.template_code,
                test_cases: parsedTestCases
            };

            let error;
            if (questionId) {
                const result = await supabase
                    .from('questions')
                    .update(payload)
                    .eq('id', questionId);
                error = result.error;
            } else {
                const result = await supabase
                    .from('questions')
                    .insert(payload);
                error = result.error;
            }

            if (error) throw error;

            toast.success(questionId ? 'Question updated' : 'Question created');
            onClose();
        } catch (error: any) {
            toast.error('Error saving question: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel p-6 max-w-2xl mx-auto border border-border bg-card/50 backdrop-blur-sm shadow-xl relative z-10">
            <h2 className="text-xl font-bold mb-4">{questionId ? 'Edit Question' : 'New Question'}</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                        required
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Difficulty</Label>
                        <Select
                            value={formData.difficulty}
                            onValueChange={v => setFormData({ ...formData, difficulty: v })}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Easy">Easy</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Hard">Hard</SelectItem>
                                <SelectItem value="Expert">Expert</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Game Mode</Label>
                        <Select
                            value={formData.game_mode}
                            onValueChange={v => setFormData({ ...formData, game_mode: v })}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="duel">Duel</SelectItem>
                                <SelectItem value="battle_royale">Battle Royale</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                        required
                        className="min-h-[100px]"
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Template Code</Label>
                    <Textarea
                        className="font-mono min-h-[150px]"
                        value={formData.template_code}
                        onChange={e => setFormData({ ...formData, template_code: e.target.value })}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Test Cases (JSON Format)</Label>
                    <p className="text-xs text-muted-foreground">Example: {'[{"input": "5", "output": "120"}]'}</p>
                    <Textarea
                        className="font-mono min-h-[150px]"
                        value={formData.test_cases}
                        onChange={e => setFormData({ ...formData, test_cases: e.target.value })}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Question
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default AdminChallengeForm;
