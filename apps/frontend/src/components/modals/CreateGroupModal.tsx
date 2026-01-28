'use client';

import { Order } from '@/domain/model/order.model';
import { createBillingContext } from '@/services/billing.service';
import { Loader2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

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

  // Auto-generate details when modal opens
  useEffect(() => {
    if (isOpen) {
      const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
      const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      setName(`Bill-${randomCode}`);
      setDescription(`Created on ${dateStr}`);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

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
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white text-center">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Create Invoice</h2>
          <p className="text-indigo-100 text-sm mt-1">Invoicing {selectedOrders.length} orders</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Auto-generated Info Card */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 font-medium">Invoice ID</span>
              <span className="text-sm font-mono font-bold text-gray-800 bg-white px-2 py-1 rounded border border-gray-200">
                {name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 font-medium">Description</span>
              <span className="text-sm text-gray-700">{description}</span>
            </div>
          </div>

          {/* Orders Preview (Compact) */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Included Orders
            </div>
            <div className="flex -space-x-2 overflow-hidden py-1 gap-3">
              {selectedOrders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  title={order.code}
                  className="
                    inline-flex items-center justify-center
                    px-3 h-8
                    rounded-full
                    bg-white/90
                    border border-gray-200
                    shadow-sm
                    text-xs font-semibold text-gray-600
                    tracking-wide
                    hover:bg-gray-50
                    hover:shadow
                    transition

                "
                >
                  {order.code}
                </div>
              ))}
              {selectedOrders.length > 5 && (
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 border-2 border-white shadow-sm text-xs font-medium text-gray-500">
                  +{selectedOrders.length - 5}
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-center">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              'Create Invoice'
            )}
          </button>

          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
