import { supabase } from '../supabase';

export async function fetchCustomerDetail(customerId) {
    const [customerRes, companiesRes, prospectsRes, activityRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', customerId).single(),
        supabase
            .from('companies')
            .select('*, projects (*)')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: true }),
        supabase
            .from('prospects')
            .select('id, name, email, company, message, score, status, created_at')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false }),
        supabase
            .from('activity_log')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(50),
    ]);

    if (customerRes.error) throw customerRes.error;
    if (companiesRes.error) throw companiesRes.error;
    if (prospectsRes.error) throw prospectsRes.error;
    if (activityRes.error) throw activityRes.error;

    const prospects = prospectsRes.data || [];
    const prospectIds = prospects.map((prospect) => prospect.id).filter(Boolean);
    const voiceQueries = [
        supabase
            .from('voice_calls')
            .select('id, session_uuid, prospect_id, customer_id, summary, transcript, duration_seconds, started_at, ended_at, recording_url, call_source, created_at')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false }),
    ];

    if (prospectIds.length > 0) {
        voiceQueries.push(
            supabase
                .from('voice_calls')
                .select('id, session_uuid, prospect_id, customer_id, summary, transcript, duration_seconds, started_at, ended_at, recording_url, call_source, created_at')
                .in('prospect_id', prospectIds)
                .order('created_at', { ascending: false })
        );
    }

    const voiceResults = await Promise.all(voiceQueries);
    const voiceCallsById = {};

    voiceResults.forEach((result) => {
        if (result.error) throw result.error;
        (result.data || []).forEach((voiceCall) => {
            voiceCallsById[voiceCall.id] = voiceCall;
        });
    });

    return {
        customer: customerRes.data,
        companies: companiesRes.data || [],
        prospects,
        activityLog: activityRes.data || [],
        voiceCalls: Object.values(voiceCallsById).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    };
}

export async function insertActivityLog(customerId, action, description, opts = {}) {
    const { error } = await supabase.from('activity_log').insert({
        action,
        description,
        customer_id: customerId,
        company_id: opts.company_id || null,
        project_id: opts.project_id || null,
        actor: 'user',
        metadata: opts.metadata || {},
    });

    if (error) throw error;
}

export async function updateCustomerField(customerId, field, value) {
    const { error } = await supabase.from('customers').update({ [field]: value }).eq('id', customerId);
    if (error) throw error;
}

export async function updateCompanyField(companyId, field, value) {
    const { error } = await supabase.from('companies').update({ [field]: value }).eq('id', companyId);
    if (error) throw error;
}

export async function updateProjectField(projectId, field, value) {
    const { error } = await supabase.from('projects').update({ [field]: value }).eq('id', projectId);
    if (error) throw error;
}

export async function createCompany(customerId, payload) {
    const { data, error } = await supabase
        .from('companies')
        .insert({ customer_id: customerId, ...payload })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function createProject(payload) {
    const { data, error } = await supabase
        .from('projects')
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteProject(projectId) {
    const { data, error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .select('id');

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Projekt kunde inte raderas');
}

export async function deleteCompany(companyId) {
    const { data, error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId)
        .select('id');

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Företag kunde inte raderas');
}

export async function deleteCustomer(customerId) {
    const { data, error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)
        .select('id');

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Kund kunde inte raderas');
}
