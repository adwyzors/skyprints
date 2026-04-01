'use client';

import { Order } from '@/domain/model/order.model';
import { createBillingContext } from '@/services/billing.service';
import { Loader2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrders: Order[];
  onSuccess: (group: { id: string }) => void;
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

    if (selectedOrders.length < 1) {
      setError('At least 1 order is required to create a group');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const hasTestOrder = selectedOrders.some((o) => o.isTest);

      const result = await createBillingContext({
        type: 'GROUP',
        name: name.trim(),
        description: description.trim() || undefined,
        orderIds: selectedOrders.map((o) => o.id),
        isTest: hasTestOrder,
      });

      onSuccess(result);
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

  const hasTestOrder = selectedOrders.some((o) => o.isTest);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`p-6 text-white text-center ${hasTestOrder ? 'bg-orange-600' : 'bg-indigo-600'}`}>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold">{hasTestOrder ? 'Create Test Invoice' : 'Create Invoice'}</h2>
          <p className={`${hasTestOrder ? 'text-orange-100' : 'text-indigo-100'} text-sm mt-1`}>
            Invoicing {selectedOrders.length} orders
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {hasTestOrder && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex flex-col items-center text-center">
              <span className="font-bold text-orange-800 text-sm">⚠️ Contains Test Orders</span>
              <p className="text-xs text-orange-700 mt-1">
                One or more selected orders are test orders. This will generate a <strong>Test Invoice</strong> (TESTR sequence).
                No real invoice can be prepared with a test order.
              </p>
            </div>
          )}
          
          {/* Auto-generated Info Card */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 font-medium">Invoice ID</span>
              <span className="text-sm font-mono font-bold text-gray-800 bg-white px-2 py-1 rounded border border-gray-200">
                Auto Generated
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
            className={`w-full py-3.5 font-bold rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              hasTestOrder 
                ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              hasTestOrder ? 'Create Test Invoice' : 'Create Invoice'
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
