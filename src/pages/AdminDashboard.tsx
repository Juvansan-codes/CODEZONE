import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import AdminChallengeForm from '@/components/admin/AdminChallengeForm';
import AdminUserList from '@/components/admin/AdminUserList';
import AdminQuestForm from '@/components/admin/AdminQuestForm';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [selectedTab, setSelectedTab] = useState('questions');
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const { data: questions, isLoading, refetch } = useQuery({
        queryKey: ['admin-questions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('questions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        }
    });

    const handleEdit = (id: string) => {
        setEditingId(id);
        setIsCreating(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this question?')) return;

        const { error } = await supabase.from('questions').delete().eq('id', id);
        if (error) {
            alert('Error deleting question');
        } else {
            refetch();
        }
    };

    const handleCloseForm = () => {
        setIsCreating(false);
        setEditingId(null);
        refetch();
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="h-[70px] border-b border-border flex items-center justify-between px-4 md:px-6 bg-surface/50 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/lobby')}>
                        <ArrowLeft className="mr-2" size={16} />
                        Back to Lobby
                    </Button>
                    <h1 className="font-orbitron text-xl font-bold text-primary">ADMIN DASHBOARD</h1>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-4 md:p-8">
                <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                    <div className="flex justify-between items-center mb-6">
                        <TabsList>
                            <TabsTrigger value="questions">Game Questions</TabsTrigger>
                            <TabsTrigger value="users">Users</TabsTrigger>
                            <TabsTrigger value="challenges">Daily Challenges</TabsTrigger>
                            <TabsTrigger value="quests">Daily Quests</TabsTrigger>
                        </TabsList>

                        {selectedTab === 'questions' && !isCreating && (
                            <Button onClick={() => setIsCreating(true)}>
                                <Plus className="mr-2" size={16} /> New Question
                            </Button>
                        )}
                        {selectedTab === 'quests' && !isCreating && (
                            <Button onClick={() => setIsCreating(true)}>
                                <Plus className="mr-2" size={16} /> New Quest
                            </Button>
                        )}
                    </div>

                    <TabsContent value="questions" className="space-y-4">
                        {isCreating ? (
                            <AdminChallengeForm
                                questionId={editingId}
                                onClose={handleCloseForm}
                            />
                        ) : (
                            <div className="grid gap-4">
                                {isLoading ? (
                                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                                ) : questions?.length === 0 ? (
                                    <div className="text-center p-8 text-muted-foreground">No questions found. Create one!</div>
                                ) : (
                                    questions?.map((q) => (
                                        <div key={q.id} className="glass-panel p-4 flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-lg">{q.title}</h3>
                                                <div className="flex gap-2 text-sm text-muted-foreground">
                                                    <span className={`px-2 py-0.5 rounded ${q.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' :
                                                        q.difficulty === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            'bg-red-500/20 text-red-400'
                                                        }`}>{q.difficulty}</span>
                                                    <span>{q.game_mode}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleEdit(q.id)}>Edit</Button>
                                                <Button variant="destructive" size="sm" onClick={() => handleDelete(q.id)}>Delete</Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="users">
                        <AdminUserList />
                    </TabsContent>

                    <TabsContent value="challenges">
                        <div className="p-8 text-center text-muted-foreground">
                            Daily Challenges management coming soon...
                        </div>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

export default AdminDashboard;
