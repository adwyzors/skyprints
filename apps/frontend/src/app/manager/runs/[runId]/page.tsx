'use client';

import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import ViewRunModal from '@/components/modals/ViewRunModal';
import { useRouter } from 'next/navigation';

function ManagerRunDetailPage({ params }: { params: { runId: string } }) {
    const router = useRouter();

    return (
        <ViewRunModal
            runId={params.runId}
            onClose={() => router.push('/manager/runs')}
            onRunUpdate={() => router.push('/manager/runs')}
        />
    );
}

export default withAuth(ManagerRunDetailPage, { permission: Permission.RUNS_VIEW });
