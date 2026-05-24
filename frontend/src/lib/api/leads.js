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
    const voiceCallsMap = {};

    if (sessionUuids.length > 0) {
        const [{ data: interactions, error: interactionsError }, { data: voiceCalls, error: voiceCallsError }] = await Promise.all([
            supabase
                .from('interactions')
                .select('session_uuid, payload')
                .eq('type', 'form')
                .in('session_uuid', sessionUuids),
            supabase
                .from('voice_calls')
                .select('id, session_uuid, summary, transcript, duration_seconds, started_at, ended_at, recording_url, call_source, created_at, extracted_data')
                .in('session_uuid', sessionUuids)
                .order('created_at', { ascending: false }),
        ]);

        if (interactionsError) throw interactionsError;
        if (voiceCallsError) throw voiceCallsError;

        (interactions || []).forEach((interaction) => {
            interactionsMap[interaction.session_uuid] = interaction.payload;
        });

        (voiceCalls || []).forEach((voiceCall) => {
            if (!voiceCallsMap[voiceCall.session_uuid]) {
                voiceCallsMap[voiceCall.session_uuid] = voiceCall;
            }
        });
    }

    return (prospects || []).map((prospect) => ({
        ...prospect,
        ai_response: interactionsMap[prospect.session_uuid]?.ai_response || null,
        similarity: interactionsMap[prospect.session_uuid]?.best_match_similarity || null,
        source: prospect.source || interactionsMap[prospect.session_uuid]?.source || null,
        latest_voice_call: voiceCallsMap[prospect.session_uuid] || null,
    }));
}

export async function fetchUnlinkedVoiceCalls() {
    const { data, error } = await supabase
        .from('voice_calls')
        .select('id, session_uuid, provider, external_call_id, call_source, started_at, ended_at, duration_seconds, transcript, summary, recording_url, created_at, extracted_data')
        .is('prospect_id', null)
        .is('customer_id', null)
        .order('created_at', { ascending: false })
        .limit(25);

    if (error) throw error;
    return data || [];
}

export async function updateLeadStatus(leadId, status) {
    const { data: prospect, error: fetchError } = await supabase
        .from('prospects')
        .select('customer_id')
        .eq('id', leadId)
        .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase.from('prospects').update({ status }).eq('id', leadId);
    if (error) throw error;

    if (prospect?.customer_id) {
        await supabase.from('activity_log').insert({
            action: 'lead_status_changed',
            description: `Leadstatus → ${status}`,
            customer_id: prospect.customer_id,
            actor: 'user',
            metadata: { prospect_id: leadId, status },
        });
    }
}

export async function deleteLead(leadId) {
    const { data, error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', leadId)
        .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error('Lead kunde inte raderas');
    }
}

export async function deleteLeads(leadIds) {
    const { data, error } = await supabase
        .from('prospects')
        .delete()
        .in('id', leadIds)
        .select('id');

    if (error) throw error;
    if (!data || data.length !== leadIds.length) {
        throw new Error('Alla leads kunde inte raderas');
    }
}

export async function deleteVoiceCall(callId) {
    const { data, error } = await supabase
        .from('voice_calls')
        .delete()
        .eq('id', callId)
        .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error('Röstsamtal kunde inte raderas');
    }
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
