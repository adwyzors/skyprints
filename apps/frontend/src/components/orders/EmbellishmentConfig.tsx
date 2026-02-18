import {
    AlertCircle,
    Calendar,
    CheckCircle,
    ChevronRight,
    Edit,
    Eye,
    FileText,
    Grid,
    Hash,
    IndianRupee,
    MapPin,
    Package,
    Palette,
    Plus,
    Ruler,
    Save,
    Trash2,
    Type,
    User,
    X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { Location } from '@/domain/model/location.model';
import { Order } from '@/domain/model/order.model';
import { ProcessRun } from '@/domain/model/run.model';
import { apiRequest } from '@/services/api.service';
import { addRunToProcess, deleteRunFromProcess } from '@/services/orders.service';
import { configureRun } from '@/services/run.service';
import { User as ManagerUser } from '@/services/user.service';

interface EmbellishmentConfigProps {
    order: Order;
    locations: Location[];
    managers: ManagerUser[];
    onRefresh?: () => Promise<void>;
    onSaveSuccess?: (processId: string, runId: string) => void;
}

// ... imports and interface ...

// Field icon mapping for compact view
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

export default function EmbellishmentConfig({
    order,
    locations,
    managers,
    onRefresh,
    onSaveSuccess,
}: EmbellishmentConfigProps) {
    const [localOrder, setLocalOrder] = useState<Order>(order);
    const [openRunId, setOpenRunId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isAddingRun, setIsAddingRun] = useState(false);
    const [isDeletingRun, setIsDeletingRun] = useState<string | null>(null);

    const handleAddRun = async (processId: string) => {
        setIsAddingRun(true);
        setError(null);
        try {
            await addRunToProcess(order.id, processId);
            if (onRefresh) {
                await onRefresh();
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to add run');
        } finally {
            setIsAddingRun(false);
        }
    };

    const handleDeleteRun = async (processId: string, runId: string) => {
        if (!confirm('Are you sure you want to delete this run? This action cannot be undone.')) {
            return;
        }

        setIsDeletingRun(runId);
        setError(null);
        try {
            await deleteRunFromProcess(order.id, processId, runId);
            if (onRefresh) {
                await onRefresh();
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to delete run');
        } finally {
            setIsDeletingRun(null);
        }
    };

    // Update local order when parent order changes
    useEffect(() => {
        setLocalOrder(order);
        // Re-sync existing images when order refreshes (e.g., after save)
        setExistingRunImages(() => {
            const init: Record<string, string[]> = {};
            order.processes.forEach(p => p.runs.forEach(r => {
                if (r.values?.images && Array.isArray(r.values.images) && r.values.images.length > 0) {
                    init[r.id] = r.values.images as string[];
                }
            }));
            return init;
        });
    }, [order]);

    // State to store selected images for each run
    const [runImages, setRunImages] = useState<Record<string, File[]>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<string, string[]>>({});
    // Pre-existing image URLs from run.values.images (shown in edit form)
    const [existingRunImages, setExistingRunImages] = useState<Record<string, string[]>>(
        () => {
            const init: Record<string, string[]> = {};
            order.processes.forEach(p => p.runs.forEach(r => {
                if (r.values?.images && Array.isArray(r.values.images) && r.values.images.length > 0) {
                    init[r.id] = r.values.images as string[];
                }
            }));
            return init;
        }
    );

    // Get field configurations from run.fields array
    const getRunFieldConfigs = (run: ProcessRun) => run.fields ?? [];

    const areAllFieldsFilled = (run: ProcessRun) => {
        const fields = run.fields ?? [];
        return fields
            .filter((f) => f.required && f.key !== 'Estimated Amount') // Skip auto-calculated field
            .every((f) => {
                const value = run.values[f.key];
                return value !== null && value !== undefined && value !== '';
            });
    };

    const prettyLabel = (field: string) =>
        field
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (s) => s.toUpperCase());

    const getRunProgress = (run: ProcessRun) => {
        const fields = run.fields ?? [];
        if (fields.length === 0) return 100;

        const filled = fields.filter((f) => {
            const value = run.values[f.key];
            return value !== null && value !== undefined && value !== '';
        });

        return Math.round((filled.length / fields.length) * 100);
    };

    const { hasPermission } = useAuth();

    // State for specific run manager selections (temproary state while editing)
    const [runManagers, setRunManagers] = useState<
        Record<string, { executorId?: string; reviewerId?: string }>
    >({});



    const [runLocations, setRunLocations] = useState<Record<string, string>>({}); // runId -> locationId



    const handleManagerSelect = (
        runId: string,
        type: 'executorId' | 'reviewerId',
        userId: string,
    ) => {
        setRunManagers((prev) => ({
            ...prev,
            [runId]: {
                ...prev[runId],
                [type]: userId,
            },
        }));
    };

    /* ================= IMAGE HANDLING ================= */

    /* ================= IMAGE HANDLING ================= */

    const handleImageSelect = async (runId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const fileArray = Array.from(files);
        const currentNewImages = runImages[runId] || [];
        const currentExisting = existingRunImages[runId] || [];
        const totalCurrent = currentNewImages.length + currentExisting.length;

        // Restrict to 2 photos total (existing + new)
        if (totalCurrent + fileArray.length > 2) {
            alert('Maximum 2 photos allowed per run');
            return;
        }

        // Validate file types
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const invalidFiles = fileArray.filter((file) => !validTypes.includes(file.type));

        if (invalidFiles.length > 0) {
            alert('Only JPEG, PNG, and WebP images are allowed');
            return;
        }

        // Validate original file sizes (max 5MB per file)
        const oversizedFiles = fileArray.filter((file) => file.size > 5 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            alert('Each image must be less than 5MB');
            return;
        }

        // Temporarily set loading/saving state if you had a global loading state,
        // but here we might just have to handle it async.
        // For better UX, we could set a local loading state for this run, but for now we'll just process.
        console.log(`Processing ${fileArray.length} images for run ${runId}...`);

        try {
            const compressedFilesPromises = fileArray.map(async (file) => {
                const options = {
                    maxSizeMB: 0.1, // 100KB
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    fileType: 'image/webp',
                    initialQuality: 0.8,
                };

                try {
                    const imageCompression = (await import('browser-image-compression')).default;
                    console.log(`Compressing ${file.name} (${(file.size / 1024).toFixed(2)} KB)...`);
                    const compressedBlob = await imageCompression(file, options);

                    const compressedFile = new File(
                        [compressedBlob],
                        file.name.replace(/\.[^/.]+$/, '') + '.webp',
                        {
                            type: 'image/webp',
                            lastModified: Date.now(),
                        },
                    );

                    console.log(
                        `Compressed to ${compressedFile.name} (${(compressedFile.size / 1024).toFixed(2)} KB)`,
                    );
                    return compressedFile;
                } catch (error) {
                    console.error('Compression failed for', file.name, error);
                    return file;
                }
            });

            const compressedFiles = await Promise.all(compressedFilesPromises);

            // Update state
            setRunImages((prev) => ({
                ...prev,
                [runId]: [...(prev[runId] || []), ...compressedFiles],
            }));

            // Create previews
            compressedFiles.forEach((file) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImagePreviews((prev) => ({
                        ...prev,
                        [runId]: [...(prev[runId] || []), reader.result as string],
                    }));
                };
                reader.readAsDataURL(file);
            });
        } catch (err) {
            console.error('Image processing error', err);
            setError('Failed to process images');
        }
    };

    const removeImage = (runId: string, index: number) => {
        setRunImages((prev) => ({
            ...prev,
            [runId]: (prev[runId] || []).filter((_, i) => i !== index),
        }));
        setImagePreviews((prev) => ({
            ...prev,
            [runId]: (prev[runId] || []).filter((_, i) => i !== index),
        }));
    };

    const removeExistingImage = (runId: string, index: number) => {
        setExistingRunImages((prev) => ({
            ...prev,
            [runId]: (prev[runId] || []).filter((_, i) => i !== index),
        }));
    };

    const updateRunField = (processId: string, runId: string, field: string, value: string) => {
        setLocalOrder((prev) => {
            if (!prev) return prev;
            const process = prev.processes.find((p) => p.id === processId);
            const run = process?.runs.find((r) => r.id === runId);

            if (!run) return prev;

            // Find the field definition to get the type
            const fieldDef = run.fields.find((f) => f.key === field);
            let typedValue: string | number | null = value;

            // Convert to number if field type is number
            if (fieldDef?.type === 'number' && value !== '') {
                typedValue = Number(value);
                // If conversion fails, keep as string but log error
                if (isNaN(typedValue as number)) {
                    console.error(`Failed to convert ${field} to number: ${value}`);
                    typedValue = value; // Fallback to string
                }
            }

            // Build new values object
            const newValues = {
                ...run.values,
                [field]: typedValue,
            };

            // Auto-calculate estimated_amount when estimated_rate or quantity changes
            if (field === 'estimated_rate' || field === 'quantity') {
                const rate = field === 'estimated_rate' ? typedValue : run.values['estimated_rate'];
                const qty = field === 'quantity' ? typedValue : run.values['quantity'];

                if (typeof rate === 'number' && typeof qty === 'number') {
                    newValues['estimated_amount'] = rate * qty;
                }
            }

            const updatedOrder = {
                ...prev,
                processes: prev.processes.map((p) =>
                    p.id !== processId
                        ? p
                        : {
                            ...p,
                            runs: p.runs.map((r) =>
                                r.id !== runId
                                    ? r
                                    : {
                                        ...r,
                                        values: newValues,
                                    },
                            ),
                        },
                ),
            };

            return updatedOrder;
        });
    };

    // Function to update run configStatus and managers locally
    const updateRunState = (
        processId: string,
        runId: string,
        updates: {
            configStatus?: string;
            executor?: { id: string; name: string } | null;
            reviewer?: { id: string; name: string } | null;
        },
    ) => {
        setLocalOrder((prev) => {
            if (!prev) return prev;

            const updatedOrder = {
                ...prev,
                processes: prev.processes.map((process) => {
                    if (process.id === processId) {
                        return {
                            ...process,
                            runs: process.runs.map((run) => {
                                if (run.id === runId) {
                                    return {
                                        ...run,
                                        ...updates,
                                    };
                                }
                                return run;
                            }),
                        };
                    }
                    return process;
                }),
            };

            // Check if ALL runs in ALL processes are complete
            // Only check if we are updating status
            if (updates.configStatus) {
                const allRunsComplete = updatedOrder.processes.every((process) =>
                    process.runs.every((run) => run.configStatus === 'COMPLETE'),
                );

                if (allRunsComplete) {
                    return {
                        ...updatedOrder,
                        status: 'Production_Ready',
                    };
                }
            }

            return updatedOrder;
        });
    };

    const saveRun = async (processId: string, runId: string) => {
        const process = localOrder.processes.find((p) => p.id === processId);
        const run = process?.runs.find((r) => r.id === runId);
        if (!process || !run) return;

        if (!areAllFieldsFilled(run)) {
            alert('Please fill all required fields before saving.');
            return;
        }

        // Prepare values for API - preserve types based on field definitions
        const apiValues: Record<string, string | number | boolean> = {};
        const fieldConfigs = getRunFieldConfigs(run);

        Object.entries(run.values).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') {
                return;
            }

            const fieldDef = fieldConfigs.find((f) => f.key === key);
            const type = fieldDef?.type || 'null';

            if (type === 'number') {
                apiValues[key] = Number(value);
            } else if (type === 'boolean') {
                apiValues[key] = Boolean(value);
            } else if (type === 'string') {
                apiValues[key] = String(value);
            } else {
                apiValues[key] = value;
            }
        });

        // Calculate and add Estimated Amount (auto-calculated field)
        const rate = Number(run.values['Estimated Rate']) || 0;
        const qty = Number(run.values['Quantity']) || 0;
        if (rate > 0 && qty > 0) {
            apiValues['Estimated Amount'] = rate * qty;
        }

        setIsSaving(runId);
        setError(null);

        try {
            // Send the values object AND images to configureRun
            // Get images for this run if any
            const images = runImages[runId] || [];
            const imageUrls: string[] = [];

            if (images.length > 0) {
                console.log(`Starting upload for ${images.length} images...`);
                const uploadPromises = images.map(async (file) => {
                    // A. Get Presigned URL
                    const { uploadUrl, publicUrl } = await apiRequest<{
                        uploadUrl: string;
                        publicUrl: string;
                    }>(`/orders/upload-url?filename=${encodeURIComponent(file.name)}`);

                    // B. Upload File to Cloudflare (PUT)
                    await fetch(uploadUrl, {
                        method: 'PUT',
                        body: file,
                        headers: {
                            'Content-Type': file.type,
                        },
                    });

                    return publicUrl;
                });

                const uploaded = await Promise.all(uploadPromises);
                imageUrls.push(...uploaded);
            }

            const managerSelection = runManagers[runId];

            const executorId = managerSelection?.executorId ?? run.executor?.id;
            const reviewerId = managerSelection?.reviewerId ?? run.reviewer?.id;

            const response = await configureRun(
                localOrder.id,
                processId,
                runId,
                apiValues,
                imageUrls,
                executorId,
                reviewerId,
                runLocations[runId] ?? run.locationId ?? undefined
            );

            // Check if API returned success
            if (response && response.success === true) {
                // Resolve full manager objects for local update
                const selectedExecutor = executorId
                    ? managers.find((u) => u.id === executorId) || run.executor
                    : run.executor;

                const selectedReviewer = reviewerId
                    ? managers.find((u) => u.id === reviewerId) || run.reviewer
                    : run.reviewer;

                // Update local state immediately with status AND managers
                updateRunState(processId, runId, {
                    configStatus: 'COMPLETE',
                    executor: selectedExecutor
                        ? { id: selectedExecutor.id, name: selectedExecutor.name }
                        : null,
                    reviewer: selectedReviewer
                        ? { id: selectedReviewer.id, name: selectedReviewer.name }
                        : null,
                });

                // Clear images for this run from state
                setRunImages((prev) => {
                    const newState = { ...prev };
                    delete newState[runId];
                    return newState;
                });
                setImagePreviews((prev) => {
                    const newState = { ...prev };
                    delete newState[runId];
                    return newState;
                });
                // Clear manager selection temp state
                setRunManagers((prev) => {
                    const newState = { ...prev };
                    delete newState[runId];
                    return newState;
                });

                // Notify parent component
                if (onSaveSuccess) {
                    onSaveSuccess(processId, runId);
                }

                alert(`Run ${run.runNumber} configured successfully`);
                setOpenRunId(null); // Close the form after successful save

                // Refresh from server to get latest data including image URLs
                if (onRefresh) {
                    await onRefresh();
                }
            } else {
                throw new Error('Failed to save configuration');
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to save configuration');
        } finally {
            setIsSaving(null);
        }
    };

    // Group fields into pairs for table-like layout
    const groupFieldsIntoPairs = (fields: any[]) => {
        const pairs = [];
        for (let i = 0; i < fields.length; i += 2) {
            pairs.push([fields[i], fields[i + 1]]);
        }
        return pairs;
    };

    const SearchableLocationSelect = ({
        label,
        valueId,
        onChange,
        locations,
    }: {
        label: string;
        valueId?: string;
        onChange: (id: string) => void;
        locations: Location[];
    }) => {
        const [search, setSearch] = useState('');
        const [isOpen, setIsOpen] = useState(false);

        useEffect(() => {
            if (valueId) {
                const l = locations.find((l) => l.id === valueId);
                if (l) setSearch(l.name);
            } else {
                setSearch('');
            }
        }, [valueId, locations]);

        const filtered = locations.filter((l) =>
            l.name.toLowerCase().includes(search.toLowerCase()) ||
            l.code.toLowerCase().includes(search.toLowerCase())
        );

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
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    placeholder={`Search ${label}...`}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {isOpen && filtered.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded shadow-lg max-h-40 overflow-y-auto">
                        {filtered.map((l) => (
                            <div
                                key={l.id}
                                className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer text-gray-700"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onChange(l.id);
                                    setSearch(l.name);
                                    setIsOpen(false);
                                }}
                            >
                                <div className="font-medium">{l.name}</div>
                                <div className="text-xs text-gray-500">{l.code}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Improved Manager Select using a simple filterable dropdown logic
    const SearchableManagerSelect = ({
        label,
        valueId,
        onChange,
        users,
    }: {
        label: string;
        valueId?: string;
        onChange: (id: string) => void;
        users: ManagerUser[];
    }) => {
        const [search, setSearch] = useState('');
        const [isOpen, setIsOpen] = useState(false);

        // Initialize search with current selected user name if any
        useEffect(() => {
            if (valueId) {
                const u = users.find((u) => u.id === valueId);
                if (u) setSearch(u.name);
            } else {
                setSearch('');
            }
        }, [valueId, users]);

        const filtered = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()));

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
                        // If clear, clear selection
                        if (e.target.value === '') onChange('');
                    }}
                    onBlur={() => {
                        // Delay hide to allow click
                        setTimeout(() => setIsOpen(false), 200);
                    }}
                    placeholder={`Search ${label}...`}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {isOpen && filtered.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded shadow-lg max-h-40 overflow-y-auto">
                        {filtered.map((u) => (
                            <div
                                key={u.id}
                                className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer text-gray-700"
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent blur
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

    // Function to render form or view based on run status
    const renderRunFormOrView = (process: any, run: ProcessRun) => {
        const isConfigured = run.configStatus === 'COMPLETE';

        if (isConfigured) {
            // Show READ-ONLY view for configured runs
            return (
                <div className="bg-gray-50 border border-gray-300 rounded p-3">
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                <h3 className="font-semibold text-sm">View Run {run.runNumber} Configuration</h3>
                            </div>
                            <button
                                onClick={() => setOpenRunId(null)}
                                className="text-gray-500 hover:text-gray-700 text-sm"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* READ-ONLY COMPACT TABLE */}
                        <div className="border border-gray-300 rounded overflow-hidden bg-white">
                            {(() => {
                                const fieldConfigs = getRunFieldConfigs(run).filter((f) => f.required === true);
                                const pairs = groupFieldsIntoPairs(fieldConfigs);

                                return pairs.map((pair, rowIndex) => (
                                    <div
                                        key={rowIndex}
                                        className="grid grid-cols-4 border-b last:border-b-0 divide-x divide-gray-300"
                                    >
                                        {pair.map((fieldConfig: any, cellIndex: number) => {
                                            if (!fieldConfig) return null;

                                            const field = fieldConfig.key;
                                            const isRequired = fieldConfig.required === true;
                                            const type = fieldConfig.type || 'string';
                                            const isNumberField = type === 'number';
                                            const currentValue = run.values[field];
                                            return (
                                                <React.Fragment key={field}>
                                                    {/* LABEL CELL */}
                                                    <div className="bg-gray-50 p-1.5">
                                                        <div className="flex items-center gap-1">
                                                            {getFieldIcon(field)}
                                                            <label className="text-xs font-medium text-gray-700">
                                                                {prettyLabel(field)}
                                                                {field === 'Quantity' && (
                                                                    <span className="text-blue-600 ml-1 font-normal">
                                                                        (Order Qty: {localOrder.quantity})
                                                                    </span>
                                                                )}
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {/* VALUE CELL (READ-ONLY) */}
                                                    <div className="p-1.5 bg-white">
                                                        <div className="w-full text-sm border border-gray-200 bg-gray-50 rounded px-2 py-1 font-medium text-gray-700">
                                                            {run.values[field] || <span className="text-gray-400">Not set</span>}
                                                        </div>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* Fill empty cells if odd number of fields */}
                                        {pair.length === 1 && (
                                            <>
                                                <div className="bg-gray-50 p-1.5"></div>
                                                <div className="p-1.5 bg-white"></div>
                                            </>
                                        )}
                                    </div>
                                ));
                            })()}
                            {/* Managed By & Reviewed By Read Only */}
                            <div className="grid grid-cols-4 border-t border-gray-300 divide-x divide-gray-300">
                                <div className="bg-gray-50 p-1.5">
                                    <div className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        <label className="text-xs font-medium text-gray-700">Executor</label>
                                    </div>
                                </div>
                                <div className="p-1.5 bg-white">
                                    <div className="w-full text-sm border border-gray-200 bg-gray-50 rounded px-2 py-1 font-medium text-gray-700">
                                        {run.executor?.name || <span className="text-gray-400">Not assigned</span>}
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-1.5">
                                    <div className="flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        <label className="text-xs font-medium text-gray-700">Reviewer</label>
                                    </div>
                                </div>
                                <div className="p-1.5 bg-white">
                                    <div className="w-full text-sm border border-gray-200 bg-gray-50 rounded px-2 py-1 font-medium text-gray-700">
                                        {run.reviewer?.name || <span className="text-gray-400">Not assigned</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Location Read Only */}
                            {run.location && (
                                <div className="mt-2 text-xs flex items-center gap-1 text-gray-600">
                                    <MapPin className="w-3 h-3" />
                                    <span>Location: </span>
                                    <span className="font-medium text-gray-800">{run.location.name} ({run.location.code})</span>
                                </div>
                            )}
                        </div>

                        {/* DISPLAY IMAGES IF AVAILABLE (READ-ONLY) */}
                        {run.values?.images &&
                            Array.isArray(run.values.images) &&
                            run.values.images.length > 0 && (
                                <div className="mt-4 border border-gray-200 rounded p-3 bg-white">
                                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Reference Images</h4>
                                    <div className="flex gap-2 overflow-x-auto">
                                        {run.values.images.map((imgUrl: string, index: number) => (
                                            <a
                                                key={index}
                                                href={imgUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block w-16 h-16 border rounded overflow-hidden shrink-0 hover:border-blue-500 transition-colors"
                                            >
                                                <img
                                                    src={imgUrl}
                                                    alt={`Ref ${index + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                        {/* CLOSE BUTTON FOR VIEW MODE */}
                        <div className="mt-4 flex items-center justify-end">
                            <button
                                onClick={() => setOpenRunId(null)}
                                className="px-4 py-1 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-100 transition-colors flex items-center gap-1"
                            >
                                <X className="w-3 h-3" />
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            );
        } else {
            // Show EDITABLE form for unconfigured runs
            const currentImages = runImages[run.id] || [];
            const currentPreviews = imagePreviews[run.id] || [];
            const currentManagerSelection = runManagers[run.id] || {
                executorId: run.executor?.id,
                reviewerId: run.reviewer?.id,
            };

            return (
                <div className="bg-gray-50 border border-gray-300 rounded p-3">
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                                <h3 className="font-semibold text-sm">Configure Run {run.runNumber}</h3>
                            </div>
                            <button
                                onClick={() => setOpenRunId(null)}
                                className="text-gray-500 hover:text-gray-700 text-sm"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <SearchableManagerSelect
                                label="Executor"
                                users={managers}
                                valueId={currentManagerSelection.executorId}
                                onChange={(id) => handleManagerSelect(run.id, 'executorId', id)}
                            />
                            <SearchableManagerSelect
                                label="Reviewer"
                                users={managers}
                                valueId={currentManagerSelection.reviewerId}
                                onChange={(id: string) => handleManagerSelect(run.id, 'reviewerId', id)}
                            />
                        </div>

                        <div className="mb-4">
                            <SearchableLocationSelect
                                label="Location"
                                locations={locations}
                                valueId={runLocations[run.id] ?? run.location?.id ?? undefined}
                                onChange={(id: string) => setRunLocations(prev => ({ ...prev, [run.id]: id }))}
                            />
                        </div>

                        {/* EDITABLE COMPACT FORM TABLE */}
                        <div className="border border-gray-300 rounded overflow-hidden bg-white">
                            {(() => {
                                const fieldConfigs = getRunFieldConfigs(run).filter((f) => f.required === true);
                                const pairs = groupFieldsIntoPairs(fieldConfigs);

                                return pairs.map((pair, rowIndex) => (
                                    <div
                                        key={rowIndex}
                                        className="grid grid-cols-4 border-b last:border-b-0 divide-x divide-gray-300"
                                    >
                                        {pair.map((fieldConfig: any, cellIndex: number) => {
                                            if (!fieldConfig) return null;

                                            const field = fieldConfig.key;
                                            const isRequired = fieldConfig.required === true;
                                            const type = fieldConfig.type || 'string';
                                            const isNumberField = type === 'number';

                                            return (
                                                <React.Fragment key={field}>
                                                    {/* LABEL CELL */}
                                                    <div className="bg-gray-50 p-1.5">
                                                        <div className="flex items-center gap-1">
                                                            {getFieldIcon(field)}
                                                            <label className="text-xs font-medium text-gray-700">
                                                                {prettyLabel(field)}
                                                                {field === 'Quantity' && (
                                                                    <span className="text-blue-600 ml-1 font-normal">
                                                                        (Order Qty: {localOrder.quantity})
                                                                    </span>
                                                                )}
                                                                {isRequired && <span className="text-red-500 ml-0.5">*</span>}
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {/* INPUT CELL */}
                                                    <div className="p-1.5 bg-white">
                                                        {/* ... existing input logic ... */}
                                                        {field === 'Estimated Amount' ? (
                                                            // Read-only calculated field
                                                            <div className="w-full text-sm border border-gray-200 bg-gray-100 rounded px-2 py-1 text-gray-700 font-medium">
                                                                {(() => {
                                                                    const rate = Number(run.values['Estimated Rate']) || 0;
                                                                    const qty = Number(run.values['Quantity']) || 0;
                                                                    return (
                                                                        rate * qty || (
                                                                            <span className="text-gray-400">Auto-calculated</span>
                                                                        )
                                                                    );
                                                                })()}
                                                            </div>
                                                        ) : field === 'Process Name' ? (
                                                            <select
                                                                value={run.values[field] ?? ''}
                                                                onChange={(e) =>
                                                                    updateRunField(process.id, run.id, field, e.target.value)
                                                                }
                                                                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                                            >
                                                                <option value="">Select Process</option>
                                                                {[
                                                                    'Sublimation',
                                                                    'Screen Printing',
                                                                    'Plotter',
                                                                    'Positive',
                                                                    'DTF',
                                                                    'Laser',
                                                                    'Diamond',
                                                                    'Spangle',
                                                                ].map((name) => (
                                                                    <option key={name} value={name}>
                                                                        {name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type={isNumberField ? 'number' : 'text'}
                                                                value={run.values[field] ?? ''}
                                                                onChange={(e) => {
                                                                    let value = e.target.value;

                                                                    // For number fields, ensure we're sending valid numbers
                                                                    if (isNumberField) {
                                                                        // Allow empty, but validate it's a number if not empty
                                                                        if (value !== '') {
                                                                            // Remove any non-numeric characters except decimal point
                                                                            value = value.replace(/[^0-9.]/g, '');
                                                                            // Ensure only one decimal point
                                                                            const parts = value.split('.');
                                                                            if (parts.length > 2) {
                                                                                value = parts[0] + '.' + parts.slice(1).join('');
                                                                            }
                                                                        }
                                                                    }

                                                                    updateRunField(process.id, run.id, field, value);
                                                                }}
                                                                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                                placeholder={`Enter ${prettyLabel(field).toLowerCase()}`}
                                                                min={isNumberField ? '0' : undefined}
                                                                step={isNumberField ? '1' : undefined}
                                                            />
                                                        )}
                                                        {isRequired && !run.values[field] && field !== 'estimated_amount' && (
                                                            <p className="text-xs text-red-500 mt-0.5">Required</p>
                                                        )}
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* Fill empty cells if odd number of fields */}
                                        {pair.length === 1 && (
                                            <>
                                                <div className="bg-gray-50 p-1.5"></div>
                                                <div className="p-1.5 bg-white"></div>
                                            </>
                                        )}
                                    </div>
                                ));
                            })()}
                        </div>

                        {/* IMAGE UPLOAD SECTION */}
                        <div className="mt-3 border border-gray-300 rounded overflow-hidden bg-white p-3">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                                    <Palette className="w-3.5 h-3.5" />
                                    Reference Images (Max 2)
                                </label>
                                <div className="text-xs text-gray-500">{currentImages.length}/2 uploaded</div>
                            </div>

                            <div className="flex gap-3 items-start">
                                {/* UPLOAD BUTTON */}
                                {currentImages.length < 2 && (
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id={`img-upload-${run.id}`}
                                            className="hidden"
                                            accept="image/jpeg,image/jpg,image/png,image/webp"
                                            multiple
                                            onChange={(e) => handleImageSelect(run.id, e)}
                                        />
                                        <label
                                            htmlFor={`img-upload-${run.id}`}
                                            className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                                        >
                                            <span className="text-gray-400 text-2xl">+</span>
                                            <span className="text-[10px] text-gray-500 mt-1">Add Image</span>
                                        </label>
                                    </div>
                                )}

                                {/* PREVIEWS */}
                                {currentPreviews.map((preview, idx) => (
                                    <div
                                        key={idx}
                                        className="relative group w-20 h-20 border rounded-lg overflow-hidden"
                                    >
                                        <img
                                            src={preview}
                                            alt={`Preview ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            onClick={() => removeImage(run.id, idx)}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ACTION BUTTONS - COMPACT */}
                        <div className="mt-4 flex items-center justify-between">
                            <div>
                                {!areAllFieldsFilled(run) && (
                                    <div className="flex items-center gap-1 text-xs text-yellow-600">
                                        <AlertCircle className="w-3 h-3" />
                                        <span>Fill all required fields (*) to save</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setOpenRunId(null)}
                                    disabled={isSaving === run.id}
                                    className="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => saveRun(process.id, run.id)}
                                    disabled={!areAllFieldsFilled(run) || isSaving === run.id}
                                    className={`px-4 py-1 text-sm font-medium rounded transition-colors flex items-center gap-1 ${areAllFieldsFilled(run)
                                            ? 'bg-green-600 hover:bg-green-700 text-white'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    {isSaving === run.id ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-3 h-3" />
                                            Save
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    };

    return (
        <>
            {/* ERROR MESSAGE */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                    <div className="flex items-center gap-2 text-red-700 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span className="font-medium">Error: {error}</span>
                    </div>
                </div>
            )}

            {/* RUN CARDS - COMPACT VIEW */}
            <div className="space-y-6">
                {localOrder.processes.map((process) => (
                    <div key={process.id} className="space-y-3">
                        {process.runs.map((run) => {
                            const progress = getRunProgress(run);
                            const isConfigured = run.configStatus === 'COMPLETE'; // Check for COMPLETE status
                            const filledFields = Object.values(run.values).filter((v) => v && v !== '').length;
                            const totalFields = run.fields?.length || 0;

                            return (
                                <div key={run.id} className="space-y-1">
                                    {/* RUN HEADER - COMPACT */}
                                    <div
                                        className={`border rounded p-2 transition-colors ${isConfigured
                                                ? 'bg-green-50 border-green-200 hover:bg-green-100'
                                                : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div
                                                onClick={() => setOpenRunId(openRunId === run.id ? null : run.id)}
                                                className="flex items-center gap-2 cursor-pointer flex-1"
                                            >
                                                <div
                                                    className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-yellow-500'}`}
                                                />
                                                <span className="font-medium text-sm">Run {run.runNumber}</span>
                                                <span className="text-xs text-gray-500">
                                                    ({filledFields}/{totalFields} fields)
                                                </span>
                                                {isConfigured && (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Configured
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1">
                                                    {isConfigured ? (
                                                        <Eye className="w-4 h-4 text-gray-500" />
                                                    ) : (
                                                        <Edit className="w-4 h-4 text-gray-500" />
                                                    )}
                                                    {hasPermission(Permission.RUNS_DELETE) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteRun(process.id, run.id);
                                                            }}
                                                            disabled={isDeletingRun === run.id}
                                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                                            title="Delete Run"
                                                        >
                                                            {isDeletingRun === run.id ? (
                                                                <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    )}
                                                    <ChevronRight
                                                        className={`w-4 h-4 text-gray-400 transition-transform ${openRunId === run.id ? 'rotate-90' : ''
                                                            }`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* EXPANDED FORM OR VIEW */}
                                    {openRunId === run.id && renderRunFormOrView(process, run)}
                                </div>
                            );
                        })}

                        {/* ADD RUN BUTTON */}
                        {hasPermission(Permission.RUNS_CREATE) && (
                            <button
                                onClick={() => handleAddRun(process.id)}
                                disabled={isAddingRun}
                                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                            >
                                {isAddingRun ? (
                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Plus className="w-4 h-4" />
                                )}
                                Add Configuration Run
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}
