'use client';

import { useAuth } from '@/auth/AuthProvider';
import RunCard from '@/components/runs/RunCard';
import { getRuns } from '@/services/run.service';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ManagerRunsPage() {
    const { user } = useAuth();
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRuns = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            // Fetch runs where user is Assigned (Executor OR Reviewer)
            // Backend was updated to support 'assignedUserId' in the service/DTO
            const res = await getRuns({
                assignedUserId: user.id
            });
            setRuns(res.runs);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuns();
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
            <h1 className="text-xl font-bold mb-6">My Assigned Runs</h1>

            {runs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-lg border border-dashed border-gray-300">
                    <p className="text-gray-500">No runs assigned to you.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {runs.map((run) => (
                        <div key={run.id} className="h-[300px]">
                            <RunCard run={run} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
