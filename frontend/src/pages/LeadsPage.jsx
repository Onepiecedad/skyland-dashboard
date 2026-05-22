import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Building2, Mail, Phone, Zap, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { leadsAPI } from '../lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardShell } from '../components/DashboardShell';

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
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border bg-primary/10 text-primary/70 border-primary/20 shrink-0">
            {label}
        </span>
    );
}

function formatDuration(durationSeconds) {
    if (!durationSeconds || durationSeconds < 1) return null;
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    if (minutes < 1) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
}

export function LeadsPage() {
    const [statusFilter, setStatusFilter] = useState('alla');

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [modalLead, setModalLead] = useState(null);

    const [convertingLead, setConvertingLead] = useState(null);
    const [convertForm, setConvertForm] = useState({ full_name: '', company_name: '', industry: '', project_type: 'konsultation' });
    const [converting, setConverting] = useState(false);

    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const leadsQuery = useQuery({
        queryKey: ['leads', statusFilter],
        queryFn: () => leadsAPI.fetchLeads(statusFilter),
    });

    const leads = leadsQuery.data || [];
    const loading = leadsQuery.isLoading;

    useEffect(() => {
        const channel = supabase
            .channel('prospects-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prospects' }, payload => {
                toast.info(`Ny lead: ${payload.new.name || 'Okänd'}`);
                queryClient.invalidateQueries({ queryKey: ['leads'] });
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [queryClient]);

    useEffect(() => {
        if (leadsQuery.isError) {
            toast.error('Kunde inte hämta leads');
        }
    }, [leadsQuery.isError]);

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }) => leadsAPI.updateLeadStatus(id, status),
        onSuccess: (_data, variables) => {
            toast.success(`Status → ${STATUS_CONFIG[variables.status]?.label || variables.status}`);
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            setModalLead(prev => prev?.id === variables.id ? { ...prev, status: variables.status } : prev);
        },
        onError: () => toast.error('Kunde inte uppdatera status'),
    });

    const deleteLeadMutation = useMutation({
        mutationFn: (id) => leadsAPI.deleteLead(id),
        onSuccess: (_data, id) => {
            toast.success('Lead raderat');
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            if (modalLead?.id === id) setModalLead(null);
        },
        onError: () => toast.error('Kunde inte radera lead'),
    });

    const deleteLeadsMutation = useMutation({
        mutationFn: (ids) => leadsAPI.deleteLeads(ids),
        onSuccess: (_data, ids) => {
            toast.success(`${ids.length} leads raderade`);
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            setSelectedIds(new Set());
        },
        onError: () => toast.error('Kunde inte radera leads'),
    });

    const convertLeadMutation = useMutation({
        mutationFn: ({ lead, form }) => leadsAPI.convertLeadToCustomer(lead, form, PROJECT_TYPES),
        onSuccess: ({ customer }) => {
            toast.success('Kund skapad');
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            setConvertingLead(null);
            navigate(`/customers/${customer.id}`);
        },
        onError: () => toast.error('Kunde inte skapa kund'),
        onSettled: () => setConverting(false),
    });

    const handleStatusChange = async (id, newStatus) => {
        updateStatusMutation.mutate({ id, status: newStatus });
    };

    const handleDeleteLead = async (id) => {
        if (!window.confirm('Radera lead permanent?')) return;
        deleteLeadMutation.mutate(id);
    };

    const handleBulkDelete = async () => {
        const ids = [...selectedIds];
        if (!window.confirm(`Radera ${ids.length} leads permanent?`)) return;
        deleteLeadsMutation.mutate(ids);
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
        convertLeadMutation.mutate({ lead: convertingLead, form: convertForm });
    };

    const stats = {
        nya: leads.filter(l => l.status === 'ny' || !l.status).length,
        kontaktade: leads.filter(l => l.status === 'kontaktad').length,
        bokade: leads.filter(l => l.status === 'bokad').length,
    };

    return (
        <DashboardShell contentClassName="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <Card className="border-primary/15 bg-card/30 backdrop-blur-sm shadow-[0_0_30px_rgba(8,146,90,0.06)]"><CardContent className="p-4"><p className="text-xs text-zinc-500 mb-1">Nya</p><p className="text-2xl font-bold text-primary">{stats.nya}</p></CardContent></Card>
                    <Card className="border-primary/15 bg-card/30 backdrop-blur-sm shadow-[0_0_30px_rgba(8,146,90,0.06)]"><CardContent className="p-4"><p className="text-xs text-zinc-500 mb-1">Kontaktade</p><p className="text-2xl font-bold text-primary">{stats.kontaktade}</p></CardContent></Card>
                    <Card className="border-primary/15 bg-card/30 backdrop-blur-sm shadow-[0_0_30px_rgba(8,146,90,0.06)]"><CardContent className="p-4"><p className="text-xs text-zinc-500 mb-1">Bokade</p><p className="text-2xl font-bold text-primary">{stats.bokade}</p></CardContent></Card>
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
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${selectedIds.has(lead.id) ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-card/30 backdrop-blur-sm hover:border-border/60 hover:bg-card/50'}`}
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

            {/* ── Lead modal ── */}
            <Dialog open={!!modalLead} onOpenChange={open => { if (!open) setModalLead(null); }}>
                <DialogContent className="sm:max-w-lg border-primary/15 shadow-[0_0_60px_rgba(8,146,90,0.15),0_0_120px_rgba(8,146,90,0.06),0_8px_32px_rgba(0,0,0,0.5)]">
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
                        {(modalLead?.ai_response?.trim() || modalLead?.similarity != null) && (
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                                <p className="text-xs font-medium text-primary mb-1.5">AI-svar</p>
                                {modalLead?.ai_response?.trim() ? (
                                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{modalLead.ai_response.trim()}</p>
                                ) : (
                                    <p className="text-sm text-zinc-500 italic">AI-svaret lagrades inte för detta lead.</p>
                                )}
                                {modalLead.similarity != null && (
                                    <p className="text-xs text-zinc-500 mt-2 border-t border-primary/20 pt-2">Matchning: {(modalLead.similarity * 100).toFixed(0)}%</p>
                                )}
                            </div>
                        )}

                        {modalLead?.latest_voice_call && (
                            <div className="bg-card/60 border border-border/50 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-medium text-zinc-300">Röstsamtal</p>
                                    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                                        {modalLead.latest_voice_call.created_at && (
                                            <span>{format(new Date(modalLead.latest_voice_call.created_at), "d MMM yyyy 'kl.' HH:mm", { locale: sv })}</span>
                                        )}
                                        {formatDuration(modalLead.latest_voice_call.duration_seconds) && (
                                            <span>{formatDuration(modalLead.latest_voice_call.duration_seconds)}</span>
                                        )}
                                    </div>
                                </div>
                                {modalLead.latest_voice_call.summary ? (
                                    <p className="text-sm text-zinc-300 leading-relaxed">{modalLead.latest_voice_call.summary}</p>
                                ) : (
                                    <p className="text-sm text-zinc-500 italic">Ingen sammanfattning sparades för samtalet.</p>
                                )}
                                {modalLead.latest_voice_call.transcript && (
                                    <details className="text-xs text-zinc-400">
                                        <summary className="cursor-pointer select-none text-zinc-500 hover:text-zinc-300">
                                            Visa transcript
                                        </summary>
                                        <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-400">
                                            {modalLead.latest_voice_call.transcript}
                                        </pre>
                                    </details>
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
        </DashboardShell>
    );
}
