'use client';

import { Customer } from '@/domain/model/customer.model';
import { createCustomer, updateCustomer } from '@/services/customer.service';
import { CreateCustomerDto } from '@app/contracts';
import { Loader2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    customer?: Customer; // If provided, we are in edit mode
}

export default function CustomerModal({
    isOpen,
    onClose,
    onSuccess,
    customer
}: CustomerModalProps) {
    const isEditMode = !!customer;

    const [formData, setFormData] = useState<CreateCustomerDto>({
        name: '',
        code: '',
        email: '',
        phone: '',
        address: '',
        gstno: '',
        tax: false,
        tds: false,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize form data when customer prop changes
    useEffect(() => {
        if (customer) {
            setFormData({
                name: customer.name,
                code: customer.code,
                email: customer.email || '',
                phone: customer.phone || '',
                address: customer.address || '',
                gstno: customer.gstno || '',
                tdsno: customer.tdsno ?? undefined,
                tax: !!customer.tax,
                tds: !!customer.tds,
            });
        } else {
            // Reset for create mode
            setFormData({
                name: '',
                code: `CUST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                email: '',
                phone: '',
                address: '',
                gstno: '',
                tdsno: undefined,
                tax: false,
                tds: false,
            });
        }
        setError(null);
    }, [customer, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.name || !formData.code) {
            setError('Name and Code are required.');
            return;
        }

        if (formData.tds && !formData.tdsno) {
            setError('TDS Number is required when TDS Deduction is enabled.');
            return;
        }

        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                email: formData.email || undefined,
                phone: formData.phone || undefined,
                address: formData.address || undefined
            };

            if (isEditMode && customer) {
                await updateCustomer(customer.id, dataToSubmit);
            } else {
                await createCustomer(dataToSubmit);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(isEditMode ? 'Failed to update customer:' : 'Failed to create customer:', err);
            setError(err.message || (isEditMode ? 'Failed to update customer' : 'Failed to create customer'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="bg-blue-600 p-4 text-white text-center relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 backdrop-blur-sm">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold">{isEditMode ? 'Edit Customer' : 'Add New Customer'}</h2>
                    <p className="text-blue-100 text-xs mt-0.5">
                        {isEditMode ? 'Update customer details below' : 'Enter customer details below'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">Code <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="code"
                                placeholder="CUST-001"
                                value={formData.code}
                                onChange={handleChange}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                placeholder="e.g. Acme Corp"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700">Email (Optional)</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="contact@acme.com"
                            value={formData.email || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700">Phone (Optional)</label>
                        <input
                            type="tel"
                            name="phone"
                            placeholder="+1 (555) 000-0000"
                            value={formData.phone || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700">Address (Optional)</label>
                        <input
                            type="text"
                            name="address"
                            placeholder="123 Business Rd, City"
                            value={formData.address || ''}
                            onChange={handleChange}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">GST No. (Optional)</label>
                            <input
                                type="text"
                                name="gstno"
                                placeholder="GSTIN"
                                value={formData.gstno || ''}
                                onChange={handleChange}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono uppercase text-sm"
                            />
                        </div>
                        {formData.tds && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700">TDS No</label>
                                <input
                                    type="number"
                                    name="tdsno"
                                    placeholder="123"
                                    value={formData.tdsno || ''}
                                    onChange={handleChange}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <label className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                                type="checkbox"
                                name="tax"
                                checked={formData.tax || false}
                                onChange={handleChange}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-gray-700">Tax Application</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                                type="checkbox"
                                name="tds"
                                checked={formData.tds || false}
                                onChange={handleChange}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-gray-700">TDS Deduction</span>
                        </label>
                    </div>

                    {error && (
                        <div className="p-2 bg-red-50 border border-red-100 rounded-lg text-center">
                            <p className="text-xs text-red-600 font-medium">{error}</p>
                        </div>
                    )}

                    <div className="pt-1 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md shadow-blue-200 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {isEditMode ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                isEditMode ? 'Update Customer' : 'Create Customer'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
