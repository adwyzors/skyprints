'use client';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import RunCard from '@/components/runs/RunCard';
import { getRuns } from '@/services/run.service';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

function ManagerRunsPage() {
    const { user } = useAuth();
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRuns = async () => {
        setLoading(true);
        try {
            // Server enforces MANAGER scoping: executor-only, PRODUCTION stage, IN_PRODUCTION orders
            const res = await getRuns({});
            setRuns(res.runs);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.id) fetchRuns();
    }, [user?.id]);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="py-6">
            <h1 className="text-xl font-bold mb-6">My Production Runs</h1>

            {runs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-lg border border-dashed border-gray-300">
                    <p className="text-gray-500">No runs at PRODUCTION stage assigned to you.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {runs.map((run) => (
                        <div key={run.id} className="h-[340px]">
                            <RunCard
                                run={run}
                                context="manager"
                                onTransitionComplete={fetchRuns}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default withAuth(ManagerRunsPage, { permission: Permission.RUNS_VIEW });
