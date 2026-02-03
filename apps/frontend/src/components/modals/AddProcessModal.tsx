'use client';

import { ProcessSummary } from '@/domain/model/process.model';
import { addProcessToOrder } from '@/services/orders.service';
import { getProcesses } from '@/services/process.service';
import { useEffect, useState } from 'react';

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    orderId: string;
}

export default function AddProcessModal({ open, onClose, onSuccess, orderId }: Props) {
    const [processes, setProcesses] = useState<ProcessSummary[]>([]);
    const [selectedProcessId, setSelectedProcessId] = useState('');
    const [count, setCount] = useState(1);
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setDataLoading(true);
            getProcesses()
                .then(setProcesses)
                .catch((err) => {
                    console.error(err);
                    setError('Failed to load processes');
                })
                .finally(() => setDataLoading(false));
        } else {
            // Reset state on close
            setSelectedProcessId('');
            setCount(1);
            setError(null);
        }
    }, [open]);

    const handleSubmit = async () => {
        if (!selectedProcessId) {
            setError('Please select a process');
            return;
        }
        if (count <= 0) {
            setError('Count must be greater than 0');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await addProcessToOrder(orderId, {
                processId: selectedProcessId,
                count: count,
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            let errorMessage = err.message || 'Failed to add process';

            // Attempt to extract friendly message from API error
            // Format is usually: "API Error <status>: <json_response>"
            if (errorMessage.includes('API Error')) {
                try {
                    const jsonMatch = errorMessage.match(/API Error \d+: (.+)/);
                    if (jsonMatch && jsonMatch[1]) {
                        const parsed = JSON.parse(jsonMatch[1]);
                        if (parsed.message) {
                            errorMessage = parsed.message;
                        }
                    }
                } catch (e) {
                    // Conversion failed, fallback to original message
                }
            }

            setError(errorMessage);
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">Add Process</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 px-2 text-2xl"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {dataLoading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-gray-500">Loading processes...</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Process</label>
                                <select
                                    value={selectedProcessId}
                                    onChange={(e) => setSelectedProcessId(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    <option value="">Select a process...</option>
                                    {processes.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Count (Runs)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={count}
                                    onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || dataLoading || !selectedProcessId}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                        {loading ? 'Adding...' : 'Add Process'}
                    </button>
                </div>
            </div>
        </div>
    );
}
