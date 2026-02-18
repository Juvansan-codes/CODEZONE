import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PresenceState {
  user_id: string;
  username: string;
  status: 'online' | 'away' | 'in_game' | 'in_queue';
  online_at: string;
}

interface OnlineUser {
  user_id: string;
  username: string;
  status: 'online' | 'away' | 'in_game' | 'in_queue';
}

export const usePresence = () => {
  const { user, profile } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());
  const [myStatus, setMyStatus] = useState<'online' | 'away' | 'in_game' | 'in_queue'>('online');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Track presence
  const trackPresence = useCallback(async (status: 'online' | 'away' | 'in_game' | 'in_queue' = 'online') => {
    if (!channelRef.current || !user || !profile) return;

    setMyStatus(status);

    await channelRef.current.track({
      user_id: user.id,
      username: profile.username,
      status,
      online_at: new Date().toISOString(),
    });

    // Also update database for persistence
    const { error } = await supabase
      .from('profiles')
      .update({
        is_online: true,
        current_status: status,
        last_seen: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating presence:', error);
    }
  }, [user, profile]);

  // Set status
  const setStatus = useCallback((status: 'online' | 'away' | 'in_game' | 'in_queue') => {
    trackPresence(status);
  }, [trackPresence]);

  // Check if a specific user is online
  const isUserOnline = useCallback((userId: string): boolean => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  // Get user status
  const getUserStatus = useCallback((userId: string): OnlineUser | null => {
    return onlineUsers.get(userId) || null;
  }, [onlineUsers]);

  // Initialize presence channel
  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase.channel('global-presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState<PresenceState>();
        const users = new Map<string, OnlineUser>();

        Object.entries(newState).forEach(([key, presences]) => {
          if (presences.length > 0) {
            const latest = presences[presences.length - 1];
            users.set(key, {
              user_id: latest.user_id,
              username: latest.username,
              status: latest.status,
            });
          }
        });

        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (newPresences.length > 0) {
          const presence = newPresences[0] as unknown as PresenceState;
          setOnlineUsers(prev => {
            const next = new Map(prev);
            next.set(key, {
              user_id: presence.user_id,
              username: presence.username,
              status: presence.status,
            });
            return next;
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineUsers(prev => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            username: profile.username,
            status: 'online',
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    // Set offline when leaving
    const handleBeforeUnload = async () => {
      await supabase
        .from('profiles')
        .update({
          is_online: false,
          current_status: 'offline',
          last_seen: new Date().toISOString()
        })
        .eq('user_id', user.id);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (channelRef.current) {
        handleBeforeUnload();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, profile]);

  return {
    onlineUsers: Array.from(onlineUsers.values()),
    onlineCount: onlineUsers.size,
    myStatus,
    setStatus,
    isUserOnline,
    getUserStatus,
    trackPresence,
  };
};
