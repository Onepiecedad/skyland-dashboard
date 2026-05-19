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

    return {
        customer: customerRes.data,
        companies: companiesRes.data || [],
        prospects: prospectsRes.data || [],
        activityLog: activityRes.data || [],
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
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
}

export async function deleteCompany(companyId) {
    const { error } = await supabase.from('companies').delete().eq('id', companyId);
    if (error) throw error;
}

export async function deleteCustomer(customerId) {
    const { error } = await supabase.from('customers').delete().eq('id', customerId);
    if (error) throw error;
}
