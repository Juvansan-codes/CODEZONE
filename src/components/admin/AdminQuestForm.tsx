import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Trash2, Trophy, Plus, Save } from 'lucide-react';

interface Challenge {
    id: string;
    title: string;
    description: string;
    type: string;
    goal_type: string;
    goal_target: number;
    reward_coins: number;
    reward_gems: number;
    is_active: boolean;
}

const AdminQuestForm: React.FC = () => {
    const [quests, setQuests] = useState<Challenge[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Challenge>>({
        type: 'daily',
        goal_type: 'matches_won',
        goal_target: 1,
        reward_coins: 100,
        reward_gems: 0,
        is_active: true
    });

    const fetchQuests = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('challenges')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            toast.error('Failed to fetch quests');
        } else {
            // Force cast to match our interface, ignoring outdated schema types
            setQuests((data as any[])?.map(q => ({
                ...q,
                type: q.type || 'daily',
                goal_target: q.goal_target || 1
            })) as Challenge[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchQuests();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title || !formData.description) {
            toast.error('Please fill in required fields');
            return;
        }

        const { error } = await supabase
            .from('challenges')
            .insert([formData]);

        if (error) {
            toast.error('Error creating quest: ' + error.message);
        } else {
            toast.success('Quest created successfully!');
            setIsEditing(false);
            setFormData({
                type: 'daily',
                goal_type: 'matches_won',
                goal_target: 1,
                reward_coins: 100,
                reward_gems: 0,
                is_active: true
            });
            fetchQuests();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this quest?')) return;

        const { error } = await supabase
            .from('challenges')
            .delete()
            .eq('id', id);

        if (error) {
            toast.error('Failed to delete quest');
        } else {
            toast.success('Quest deleted');
            fetchQuests();
        }
    };

    const handleReset = async () => {
        if (!confirm('DANGER: This will delete ALL quests and user progress. Are you sure?')) return;

        // Since we can't easily truncate via client without RLS allowing it broadly,
        // we'll fetch all IDs and delete them.
        setLoading(true);
        try {
            const { data: allQuests } = await supabase.from('challenges').select('id');
            if (allQuests && allQuests.length > 0) {
                const ids = allQuests.map(q => q.id);
                const { error } = await supabase.from('challenges').delete().in('id', ids);
                if (error) throw error;

                // Also try to clear user_challenges if possible, though cascade should handle it
                // But RLS might block cascading deletes if not careful. 
                // Actually, defined foreign keys with ON DELETE CASCADE in migration:
                // challenge_id uuid references public.challenges(id) on delete cascade
                // So deleting challenges is enough.

                toast.success('All challenges reset successfully');
                setQuests([]);
            } else {
                toast.info('No challenges to reset');
            }
        } catch (err: any) {
            console.error('Reset error:', err);
            toast.error('Failed to reset challenges: ' + err.message);
        } finally {
            setLoading(false);
            fetchQuests();
        }
    };


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Trophy className="text-gold" /> Quest Management
                </h2>
            </h2>

            <div className="flex gap-2">
                <Button onClick={() => setIsEditing(!isEditing)} variant={isEditing ? "secondary" : "default"}>
                    {isEditing ? 'Cancel' : <><Plus size={16} className="mr-2" /> New Quest</>}
                </Button>
                <Button onClick={handleReset} variant="destructive">
                    <Trash2 size={16} className="mr-2" /> Reset All
                </Button>
            </div>
        </div>

            {
        isEditing && (
            <div className="glass-panel p-6 border border-border bg-card/50 backdrop-blur-sm shadow-xl relative z-10 animate-in fade-in slide-in-from-top-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Title</label>
                            <input
                                className="w-full bg-background border border-border rounded-md p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                                placeholder="e.g. First Blood"
                                value={formData.title || ''}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Type</label>
                            <select
                                className="w-full bg-background border border-border rounded-md p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="achievement">Achievement</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <textarea
                            className="w-full bg-background border border-border rounded-md p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none min-h-[80px]"
                            placeholder="Describe what the user needs to do..."
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Goal Type</label>
                            <select
                                className="w-full bg-background border border-border rounded-md p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                                value={formData.goal_type}
                                onChange={e => setFormData({ ...formData, goal_type: e.target.value })}
                            >
                                <option value="matches_won">Matches Won</option>
                                <option value="problems_solved">Problems Solved</option>
                                <option value="login_streak">Login Streak</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Target Amount</label>
                            <input
                                type="number"
                                className="w-full bg-background border border-border rounded-md p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                                value={formData.goal_target}
                                onChange={e => setFormData({ ...formData, goal_target: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Reward (Coins | Gems)</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    className="w-1/2 bg-background border border-border rounded-md p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                                    placeholder="Coins"
                                    value={formData.reward_coins}
                                    onChange={e => setFormData({ ...formData, reward_coins: parseInt(e.target.value) })}
                                />
                                <input
                                    type="number"
                                    className="w-1/2 bg-background border border-border rounded-md p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                                    placeholder="Gems"
                                    value={formData.reward_gems}
                                    onChange={e => setFormData({ ...formData, reward_gems: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>

                    <Button type="submit" className="w-full gap-2">
                        <Save size={16} /> Create Quest
                    </Button>
                </form>
            </div>
        )
    }

    <div className="space-y-4">
        {loading ? (
            <div className="text-center p-8"><Loader2 className="animate-spin mx-auto text-primary" /></div>
        ) : quests.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground border border-dashed border-border rounded-xl">No quests created yet.</div>
        ) : (
            <div className="grid grid-cols-1 gap-3">
                {quests.map(quest => (
                    <div key={quest.id} className="glass-panel p-4 flex justify-between items-center group">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold">{quest.title}</h3>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold
                                            ${quest.type === 'daily' ? 'bg-blue-500/20 text-blue-400' :
                                        quest.type === 'weekly' ? 'bg-purple-500/20 text-purple-400' : 'bg-gold/20 text-gold'}`}>
                                    {quest.type}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{quest.description}</p>
                            <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                                <span>Target: {quest.goal_target} {quest.goal_type.replace('_', ' ')}</span>
                                <span className="text-gold">Reward: {quest.reward_coins} 🪙 {quest.reward_gems > 0 && `+ ${quest.reward_gems} 💎`}</span>
                            </div>
                        </div>
                        <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={() => handleDelete(quest.id)}>
                            <Trash2 size={16} />
                        </Button>
                    </div>
                ))}
            </div>
        );
};

        export default AdminQuestForm;
