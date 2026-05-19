import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { LogOut, Building2, Mail, Phone, Zap, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

const STATUS_CONFIG = {
    ny:        { label: 'Ny',        color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    kontaktad: { label: 'Kontaktad', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    bokad:     { label: 'Bokad',     color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    förlorad:  { label: 'Förlorad',  color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    arkiverad: { label: 'Arkiverad', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

const SOURCE_CONFIG = {
    facebook:     { label: 'Facebook Ads' },
    facebook_ads: { label: 'Facebook Ads' },
    hemsida:      { label: 'Hemsida' },
    website:      { label: 'Hemsida' },
    ai_agent:     { label: 'AI-agent' },
    email:        { label: 'E-post' },
    manual:       { label: 'Manuell' },
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
        <span className={`flex items-center gap-0.5 text-xs font-medium shrink-0 ${color}`}>
            <Zap className="h-3 w-3" />{score}
        </span>
    );
}

function SourceBadge({ source }) {
    if (!source) return null;
    const conf = SOURCE_CONFIG[source];
    const label = conf?.label || source;
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border bg-zinc-800/60 text-zinc-400 border-zinc-700/50 shrink-0">
            {label}
        </span>
    );
}

export function LeadsPage() {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('alla');

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [modalLead, setModalLead] = useState(null);

    const [convertingLead, setConvertingLead] = useState(null);
    const [convertForm, setConvertForm] = useState({ full_name: '', company_name: '', industry: '', project_type: 'konsultation' });
    const [converting, setConverting] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    const fetchLeads = async () => {
        try {
            let query = supabase
                .from('prospects')
                .select('*')
                .order('created_at', { ascending: false });

            if (statusFilter !== 'alla') query = query.eq('status', statusFilter);

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

                (interactions || []).forEach(i => { interactionsMap[i.session_uuid] = i.payload; });
            }

            setLeads((prospects || []).map(p => ({
                ...p,
                ai_response: interactionsMap[p.session_uuid]?.ai_response || null,
                similarity: interactionsMap[p.session_uuid]?.best_match_similarity || null,
                source: p.source || interactionsMap[p.session_uuid]?.source || null,
            })));
        } catch {
            toast.error('Kunde inte hämta leads');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLeads(); }, [statusFilter]);

    useEffect(() => {
        const channel = supabase
            .channel('prospects-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prospects' }, payload => {
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
            toast.success(`Status → ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
            setModalLead(prev => prev?.id === id ? { ...prev, status: newStatus } : prev);
        } catch {
            toast.error('Kunde inte uppdatera status');
        }
    };

    const handleDeleteLead = async (id) => {
        if (!window.confirm('Radera lead permanent?')) return;
        try {
            const { error } = await supabase.from('prospects').delete().eq('id', id);
            if (error) throw error;
            toast.success('Lead raderat');
            setLeads(prev => prev.filter(l => l.id !== id));
            setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            if (modalLead?.id === id) setModalLead(null);
        } catch {
            toast.error('Kunde inte radera lead');
        }
    };

    const handleBulkDelete = async () => {
        const ids = [...selectedIds];
        if (!window.confirm(`Radera ${ids.length} leads permanent?`)) return;
        try {
            const { error } = await supabase.from('prospects').delete().in('id', ids);
            if (error) throw error;
            toast.success(`${ids.length} leads raderade`);
            setLeads(prev => prev.filter(l => !ids.includes(l.id)));
            setSelectedIds(new Set());
        } catch {
            toast.error('Kunde inte radera leads');
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id));

    const openConvertModal = (lead) => {
        setConvertingLead(lead);
        setConvertForm({ full_name: lead.name || '', company_name: lead.company || '', industry: '', project_type: 'konsultation' });
    };

    const handleConvert = async () => {
        if (!convertForm.full_name.trim()) { toast.error('Namn krävs'); return; }
        if (!convertForm.company_name.trim()) { toast.error('Företagsnamn krävs'); return; }
        setConverting(true);
        try {
            const { data: customer, error: custErr } = await supabase
                .from('customers')
                .insert({ full_name: convertForm.full_name.trim(), email: convertingLead.email || null })
                .select().single();
            if (custErr) throw custErr;

            const { data: company, error: compErr } = await supabase
                .from('companies')
                .insert({ customer_id: customer.id, name: convertForm.company_name.trim(), industry: convertForm.industry || null })
                .select().single();
            if (compErr) throw compErr;

            const { data: project, error: projErr } = await supabase
                .from('projects')
                .insert({ company_id: company.id, name: PROJECT_TYPES.find(t => t.value === convertForm.project_type)?.label || convertForm.project_type, project_type: convertForm.project_type, status: 'lead' })
                .select().single();
            if (projErr) throw projErr;

            await supabase.from('prospects').update({ customer_id: customer.id }).eq('id', convertingLead.id);
            await supabase.from('activity_log').insert({
                action: 'customer_created',
                description: `Konverterad från prospect "${convertingLead.name || convertingLead.email}"`,
                customer_id: customer.id, company_id: company.id, project_id: project.id,
                actor: 'user', metadata: { prospect_id: convertingLead.id },
            });

            toast.success('Kund skapad');
            setConvertingLead(null);
            navigate(`/customers/${customer.id}`);
        } catch {
            toast.error('Kunde inte skapa kund');
        } finally {
            setConverting(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const stats = {
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
                            <Link to="/leads" className={`text-sm transition-colors ${location.pathname === '/leads' ? 'text-foreground' : 'text-zinc-500 hover:text-zinc-300'}`}>Leads</Link>
                            <Link to="/customers" className={`text-sm transition-colors ${location.pathname.startsWith('/customers') ? 'text-foreground' : 'text-zinc-500 hover:text-zinc-300'}`}>Kunder</Link>
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
                    <Card className="border-border/50 bg-card/50"><CardContent className="p-4"><p className="text-xs text-zinc-500">Nya</p><p className="text-2xl font-bold text-blue-400">{stats.nya}</p></CardContent></Card>
                    <Card className="border-border/50 bg-card/50"><CardContent className="p-4"><p className="text-xs text-zinc-500">Kontaktade</p><p className="text-2xl font-bold text-yellow-400">{stats.kontaktade}</p></CardContent></Card>
                    <Card className="border-border/50 bg-card/50"><CardContent className="p-4"><p className="text-xs text-zinc-500">Bokade</p><p className="text-2xl font-bold text-green-400">{stats.bokade}</p></CardContent></Card>
                </div>

                {/* Filter + select-all + bulk delete */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(leads.map(l => l.id)))}
                            className="h-3.5 w-3.5 accent-zinc-400 cursor-pointer"
                            aria-label="Markera alla"
                        />
                        <h2 className="text-sm font-medium text-zinc-400">
                            Leads <span className="text-zinc-600">({leads.length})</span>
                        </h2>
                        {selectedIds.size > 0 && (
                            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={handleBulkDelete}>
                                <Trash2 className="h-3 w-3" /> Radera {selectedIds.size} valda
                            </Button>
                        )}
                    </div>
                    <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setSelectedIds(new Set()); }}>
                        <SelectTrigger className="w-[140px] h-8 text-xs border-border/50 bg-card/50"><SelectValue /></SelectTrigger>
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
                    <div className="space-y-2">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-card/30 animate-pulse" />)}
                    </div>
                ) : leads.length === 0 ? (
                    <Card className="border-border/50">
                        <CardContent className="p-12 text-center">
                            <Mail className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
                            <p className="text-sm text-zinc-400">Inga leads matchar filtret</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-1.5">
                        {leads.map(lead => (
                            <div
                                key={lead.id}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${selectedIds.has(lead.id) ? 'border-zinc-600/60 bg-card/80' : 'border-border/50 bg-card/50 hover:bg-card/80'}`}
                            >
                                {/* Checkbox */}
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(lead.id)}
                                    onChange={() => toggleSelect(lead.id)}
                                    className="h-3.5 w-3.5 accent-zinc-400 cursor-pointer shrink-0"
                                />

                                {/* Main content */}
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setModalLead(lead)}>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="font-medium text-sm truncate">{lead.name || 'Okänd'}</span>
                                        <ScoreBadge score={lead.score} />
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                                        {lead.company && (
                                            <span className="flex items-center gap-1 truncate">
                                                <Building2 className="h-3 w-3 shrink-0" />{lead.company}
                                            </span>
                                        )}
                                        {lead.created_at && (
                                            <time dateTime={lead.created_at} title={new Date(lead.created_at).toLocaleString('sv-SE')}>
                                                {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: sv })}
                                            </time>
                                        )}
                                    </div>
                                </div>

                                {/* Source + status — click opens modal */}
                                <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => setModalLead(lead)}>
                                    <SourceBadge source={lead.source} />
                                    <StatusBadge status={lead.status || 'ny'} />
                                </div>

                                {/* Delete */}
                                <button
                                    onClick={e => { e.stopPropagation(); handleDeleteLead(lead.id); }}
                                    className="text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                                    aria-label="Radera lead"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* ── Lead modal ── */}
            <Dialog open={!!modalLead} onOpenChange={open => { if (!open) setModalLead(null); }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 pr-6">
                            <span className="truncate">{modalLead?.name || 'Okänd'}</span>
                            <ScoreBadge score={modalLead?.score} />
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-1">
                        {/* Timestamp + source */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {modalLead?.created_at && (
                                <span className="text-xs text-zinc-500">
                                    {format(new Date(modalLead.created_at), "d MMM yyyy 'kl.' HH:mm", { locale: sv })}
                                </span>
                            )}
                            <SourceBadge source={modalLead?.source} />
                            <StatusBadge status={modalLead?.status || 'ny'} />
                        </div>

                        {/* Contact info */}
                        <div className="space-y-1.5">
                            {modalLead?.email && (
                                <a href={`mailto:${modalLead.email}`} className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors">
                                    <Mail className="h-3.5 w-3.5 text-zinc-500 shrink-0" />{modalLead.email}
                                </a>
                            )}
                            {modalLead?.phone && (
                                <a href={`tel:${modalLead.phone}`} className="flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors">
                                    <Phone className="h-3.5 w-3.5 text-zinc-500 shrink-0" />{modalLead.phone}
                                </a>
                            )}
                            {modalLead?.company && (
                                <span className="flex items-center gap-2 text-sm text-zinc-400">
                                    <Building2 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />{modalLead.company}
                                </span>
                            )}
                        </div>

                        {/* Message */}
                        {modalLead?.message && (
                            <div>
                                <p className="text-xs text-zinc-500 mb-1.5">Meddelande</p>
                                <p className="text-sm text-zinc-300 leading-relaxed">{modalLead.message}</p>
                            </div>
                        )}

                        {/* AI response */}
                        {modalLead?.ai_response && (
                            <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg p-3">
                                <p className="text-xs font-medium text-blue-400 mb-1.5">AI-svar</p>
                                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{modalLead.ai_response}</p>
                                {modalLead.similarity != null && (
                                    <p className="text-xs text-zinc-600 mt-2">Matchning: {(modalLead.similarity * 100).toFixed(0)}%</p>
                                )}
                            </div>
                        )}

                        {/* Status */}
                        <div>
                            <p className="text-xs text-zinc-500 mb-2">Ändra status</p>
                            <div className="flex flex-wrap gap-1.5">
                                {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                                    <Button
                                        key={key}
                                        variant={modalLead?.status === key ? 'default' : 'outline'}
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => handleStatusChange(modalLead.id, key)}
                                        disabled={modalLead?.status === key}
                                    >
                                        {conf.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-zinc-600 hover:text-red-400"
                            onClick={() => handleDeleteLead(modalLead?.id)}
                        >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Radera
                        </Button>
                        {modalLead?.customer_id ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-zinc-400"
                                onClick={() => { setModalLead(null); navigate(`/customers/${modalLead.customer_id}`); }}
                            >
                                Visa kund →
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-400"
                                onClick={() => { setModalLead(null); openConvertModal(modalLead); }}
                            >
                                <UserPlus className="h-3.5 w-3.5 mr-1" /> Konvertera till kund
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Convert to customer modal ── */}
            <Dialog open={!!convertingLead} onOpenChange={open => { if (!open) setConvertingLead(null); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Konvertera till kund</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Personnamn *</label>
                            <Input value={convertForm.full_name} onChange={e => setConvertForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Förnamn Efternamn" className="text-sm border-border/50" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Företagsnamn *</label>
                            <Input value={convertForm.company_name} onChange={e => setConvertForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Företaget AB" className="text-sm border-border/50" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Bransch</label>
                            <Select value={convertForm.industry} onValueChange={v => setConvertForm(f => ({ ...f, industry: v }))}>
                                <SelectTrigger className="text-sm border-border/50"><SelectValue placeholder="Välj bransch" /></SelectTrigger>
                                <SelectContent>{INDUSTRIES.map(ind => <SelectItem key={ind} value={ind}>{ind}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Initial projekttyp</label>
                            <Select value={convertForm.project_type} onValueChange={v => setConvertForm(f => ({ ...f, project_type: v }))}>
                                <SelectTrigger className="text-sm border-border/50"><SelectValue /></SelectTrigger>
                                <SelectContent>{PROJECT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        {convertingLead?.email && (
                            <p className="text-xs text-zinc-600">Email <span className="text-zinc-400">{convertingLead.email}</span> kopplas till kunden.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setConvertingLead(null)}>Avbryt</Button>
                        <Button size="sm" onClick={handleConvert} disabled={converting}>{converting ? 'Skapar...' : 'Skapa kund'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
