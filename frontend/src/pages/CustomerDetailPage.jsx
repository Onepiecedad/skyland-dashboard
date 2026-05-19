import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomerDetailPanel } from './CustomerDetailPanel';
import { DashboardShell } from '../components/DashboardShell';

export function CustomerDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <DashboardShell contentClassName="max-w-6xl mx-auto px-4 py-6">
            <CustomerDetailPanel
                customerId={id}
                showBackButton
                onDeleted={() => navigate('/customers')}
            />
        </DashboardShell>
    );
}
