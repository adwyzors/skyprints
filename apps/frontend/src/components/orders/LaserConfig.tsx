
import {
    AlertCircle,
    CheckCircle,
    ChevronRight,
    Edit,
    Eye,
    MapPin,
    Palette,
    Plus,
    Save,
    Trash2,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { Location } from '@/domain/model/location.model';
import { Order } from '@/domain/model/order.model';
import { LaserItem, LaserRunValues, ProcessRun } from '@/domain/model/run.model';
import { getLocationsWithHeaders } from '@/services/location.service';
import { addRunToProcess, deleteRunFromProcess } from '@/services/orders.service';
import { configureRun } from '@/services/run.service';
import { getManagers, User as ManagerUser } from '@/services/user.service';
import SearchableLocationSelect from '../common/SearchableLocationSelect';

interface LaserConfigProps {
    order: Order;
    onRefresh?: () => Promise<void>;
    onSaveSuccess?: (processId: string, runId: string) => void;
}



export default function LaserConfig({
    order,
    onRefresh,
    onSaveSuccess,
}: LaserConfigProps) {
    const [localOrder, setLocalOrder] = useState<Order>(order);
    const [openRunId, setOpenRunId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isAddingRun, setIsAddingRun] = useState(false);
    const [isDeletingRun, setIsDeletingRun] = useState<string | null>(null);
    const [editingRunId, setEditingRunId] = useState<string | null>(null);

    // State for local editing of form fields before save
    const [editForm, setEditForm] = useState<LaserRunValues | null>(null);

    // Initial state for new runs
    const initialFormState = {
        particulars: '',
        items: []
    };

    function parseItems(items: unknown): LaserItem[] {
        if (Array.isArray(items)) {
            return items;
        }

        if (typeof items === 'string') {
            try {
                const parsed = JSON.parse(items);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }

        return [];
    }

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

    const { hasPermission } = useAuth();

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
    }, [order]);

    // Locations State
    const [locations, setLocations] = useState<Location[]>([]);
    const [runLocations, setRunLocations] = useState<Record<string, string>>({}); // runId -> locationId

    useEffect(() => {
        const loadLocations = async () => {
            try {
                const response = await getLocationsWithHeaders({ limit: 100 });
                setLocations(response.locations);
            } catch (error) {
                console.error('Failed to load locations', error);
            }
        };
        loadLocations();
    }, []);

    // Initialize edit form when opening a run
    useEffect(() => {
        if (openRunId) {
            // Find the run
            let run: ProcessRun | undefined;
            for (const p of localOrder.processes) {
                run = p.runs.find(r => r.id === openRunId);
                if (run) break;
            }

            if (run) {
                // Initialize form from run values
                const values = run.values as LaserRunValues;
                const existingItems = parseItems(values.items);
                setEditForm({
                    particulars: values.particulars || '',
                    items: existingItems.length > 0 ? existingItems : [{ designSizes: '', quantity: 0, fSizes: 'all', laserTime: 0, rate: 0, amount: 0 }]
                });

                // Init location
                if (run.location?.id) {
                    setRunLocations(prev => ({
                        ...prev,
                        [run.id]: run.location!.id
                    }));
                }
            }
        } else {
            setEditForm(null);
        }
    }, [openRunId, localOrder]);


    // Managers Logic
    const [runManagers, setRunManagers] = useState<
        Record<string, { executorId?: string; reviewerId?: string }>
    >({});
    const [managers, setManagers] = useState<ManagerUser[]>([]);
    const [loadingManagers, setLoadingManagers] = useState(false);

    useEffect(() => {
        const loadManagers = async () => {
            setLoadingManagers(true);
            try {
                const users = await getManagers();
                setManagers(users);
            } catch (err) {
                console.error('Failed to load managers', err);
            } finally {
                setLoadingManagers(false);
            }
        };
        loadManagers();
    }, []);

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

    // --- Image Handling ---
    const [runImages, setRunImages] = useState<Record<string, File[]>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<string, string[]>>({});

    const handleImageSelect = async (runId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const fileArray = Array.from(files);
        const currentImages = runImages[runId] || [];

        // Restrict to 2 photos
        if (currentImages.length + fileArray.length > 2) {
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

        //console.log(`Processing ${fileArray.length} images for run ${runId}...`);

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
                    const compressedBlob = await imageCompression(file, options);
                    const compressedFile = new File(
                        [compressedBlob],
                        file.name.replace(/\.[^/.]+$/, '') + '.webp',
                        { type: 'image/webp', lastModified: Date.now() }
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

    // --- Calculations ---
    const calculateTotalAmount = (items: LaserItem[]) => {
        return items.reduce((sum, item) => sum + item.amount, 0);
    };

    const calculateTotalQuantity = (items: LaserItem[]) => {
        return items.reduce((sum, item) => sum + item.quantity, 0);
    };

    const calculateTotalLaserTime = (items: LaserItem[]) => {
        return items.reduce((sum, item) => sum + item.laserTime, 0);
    };

    const calculateAverageRate = (totalAmount: number, totalQuantity: number) => {
        if (totalQuantity === 0) return 0;
        return totalAmount / totalQuantity;
    };

    // --- Form Handlers ---
    const updateHeaderField = (field: keyof typeof initialFormState, value: any) => {
        setEditForm(prev => {
            if (!prev) return prev;
            return { ...prev, [field]: value };
        });
    };

    const updateItem = (index: number, field: keyof LaserItem, value: any) => {
        setEditForm(prev => {
            if (!prev) return prev;
            const newItems = [...prev.items];
            const item = { ...newItems[index], [field]: value };

            // Auto calculate rate and amount based on laserTime
            if (field === 'laserTime') {
                const time = Number(value) || 0;
                item.rate = time * 10;
                item.amount = item.quantity * item.rate;
            }

            // Auto calculate amount based on quantity
            if (field === 'quantity') {
                const qty = Number(value) || 0;
                item.amount = qty * item.rate;
            }

            newItems[index] = item;
            return { ...prev, items: newItems };
        });
    };

    const addItem = () => {
        setEditForm(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                items: [...prev.items, { designSizes: '', quantity: 0, fSizes: 'all', laserTime: 0, rate: 0, amount: 0 }]
            };
        });
    };

    const deleteItem = (index: number) => {
        setEditForm(prev => {
            if (!prev) return prev;
            const newItems = prev.items.filter((_, i) => i !== index);
            return { ...prev, items: newItems };
        });
    };

    const saveRun = async (processId: string, runId: string) => {
        if (!editForm) return;

        // Validation
        if (!editForm.particulars) {
            alert('Please fill field Particulars');
            return;
        }

        // Prepare API values
        const totalAmount = calculateTotalAmount(editForm.items);
        const totalQuantity = calculateTotalQuantity(editForm.items);
        const totalLaserTime = calculateTotalLaserTime(editForm.items);
        const averageRate = calculateAverageRate(totalAmount, totalQuantity);

        const apiValues = {
            particulars: editForm.particulars,
            items: editForm.items,

            // Summary fields
            'Total Quantity': totalQuantity,
            'Total Laser Time': totalLaserTime,
            'Average Rate': averageRate, // kept as number
            'Total Amount': totalAmount,
            // Estimated Amount is often used by system
            'Estimated Amount': totalAmount
        };

        setIsSaving(runId);
        setError(null);

        try {
            // Upload Images
            const images = runImages[runId] || [];
            const imageUrls: string[] = [];

            if (images.length > 0) {
                //console.log(`Starting upload for ${images.length} images...`);
                const { apiRequest } = await import('@/services/api.service');

                const uploadPromises = images.map(async (file) => {
                    const { uploadUrl, publicUrl } = await apiRequest<{
                        uploadUrl: string;
                        publicUrl: string;
                    }>(`/orders/upload-url?filename=${encodeURIComponent(file.name)}`);

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

            // Manager selection
            const process = localOrder.processes.find((p) => p.id === processId);
            const run = process?.runs.find((r) => r.id === runId);
            const managerSelection = runManagers[runId];
            const executorId = managerSelection?.executorId ?? run?.executor?.id;
            const reviewerId = managerSelection?.reviewerId ?? run?.reviewer?.id;

            const response = await configureRun(
                localOrder.id,
                processId,
                runId,
                apiValues,
                imageUrls,
                executorId,
                reviewerId,
                runLocations[runId] ?? run?.location?.id
            );

            if (response && response.success === true) {
                // Clear images state
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

                if (onSaveSuccess) onSaveSuccess(processId, runId);
                setOpenRunId(null);
                setEditingRunId(null);
                if (onRefresh) await onRefresh();
            } else {
                throw new Error('Failed to save configuration');
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to save');
        } finally {
            setIsSaving(null);
        }
    };


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
                        {filtered.map((u) => (
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

    const renderRunFormOrView = (process: any, run: ProcessRun) => {
        const isConfigured = run.configStatus === 'COMPLETE';
        const isEditing = editingRunId === run.id;
        const currentEdit = editForm || initialFormState;

        // View Mode
        if (isConfigured && !isEditing) {
            const values = run.values as LaserRunValues;
            const items = values.items || [];
            const totalAmt = values['Total Amount'] || 0;
            const totalQty = values['Total Quantity'] || 0;
            const totalTime = values['Total Laser Time'] || 0;
            const avgRate = values['Average Rate'] || 0;
            const savedImages = (values.images as string[]) || [];

            return (
                <div className="bg-gray-50 border border-gray-300 rounded p-3">
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                <h3 className="font-semibold text-sm">View Run {run.runNumber} Configuration</h3>
                                {run.location && (
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {run.location.code}
                                    </span>
                                )}
                            </div>
                            {hasPermission(Permission.RUNS_UPDATE) && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setEditingRunId(run.id);
                                            // Form init handled by useEffect
                                        }}
                                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-200"
                                    >
                                        <Edit className="w-3 h-3" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => setOpenRunId(null)}
                                        className="text-gray-500 hover:text-gray-700 text-sm"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Read-Only View */}
                        <div className="bg-white border border-gray-200 rounded p-4 space-y-4">
                            <div className="grid grid-cols-4 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500">Particulars</label>
                                    <div className="text-sm font-medium">{values.particulars}</div>
                                </div>
                            </div>

                            <table className="w-full text-sm border-collapse border border-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="border p-2 text-left">Design sizes</th>
                                        <th className="border p-2 text-right">Quantity</th>
                                        <th className="border p-2 text-right">F. Size</th>
                                        <th className="border p-2 text-right">Laser time</th>
                                        <th className="border p-2 text-right">Rate</th>
                                        <th className="border p-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="border p-2">{item.designSizes}</td>
                                            <td className="border p-2 text-right">{item.quantity}</td>
                                            <td className="border p-2 text-right">{item.fSizes}</td>
                                            <td className="border p-2 text-right">{item.laserTime}</td>
                                            <td className="border p-2 text-right">{item.rate}</td>
                                            <td className="border p-2 text-right">{item.amount.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-blue-50 font-bold">
                                    <tr>
                                        <td className="border p-2 text-right">Totals</td>
                                        <td className="border p-2 text-right">{totalQty}</td>
                                        <td className="border p-2 text-right"></td>
                                        <td className="border p-2 text-right">{totalTime}</td>
                                        <td className="border p-2 text-right">{Number(avgRate).toFixed(2)}</td>
                                        <td className="border p-2 text-right">₹{Number(totalAmt).toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Images View */}
                            {savedImages.length > 0 && (
                                <div className="border border-gray-200 rounded p-3 bg-gray-50">
                                    <h4 className="text-xs font-semibold text-gray-700 mb-2">Reference Images</h4>
                                    <div className="flex gap-2">
                                        {savedImages.map((imgUrl, idx) => (
                                            <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 border rounded overflow-hidden hover:border-blue-500">
                                                <img src={imgUrl} alt={`Ref ${idx + 1}`} className="w-full h-full object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Managers Read Only */}
                            <div className="grid grid-cols-2 gap-4 border-t pt-2">
                                <div>
                                    <span className="text-xs text-gray-500">Executor: </span>
                                    <span className="text-sm">{run.executor?.name || 'Unassigned'}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500">Reviewer: </span>
                                    <span className="text-sm">{run.reviewer?.name || 'Unassigned'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
        }

        // Edit Mode
        const currentManagerSelection = runManagers[run.id] || {
            executorId: run.executor?.id,
            reviewerId: run.reviewer?.id,
        };

        const totalAmt = calculateTotalAmount(currentEdit.items);
        const totalQty = calculateTotalQuantity(currentEdit.items);
        const totalTime = calculateTotalLaserTime(currentEdit.items);
        const avgRate = calculateAverageRate(totalAmt, totalQty);
        const currentPreviews = imagePreviews[run.id] || [];

        return (
            <div className="bg-gray-50 border border-gray-300 rounded p-3">
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isEditing ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                            <h3 className="font-semibold text-sm">
                                {isEditing ? `Edit Run ${run.runNumber}` : `Configure Run ${run.runNumber}`}
                            </h3>
                        </div>
                        <button
                            onClick={() => {
                                setOpenRunId(null);
                                setEditingRunId(null);
                            }}
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
                            onChange={(id) => handleManagerSelect(run.id, 'reviewerId', id)}
                        />
                        <SearchableLocationSelect
                            label="Location"
                            locations={locations}
                            valueId={runLocations[run.id] ?? run.location?.id}
                            onChange={(id) => setRunLocations(prev => ({ ...prev, [run.id]: id }))}
                        />
                    </div>

                    {/* Edit Form */}
                    <div className="bg-white border border-gray-200 rounded p-4 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Particulars</label>
                                <input
                                    type="text"
                                    className="w-full text-sm border p-1 rounded"
                                    value={currentEdit.particulars || ''}
                                    onChange={e => updateHeaderField('particulars', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Image Upload Section */}
                        <div className="mt-3 border border-gray-300 rounded overflow-hidden bg-white p-3">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                                    <Palette className="w-3.5 h-3.5" />
                                    Reference Images (Max 2)
                                </label>
                                <div className="text-xs text-gray-500">{currentPreviews.length}/2 uploaded</div>
                            </div>

                            <div className="flex gap-3 items-start">
                                {/* UPLOAD BUTTON */}
                                {currentPreviews.length < 2 && (
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
                                {currentPreviews.map((src, index) => (
                                    <div
                                        key={index}
                                        className="relative group w-20 h-20 border rounded-lg overflow-hidden"
                                    >
                                        <img
                                            src={src}
                                            alt={`Preview ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            onClick={() => removeImage(run.id, index)}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="border rounded overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-2 text-left">Design sizes</th>
                                        <th className="p-2 text-right w-20">Quantity</th>
                                        <th className="p-2 text-right w-20">F. Size</th>
                                        <th className="p-2 text-right w-20">Laser time</th>
                                        <th className="p-2 text-right w-20">Rate</th>
                                        <th className="p-2 text-right w-24">Amount</th>
                                        <th className="p-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentEdit.items.map((item, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td className="p-2">
                                                <input
                                                    type="text"
                                                    className="w-full border p-1 rounded"
                                                    value={item.designSizes}
                                                    onChange={e => updateItem(idx, 'designSizes', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    className="w-full border p-1 rounded text-right"
                                                    value={item.quantity}
                                                    onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="text"
                                                    className="w-full border p-1 rounded text-right"
                                                    value={item.fSizes}
                                                    onChange={e => updateItem(idx, 'fSizes', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    className="w-full border p-1 rounded text-right"
                                                    value={item.laserTime}
                                                    onChange={e => updateItem(idx, 'laserTime', parseFloat(e.target.value) || 0)}
                                                />
                                            </td>
                                            <td className="p-2 text-right bg-gray-50">
                                                {item.rate}
                                            </td>
                                            <td className="p-2 text-right bg-gray-50 font-medium">
                                                {item.amount.toFixed(2)}
                                            </td>
                                            <td className="p-2 text-center">
                                                <button
                                                    onClick={() => deleteItem(idx)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100 font-semibold text-gray-700">
                                    <tr>
                                        <td className="p-2 text-right">Totals:</td>
                                        <td className="p-2 text-right">{totalQty}</td>
                                        <td className="p-2 text-right"></td>
                                        <td className="p-2 text-right">{totalTime}</td>
                                        <td className="p-2 text-right">{avgRate.toFixed(2)}</td>
                                        <td className="p-2 text-right">₹{totalAmt.toFixed(2)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                            <button
                                onClick={addItem}
                                className="w-full p-2 bg-gray-50 hover:bg-gray-100 text-blue-600 flex items-center justify-center gap-2 border-t text-sm font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add Item
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setEditingRunId(null);
                                    setOpenRunId(null);
                                }}
                                disabled={isSaving === run.id}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => saveRun(process.id, run.id)}
                                disabled={isSaving === run.id}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {isSaving === run.id ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            {localOrder.processes.map(process => (
                <div key={process.id} className="space-y-4">
                    {process.runs.map(run => {
                        const items = (run.values.items as unknown as LaserItem[]) || [];
                        const itemCount = items.length;
                        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

                        return (
                            <div key={run.id} className="space-y-1">
                                {!openRunId || openRunId !== run.id ? (
                                    <div
                                        className={`border rounded p-2 transition-colors ${run.configStatus === 'COMPLETE'
                                            ? 'bg-green-50 border-green-200 hover:bg-green-100'
                                            : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div
                                                onClick={() => setOpenRunId(run.id)}
                                                className="flex items-center gap-2 cursor-pointer flex-1"
                                            >
                                                <div className={`w-2 h-2 rounded-full ${run.configStatus === 'COMPLETE' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                <span className="font-medium text-sm">Run {run.runNumber}</span>
                                                <span className="text-xs text-gray-500">
                                                    ({itemCount} items, {totalQuantity} qty)
                                                </span>
                                                {run.configStatus === 'COMPLETE' && (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" />
                                                        Configured
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1">
                                                    {run.configStatus === 'COMPLETE' ? (
                                                        <div className="p-1">
                                                            <Eye className="w-4 h-4 text-gray-500" />
                                                        </div>
                                                    ) : (
                                                        <div className="p-1">
                                                            <Edit className="w-4 h-4 text-gray-500" />
                                                        </div>
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
                                                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${openRunId === run.id ? 'rotate-90' : ''}`} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    renderRunFormOrView(process, run)
                                )}
                            </div>
                        );
                    })}

                    {/* Add Run Button */}
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
    );
}
