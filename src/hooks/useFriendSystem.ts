import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Friend {
  id: string;
  friendId: string;
  username: string;
  uniqueId: string;
  status: 'pending' | 'accepted' | 'rejected';
  isOnline: boolean;
  isSentByMe: boolean;
}

export const useFriendSystem = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all friendships
  const fetchFriends = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (error) {
      console.error('Error fetching friends:', error);
      setLoading(false);
      return;
    }

    if (!friendships) {
      setLoading(false);
      return;
    }

    // Get all friend user IDs
    const friendUserIds = friendships.map((f) => 
      f.user_id === user.id ? f.friend_id : f.user_id
    );

    if (friendUserIds.length === 0) {
      setFriends([]);
      setPendingRequests([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for all friends
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, unique_id')
      .in('user_id', friendUserIds);

    const mappedFriends: Friend[] = friendships.map((f) => {
      const friendUserId = f.user_id === user.id ? f.friend_id : f.user_id;
      const profile = profiles?.find((p) => p.user_id === friendUserId);
      
      return {
        id: f.id,
        friendId: friendUserId,
        username: profile?.username || 'Unknown',
        uniqueId: profile?.unique_id || '',
        status: f.status as 'pending' | 'accepted' | 'rejected',
        isOnline: false, // Will be updated by usePresence hook
        isSentByMe: f.user_id === user.id,
      };
    });

    setFriends(mappedFriends.filter((f) => f.status === 'accepted'));
    setPendingRequests(mappedFriends.filter((f) => f.status === 'pending'));
    setLoading(false);
  }, [user]);

  // Send friend request by unique ID (username#XXXX)
  const sendFriendRequest = useCallback(async (uniqueId: string) => {
    if (!user) return { error: 'Not authenticated' };

    // Find the user by unique_id
    const { data: targetProfile, error: findError } = await supabase
      .from('profiles')
      .select('user_id, username')
      .eq('unique_id', uniqueId)
      .single();

    if (findError || !targetProfile) {
      return { error: 'Player not found. Make sure you entered the correct ID (e.g., username#1234)' };
    }

    if (targetProfile.user_id === user.id) {
      return { error: "You can't add yourself as a friend" };
    }

    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${targetProfile.user_id}),and(user_id.eq.${targetProfile.user_id},friend_id.eq.${user.id})`)
      .single();

    if (existing) {
      if (existing.status === 'pending') {
        return { error: 'Friend request already pending' };
      }
      if (existing.status === 'accepted') {
        return { error: 'Already friends with this player' };
      }
    }

    // Create friendship
    const { error: insertError } = await supabase
      .from('friendships')
      .insert({
        user_id: user.id,
        friend_id: targetProfile.user_id,
        status: 'pending',
      });

    if (insertError) {
      return { error: 'Failed to send friend request' };
    }

    await fetchFriends();
    return { error: null, username: targetProfile.username };
  }, [user, fetchFriends]);

  // Accept friend request
  const acceptFriendRequest = useCallback(async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);

    if (!error) {
      await fetchFriends();
    }
    return { error: error?.message || null };
  }, [fetchFriends]);

  // Reject friend request
  const rejectFriendRequest = useCallback(async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'rejected' })
      .eq('id', friendshipId);

    if (!error) {
      await fetchFriends();
    }
    return { error: error?.message || null };
  }, [fetchFriends]);

  // Remove friend
  const removeFriend = useCallback(async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (!error) {
      await fetchFriends();
    }
    return { error: error?.message || null };
  }, [fetchFriends]);

  // Initial fetch
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('friendships-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchFriends()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${user.id}`,
        },
        () => fetchFriends()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchFriends]);

  return {
    friends,
    pendingRequests,
    loading,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    refetch: fetchFriends,
  };
};