'use client';

import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import ManagerRunModal from '@/components/modals/ManagerRunModal';
import { useRouter } from 'next/navigation';

function ManagerRunDetailPage({ params }: { params: { runId: string } }) {
    const router = useRouter();

    return (
        <ManagerRunModal
            runId={params.runId}
            onClose={() => router.push('/manager/runs')}
            onTransitionComplete={() => router.push('/manager/runs')}
        />
    );
}

export default withAuth(ManagerRunDetailPage, { permission: Permission.RUNS_VIEW });
