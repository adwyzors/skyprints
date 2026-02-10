'use client';

import { Location } from '@/domain/model/location.model';
import { createLocation, updateLocation } from '@/services/location.service';
import { CreateLocationDto } from '@app/contracts';
import { Loader2, MapPin, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface LocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    location?: Location; // If provided, we are in edit mode
}

export default function LocationModal({
    isOpen,
    onClose,
    onSuccess,
    location
}: LocationModalProps) {
    const isEditMode = !!location;

    const [formData, setFormData] = useState<CreateLocationDto>({
        name: '',
        code: '',
        description: '',
        type: 'WORKSTATION',
        isActive: true,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize form data when location prop changes
    useEffect(() => {
        if (location) {
            setFormData({
                name: location.name,
                code: location.code,
                description: location.description || '',
                type: location.type,
                isActive: location.isActive,
            });
        } else {
            // Reset for create mode
            setFormData({
                name: '',
                code: '',
                description: '',
                type: 'WORKSTATION',
                isActive: true,
            });
        }
        setError(null);
    }, [location, isOpen]);

    if (!isOpen) return null;

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

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

        setIsSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                description: formData.description || undefined,
            };

            if (isEditMode && location) {
                await updateLocation(location.id, dataToSubmit);
            } else {
                await createLocation(dataToSubmit);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(isEditMode ? 'Failed to update location:' : 'Failed to create location:', err);
            setError(err.message || (isEditMode ? 'Failed to update location' : 'Failed to create location'));
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
                        <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold">{isEditMode ? 'Edit Location' : 'Add New Location'}</h2>
                    <p className="text-blue-100 text-xs mt-0.5">
                        {isEditMode ? 'Update location details below' : 'Enter location details below'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">Code <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="code"
                                placeholder="LOC-001"
                                value={formData.code}
                                onChange={handleChange}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm uppercase"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="name"
                                placeholder="e.g. Mixing Station"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700">Type</label>
                        <select
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        >
                            <option value="WORKSTATION">Workstation</option>
                            <option value="WAREHOUSE">Warehouse</option>
                            <option value="OFFICE">Office</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>


                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-700">Description (Optional)</label>
                        <textarea
                            name="description"
                            placeholder="Location details..."
                            value={formData.description || ''}
                            onChange={handleChange}
                            rows={3}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm resize-none"
                        />
                    </div>

                    <div className="pt-1">
                        <label className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                                type="checkbox"
                                name="isActive"
                                checked={formData.isActive || false}
                                onChange={handleChange}
                                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs font-medium text-gray-700">Active</span>
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
                                isEditMode ? 'Update Location' : 'Create Location'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
