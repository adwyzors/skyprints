'use client';

import {
    Calendar,
    FileText,
    Grid,
    Hash,
    IndianRupee,
    Package,
    Palette,
    Ruler,
    Save,
    Type,
    User,
    X
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { apiRequest } from "@/services/api.service";
import { configureRun } from '@/services/run.service';
import { getManagers, User as ManagerUser } from '@/services/user.service';

interface RunConfigFormProps {
    runId: string;
    runNumber: number;
    displayName: string;
    processId: string;
    orderId: string;
    orderQuantity: number;
    initialValues: Record<string, any>;
    fieldDefinitions: Array<{ key: string; required?: boolean; type?: string }>;
    initialExecutor?: { id: string; name: string } | null;
    initialReviewer?: { id: string; name: string } | null;
    onSaveSuccess: () => void;
    onCancel: () => void;
}

// Field icon mapping
const getFieldIcon = (fieldName: string) => {
    const lowerField = fieldName.toLowerCase();

    if (lowerField.includes('date')) return <Calendar className="w-3 h-3" />;
    if (lowerField.includes('job') || lowerField.includes('number'))
        return <Hash className="w-3 h-3" />;
    if (lowerField.includes('party') || lowerField.includes('customer'))
        return <User className="w-3 h-3" />;
    if (lowerField.includes('particular') || lowerField.includes('design'))
        return <FileText className="w-3 h-3" />;
    if (lowerField.includes('color')) return <Palette className="w-3 h-3" />;
    if (lowerField.includes('size') || lowerField.includes('area') || lowerField.includes('farma'))
        return <Ruler className="w-3 h-3" />;
    if (lowerField.includes('quantity')) return <Package className="w-3 h-3" />;
    if (lowerField.includes('amount') || lowerField.includes('rate') || lowerField.includes('price'))
        return <IndianRupee className="w-3 h-3" />;
    if (lowerField.includes('type')) return <Type className="w-3 h-3" />;
    return <Grid className="w-3 h-3" />;
};

const prettyLabel = (field: string) =>
    field
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase());

