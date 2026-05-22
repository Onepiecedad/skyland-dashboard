import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import {
    ArrowLeft, Mail, Phone, Building2, Plus, ChevronDown, ChevronUp,
    Clock, Zap, Globe, StickyNote, Folder, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { customerDetailAPI } from '../lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    'lead':      { label: 'Lead',      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    'pågående':  { label: 'Pågående',  color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    'levererat': { label: 'Levererat', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    'i drift':   { label: 'I drift',   color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    'pausat':    { label: 'Pausat',    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    'avslutat':  { label: 'Avslutat', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

const TYPE_CONFIG = {
    'ai-system':          { label: 'AI-system',       color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
    'hemsida':            { label: 'Hemsida',          color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    'automation':         { label: 'Automation',       color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    'drift-och-säkerhet': { label: 'Drift & säkerhet', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    'konsultation':       { label: 'Konsultation',     color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
};

const ACTIVITY_LABELS = {
    'customer_created':       'Kund skapad',
    'customer_updated':       'Kund uppdaterad',
    'company_created':        'Företag skapat',
    'company_deleted':        'Företag raderat',
    'company_updated':        'Företag uppdaterat',
    'project_created':        'Projekt skapat',
    'project_deleted':        'Projekt raderat',
    'project_status_changed': 'Projektstatus ändrad',
    'notes_updated':          'Anteckningar uppdaterade',
};

function formatDuration(durationSeconds) {
    if (!durationSeconds || durationSeconds < 1) return null;
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    if (minutes < 1) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
}

// ─── Small reusable components ────────────────────────────────────────────────

function InlineText({ value, onSave, placeholder = 'Klicka för att redigera', type = 'text', className = '' }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value || '');
    const [saving, setSaving] = useState(false);

    useEffect(() => { setDraft(value || ''); }, [value]);

    const save = async () => {
        const trimmed = draft.trim();
        if (trimmed === (value || '').trim()) { setEditing(false); return; }
        setSaving(true);
        try { await onSave(trimmed); }
        catch { toast.error('Kunde inte spara'); setDraft(value || ''); }
        finally { setSaving(false); setEditing(false); }
    };

    if (editing) {
        return (
            <input
                autoFocus
                type={type}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={save}
                onKeyDown={e => {
                    if (e.key === 'Enter') save();
                    if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
                }}
                disabled={saving}
                className={`bg-card border border-border/80 rounded px-2 py-0.5 text-sm w-full focus:outline-none focus:border-zinc-400 ${className}`}
            />
        );
    }

    return (
        <span
            onClick={() => setEditing(true)}
            title="Klicka för att redigera"
            className={`cursor-pointer hover:text-foreground transition-colors ${value ? '' : 'text-zinc-600 italic'} ${className}`}
        >
            {value || placeholder}
        </span>
    );
}

function InlineTextarea({ value, onSave, placeholder = 'Klicka för att lägga till anteckningar...' }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value || '');
    const [saving, setSaving] = useState(false);

    useEffect(() => { setDraft(value || ''); }, [value]);

    const save = async () => {
        if (draft.trim() === (value || '').trim()) { setEditing(false); return; }
        setSaving(true);
        try { await onSave(draft.trim()); }
        catch { toast.error('Kunde inte spara'); setDraft(value || ''); }
        finally { setSaving(false); setEditing(false); }
    };

    if (editing) {
        return (
            <textarea
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={save}
                disabled={saving}
                className="w-full min-h-[100px] text-sm bg-card border border-border/80 rounded px-3 py-2 focus:outline-none focus:border-zinc-400 resize-none leading-relaxed"
                placeholder={placeholder}
            />
        );
    }

    return (
        <div onClick={() => setEditing(true)} className="cursor-pointer min-h-[60px]">
            {value ? (
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{value}</p>
            ) : (
                <p className="text-sm text-zinc-600 italic">{placeholder}</p>
            )}
        </div>
    );
}

// ─── Panel component ──────────────────────────────────────────────────────────

export function CustomerDetailPanel({ customerId, onDeleted, showBackButton = true }) {
    const navigate = useNavigate();
    const id = customerId;
    const queryClient = useQueryClient();

    const [expandedProjectId, setExpandedProjectId] = useState(null);
    const [expandedProspectId, setExpandedProspectId] = useState(null);

    const [showAddCompany, setShowAddCompany] = useState(false);
    const [addCompanyForm, setAddCompanyForm] = useState({ name: '', industry: '', website: '', notes: '' });
    const [savingCompany, setSavingCompany] = useState(false);

    const [showAddProject, setShowAddProject] = useState(false);
    const [addProjectForm, setAddProjectForm] = useState({ name: '', company_id: '', project_type: 'konsultation', status: 'lead', next_step: '' });
    const [savingProject, setSavingProject] = useState(false);

    const detailQuery = useQuery({
        queryKey: ['customer-detail', id],
        queryFn: () => customerDetailAPI.fetchCustomerDetail(id),
        enabled: !!id,
    });

    const customer = detailQuery.data?.customer || null;
    const companies = detailQuery.data?.companies || [];
    const prospects = detailQuery.data?.prospects || [];
    const activityLog = detailQuery.data?.activityLog || [];
    const voiceCalls = detailQuery.data?.voiceCalls || [];
    const loading = detailQuery.isLoading;
    const error = detailQuery.isError;

    const invalidateDetail = () => queryClient.invalidateQueries({ queryKey: ['customer-detail', id] });
    const invalidateCustomers = () => queryClient.invalidateQueries({ queryKey: ['customers'] });

    const logActivity = useCallback(async (action, description, opts = {}) => {
        try {
            await customerDetailAPI.insertActivityLog(id, action, description, opts);
        } catch {
            // non-critical
        }
    }, [id]);

    const updateCustomerMutation = useMutation({
        mutationFn: ({ field, value }) => customerDetailAPI.updateCustomerField(id, field, value),
        onSuccess: async (_data, variables) => {
            await logActivity('customer_updated', `${variables.field} uppdaterat`);
            invalidateDetail();
            invalidateCustomers();
            toast.success('Sparat');
        },
    });

    const updateCompanyMutation = useMutation({
        mutationFn: ({ companyId, field, value }) => customerDetailAPI.updateCompanyField(companyId, field, value),
        onSuccess: async (_data, variables) => {
            await logActivity('company_updated', `${variables.field} uppdaterat`, { company_id: variables.companyId });
            invalidateDetail();
            invalidateCustomers();
            toast.success('Sparat');
        },
    });

    const updateProjectMutation = useMutation({
        mutationFn: ({ projectId, field, value }) => customerDetailAPI.updateProjectField(projectId, field, value),
        onSuccess: async (_data, variables) => {
            if (variables.field === 'status') {
                await logActivity('project_status_changed', `Status → ${variables.value}`, {
                    company_id: variables.companyId,
                    project_id: variables.projectId,
                });
            }
            invalidateDetail();
            invalidateCustomers();
            toast.success('Sparat');
        },
    });

    const saveCustomerField = async (field, value) => {
        await updateCustomerMutation.mutateAsync({ field, value });
    };

    const saveCompanyField = async (companyId, field, value) => {
        await updateCompanyMutation.mutateAsync({ companyId, field, value });
    };

    const saveProjectField = async (projectId, companyId, field, value) => {
        try {
            await updateProjectMutation.mutateAsync({ projectId, companyId, field, value });
        } catch {
            toast.error('Kunde inte spara');
        }
    };

    const handleAddCompany = async () => {
        if (!addCompanyForm.name.trim()) { toast.error('Namn krävs'); return; }
        setSavingCompany(true);
        try {
            const data = await customerDetailAPI.createCompany(id, addCompanyForm);
            await logActivity('company_created', `${data.name} skapat`, { company_id: data.id });
            toast.success(`${data.name} skapat`);
            setShowAddCompany(false);
            setAddCompanyForm({ name: '', industry: '', website: '', notes: '' });
            invalidateDetail();
            invalidateCustomers();
        } catch {
            toast.error('Kunde inte skapa företag');
        } finally {
            setSavingCompany(false);
        }
    };

    const handleAddProject = async () => {
        if (!addProjectForm.name.trim()) { toast.error('Namn krävs'); return; }
        if (!addProjectForm.company_id) { toast.error('Välj ett företag'); return; }
        setSavingProject(true);
        try {
            const data = await customerDetailAPI.createProject({
                company_id: addProjectForm.company_id,
                name: addProjectForm.name.trim(),
                project_type: addProjectForm.project_type,
                status: addProjectForm.status,
                next_step: addProjectForm.next_step.trim() || null,
            });
            await logActivity('project_created', `${data.name} skapat`, { company_id: addProjectForm.company_id, project_id: data.id });
            toast.success(`${data.name} skapat`);
            setShowAddProject(false);
            setAddProjectForm({ name: '', company_id: '', project_type: 'konsultation', status: 'lead', next_step: '' });
            invalidateDetail();
            invalidateCustomers();
        } catch {
            toast.error('Kunde inte skapa projekt');
        } finally {
            setSavingProject(false);
        }
    };

    const handleDeleteProject = async (projectId, projectName) => {
        if (!window.confirm(`Radera projektet "${projectName}" permanent?`)) return;
        try {
            await customerDetailAPI.deleteProject(projectId);
            await logActivity('project_deleted', `${projectName} raderat`);
            toast.success(`${projectName} raderat`);
            invalidateDetail();
            invalidateCustomers();
            if (expandedProjectId === projectId) setExpandedProjectId(null);
        } catch {
            toast.error('Kunde inte radera projekt');
        }
    };

    const handleDeleteCompany = async (companyId, companyName) => {
        if (!window.confirm(`Radera "${companyName}" och alla tillhörande projekt permanent?`)) return;
        try {
            await customerDetailAPI.deleteCompany(companyId);
            await logActivity('company_deleted', `${companyName} raderat`);
            toast.success(`${companyName} raderat`);
            invalidateDetail();
            invalidateCustomers();
        } catch {
            toast.error('Kunde inte radera företag');
        }
    };

    const handleDeleteCustomer = async () => {
        if (!window.confirm(`Radera kunden "${customer.full_name}" och alla företag/projekt permanent? Åtgärden kan inte ångras.`)) return;
        try {
            await customerDetailAPI.deleteCustomer(id);
            queryClient.setQueryData(['customers'], (old) =>
                Array.isArray(old) ? old.filter((existingCustomer) => existingCustomer.id !== id) : old
            );
            queryClient.removeQueries({ queryKey: ['customer-detail', id] });
            invalidateCustomers();
            toast.success('Kund raderad');
            if (onDeleted) onDeleted();
            else navigate('/customers');
        } catch {
            toast.error('Kunde inte radera kund');
        }
    };

    const allProjects = companies.flatMap(co =>
        (co.projects || []).map(p => ({ ...p, company_name: co.name, company_id: co.id }))
    );

    // ── Loading / error ──────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="space-y-2 w-full py-4">
                {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-lg bg-card/30 animate-pulse" />)}
            </div>
        );
    }

    if (error || !customer) {
        return (
            <div className="py-12 text-center space-y-3">
                <p className="text-sm text-zinc-400">Kunden hittades inte.</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/customers')}>
                    Tillbaka till Kunder
                </Button>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Title + optional back button */}
            <div className="flex items-center gap-3">
                {showBackButton && (
                    <Button variant="ghost" size="sm" onClick={() => navigate('/customers')} className="-ml-2 text-zinc-500 hover:text-zinc-200">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                )}
                <h1 className="text-xl font-semibold tracking-tight">{customer.full_name}</h1>
            </div>

            {/* 3-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1fr] gap-4">

                {/* ── Column 1: Kontakt + Företag ── */}
                <div className="space-y-4">

                    {/* Kontakt */}
                    <Card className="border-border/50 bg-card/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-zinc-400">Kontakt</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <p className="text-xs text-zinc-600 mb-0.5">Namn</p>
                                <InlineText
                                    value={customer.full_name}
                                    onSave={v => saveCustomerField('full_name', v)}
                                    placeholder="Lägg till namn"
                                    className="text-sm font-medium"
                                />
                            </div>
                            <div>
                                <p className="text-xs text-zinc-600 mb-0.5">Email</p>
                                <div className="flex items-center gap-1.5">
                                    {customer.email && <Mail className="h-3 w-3 text-zinc-600 shrink-0" />}
                                    <InlineText
                                        value={customer.email}
                                        onSave={v => saveCustomerField('email', v)}
                                        placeholder="Lägg till email"
                                        type="email"
                                        className="text-sm text-zinc-300"
                                    />
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-600 mb-0.5">Telefon</p>
                                <div className="flex items-center gap-1.5">
                                    {customer.phone && <Phone className="h-3 w-3 text-zinc-600 shrink-0" />}
                                    <InlineText
                                        value={customer.phone}
                                        onSave={v => saveCustomerField('phone', v)}
                                        placeholder="Lägg till telefon"
                                        className="text-sm text-zinc-300"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Företag */}
                    <Card className="border-border/50 bg-card/50">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-medium text-zinc-400">Företag</CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-200"
                                onClick={() => setShowAddCompany(true)}
                            >
                                <Plus className="h-3 w-3 mr-1" /> Lägg till
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {companies.length === 0 ? (
                                <p className="text-sm text-zinc-600 italic">Inga företag.</p>
                            ) : (
                                companies.map(co => (
                                    <div key={co.id} className="space-y-1.5 pb-3 border-b border-border/30 last:border-0 last:pb-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <InlineText
                                                value={co.name}
                                                onSave={v => saveCompanyField(co.id, 'name', v)}
                                                className="text-sm font-medium"
                                            />
                                            <button
                                                onClick={() => handleDeleteCompany(co.id, co.name)}
                                                className="text-zinc-700 hover:text-red-400 transition-colors shrink-0"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Building2 className="h-3 w-3 text-zinc-600 shrink-0" />
                                            <InlineText
                                                value={co.industry}
                                                onSave={v => saveCompanyField(co.id, 'industry', v)}
                                                placeholder="Bransch"
                                                className="text-xs text-zinc-400"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Globe className="h-3 w-3 text-zinc-600 shrink-0" />
                                            <InlineText
                                                value={co.website}
                                                onSave={v => saveCompanyField(co.id, 'website', v)}
                                                placeholder="Webbplats"
                                                className="text-xs text-zinc-400"
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── Column 2: Anteckningar + Prospects ── */}
                <div className="space-y-4">

                    {/* Anteckningar */}
                    <Card className="border-border/50 bg-card/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                                <StickyNote className="h-3.5 w-3.5" /> Anteckningar
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <InlineTextarea
                                value={customer.notes}
                                onSave={v => saveCustomerField('notes', v)}
                            />
                        </CardContent>
                    </Card>

                    {/* Kopplade prospects */}
                    <Card className="border-border/50 bg-card/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-zinc-400">
                                Prospects <span className="text-zinc-600 font-normal">({prospects.length})</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {prospects.length === 0 ? (
                                <p className="text-sm text-zinc-600 italic">Inga kopplade prospects.</p>
                            ) : (
                                prospects.map(p => {
                                    const isExpanded = expandedProspectId === p.id;
                                    const prospectVoiceCalls = voiceCalls.filter(call => call.prospect_id === p.id);
                                    return (
                                        <div
                                            key={p.id}
                                            className="rounded-lg border border-border/40 bg-background/30 p-3 cursor-pointer"
                                            onClick={() => setExpandedProspectId(isExpanded ? null : p.id)}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className="text-sm font-medium truncate">{p.name || 'Okänd'}</span>
                                                        {p.score != null && (
                                                            <span className="flex items-center gap-0.5 text-[11px] text-zinc-500">
                                                                <Zap className="h-2.5 w-2.5" />{p.score}
                                                            </span>
                                                        )}
                                                        {prospectVoiceCalls.length > 0 && (
                                                            <span className="text-[11px] text-zinc-500 border border-border/40 rounded px-1.5 py-0.5">
                                                                {prospectVoiceCalls.length} samtal
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-zinc-500">
                                                        {p.created_at ? formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: sv }) : ''}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {p.status && (
                                                        <span className="text-[11px] text-zinc-500 border border-border/40 rounded px-1.5 py-0.5">{p.status}</span>
                                                    )}
                                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-zinc-600" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />}
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="mt-2 border-t border-border/30 pt-2 space-y-2">
                                                    {p.message && (
                                                        <p className="text-xs text-zinc-400 leading-relaxed">
                                                            {p.message}
                                                        </p>
                                                    )}
                                                    {prospectVoiceCalls.length > 0 && (
                                                        <div className="space-y-2">
                                                            {prospectVoiceCalls.map(call => (
                                                                <div key={call.id} className="rounded border border-border/30 bg-background/40 p-2">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="text-[11px] text-zinc-500">Röstsamtal</span>
                                                                        <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                                                                            {call.created_at && <span>{formatDistanceToNow(new Date(call.created_at), { addSuffix: true, locale: sv })}</span>}
                                                                            {formatDuration(call.duration_seconds) && <span>{formatDuration(call.duration_seconds)}</span>}
                                                                        </div>
                                                                    </div>
                                                                    {call.summary && (
                                                                        <p className="mt-1 text-xs text-zinc-300 leading-relaxed">{call.summary}</p>
                                                                    )}
                                                                    {call.recording_url && (
                                                                        <div className="mt-1">
                                                                            <audio controls src={call.recording_url} className="h-7 w-full max-w-[200px]" preload="none" />
                                                                        </div>
                                                                    )}
                                                                    {call.transcript && (
                                                                        <details className="mt-1 text-xs text-zinc-400">
                                                                            <summary className="cursor-pointer select-none text-zinc-500 hover:text-zinc-300">
                                                                                Visa transcript
                                                                            </summary>
                                                                            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-400">
                                                                                {call.transcript}
                                                                            </pre>
                                                                        </details>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-zinc-400">
                                Voice Calls <span className="text-zinc-600 font-normal">({voiceCalls.length})</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {voiceCalls.length === 0 ? (
                                <p className="text-sm text-zinc-600 italic">Inga röstsamtal sparade ännu.</p>
                            ) : (
                                voiceCalls.map(call => (
                                    <div key={call.id} className="rounded-lg border border-border/40 bg-background/30 p-3 space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-medium">Voice call</p>
                                                <p className="text-xs text-zinc-500">
                                                    {call.created_at ? formatDistanceToNow(new Date(call.created_at), { addSuffix: true, locale: sv }) : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                                                {call.prospect_id && (
                                                    <span className="border border-border/40 rounded px-1.5 py-0.5">Prospect</span>
                                                )}
                                                {formatDuration(call.duration_seconds) && <span>{formatDuration(call.duration_seconds)}</span>}
                                            </div>
                                        </div>
                                        {call.summary ? (
                                            <p className="text-xs text-zinc-300 leading-relaxed">{call.summary}</p>
                                        ) : (
                                            <p className="text-xs text-zinc-500 italic">Ingen sammanfattning sparades.</p>
                                        )}
                                        {call.recording_url && (
                                            <div className="mt-2 mb-1">
                                                <audio controls src={call.recording_url} className="h-8 w-full max-w-[240px]" preload="none" />
                                            </div>
                                        )}
                                        {call.transcript && (
                                            <details className="text-xs text-zinc-400">
                                                <summary className="cursor-pointer select-none text-zinc-500 hover:text-zinc-300">
                                                    Visa transcript
                                                </summary>
                                                <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-400">
                                                    {call.transcript}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── Column 3: Projekt ── */}
                <div>
                    <Card className="border-border/50 bg-card/50">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                                <Folder className="h-3.5 w-3.5" /> Projekt <span className="text-zinc-600 font-normal">({allProjects.length})</span>
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-200"
                                onClick={() => {
                                    setAddProjectForm(f => ({ ...f, company_id: companies.length === 1 ? companies[0].id : '' }));
                                    setShowAddProject(true);
                                }}
                            >
                                <Plus className="h-3 w-3 mr-1" /> Nytt projekt
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {allProjects.length === 0 ? (
                                <p className="text-sm text-zinc-600 italic">Inga projekt.</p>
                            ) : (
                                allProjects.map(project => {
                                    const isExpanded = expandedProjectId === project.id;
                                    const statusConf = STATUS_CONFIG[project.status] || {};
                                    const typeConf = TYPE_CONFIG[project.project_type] || {};
                                    return (
                                        <div key={project.id} className="rounded-lg border border-border/40 bg-background/30">
                                            {/* Compact header */}
                                            <div
                                                className="p-3 cursor-pointer"
                                                onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0 space-y-1.5">
                                                        <p className="text-sm font-medium truncate">{project.name}</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border ${typeConf.color || ''}`}>
                                                                {typeConf.label || project.project_type}
                                                            </span>
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border ${statusConf.color || ''}`}>
                                                                {statusConf.label || project.status}
                                                            </span>
                                                            {companies.length > 1 && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-zinc-800/50 text-zinc-500">
                                                                    {project.company_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {project.next_step && !isExpanded && (
                                                            <p className="text-xs text-zinc-500 truncate">→ {project.next_step}</p>
                                                        )}
                                                    </div>
                                                    {isExpanded
                                                        ? <ChevronUp className="h-3.5 w-3.5 text-zinc-600 shrink-0 mt-0.5" />
                                                        : <ChevronDown className="h-3.5 w-3.5 text-zinc-600 shrink-0 mt-0.5" />
                                                    }
                                                </div>
                                            </div>

                                            {/* Expanded */}
                                            {isExpanded && (
                                                <div className="px-3 pb-3 border-t border-border/30 space-y-3 pt-3" onClick={e => e.stopPropagation()}>
                                                    <div className="flex justify-end">
                                                        <button
                                                            onClick={() => handleDeleteProject(project.id, project.name)}
                                                            className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 className="h-3 w-3" /> Radera projekt
                                                        </button>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-zinc-600 mb-1">Status</p>
                                                        <Select
                                                            value={project.status}
                                                            onValueChange={v => saveProjectField(project.id, project.company_id, 'status', v)}
                                                        >
                                                            <SelectTrigger className="h-7 text-xs border-border/50 bg-card/50">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                                                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-zinc-600 mb-1">Nästa steg</p>
                                                        <InlineText
                                                            value={project.next_step}
                                                            onSave={v => saveProjectField(project.id, project.company_id, 'next_step', v)}
                                                            placeholder="Lägg till nästa steg"
                                                            className="text-xs text-zinc-400"
                                                        />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-zinc-600 mb-1">Anteckningar</p>
                                                        <InlineTextarea
                                                            value={project.notes}
                                                            onSave={v => saveProjectField(project.id, project.company_id, 'notes', v)}
                                                            placeholder="Projektanteckningar..."
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* ── Activity Timeline ── */}
            <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> Aktivitet
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {activityLog.length === 0 ? (
                        <p className="text-sm text-zinc-600 italic">Ingen aktivitet loggad ännu.</p>
                    ) : (
                        <div className="space-y-3">
                            {activityLog.map(entry => (
                                <div key={entry.id} className="flex items-start gap-3">
                                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-600 mt-2 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-zinc-300">
                                            {ACTIVITY_LABELS[entry.action] || entry.action}
                                            {entry.description && (
                                                <span className="text-zinc-500"> — {entry.description}</span>
                                            )}
                                        </p>
                                        <p className="text-[11px] text-zinc-600 mt-0.5">
                                            {entry.created_at ? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: sv }) : ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete customer */}
            <div className="flex justify-end pb-2">
                <button
                    onClick={handleDeleteCustomer}
                    className="flex items-center gap-1.5 text-xs text-zinc-700 hover:text-red-400 transition-colors"
                >
                    <Trash2 className="h-3 w-3" /> Radera kund
                </button>
            </div>

            {/* ── Add Company Modal ── */}
            <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Lägg till företag</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Namn *</label>
                            <Input
                                value={addCompanyForm.name}
                                onChange={e => setAddCompanyForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Företagsnamn"
                                className="text-sm border-border/50"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Bransch</label>
                            <Input
                                value={addCompanyForm.industry}
                                onChange={e => setAddCompanyForm(f => ({ ...f, industry: e.target.value }))}
                                placeholder="t.ex. Livsmedel, Marin service"
                                className="text-sm border-border/50"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Webbplats</label>
                            <Input
                                value={addCompanyForm.website}
                                onChange={e => setAddCompanyForm(f => ({ ...f, website: e.target.value }))}
                                placeholder="https://..."
                                className="text-sm border-border/50"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setShowAddCompany(false)}>Avbryt</Button>
                        <Button size="sm" onClick={handleAddCompany} disabled={savingCompany}>
                            {savingCompany ? 'Sparar...' : 'Skapa'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Add Project Modal ── */}
            <Dialog open={showAddProject} onOpenChange={setShowAddProject}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Nytt projekt</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Projektnamn *</label>
                            <Input
                                value={addProjectForm.name}
                                onChange={e => setAddProjectForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="t.ex. AI-system fas 2"
                                className="text-sm border-border/50"
                            />
                        </div>
                        {companies.length > 1 && (
                            <div>
                                <label className="text-xs text-zinc-500 mb-1 block">Företag *</label>
                                <Select
                                    value={addProjectForm.company_id}
                                    onValueChange={v => setAddProjectForm(f => ({ ...f, company_id: v }))}
                                >
                                    <SelectTrigger className="text-sm border-border/50">
                                        <SelectValue placeholder="Välj företag" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {companies.map(co => (
                                            <SelectItem key={co.id} value={co.id}>{co.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Typ</label>
                            <Select
                                value={addProjectForm.project_type}
                                onValueChange={v => setAddProjectForm(f => ({ ...f, project_type: v }))}
                            >
                                <SelectTrigger className="text-sm border-border/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Status</label>
                            <Select
                                value={addProjectForm.status}
                                onValueChange={v => setAddProjectForm(f => ({ ...f, status: v }))}
                            >
                                <SelectTrigger className="text-sm border-border/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Nästa steg</label>
                            <Input
                                value={addProjectForm.next_step}
                                onChange={e => setAddProjectForm(f => ({ ...f, next_step: e.target.value }))}
                                placeholder="Valfritt"
                                className="text-sm border-border/50"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setShowAddProject(false)}>Avbryt</Button>
                        <Button size="sm" onClick={handleAddProject} disabled={savingProject}>
                            {savingProject ? 'Sparar...' : 'Skapa'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
