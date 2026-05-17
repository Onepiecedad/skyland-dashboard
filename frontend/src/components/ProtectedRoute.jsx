import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export const ProtectedRoute = ({ children }) => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Laddar...</div>;
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return children;
};
