import { supabase } from '../supabase';

export async function fetchLeads(statusFilter = 'alla') {
    let query = supabase
        .from('prospects')
        .select('*')
        .order('created_at', { ascending: false });

    if (statusFilter !== 'alla') {
        query = query.eq('status', statusFilter);
    }

    const { data: prospects, error: prospectsError } = await query;
    if (prospectsError) throw prospectsError;

    const sessionUuids = (prospects || []).map((prospect) => prospect.session_uuid).filter(Boolean);
    const interactionsMap = {};

    if (sessionUuids.length > 0) {
        const { data: interactions, error: interactionsError } = await supabase
            .from('interactions')
            .select('session_uuid, payload')
            .eq('type', 'form')
            .in('session_uuid', sessionUuids);

        if (interactionsError) throw interactionsError;

        (interactions || []).forEach((interaction) => {
            interactionsMap[interaction.session_uuid] = interaction.payload;
        });
    }

    return (prospects || []).map((prospect) => ({
        ...prospect,
        ai_response: interactionsMap[prospect.session_uuid]?.ai_response || null,
        similarity: interactionsMap[prospect.session_uuid]?.best_match_similarity || null,
        source: prospect.source || interactionsMap[prospect.session_uuid]?.source || null,
    }));
}

export async function updateLeadStatus(leadId, status) {
    const { error } = await supabase.from('prospects').update({ status }).eq('id', leadId);
    if (error) throw error;
}

export async function deleteLead(leadId) {
    const { error } = await supabase.from('prospects').delete().eq('id', leadId);
    if (error) throw error;
}

export async function deleteLeads(leadIds) {
    const { error } = await supabase.from('prospects').delete().in('id', leadIds);
    if (error) throw error;
}

export async function convertLeadToCustomer(lead, form, projectTypes) {
    const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
            full_name: form.full_name.trim(),
            email: lead.email || null,
        })
        .select()
        .single();

    if (customerError) throw customerError;

    const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
            customer_id: customer.id,
            name: form.company_name.trim(),
            industry: form.industry || null,
        })
        .select()
        .single();

    if (companyError) throw companyError;

    const projectName = projectTypes.find((type) => type.value === form.project_type)?.label || form.project_type;

    const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
            company_id: company.id,
            name: projectName,
            project_type: form.project_type,
            status: 'lead',
        })
        .select()
        .single();

    if (projectError) throw projectError;

    const { error: prospectError } = await supabase
        .from('prospects')
        .update({ customer_id: customer.id })
        .eq('id', lead.id);

    if (prospectError) throw prospectError;

    const { error: activityError } = await supabase.from('activity_log').insert({
        action: 'customer_created',
        description: `Konverterad från prospect "${lead.name || lead.email}"`,
        customer_id: customer.id,
        company_id: company.id,
        project_id: project.id,
        actor: 'user',
        metadata: { prospect_id: lead.id },
    });

    if (activityError) throw activityError;

    return { customer, company, project };
}
