import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { LogOut, Users, Clock, TrendingUp, ChevronDown, ChevronUp, Building2, Mail, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

const STATUS_CONFIG = {
    ny:         { label: 'Ny',         color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    kontaktad:  { label: 'Kontaktad',  color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    bokad:      { label: 'Bokad',      color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    förlorad:   { label: 'Förlorad',   color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    arkiverad:  { label: 'Arkiverad',  color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

function StatusBadge({ status }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG['ny'];
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${config.color}`}>
            {config.label}
        </span>
    );
}

function ScoreBadge({ score }) {
    if (score == null) return null;
    const color = score >= 30 ? 'text-green-400' : score >= 20 ? 'text-yellow-400' : 'text-zinc-400';
    return (
        <span className={`flex items-center gap-1 text-xs font-medium ${color}`}>
            <Zap className="h-3 w-3" />
            {score}
        </span>
    );
}

function RelativeTime({ date }) {
    if (!date) return null;
    const formatted = formatDistanceToNow(new Date(date), { addSuffix: true, locale: sv });
    return (
        <time
            dateTime={date}
            title={new Date(date).toLocaleString('sv-SE')}
            className="text-xs text-zinc-500"
        >
            {formatted}
        </time>
    );
}

export function LeadsPage() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('alla');
    const [expandedId, setExpandedId] = useState(null);

    const fetchLeads = async () => {
        try {
            let query = supabase
                .from('prospects')
                .select('*')
                .order('created_at', { ascending: false });

            if (statusFilter !== 'alla') {
                query = query.eq('status', statusFilter);
            }

            const { data: prospects, error: pErr } = await query;
            if (pErr) throw pErr;

            // Fetch AI responses from interactions
            const sessionUuids = (prospects || []).map(p => p.session_uuid).filter(Boolean);
            let interactionsMap = {};

            if (sessionUuids.length > 0) {
                const { data: interactions } = await supabase
                    .from('interactions')
                    .select('session_uuid, payload')
                    .eq('type', 'form')
                    .in('session_uuid', sessionUuids);

                (interactions || []).forEach(i => {
                    interactionsMap[i.session_uuid] = i.payload;
                });
            }

            // Combine
            const combined = (prospects || []).map(p => ({
                ...p,
                ai_response: interactionsMap[p.session_uuid]?.ai_response || null,
                similarity: interactionsMap[p.session_uuid]?.best_match_similarity || null,
            }));

            setLeads(combined);
        } catch (error) {
            console.error('Error fetching leads:', error);
            toast.error('Kunde inte hämta leads');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, [statusFilter]);

    // Realtime subscription
    useEffect(() => {
        const channel = supabase
            .channel('prospects-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'prospects' },
                (payload) => {
                    toast.info(`Ny lead: ${payload.new.name || 'Okänd'}`);
                    fetchLeads();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleStatusChange = async (id, newStatus) => {
        try {
            const { error } = await supabase
                .from('prospects')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            toast.success(`Status ändrad till ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
            fetchLeads();
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Kunde inte uppdatera status');
        }
    };

    const location = useLocation();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    // Stats
    const stats = {
        total: leads.length,
        nya: leads.filter(l => l.status === 'ny' || !l.status).length,
        kontaktade: leads.filter(l => l.status === 'kontaktad').length,
        bokade: leads.filter(l => l.status === 'bokad').length,
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Top bar */}
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

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <Card className="border-border/50 bg-card/50">
                        <CardContent className="p-4">
                            <p className="text-xs text-zinc-500">Nya</p>
                            <p className="text-2xl font-bold text-blue-400">{stats.nya}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border/50 bg-card/50">
                        <CardContent className="p-4">
                            <p className="text-xs text-zinc-500">Kontaktade</p>
                            <p className="text-2xl font-bold text-yellow-400">{stats.kontaktade}</p>
                        </CardContent>
                    </Card>
                    <Card className="border-border/50 bg-card/50">
                        <CardContent className="p-4">
                            <p className="text-xs text-zinc-500">Bokade</p>
                            <p className="text-2xl font-bold text-green-400">{stats.bokade}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filter */}
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-zinc-400">
                        Leads <span className="text-zinc-600">({leads.length})</span>
                    </h2>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-8 text-xs border-border/50 bg-card/50">
                            <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="alla">Alla</SelectItem>
                            <SelectItem value="ny">Nya</SelectItem>
                            <SelectItem value="kontaktad">Kontaktade</SelectItem>
                            <SelectItem value="bokad">Bokade</SelectItem>
                            <SelectItem value="förlorad">Förlorade</SelectItem>
                            <SelectItem value="arkiverad">Arkiverade</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Lead list */}
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 rounded-lg bg-card/30 animate-pulse" />
                        ))}
                    </div>
                ) : leads.length === 0 ? (
                    <Card className="border-border/50">
                        <CardContent className="p-12 text-center">
                            <Mail className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
                            <p className="text-sm text-zinc-400">Inga leads matchar filtret</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {leads.map((lead) => {
                            const isExpanded = expandedId === lead.id;

                            return (
                                <Card
                                    key={lead.id}
                                    className="border-border/50 bg-card/50 hover:bg-card/80 transition-colors cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                                >
                                    <CardContent className="p-4">
                                        {/* Compact view */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium text-sm truncate">
                                                        {lead.name || 'Okänd'}
                                                    </span>
                                                    <ScoreBadge score={lead.score} />
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-zinc-500">
                                                    {lead.company && (
                                                        <span className="flex items-center gap-1">
                                                            <Building2 className="h-3 w-3" />
                                                            {lead.company}
                                                        </span>
                                                    )}
                                                    <RelativeTime date={lead.created_at} />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <StatusBadge status={lead.status || 'ny'} />
                                                {isExpanded
                                                    ? <ChevronUp className="h-4 w-4 text-zinc-600" />
                                                    : <ChevronDown className="h-4 w-4 text-zinc-600" />
                                                }
                                            </div>
                                        </div>

                                        {/* Expanded view */}
                                        {isExpanded && (
                                            <div className="mt-4 pt-4 border-t border-border/50 space-y-4" onClick={e => e.stopPropagation()}>
                                                {/* Contact info */}
                                                <div className="flex flex-wrap gap-4 text-sm">
                                                    {lead.email && (
                                                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors">
                                                            <Mail className="h-3.5 w-3.5" />
                                                            {lead.email}
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Message */}
                                                {lead.message && (
                                                    <div>
                                                        <p className="text-xs font-medium text-zinc-500 mb-1">Meddelande</p>
                                                        <p className="text-sm text-zinc-300 leading-relaxed">{lead.message}</p>
                                                    </div>
                                                )}

                                                {/* AI Response */}
                                                {lead.ai_response && (
                                                    <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-3">
                                                        <p className="text-xs font-medium text-blue-400 mb-1">AI-svar</p>
                                                        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                                                            {lead.ai_response}
                                                        </p>
                                                        {lead.similarity != null && (
                                                            <p className="text-xs text-zinc-600 mt-2">
                                                                Matchning: {(lead.similarity * 100).toFixed(0)}%
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Status actions */}
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                                                        <Button
                                                            key={key}
                                                            variant={lead.status === key ? 'default' : 'outline'}
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => handleStatusChange(lead.id, key)}
                                                            disabled={lead.status === key}
                                                        >
                                                            {conf.label}
                                                        </Button>
                                                    ))}
                                                </div>
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