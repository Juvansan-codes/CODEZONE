import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

const AdminUserList = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const { data: users, isLoading } = useQuery({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('last_seen', { ascending: false });

            if (error) throw error;
            return data;
        }
    });

    const filteredUsers = users?.filter(user =>
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 max-w-sm">
                <Search className="text-muted-foreground w-4 h-4" />
                <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-background/50"
                />
            </div>

            <div className="glass-panel overflow-hidden border border-white/10">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-white/5 border-white/10">
                            <TableHead>User</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Rank</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Matches</TableHead>
                            <TableHead>Last Seen</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers?.map((user) => (
                            <TableRow key={user.id} className="hover:bg-white/5 border-white/10">
                                <TableCell className="flex items-center gap-3">
                                    <Avatar className="w-8 h-8 border border-border">
                                        <AvatarImage src={user.avatar_url || ''} />
                                        <AvatarFallback>{user.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{user.username}</span>
                                        <span className="text-xs text-muted-foreground">{user.display_name}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {user.is_online ? (
                                        <Badge variant="default" className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/50">
                                            Online
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-muted-foreground border-white/10">
                                            Offline
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <span className={`px-2 py-0.5 rounded text-xs border ${user.rank === 'Grandmaster' ? 'border-red-500/50 text-red-400 bg-red-500/10' :
                                            user.rank === 'Diamond' ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10' :
                                                'border-white/10 text-muted-foreground'
                                        }`}>
                                        {user.rank}
                                    </span>
                                </TableCell>
                                <TableCell className="font-mono text-gold">
                                    Lvl {user.level}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col text-xs">
                                        <span>{user.total_matches} played</span>
                                        <span className="text-green-400">{user.total_wins} wins</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {user.last_seen ? formatDistanceToNow(new Date(user.last_seen), { addSuffix: true }) : 'Never'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default AdminUserList;
