import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent } from '../components/ui/dialog';
import { LogOut, Search, Building2, ChevronRight, Users } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerDetailPanel } from './CustomerDetailPanel';

const STATUS_COLORS = {
    'i drift':   'bg-green-500/10 text-green-400 border-green-500/20',
    'pågående':  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    'levererat': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'lead':      'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'pausat':    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    'avslutat':  'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

const STATUS_ORDER = ['i drift', 'pågående', 'levererat', 'lead', 'pausat', 'avslutat'];

function getStatusSummary(companies) {
    const counts = {};
    for (const co of (companies || [])) {
        for (const p of (co.projects || [])) {
            counts[p.status] = (counts[p.status] || 0) + 1;
        }
    }
    return Object.entries(counts).sort(([a], [b]) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b));
}

export function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('alla');
    const [modalCustomerId, setModalCustomerId] = useState(null);
    const location = useLocation();

    const fetchCustomers = async () => {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select(`
                    id, full_name, email, updated_at,
                    companies (
                        id, name,
                        projects (id, status)
                    )
                `)
                .order('updated_at', { ascending: false });
            if (error) throw error;
            setCustomers(data || []);
        } catch {
            toast.error('Kunde inte hämta kunder');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCustomers(); }, []);

    useEffect(() => {
        const channel = supabase
            .channel('customers-list')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchCustomers)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, fetchCustomers)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchCustomers)
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const filtered = customers.filter(c => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (
                !c.full_name.toLowerCase().includes(q) &&
                !(c.email || '').toLowerCase().includes(q) &&
                !(c.companies || []).some(co => co.name.toLowerCase().includes(q))
            ) return false;
        }
        const allProjects = (c.companies || []).flatMap(co => co.projects || []);
        if (filter === 'aktiva') return allProjects.some(p => ['lead', 'pågående', 'i drift'].includes(p.status));
        if (filter === 'leads') return allProjects.some(p => p.status === 'lead');
        if (filter === 'arkiverade') return allProjects.length > 0 && allProjects.every(p => p.status === 'avslutat');
        return true;
    });

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-primary/10 bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
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

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                        <Input
                            placeholder="Sök namn, email, företag..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs border-border/50 bg-card/50"
                        />
                    </div>
                    <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="w-[160px] h-8 text-xs border-border/50 bg-card/50">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="alla">Alla</SelectItem>
                            <SelectItem value="aktiva">Aktiva projekt</SelectItem>
                            <SelectItem value="leads">Leads</SelectItem>
                            <SelectItem value="arkiverade">Arkiverade</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <h2 className="text-sm font-medium text-zinc-400">
                    Kunder <span className="text-zinc-600">({filtered.length})</span>
                </h2>

                {loading ? (
                    <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-20 rounded-lg bg-card/30 animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <Card className="border-border/50">
                        <CardContent className="p-12 text-center">
                            <Users className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
                            <p className="text-sm text-zinc-400">Inga kunder matchar filtret</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {filtered.map(customer => {
                            const statusSummary = getStatusSummary(customer.companies);
                            return (
                                <Card
                                    key={customer.id}
                                    className="border-border/40 bg-card/30 backdrop-blur-sm hover:border-primary/25 hover:bg-card/50 transition-all cursor-pointer"
                                    onClick={() => setModalCustomerId(customer.id)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="font-medium text-sm">{customer.full_name}</span>
                                                    {(customer.companies || []).length > 0 && (
                                                        <span className="flex items-center gap-1 text-xs text-zinc-500">
                                                            <Building2 className="h-3 w-3" />
                                                            {customer.companies.length === 1
                                                                ? customer.companies[0].name
                                                                : `${customer.companies.length} företag`}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {statusSummary.length > 0 ? (
                                                        statusSummary.map(([status, count]) => (
                                                            <span
                                                                key={status}
                                                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border ${STATUS_COLORS[status] || ''}`}
                                                            >
                                                                {count > 1 ? `${count}× ` : ''}{status}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-zinc-600">Inga projekt</span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-zinc-600 shrink-0" />
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* ── Customer detail modal ── */}
            <Dialog open={!!modalCustomerId} onOpenChange={open => !open && setModalCustomerId(null)}>
                <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 border-primary/15 shadow-[0_0_80px_rgba(8,146,90,0.18),0_0_160px_rgba(8,146,90,0.08),0_16px_64px_rgba(0,0,0,0.6)]">
                    <div className="overflow-y-auto flex-1 px-6 pb-6 pt-6">
                        {modalCustomerId && (
                            <CustomerDetailPanel
                                customerId={modalCustomerId}
                                showBackButton={false}
                                onDeleted={() => setModalCustomerId(null)}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
