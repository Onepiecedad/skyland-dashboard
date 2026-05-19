import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';

export function DashboardShell({ children, contentClassName = 'max-w-5xl mx-auto px-4 py-6' }) {
    const location = useLocation();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-primary/10 bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-6">
                        <span className="text-base font-semibold tracking-tight text-primary">Skyland Dashboard</span>
                        <nav className="flex items-center gap-4">
                            <Link
                                to="/leads"
                                className={`text-sm font-medium transition-colors ${location.pathname === '/leads' ? 'text-primary' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Leads
                            </Link>
                            <Link
                                to="/customers"
                                className={`text-sm font-medium transition-colors ${location.pathname.startsWith('/customers') ? 'text-primary' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Kunder
                            </Link>
                        </nav>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-500 hover:text-zinc-200">
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            <main className={contentClassName}>
                {children}
            </main>
        </div>
    );
}
