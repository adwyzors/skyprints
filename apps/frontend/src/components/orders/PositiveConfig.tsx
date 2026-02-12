import {
    CheckCircle,
    ChevronRight,
    Edit,
    Eye,
    MapPin,
    Palette,
    Plus,
    Trash2,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import SearchableLocationSelect from '../common/SearchableLocationSelect';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { Location } from '@/domain/model/location.model';
import { Order } from '@/domain/model/order.model';
import { PositiveItem, PositiveRunValues, ProcessRun } from '@/domain/model/run.model';
import { addRunToProcess, deleteRunFromProcess } from '@/services/orders.service';
import { configureRun } from '@/services/run.service';
import { User as ManagerUser } from '@/services/user.service';

interface PositiveConfigProps {
    order: Order;
    locations: Location[];
    managers: ManagerUser[];
    onRefresh?: () => Promise<void>;
    onSaveSuccess?: (processId: string, runId: string) => void;
}

export default function PositiveConfig({
    order,
    locations,
    managers,
    onRefresh,
    onSaveSuccess,
}: PositiveConfigProps) {
    const [localOrder, setLocalOrder] = useState<Order>(order);
    const [openRunId, setOpenRunId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isAddingRun, setIsAddingRun] = useState(false);
    const [isDeletingRun, setIsDeletingRun] = useState<string | null>(null);
    const [editingRunId, setEditingRunId] = useState<string | null>(null);

    // State for local editing
    const [editForm, setEditForm] = useState<PositiveRunValues | null>(null);

    const [runLocations, setRunLocations] = useState<Record<string, string>>({}); // runId -> locationId



    function parseItems(items: unknown): PositiveItem[] {
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

    const initialFormState: PositiveRunValues = {
        particulars: '',
        rate: 0,
        items: []
    };

    const { hasPermission } = useAuth();
    const [runManagers, setRunManagers] = useState<
        Record<string, { executorId?: string; reviewerId?: string }>
    >({});



    const handleManagerSelect = (runId: string, type: 'executorId' | 'reviewerId', userId: string) => {
        setRunManagers(prev => ({
            ...prev,
            [runId]: { ...prev[runId], [type]: userId }
        }));
    };

    const handleAddRun = async (processId: string) => {
        setIsAddingRun(true);
        setError(null);
        try {
            await addRunToProcess(order.id, processId);
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            setError(err.message || 'Failed to add run');
        } finally {
            setIsAddingRun(false);
        }
    };

    const handleDeleteRun = async (processId: string, runId: string) => {
        if (!confirm('Are you sure?')) return;
        setIsDeletingRun(runId);
        setError(null);
        try {
            await deleteRunFromProcess(order.id, processId, runId);
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            setError(err.message || 'Failed to delete run');
        } finally {
            setIsDeletingRun(null);
        }
    };

    useEffect(() => {
        setLocalOrder(order);
    }, [order]);

    useEffect(() => {
        if (openRunId) {
            const process = localOrder.processes.find(p => p.runs.some(r => r.id === openRunId));
            const run = process?.runs.find(r => r.id === openRunId);

            if (run) {
                const values = run.values as PositiveRunValues;
                const existingItems = parseItems(values.items);
                setEditForm({
                    particulars: values.particulars || '',
                    rate: values.rate || 0,
                    items: existingItems.length > 0 ? existingItems : [{
                        description: '', width: 0, height: 0, amount: 0
                    }]
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

    // --- Calculations ---
    const calculateRow = (item: PositiveItem, globalRate: number): PositiveItem => {
        // Amount = Rate * Width * Height
        const amount = globalRate * item.width * item.height;
        return {
            ...item,
            amount: Number(amount.toFixed(2))
        };
    };

    const updateHeader = (field: keyof PositiveRunValues, value: any) => {
        setEditForm(prev => {
            if (!prev) return prev;
            const updates = { ...prev, [field]: value };

            // If global Rate changes, recalculate all items
            if (field === 'rate') {
                const newRate = Number(value) || 0;
                updates.items = parseItems(prev.items).map(item => calculateRow(item, newRate));
            }

            return updates;
        });
    };

    const updateItem = (index: number, field: keyof PositiveItem, value: any) => {
        setEditForm(prev => {
            if (!prev) return prev;
            const newItems = [...prev.items];
            let item = { ...newItems[index], [field]: value };

            // Recalculate amount if width/height changed
            if (field === 'width' || field === 'height') {
                item = calculateRow(item, prev.rate);
            }

            newItems[index] = item;
            return { ...prev, items: newItems };
        });
    };

    const addItem = () => {
        setEditForm(prev => prev ? {
            ...prev,
            items: [...prev.items, { description: '', width: 0, height: 0, amount: 0 }]
        } : prev);
    };

    const deleteItem = (index: number) => {
        setEditForm(prev => prev ? { ...prev, items: prev.items.filter((_, i) => i !== index) } : prev);
    };

    const getTotals = (items: PositiveItem[]) => {
        const totalAmount = items.reduce((sum, i) => sum + (i.amount || 0), 0);
        return { totalAmount };
    };

    const saveRun = async (processId: string, runId: string) => {
        if (!editForm) return;

        if (!editForm.particulars) {
            alert('Particulars is required');
            return;
        }

        const totals = getTotals(parseItems(editForm.items));

        const apiValues = {
            particulars: editForm.particulars,
            rate: editForm.rate,
            items: editForm.items,

            // Summaries for display/sorting in lists if needed
            'Total Amount': Number(totals.totalAmount.toFixed(2)),
            'Estimated Amount': Number(totals.totalAmount.toFixed(2))
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

            const managerSelection = runManagers[runId];
            const process = localOrder.processes.find(p => p.id === processId);
            const run = process?.runs.find(r => r.id === runId);

            const executorId = managerSelection?.executorId ?? run?.executor?.id;
            const reviewerId = managerSelection?.reviewerId ?? run?.reviewer?.id;

            const res = await configureRun(
                localOrder.id,
                processId,
                runId,
                apiValues,
                imageUrls,
                executorId,
                reviewerId,
                runLocations[runId] ?? run?.location?.id
            );
            if (res.success) {
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
                throw new Error('Save failed');
            }
        } catch (err: any) {
            setError(err.message || 'Save failed');
        } finally {
            setIsSaving(null);
        }
    };

    const SearchableManagerSelect = ({ label, valueId, onChange, users }: any) => {
        return (
            <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
                <select
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                    value={valueId || ''}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value="">Select {label}...</option>
                    {users.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
            </div>
        )
    };

    const renderRun = (process: any, run: ProcessRun) => {
        const isConfigured = run.configStatus === 'COMPLETE';
        const isEditing = editingRunId === run.id;
        const mode = isConfigured && !isEditing ? 'view' : 'edit';

        const data = mode === 'view'
            ? run.values as PositiveRunValues
            : (editForm || initialFormState);

        const savedImages = (mode === 'view' ? (data.images || []) : []) as string[];
        const totals = getTotals(parseItems(data.items) || []);

        return (
            <div className="bg-gray-50 border border-gray-300 rounded p-3">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${mode === 'edit' ? 'bg-blue-500' : 'bg-green-500'}`} />
                        <h3 className="font-semibold text-sm">
                            {mode === 'edit' ? `Configure Run ${run.runNumber}` : `Run ${run.runNumber} Config`}
                        </h3>
                        {mode === 'view' && run.location && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {run.location.code}
                            </span>
                        )}
                    </div>
                    {mode === 'view' && hasPermission(Permission.RUNS_UPDATE) && (
                        <div className="flex items-center gap-2">
                            <button onClick={() => setEditingRunId(run.id)} className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs border border-blue-200">Edit</button>
                            <button onClick={() => setOpenRunId(null)}><X className="w-4 h-4 text-gray-500" /></button>
                        </div>
                    )}
                    {mode === 'edit' && (
                        <button onClick={() => { setOpenRunId(null); setEditingRunId(null); }}><X className="w-4 h-4 text-gray-500" /></button>
                    )}
                </div>

                    {mode === 'edit' && (
                <div className="bg-white border border-gray-200 rounded p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4 mb-2">
                            <SearchableManagerSelect
                                label="Executor"
                                users={managers}
                                valueId={runManagers[run.id]?.executorId ?? run.executor?.id}
                                onChange={(id: string) => handleManagerSelect(run.id, 'executorId', id)}
                            />
                            <SearchableManagerSelect
                                label="Reviewer"
                                users={managers}
                                valueId={runManagers[run.id]?.reviewerId ?? run.reviewer?.id}
                                onChange={(id: string) => handleManagerSelect(run.id, 'reviewerId', id)}
                            />
                            <SearchableLocationSelect
                                label="Location"
                                locations={locations}
                                valueId={runLocations[run.id] ?? run.location?.id}
                                onChange={(id) => setRunLocations(prev => ({ ...prev, [run.id]: id }))}
                            />
                        </div>
                </div>
                    )}


                {/* IMAGE UPLOAD SECTION */}
                {mode === 'edit' && (
                    <div className="mt-3 border border-gray-300 rounded overflow-hidden bg-white p-3">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5" />
                                Reference Images (Max 2)
                            </label>
                            <div className="text-xs text-gray-500">{(runImages[run.id] || []).length}/2 uploaded</div>
                        </div>

                        <div className="flex gap-3 items-start">
                            {/* UPLOAD BUTTON */}
                            {(runImages[run.id] || []).length < 2 && (
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
                            {(imagePreviews[run.id] || []).map((preview, idx) => (
                                <div key={idx} className="relative group w-20 h-20 border rounded-lg overflow-hidden">
                                    <img src={preview} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
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
                )}

                {/* DISPLAY IMAGES IF AVAILABLE (READ-ONLY) */}
                {mode === 'view' && savedImages.length > 0 && (
                    <div className="mt-4 border border-gray-200 rounded p-3 bg-white">
                        <h4 className="text-xs font-semibold text-gray-700 mb-2">Reference Images</h4>
                        <div className="flex gap-2 overflow-x-auto">
                            {savedImages.map((imgUrl, index) => (
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

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-500 block">Particulars</label>
                        {mode === 'edit' ? (
                            <input
                                className="w-full border p-1 rounded text-sm"
                                value={data.particulars || ''}
                                onChange={e => updateHeader('particulars', e.target.value)}
                            />
                        ) : (
                            <div className="text-sm font-medium">{data.particulars || '-'}</div>
                        )}
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block">Rate</label>
                        {mode === 'edit' ? (
                            <input
                                type="number"
                                className="w-full border p-1 rounded text-sm"
                                value={data.rate}
                                onChange={e => updateHeader('rate', parseFloat(e.target.value) || 0)}
                            />
                        ) : (
                            <div className="text-sm font-medium">{data.rate}</div>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto border rounded">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 text-xs">
                            <tr>
                                <th className="p-2 text-left w-12">S.No</th>
                                <th className="p-2 text-left">Desc (Particulars)</th>
                                <th className="p-2 text-right w-24">Width</th>
                                <th className="p-2 text-right w-24">Height</th>
                                <th className="p-2 text-right w-32 bg-blue-50">Amount</th>
                                {mode === 'edit' && <th className="p-2 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {(parseItems(data.items) || []).map((item, idx) => (
                                <tr key={idx} className="border-t">
                                    <td className="p-2 text-gray-500">{idx + 1}</td>
                                    <td className="p-2">
                                        {mode === 'edit' ? (
                                            <input className="w-full border p-1 rounded" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} />
                                        ) : item.description}
                                    </td>
                                    <td className="p-2 text-right">
                                        {mode === 'edit' ? (
                                            <input type="number" className="w-full border p-1 text-right rounded" value={item.width} onChange={e => updateItem(idx, 'width', parseFloat(e.target.value) || 0)} />
                                        ) : item.width}
                                    </td>
                                    <td className="p-2 text-right">
                                        {mode === 'edit' ? (
                                            <input type="number" className="w-full border p-1 text-right rounded" value={item.height} onChange={e => updateItem(idx, 'height', parseFloat(e.target.value) || 0)} />
                                        ) : item.height}
                                    </td>
                                    <td className="p-2 text-right bg-gray-50 font-medium">
                                        {item.amount.toFixed(2)}
                                    </td>
                                    {mode === 'edit' && (
                                        <td className="p-2 text-center">
                                            <button onClick={() => deleteItem(idx)} className="text-red-500 hover:text-red-700">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold text-gray-700">
                            <tr>
                                <td colSpan={4} className="p-2 text-right">Totals:</td>
                                <td className="p-2 text-right">₹{totals.totalAmount.toFixed(2)}</td>
                                {mode === 'edit' && <td></td>}
                            </tr>
                        </tfoot>
                    </table>
                    {mode === 'edit' && (
                        <button onClick={addItem} className="w-full p-2 bg-gray-50 hover:bg-gray-100 text-blue-600 border-t text-sm font-medium flex items-center justify-center gap-2">
                            <Plus className="w-4 h-4" /> Add Item
                        </button>
                    )}
                </div>
                {mode === 'edit' && (
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => { setEditingRunId(null); setOpenRunId(null); }}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => saveRun(process.id, run.id)}
                            disabled={isSaving === run.id}
                            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isSaving === run.id ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded text-sm border border-red-200">{error}</div>}
            {localOrder.processes.map(process => (
                <div key={process.id} className="space-y-2">
                    {process.runs.map(run => (
                        <div key={run.id} className="space-y-1">
                            {!openRunId || openRunId !== run.id ? (
                                <div
                                    className={`border rounded p-2 transition-colors cursor-pointer flex items-center justify-between
                                        ${run.configStatus === 'COMPLETE' ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-gray-50 border-gray-300 hover:bg-gray-100'}`}
                                >
                                    <div onClick={() => setOpenRunId(run.id)} className="flex items-center gap-2 flex-1">
                                        <div className={`w-2 h-2 rounded-full ${run.configStatus === 'COMPLETE' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                        <span className="font-medium text-sm">Run {run.runNumber}</span>
                                        {run.configStatus === 'COMPLETE' && (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" /> Configured
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {run.configStatus === 'COMPLETE' ? (
                                            <div className="p-1"><Eye className="w-4 h-4 text-gray-500" /></div>
                                        ) : (
                                            <div className="p-1"><Edit className="w-4 h-4 text-gray-500" /></div>
                                        )}
                                        {hasPermission(Permission.RUNS_DELETE) && (
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteRun(process.id, run.id); }} className="p-1 text-gray-400 hover:text-red-500">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    </div>
                                </div>
                            ) : (
                                renderRun(process, run)
                            )}
                        </div>
                    ))}
                    {hasPermission(Permission.RUNS_CREATE) && (
                        <button
                            onClick={() => handleAddRun(process.id)}
                            disabled={isAddingRun}
                            className="w-full py-2 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 text-sm font-medium flex items-center justify-center gap-2"
                        >
                            {isAddingRun ? 'Adding...' : <><Plus className="w-4 h-4" /> Add configuration run</>}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
