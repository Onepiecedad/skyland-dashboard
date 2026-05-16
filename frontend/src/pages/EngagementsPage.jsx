import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { LogOut, ChevronDown, ChevronUp, User, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
    'lead':      { label: 'Lead',      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    'pågående':  { label: 'Pågående',  color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    'levererat': { label: 'Levererat', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    'i drift':   { label: 'I drift',   color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    'pausat':    { label: 'Pausat',    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    'avslutat':  { label: 'Avslutat', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

const TYPE_CONFIG = {
    'ai-system':           { label: 'AI-system' },
    'hemsida':             { label: 'Hemsida' },
    'automation':          { label: 'Automation' },
    'drift-och-säkerhet':  { label: 'Drift & säkerhet' },
    'konsultation':        { label: 'Konsultation' },
};

function StatusBadge({ status }) {
    const config = STATUS_CONFIG[status] || {};
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${config.color}`}>
            {config.label}
        </span>
    );
}

function TypeBadge({ type }) {
    const config = TYPE_CONFIG[type] || { label: type };
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-800 text-zinc-400">
            {config.label}
        </span>
    );
}

function Nav() {
    const location = useLocation();
    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };
    return (
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
                <div className="flex items-center gap-6">
                    <span className="text-base font-semibold tracking-tight">Skyland Dashboard</span>
                    <nav className="flex items-center gap-4">
                        <Link
                            to="/leads"
                            className={`text-sm transition-colors ${location.pathname === '/leads' ? 'text-foreground' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Leads
                        </Link>
                        <Link
                            to="/engagements"
                            className={`text-sm transition-colors ${location.pathname === '/engagements' ? 'text-foreground' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Engagements
                        </Link>
                    </nav>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-400 hover:text-zinc-200">
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>
        </header>
    );
}

export function EngagementsPage() {
    const [engagements, setEngagements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        const fetchEngagements = async () => {
            try {
                const { data, error } = await supabase
                    .from('engagements')
                    .select('*')
                    .order('created_at', { ascending: true });
                if (error) throw error;
                setEngagements(data || []);
            } catch (error) {
                console.error('Error fetching engagements:', error);
                toast.error('Kunde inte hämta engagements');
            } finally {
                setLoading(false);
            }
        };
        fetchEngagements();
    }, []);

    const stats = {
        iDrift:   engagements.filter(e => e.status === 'i drift').length,
        pagaende: engagements.filter(e => e.status === 'pågående').length,
        leads:    engagements.filter(e => e.status === 'lead').length,
    };

    return (
        <div className="min-h-screen bg-background">
            <Nav />

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <Card className="border-border/50 bg-card/50">
                        <CardContent className="p-4">
                            <p className="text-xs text-zinc-500">I drift</p>
                            <p className="text-2xl font-bold text-green-400">{stats.iDrift}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border/50 bg-card/50">
                        <CardContent className="p-4">
                            <p className="text-xs text-zinc-500">Pågående</p>
                            <p className="text-2xl font-bold text-indigo-400">{stats.pagaende}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border/50 bg-card/50">
                        <CardContent className="p-4">
                            <p className="text-xs text-zinc-500">Leads</p>
                            <p className="text-2xl font-bold text-blue-400">{stats.leads}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* List */}
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-zinc-400">
                        Engagements <span className="text-zinc-600">({engagements.length})</span>
                    </h2>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-20 rounded-lg bg-card/30 animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {engagements.map((eng) => {
                            const isExpanded = expandedId === eng.id;
                            return (
                                <Card
                                    key={eng.id}
                                    className="border-border/50 bg-card/50 hover:bg-card/80 transition-colors cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : eng.id)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium text-sm">{eng.client_name}</span>
                                                    <TypeBadge type={eng.client_type} />
                                                </div>
                                                {eng.contact_person && (
                                                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                                                        <User className="h-3 w-3" />
                                                        {eng.contact_person}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <StatusBadge status={eng.status} />
                                                {isExpanded
                                                    ? <ChevronUp className="h-4 w-4 text-zinc-600" />
                                                    : <ChevronDown className="h-4 w-4 text-zinc-600" />
                                                }
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="mt-4 pt-4 border-t border-border/50 space-y-3" onClick={e => e.stopPropagation()}>
                                                {eng.next_step && (
                                                    <div>
                                                        <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center gap-1">
                                                            <ArrowRight className="h-3 w-3" /> Nästa steg
                                                        </p>
                                                        <p className="text-sm text-zinc-300">{eng.next_step}</p>
                                                    </div>
                                                )}
                                                {eng.notes && (
                                                    <div>
                                                        <p className="text-xs font-medium text-zinc-500 mb-1">Anteckningar</p>
                                                        <p className="text-sm text-zinc-400 leading-relaxed">{eng.notes}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
