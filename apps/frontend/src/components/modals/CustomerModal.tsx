'use client';

import { Customer } from '@/domain/model/customer.model';
import { createCustomer, updateCustomer } from '@/services/customer.service';
import { CreateCustomerDto } from '@app/contracts';
import { ClipboardPaste, Loader2, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface CustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    customer?: Customer; // If provided, we are in edit mode
}

// The order fields are filled from a pasted Excel row (left → right)
const PASTE_FIELD_ORDER: (keyof CreateCustomerDto)[] = [
    'code', 'name', 'email', 'phone', 'address', 'gstno', 'creditLimit', 'outstandingAmount'
];

const PASTE_FIELD_LABELS: Record<string, string> = {
    code: 'Code',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    gstno: 'GST No',
    creditLimit: 'Credit Limit',
    outstandingAmount: 'Outstanding',
};

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
        creditLimit: 0,
        outstandingAmount: 0,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pasteSuccess, setPasteSuccess] = useState<string | null>(null);
    const pasteToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                creditLimit: customer.creditLimit || 0,
                outstandingAmount: customer.outstandingAmount || 0,
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
                creditLimit: 0,
                outstandingAmount: 0,
            });
        }
        setError(null);
        setPasteSuccess(null);
    }, [customer, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : type === 'number' ? (value === '' ? 0 : Number(value)) : value
        }));
    };

    // ─── Paste-to-Fill ────────────────────────────────────────────────────────
    const handlePaste = (e: React.ClipboardEvent<HTMLFormElement>) => {
        // Only intercept when the target is NOT an individual input/textarea
        // (so normal typing/paste in a focused field still works)
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        const text = e.clipboardData.getData('text');
        if (!text.includes('\t') && !text.includes('\n')) return; // Not TSV — ignore

        e.preventDefault();

        // Take the first row only
        const firstRow = text.split('\n')[0].replace(/\r$/, '');
        const columns = firstRow.split('\t');

        if (columns.length === 0) return;

        const updates: Partial<CreateCustomerDto> = {};
        let filled = 0;

        columns.forEach((rawValue, idx) => {
            const fieldKey = PASTE_FIELD_ORDER[idx];
            if (!fieldKey) return;

            const value = rawValue.trim();
            if (value === '') return;

            const numericFields: (keyof CreateCustomerDto)[] = ['creditLimit', 'outstandingAmount'];
            if (numericFields.includes(fieldKey)) {
                const num = Number(value.replace(/,/g, '')); // strip commas (e.g. "1,00,000")
                if (!isNaN(num)) {
                    (updates as any)[fieldKey] = num;
                    filled++;
                }
            } else {
                (updates as any)[fieldKey] = value;
                filled++;
            }
        });

        if (filled === 0) return;

        setFormData(prev => ({ ...prev, ...updates }));

        const fieldNames = Object.keys(updates)
            .map(k => PASTE_FIELD_LABELS[k] ?? k)
            .join(', ');

        // Clear any existing toast timer
        if (pasteToastRef.current) clearTimeout(pasteToastRef.current);
        setPasteSuccess(`✓ Filled ${filled} field${filled > 1 ? 's' : ''}: ${fieldNames}`);
        pasteToastRef.current = setTimeout(() => setPasteSuccess(null), 3500);
    };
    // ─────────────────────────────────────────────────────────────────────────

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

                {/* Paste-to-fill hint */}
                <div className="px-5 pt-3">
                    <div className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                        <ClipboardPaste className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-blue-700">Paste to Fill</p>
                            <p className="text-[10px] text-blue-500 leading-relaxed mt-0.5">
                                Copy a row from Excel &amp; press <kbd className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[9px]">Ctrl+V</kbd> anywhere on this form (not inside a field)
                            </p>
                            <p className="text-[10px] text-blue-400 mt-1 font-mono truncate">
                                {PASTE_FIELD_ORDER.map(k => PASTE_FIELD_LABELS[k]).join(' → ')}
                            </p>
                        </div>
                    </div>

                    {/* Paste success toast */}
                    {pasteSuccess && (
                        <div className="mt-2 flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-xs text-green-700 font-medium">{pasteSuccess}</p>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} onPaste={handlePaste} className="p-5 space-y-3">
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
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">Credit Limit (0 = Unlimited)</label>
                            <input
                                type="number"
                                name="creditLimit"
                                placeholder="0"
                                value={formData.creditLimit}
                                onChange={handleChange}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                            />
                        </div>
                        {isEditMode && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-700">Outstanding Amount</label>
                                <input
                                    type="number"
                                    name="outstandingAmount"
                                    placeholder="0"
                                    value={formData.outstandingAmount}
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
