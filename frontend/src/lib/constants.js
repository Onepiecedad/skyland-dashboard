export const LEAD_STATUS_CONFIG = {
    ny:        { label: 'Ny',        color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    kontaktad: { label: 'Kontaktad', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    bokad:     { label: 'Bokad',     color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    förlorad:  { label: 'Förlorad',  color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    arkiverad: { label: 'Arkiverad', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

export const PROJECT_STATUS_CONFIG = {
    'lead':      { label: 'Lead',      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    'pågående':  { label: 'Pågående',  color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    'levererat': { label: 'Levererat', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    'i drift':   { label: 'I drift',   color: 'bg-green-500/10 text-green-400 border-green-500/20' },
    'pausat':    { label: 'Pausat',    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    'avslutat':  { label: 'Avslutat', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

export const SOURCE_CONFIG = {
    facebook:     { label: 'Facebook Ads' },
    facebook_ads: { label: 'Facebook Ads' },
    hemsida:      { label: 'Hemsida' },
    website:      { label: 'Hemsida' },
    ai_agent:     { label: 'AI-agent' },
    email:        { label: 'E-post' },
    manual:       { label: 'Manuell' },
};

export const PROJECT_TYPES = [
    { value: 'ai-system',          label: 'AI-system' },
    { value: 'hemsida',            label: 'Hemsida' },
    { value: 'automation',         label: 'Automation' },
    { value: 'drift-och-säkerhet', label: 'Drift & säkerhet' },
    { value: 'konsultation',       label: 'Konsultation' },
];

export const INDUSTRIES = [
    'Bygg & Fastighet',
    'Hotell & Besöksnäring',
    'Livsmedel & Restaurang',
    'Skönhet & Välmående',
    'Tjänster & Konsult',
    'Handel & E-handel',
    'Vård & Omsorg',
    'Transport & Logistik',
    'Industri & Tillverkning',
    'Utbildning',
    'Övrigt',
];

export const TYPE_CONFIG = {
    'ai-system':          { label: 'AI-system',       color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
    'hemsida':            { label: 'Hemsida',          color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    'automation':         { label: 'Automation',       color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    'drift-och-säkerhet': { label: 'Drift & säkerhet', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    'konsultation':       { label: 'Konsultation',     color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
};

export const ACTIVITY_LABELS = {
    'customer_created':       'Kund skapad',
    'customer_updated':       'Kund uppdaterad',
    'company_created':        'Företag skapat',
    'company_deleted':        'Företag raderat',
    'company_updated':        'Företag uppdaterat',
    'project_created':        'Projekt skapat',
    'project_deleted':        'Projekt raderat',
    'project_status_changed': 'Projektstatus ändrad',
    'notes_updated':          'Anteckningar uppdaterade',
    'lead_status_changed':    'Leadstatus ändrad',
};
