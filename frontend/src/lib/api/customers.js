import { supabase } from '../supabase';

export async function fetchCustomers() {
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
    return data || [];
}
