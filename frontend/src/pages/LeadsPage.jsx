import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { LogOut, ChevronDown, ChevronUp, Building2, Mail, Zap, UserPlus, Trash2 } from 'lucide-react';
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

const PROJECT_TYPES = [
    { value: 'ai-system',          label: 'AI-system' },
    { value: 'hemsida',            label: 'Hemsida' },
    { value: 'automation',         label: 'Automation' },
    { value: 'drift-och-säkerhet', label: 'Drift & säkerhet' },
    { value: 'konsultation',       label: 'Konsultation' },
];

const INDUSTRIES = [
    'Livsmedel', 'Marin service', 'Artist', 'Event/Upplevelser',
    'Industriservice', 'Bygg & fastighet', 'Hälsa & välmående',
    'Handel & e-handel', 'Konsultation', 'Övrigt',
];

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
    return (
        <time dateTime={date} title={new Date(date).toLocaleString('sv-SE')} className="text-xs text-zinc-500">
            {formatDistanceToNow(new Date(date), { addSuffix: true, locale: sv })}
        </time>
    );
}

export function LeadsPage() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('alla');
    const [expandedId, setExpandedId] = useState(null);

    // Conversion modal
    const [convertingLead, setConvertingLead] = useState(null);
    const [convertForm, setConvertForm] = useState({ full_name: '', company_name: '', industry: '', project_type: 'konsultation' });
    const [converting, setConverting] = useState(false);

    const navigate = useNavigate();

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

    useEffect(() => { fetchLeads(); }, [statusFilter]);

    useEffect(() => {
        const channel = supabase
            .channel('prospects-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prospects' }, (payload) => {
                toast.info(`Ny lead: ${payload.new.name || 'Okänd'}`);
                fetchLeads();
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, []);

    const handleStatusChange = async (id, newStatus) => {
        try {
            const { error } = await supabase.from('prospects').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            toast.success(`Status ändrad till ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
            fetchLeads();
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Kunde inte uppdatera status');
        }
    };

    const handleDeleteLead = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Radera lead permanent?')) return;
        try {
            const { error } = await supabase.from('prospects').delete().eq('id', id);
            if (error) throw error;
            toast.success('Lead raderat');
            setLeads(prev => prev.filter(l => l.id !== id));
            if (expandedId === id) setExpandedId(null);
        } catch {
            toast.error('Kunde inte radera lead');
        }
    };

    const openConvertModal = (lead) => {
        setConvertingLead(lead);
        setConvertForm({
            full_name: lead.name || '',
            company_name: lead.company || '',
            industry: '',
            project_type: 'konsultation',
        });
    };

    const handleConvert = async () => {
        if (!convertForm.full_name.trim()) { toast.error('Namn krävs'); return; }
        if (!convertForm.company_name.trim()) { toast.error('Företagsnamn krävs'); return; }
        setConverting(true);
        try {
            // 1. Create customer
            const { data: customer, error: custErr } = await supabase
                .from('customers')
                .insert({ full_name: convertForm.full_name.trim(), email: convertingLead.email || null })
                .select()
                .single();
            if (custErr) throw custErr;

            // 2. Create company
            const { data: company, error: compErr } = await supabase
                .from('companies')
                .insert({
                    customer_id: customer.id,
                    name: convertForm.company_name.trim(),
                    industry: convertForm.industry || null,
                })
                .select()
                .single();
            if (compErr) throw compErr;

            // 3. Create project
            const { data: project, error: projErr } = await supabase
                .from('projects')
                .insert({
                    company_id: company.id,
                    name: PROJECT_TYPES.find(t => t.value === convertForm.project_type)?.label || convertForm.project_type,
                    project_type: convertForm.project_type,
                    status: 'lead',
                })
                .select()
                .single();
            if (projErr) throw projErr;

            // 4. Link prospect to customer
            await supabase.from('prospects').update({ customer_id: customer.id }).eq('id', convertingLead.id);

            // 5. Log activity
            await supabase.from('activity_log').insert({
                action: 'customer_created',
                description: `Konverterad från prospect "${convertingLead.name || convertingLead.email}"`,
                customer_id: customer.id,
                company_id: company.id,
                project_id: project.id,
                actor: 'user',
                metadata: { prospect_id: convertingLead.id },
            });

            toast.success('Kund skapad');
            setConvertingLead(null);
            navigate(`/customers/${customer.id}`);
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte skapa kund');
        } finally {
            setConverting(false);
        }
    };

    const location = useLocation();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const stats = {
        total: leads.length,
        nya: leads.filter(l => l.status === 'ny' || !l.status).length,
        kontaktade: leads.filter(l => l.status === 'kontaktad').length,
        bokade: leads.filter(l => l.status === 'bokad').length,
    };

    return (
        <div className="min-h-screen bg-background">
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
                                to="/customers"
                                className={`text-sm transition-colors ${location.pathname.startsWith('/customers') ? 'text-foreground' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Kunder
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
                            const alreadyCustomer = !!lead.customer_id;

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

                                                {/* Status actions + convert button */}
                                                <div className="flex flex-wrap gap-2 items-center">
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
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-zinc-600 hover:text-red-400"
                                                        onClick={e => handleDeleteLead(e, lead.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <div className="ml-auto">
                                                        {alreadyCustomer ? (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 text-xs text-zinc-500"
                                                                onClick={() => navigate(`/customers/${lead.customer_id}`)}
                                                            >
                                                                Visa kund →
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 text-xs border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-400"
                                                                onClick={() => openConvertModal(lead)}
                                                            >
                                                                <UserPlus className="h-3 w-3 mr-1" />
                                                                Konvertera till kund
                                                            </Button>
                                                        )}
                                                    </div>
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

            {/* Convert to customer modal */}
            <Dialog open={!!convertingLead} onOpenChange={open => { if (!open) setConvertingLead(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Konvertera till kund</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Personnamn *</label>
                            <Input
                                value={convertForm.full_name}
                                onChange={e => setConvertForm(f => ({ ...f, full_name: e.target.value }))}
                                placeholder="Förnamn Efternamn"
                                className="text-sm border-border/50"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Företagsnamn *</label>
                            <Input
                                value={convertForm.company_name}
                                onChange={e => setConvertForm(f => ({ ...f, company_name: e.target.value }))}
                                placeholder="Företaget AB"
                                className="text-sm border-border/50"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Bransch</label>
                            <Select
                                value={convertForm.industry}
                                onValueChange={v => setConvertForm(f => ({ ...f, industry: v }))}
                            >
                                <SelectTrigger className="text-sm border-border/50">
                                    <SelectValue placeholder="Välj bransch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {INDUSTRIES.map(ind => (
                                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Initial projekttyp</label>
                            <Select
                                value={convertForm.project_type}
                                onValueChange={v => setConvertForm(f => ({ ...f, project_type: v }))}
                            >
                                <SelectTrigger className="text-sm border-border/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROJECT_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {convertingLead?.email && (
                            <p className="text-xs text-zinc-600">
                                Email <span className="text-zinc-400">{convertingLead.email}</span> kopplas till kunden.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setConvertingLead(null)}>Avbryt</Button>
                        <Button size="sm" onClick={handleConvert} disabled={converting}>
                            {converting ? 'Skapar...' : 'Skapa kund'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
