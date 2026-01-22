import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PartyMember {
  id: string;
  user_id: string;
  username: string;
  unique_id: string;
  is_ready: boolean;
  is_leader: boolean;
}

interface Party {
  id: string;
  leader_id: string;
  game_mode: string;
  team_size: number;
  status: 'forming' | 'queuing' | 'matched';
  match_id: string | null;
  members: PartyMember[];
}

export const usePartySystem = () => {
  const { user, profile } = useAuth();
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState<{ partyId: string; leaderName: string }[]>([]);

  // Fetch current party
  const fetchParty = useCallback(async () => {
    if (!user) return;

    // Check if user is in a party
    const { data: memberData } = await supabase
      .from('party_members')
      .select('party_id')
      .eq('user_id', user.id)
      .single();

    if (!memberData) {
      setParty(null);
      return;
    }

    // Fetch party details
    const { data: partyData } = await supabase
      .from('parties')
      .select('*')
      .eq('id', memberData.party_id)
      .single();

    if (!partyData) {
      setParty(null);
      return;
    }

    // Fetch all members
    const { data: members } = await supabase
      .from('party_members')
      .select('id, user_id, is_ready')
      .eq('party_id', partyData.id);

    if (!members) {
      setParty(null);
      return;
    }

    // Fetch profiles for members
    const memberIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, unique_id')
      .in('user_id', memberIds);

    const partyMembers: PartyMember[] = members.map(m => {
      const p = profiles?.find(pr => pr.user_id === m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        username: p?.username || 'Unknown',
        unique_id: p?.unique_id || '',
        is_ready: m.is_ready,
        is_leader: m.user_id === partyData.leader_id,
      };
    });

    setParty({
      id: partyData.id,
      leader_id: partyData.leader_id,
      game_mode: partyData.game_mode,
      team_size: partyData.team_size,
      status: partyData.status as 'forming' | 'queuing' | 'matched',
      match_id: partyData.match_id,
      members: partyMembers,
    });
  }, [user]);

  // Create a new party
  const createParty = useCallback(async (gameMode: string = 'duel', teamSize: number = 5) => {
    if (!user || !profile) return { error: 'Not authenticated' };

    setLoading(true);

    // First leave any existing party
    await leaveParty();

    // Create the party
    const { data: partyData, error: partyError } = await supabase
      .from('parties')
      .insert({
        leader_id: user.id,
        game_mode: gameMode,
        team_size: teamSize,
        status: 'forming',
      })
      .select()
      .single();

    if (partyError || !partyData) {
      setLoading(false);
      return { error: 'Failed to create party' };
    }

    // Add leader as member
    const { error: memberError } = await supabase
      .from('party_members')
      .insert({
        party_id: partyData.id,
        user_id: user.id,
        is_ready: true,
      });

    if (memberError) {
      // Cleanup party if member insert fails
      await supabase.from('parties').delete().eq('id', partyData.id);
      setLoading(false);
      return { error: 'Failed to join party' };
    }

    await fetchParty();
    setLoading(false);
    return { error: null, partyId: partyData.id };
  }, [user, profile, fetchParty]);

  // Invite a friend to party
  const inviteToParty = useCallback(async (friendUserId: string) => {
    if (!party || party.leader_id !== user?.id) {
      return { error: 'Only party leader can invite' };
    }

    if (party.members.length >= party.team_size) {
      return { error: 'Party is full' };
    }

    // For now, we'll directly add them (in production, you'd send an invite notification)
    const { error } = await supabase
      .from('party_members')
      .insert({
        party_id: party.id,
        user_id: friendUserId,
        is_ready: false,
      });

    if (error) {
      if (error.code === '23505') {
        return { error: 'Already in party' };
      }
      return { error: 'Failed to invite' };
    }

    await fetchParty();
    return { error: null };
  }, [party, user, fetchParty]);

  // Leave the party
  const leaveParty = useCallback(async () => {
    if (!user) return;

    // Get current party membership
    const { data: memberData } = await supabase
      .from('party_members')
      .select('party_id')
      .eq('user_id', user.id)
      .single();

    if (!memberData) return;

    // Check if user is leader
    const { data: partyData } = await supabase
      .from('parties')
      .select('leader_id')
      .eq('id', memberData.party_id)
      .single();

    // Remove from party
    await supabase
      .from('party_members')
      .delete()
      .eq('user_id', user.id)
      .eq('party_id', memberData.party_id);

    // If leader left, delete the party
    if (partyData?.leader_id === user.id) {
      await supabase
        .from('parties')
        .delete()
        .eq('id', memberData.party_id);
    }

    setParty(null);
  }, [user]);

  // Toggle ready status
  const toggleReady = useCallback(async () => {
    if (!user || !party) return;

    const member = party.members.find(m => m.user_id === user.id);
    if (!member) return;

    await supabase
      .from('party_members')
      .update({ is_ready: !member.is_ready })
      .eq('party_id', party.id)
      .eq('user_id', user.id);

    await fetchParty();
  }, [user, party, fetchParty]);

  // Start queue (leader only)
  const startQueue = useCallback(async () => {
    if (!party || party.leader_id !== user?.id) {
      return { error: 'Only party leader can start queue' };
    }

    const allReady = party.members.every(m => m.is_ready);
    if (!allReady) {
      return { error: 'All members must be ready' };
    }

    await supabase
      .from('parties')
      .update({ status: 'queuing' })
      .eq('id', party.id);

    await fetchParty();
    return { error: null };
  }, [party, user, fetchParty]);

  // Kick member (leader only)
  const kickMember = useCallback(async (userId: string) => {
    if (!party || party.leader_id !== user?.id) {
      return { error: 'Only party leader can kick members' };
    }

    if (userId === user.id) {
      return { error: "Can't kick yourself" };
    }

    await supabase
      .from('party_members')
      .delete()
      .eq('party_id', party.id)
      .eq('user_id', userId);

    await fetchParty();
    return { error: null };
  }, [party, user, fetchParty]);

  // Initial fetch
  useEffect(() => {
    fetchParty();
  }, [fetchParty]);

  // Subscribe to party changes
  useEffect(() => {
    if (!party) return;

    const channel = supabase
      .channel(`party-${party.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_members',
          filter: `party_id=eq.${party.id}`,
        },
        () => fetchParty()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parties',
          filter: `id=eq.${party.id}`,
        },
        () => fetchParty()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [party?.id, fetchParty]);

  const isLeader = party?.leader_id === user?.id;
  const isFull = party ? party.members.length >= party.team_size : false;
  const allReady = party?.members.every(m => m.is_ready) || false;

  return {
    party,
    loading,
    invites,
    isLeader,
    isFull,
    allReady,
    createParty,
    inviteToParty,
    leaveParty,
    toggleReady,
    startQueue,
    kickMember,
    fetchParty,
  };
};
