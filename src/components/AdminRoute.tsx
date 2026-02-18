import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const AdminRoute = () => {
    const { user, loading } = useAuth();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkAdmin = async () => {
            if (!user) {
                setIsAdmin(false);
                setChecking(false);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('user_id', user.id)
                .single();

            if (!error && data) {
                setIsAdmin(data.is_admin || false);
            } else {
                setIsAdmin(false);
            }
            setChecking(false);
        };

        if (!loading) {
            checkAdmin();
        }
    }, [user, loading]);

    if (loading || checking) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black/90">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return isAdmin ? <Outlet /> : <Navigate to="/lobby" replace />;
};

export default AdminRoute;
