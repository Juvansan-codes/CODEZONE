import React, { useEffect } from 'react';
import { usePresence } from '@/hooks/usePresence';
import { useAuth } from '@/contexts/AuthContext';

const PresenceHandler: React.FC = () => {
    const { user } = useAuth();
    const { trackPresence } = usePresence();

    useEffect(() => {
        if (user) {
            trackPresence('online');

            // Set interval to heartbeat presence
            const interval = setInterval(() => {
                trackPresence('online');
            }, 30000); // Pulse every 30 seconds

            return () => clearInterval(interval);
        }
    }, [user, trackPresence]);

    return null;
};

export default PresenceHandler;
