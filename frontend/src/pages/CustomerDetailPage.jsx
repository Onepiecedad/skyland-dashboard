import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import {
    LogOut, ArrowLeft, Mail, Phone, Building2, Plus, ChevronDown, ChevronUp,
    Clock, Zap, Globe, StickyNote, Folder, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

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
    'company_updated':        'Företag uppdaterat',
    'project_created':        'Projekt skapat',
    'project_status_changed': 'Projektstatus ändrad',
    'notes_updated':          'Anteckningar uppdaterade',
};

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
        <div
            onClick={() => setEditing(true)}
            className="cursor-pointer min-h-[60px]"
        >
            {value ? (
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{value}</p>
            ) : (
                <p className="text-sm text-zinc-600 italic">{placeholder}</p>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CustomerDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const [customer, setCustomer] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [prospects, setProspects] = useState([]);
    const [activityLog, setActivityLog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const [expandedProjectId, setExpandedProjectId] = useState(null);
    const [expandedProspectId, setExpandedProspectId] = useState(null);

    const [showAddCompany, setShowAddCompany] = useState(false);
    const [addCompanyForm, setAddCompanyForm] = useState({ name: '', industry: '', website: '', notes: '' });
    const [savingCompany, setSavingCompany] = useState(false);

    const [showAddProject, setShowAddProject] = useState(false);
    const [addProjectForm, setAddProjectForm] = useState({ name: '', company_id: '', project_type: 'konsultation', status: 'lead', next_step: '' });
    const [savingProject, setSavingProject] = useState(false);

    const logActivity = useCallback(async (action, description, opts = {}) => {
        try {
            await supabase.from('activity_log').insert({
                action,
                description,
                customer_id: id,
                company_id: opts.company_id || null,
                project_id: opts.project_id || null,
                actor: 'user',
                metadata: opts.metadata || {},
            });
        } catch {
            // non-critical
        }
    }, [id]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const [custRes, compsRes, prspRes, actRes] = await Promise.all([
                supabase.from('customers').select('*').eq('id', id).single(),
                supabase.from('companies').select('*, projects (*)').eq('customer_id', id).order('created_at', { ascending: true }),
                supabase.from('prospects').select('id, name, email, company, message, score, status, created_at').eq('customer_id', id).order('created_at', { ascending: false }),
                supabase.from('activity_log').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(50),
            ]);

            if (custRes.error) throw custRes.error;
            setCustomer(custRes.data);
            setCompanies(compsRes.data || []);
            setProspects(prspRes.data || []);
            setActivityLog(actRes.data || []);
        } catch (err) {
            console.error(err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const saveCustomerField = async (field, value) => {
        const { error } = await supabase.from('customers').update({ [field]: value }).eq('id', id);
        if (error) throw error;
        setCustomer(prev => ({ ...prev, [field]: value }));
        await logActivity('customer_updated', `${field} uppdaterat`);
        toast.success('Sparat');
    };

    const saveCompanyField = async (companyId, field, value) => {
        const { error } = await supabase.from('companies').update({ [field]: value }).eq('id', companyId);
        if (error) throw error;
        setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, [field]: value } : c));
        await logActivity('company_updated', `${field} uppdaterat`, { company_id: companyId });
        toast.success('Sparat');
    };

    const saveProjectField = async (projectId, companyId, field, value) => {
        const { error } = await supabase.from('projects').update({ [field]: value }).eq('id', projectId);
        if (error) { toast.error('Kunde inte spara'); return; }
        setCompanies(prev => prev.map(co =>
            co.id === companyId
                ? { ...co, projects: (co.projects || []).map(p => p.id === projectId ? { ...p, [field]: value } : p) }
                : co
        ));
        if (field === 'status') {
            await logActivity('project_status_changed', `Status → ${value}`, { company_id: companyId, project_id: projectId });
        }
        toast.success('Sparat');
    };

    const handleAddCompany = async () => {
        if (!addCompanyForm.name.trim()) { toast.error('Namn krävs'); return; }
        setSavingCompany(true);
        try {
            const { data, error } = await supabase
                .from('companies')
                .insert({ customer_id: id, ...addCompanyForm })
                .select()
                .single();
            if (error) throw error;
            await logActivity('company_created', `${data.name} skapat`, { company_id: data.id });
            toast.success(`${data.name} skapat`);
            setShowAddCompany(false);
            setAddCompanyForm({ name: '', industry: '', website: '', notes: '' });
            await fetchData();
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
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    company_id: addProjectForm.company_id,
                    name: addProjectForm.name.trim(),
                    project_type: addProjectForm.project_type,
                    status: addProjectForm.status,
                    next_step: addProjectForm.next_step.trim() || null,
                })
                .select()
                .single();
            if (error) throw error;
            await logActivity('project_created', `${data.name} skapat`, { company_id: addProjectForm.company_id, project_id: data.id });
            toast.success(`${data.name} skapat`);
            setShowAddProject(false);
            setAddProjectForm({ name: '', company_id: '', project_type: 'konsultation', status: 'lead', next_step: '' });
            await fetchData();
        } catch {
            toast.error('Kunde inte skapa projekt');
        } finally {
            setSavingProject(false);
        }
    };

    const handleDeleteProject = async (projectId, projectName) => {
        if (!window.confirm(`Radera projektet "${projectName}" permanent?`)) return;
        try {
            const { error } = await supabase.from('projects').delete().eq('id', projectId);
            if (error) throw error;
            await logActivity('project_deleted', `${projectName} raderat`);
            toast.success(`${projectName} raderat`);
            setCompanies(prev => prev.map(co => ({
                ...co,
                projects: (co.projects || []).filter(p => p.id !== projectId),
            })));
            if (expandedProjectId === projectId) setExpandedProjectId(null);
        } catch {
            toast.error('Kunde inte radera projekt');
        }
    };

    const handleDeleteCompany = async (companyId, companyName) => {
        if (!window.confirm(`Radera "${companyName}" och alla tillhörande projekt permanent?`)) return;
        try {
            const { error } = await supabase.from('companies').delete().eq('id', companyId);
            if (error) throw error;
            await logActivity('company_deleted', `${companyName} raderat`);
            toast.success(`${companyName} raderat`);
            setCompanies(prev => prev.filter(co => co.id !== companyId));
        } catch {
            toast.error('Kunde inte radera företag');
        }
    };

    const handleDeleteCustomer = async () => {
        if (!window.confirm(`Radera kunden "${customer.full_name}" och alla företag/projekt permanent? Åtgärden kan inte ångras.`)) return;
        try {
            const { error } = await supabase.from('customers').delete().eq('id', id);
            if (error) throw error;
            toast.success('Kund raderad');
            navigate('/customers');
        } catch {
            toast.error('Kunde inte radera kund');
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const allProjects = companies.flatMap(co =>
        (co.projects || []).map(p => ({ ...p, company_name: co.name, company_id: co.id }))
    );

    // ── Loading / error ──────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="space-y-2 w-full max-w-5xl px-4">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-lg bg-card/30 animate-pulse" />)}
                </div>
            </div>
        );
    }

    if (error || !customer) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-3">
                    <p className="text-sm text-zinc-400">Kunden hittades inte.</p>
                    <Button variant="outline" size="sm" onClick={() => navigate('/customers')}>
                        Tillbaka till Kunder
                    </Button>
                </div>
            </div>
        );
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-background">
            {/* Nav */}
            <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
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

            <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Back + title */}
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/customers')} className="-ml-2 text-zinc-500 hover:text-zinc-200">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
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
                                                {isExpanded && p.message && (
                                                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed border-t border-border/30 pt-2">
                                                        {p.message}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })
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
                                            <div
                                                key={project.id}
                                                className="rounded-lg border border-border/40 bg-background/30"
                                            >
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
                                                        {/* Status select */}
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
                                                        {/* Next step */}
                                                        <div>
                                                            <p className="text-xs text-zinc-600 mb-1">Nästa steg</p>
                                                            <InlineText
                                                                value={project.next_step}
                                                                onSave={v => saveProjectField(project.id, project.company_id, 'next_step', v)}
                                                                placeholder="Lägg till nästa steg"
                                                                className="text-xs text-zinc-400"
                                                            />
                                                        </div>
                                                        {/* Notes */}
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
            </main>

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