// Improved Manager Select
const SearchableManagerSelect = ({
    label,
    valueId,
    onChange,
    users
}: {
    label: string;
    valueId?: string;
    onChange: (id: string) => void;
    users: ManagerUser[];
}) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (valueId) {
            const u = users.find(u => u.id === valueId);
            if (u) setSearch(u.name);
        } else {
            setSearch('');
        }
    }, [valueId, users]);

    const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="relative">
            <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
            <input
                type="text"
                value={search}
                onFocus={() => setIsOpen(true)}
                onChange={(e) => {
                    setSearch(e.target.value);
                    setIsOpen(true);
                    if (e.target.value === '') onChange('');
                }}
                onBlur={() => {
                    setTimeout(() => setIsOpen(false), 200);
                }}
                placeholder={`Search ${label}...`}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {isOpen && filtered.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded shadow-lg max-h-40 overflow-y-auto">
                    {filtered.map(u => (
                        <div
                            key={u.id}
                            className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer text-gray-700"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onChange(u.id);
                                setSearch(u.name);
                                setIsOpen(false);
                            }}
                        >
                            {u.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function RunConfigForm({
    runId,
    runNumber,
    displayName,
    processId,
    orderId,
    orderQuantity,
    initialValues,
    fieldDefinitions,
    initialExecutor,
    initialReviewer,
    onSaveSuccess,
    onCancel
}: RunConfigFormProps) {
    const [values, setValues] = useState<Record<string, any>>(initialValues || {});
    // Merge initial values with empty strings for all fields to ensure controlled inputs
    useEffect(() => {
        const merged = { ...values };
        fieldDefinitions.forEach(f => {
            if (merged[f.key] === undefined) {
                merged[f.key] = '';
            }
        });
        setValues(merged);
    }, []); // Run once on mount

    const [executorId, setExecutorId] = useState<string>(initialExecutor?.id || '');
    const [reviewerId, setReviewerId] = useState<string>(initialReviewer?.id || '');

    // Image state
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]); // New uploads
    const [existingImages, setExistingImages] = useState<string[]>(initialValues.images || []);

    const [managers, setManagers] = useState<ManagerUser[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getManagers().then(setManagers).catch(console.error);
    }, []);

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const fileArray = Array.from(files);

        if (existingImages.length + images.length + fileArray.length > 2) {
            alert('Maximum 2 photos allowed per run');
            return;
        }

        // Processing (Compression) logic...
        try {
            const compressedFilesPromises = fileArray.map(async (file) => {
                const options = {
                    maxSizeMB: 0.1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    fileType: 'image/webp',
                    initialQuality: 0.8,
                };

                try {
                    const imageCompression = (await import('browser-image-compression')).default;
                    const compressedBlob = await imageCompression(file, options);
                    return new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                        type: 'image/webp',
                        lastModified: Date.now(),
                    });
                } catch {
                    return file;
                }
            });

            const compressedFiles = await Promise.all(compressedFilesPromises);
            setImages(prev => [...prev, ...compressedFiles]);

            // Previews
            compressedFiles.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreviews(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });

        } catch (err) {
            console.error("Image processing error", err);
            setError('Failed to process images');
        }
    };

    const removeNewImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingImage = (index: number) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const updateField = (field: string, value: string) => {
        setValues(prev => {
            const fieldDef = fieldDefinitions.find(f => f.key === field);
            let typedValue: string | number | null = value;

            if (fieldDef?.type === 'number' && value !== '') {
                typedValue = Number(value);
                if (isNaN(typedValue)) typedValue = value;
            }

            const newValues = { ...prev, [field]: typedValue };

            // Auto-calculate
            if (field === 'Estimated Rate' || field === 'Quantity') {
                const rate = field === 'Estimated Rate' ? typedValue : prev['Estimated Rate'];
                const qty = field === 'Quantity' ? typedValue : prev['Quantity'];

                if (typeof rate === 'number' && typeof qty === 'number') {
                    newValues['Estimated Amount'] = rate * qty;
                }
            }
            return newValues;
        });
    };

    const handleSave = async () => {
        // Validate required fields
        const missingFields = fieldDefinitions
            .filter(f => f.required && f.key !== 'Estimated Amount')
            .filter(f => {
                const v = values[f.key];
                return v === null || v === undefined || v === '';
            });

        if (missingFields.length > 0) {
            alert(`Please fill required fields: ${missingFields.map(f => prettyLabel(f.key)).join(', ')}`);
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            // Upload images
            const imageUrls: string[] = [...existingImages];

            if (images.length > 0) {
                const uploadPromises = images.map(async (file) => {
                    const { uploadUrl, publicUrl } = await apiRequest<{ uploadUrl: string; publicUrl: string }>(
                        `/orders/upload-url?filename=${encodeURIComponent(file.name)}`
                    );
                    await fetch(uploadUrl, {
                        method: 'PUT',
                        body: file,
                        headers: { 'Content-Type': file.type },
                    });
                    return publicUrl;
                });
                const uploaded = await Promise.all(uploadPromises);
                imageUrls.push(...uploaded);
            }

            // Prepare API values
            const apiValues: Record<string, string | number | boolean> = {};
            // We need to send ALL fields, not just those in definitions, or just definitions? 
            // Usually just definition keys + any extras logic.
            // We'll iterate definitions to be safe and typed.

            Object.entries(values).forEach(([key, value]) => {
                if (value === null || value === undefined) return;

                // If it's empty string, check if it's supposed to be number? 
                // But we already typed it in updateField.
                // Just send it.
                if (value === '' && typeof value === 'string') return;

                apiValues[key] = value as any;
            });

            // Ensure estimated amount is there
            if (apiValues['Estimated Amount'] === undefined && values['Estimated Amount']) {
                apiValues['Estimated Amount'] = values['Estimated Amount'];
            }

            const response = await configureRun(
                orderId,
                processId,
                runId,
                apiValues,
                imageUrls,
                executorId || undefined,
                reviewerId || undefined
            );

            if (response && response.success) {
                onSaveSuccess();
            } else {
                throw new Error('Failed to save configuration');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    // Group fields
    const groupFieldsIntoPairs = (fields: any[]) => {
        const pairs = [];
        for (let i = 0; i < fields.length; i += 2) {
            pairs.push([fields[i], fields[i + 1]]);
        }
        return pairs;
    };

    // Filter definitions to show in form (exclude hidden ones if any, or auto-calc)
    // We show 'Estimated Amount' as read-only usually or at the end. 
    // EmbellishmentConfig shows it in the grid.

    const relevantFields = fieldDefinitions.filter(f => !['New Rate', 'New Amount'].includes(f.key));
    const pairs = groupFieldsIntoPairs(relevantFields);

    return (
        <div className="bg-gray-50 border boyrder-gray-300 rounded p-4">
            <div className="mb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                        <h3 className="font-semibold text-base">Configure {displayName} #{runNumber}</h3>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <SearchableManagerSelect
                        label="Executor"
                        users={managers}
                        valueId={executorId}
                        onChange={setExecutorId}
                    />
                    <SearchableManagerSelect
                        label="Reviewer"
                        users={managers}
                        valueId={reviewerId}
                        onChange={setReviewerId}
                    />
                </div>

                <div className="border border-gray-300 rounded overflow-hidden bg-white">
                    {pairs.map((pair, rowIndex) => (
                        <div key={rowIndex} className="grid grid-cols-4 border-b last:border-b-0 divide-x divide-gray-300">
                            {pair.map((fieldDef: any) => {
                                if (!fieldDef) return null;
                                const field = fieldDef.key;
                                const isRequired = fieldDef.required;
                                const type = fieldDef.type || 'string';
                                const value = values[field] ?? '';
                                const isReadOnly = field === 'Estimated Amount';

                                return (
                                    <React.Fragment key={field}>
                                        <div className="bg-gray-50 p-2 flex items-center">
                                            <div className="flex items-center gap-1.5">
                                                {getFieldIcon(field)}
                                                <label className="text-xs font-medium text-gray-700">
                                                    {prettyLabel(field)}
                                                    {field === 'Quantity' && (
                                                        <span className="text-blue-600 ml-1 font-normal">
                                                            (Order: {orderQuantity})
                                                        </span>
                                                    )}
                                                    {isRequired && !isReadOnly && <span className="text-red-500 ml-0.5">*</span>}
                                                </label>
                                            </div>
                                        </div>
                                        <div className="p-2 bg-white">
                                            {isReadOnly ? (
                                                <div className="px-2 py-1.5 text-sm font-medium text-gray-700">
                                                    {typeof value === 'number' ? `₹${value.toLocaleString()}` : value || '-'}
                                                </div>
                                            ) : (
                                                <input
                                                    type={type === 'number' ? 'number' : 'text'}
                                                    value={value}
                                                    onChange={(e) => updateField(field, e.target.value)}
                                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                    placeholder={`Enter ${prettyLabel(field)}`}
                                                />
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                            {pair.length === 1 && (
                                <>
                                    <div className="bg-gray-50 p-2"></div>
                                    <div className="p-2 bg-white"></div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {/* Images */}
                <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Reference Images (Max 2)</label>
                        <span className="text-xs text-gray-500">
                            {existingImages.length + images.length}/2
                        </span>
                    </div>

                    <div className="flex gap-4">
                        {/* Existing Images */}
                        {existingImages.map((url, i) => (
                            <div key={`existing-${i}`} className="relative group w-24 h-24 border rounded overflow-hidden">
                                <img src={url} alt="Ref" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => removeExistingImage(i)}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        {/* New Previews */}
                        {previews.map((url, i) => (
                            <div key={`new-${i}`} className="relative group w-24 h-24 border rounded overflow-hidden">
                                <img src={url} alt="Preview" className="w-full h-full object-cover opacity-80" />
                                <button
                                    onClick={() => removeNewImage(i)}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}

                        {existingImages.length + images.length < 2 && (
                            <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                                <div className="text-center">
                                    <span className="text-2xl text-gray-400">+</span>
                                    <span className="block text-xs text-gray-500 mt-1">Add Photo</span>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={handleImageSelect}
                                />
                            </label>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-8 flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Configuration
                            </>
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-100 text-center">
                        {error}
                    </div>
                )}

            </div>
        </div>
    );
}
