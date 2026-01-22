'use client';

import { Order } from '@/domain/model/order.model';
import { createBillingContext } from '@/services/billing.service';
import { Loader2, Package, Users, X } from 'lucide-react';
import { useState } from 'react';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOrders: Order[];
    onSuccess: () => void;
}

export default function CreateGroupModal({
    isOpen,
    onClose,
    selectedOrders,
    onSuccess,
}: CreateGroupModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('Group name is required');
            return;
        }

        if (selectedOrders.length < 2) {
            setError('At least 2 orders are required to create a group');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await createBillingContext({
                type: 'GROUP',
                name: name.trim(),
                description: description.trim() || undefined,
                orderIds: selectedOrders.map((o) => o.id),
            });

            onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to create billing group:', err);
            setError(err instanceof Error ? err.message : 'Failed to create group');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setName('');
            setDescription('');
            setError(null);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-xl">
                            <Users className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Create Billing Group</h2>
                            <p className="text-sm text-gray-500">Group {selectedOrders.length} orders together</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
                    {/* Type Badge */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">Type:</span>
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-full">
                            GROUP
                        </span>
                    </div>

                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Group Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., January 2026 Batch"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                            disabled={isSubmitting}
                            autoFocus
                        />
                    </div>

                    {/* Description Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description <span className="text-gray-400">(optional)</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add notes about this billing group..."
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Selected Orders Preview */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selected Orders ({selectedOrders.length})
                        </label>
                        <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto">
                            {selectedOrders.map((order) => (
                                <div
                                    key={order.id}
                                    className="flex items-center gap-3 p-3 border-b border-gray-100 last:border-b-0"
                                >
                                    <div className="p-1.5 bg-gray-100 rounded-lg">
                                        <Package className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-800 truncate">{order.code}</p>
                                        <p className="text-xs text-gray-500 truncate">{order.customer?.name}</p>
                                    </div>
                                    <span className="text-xs text-gray-400">Qty: {order.quantity}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 text-gray-700 font-medium border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !name.trim() || selectedOrders.length < 2}
                        className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Users className="w-4 h-4" />
                                Create Group
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
