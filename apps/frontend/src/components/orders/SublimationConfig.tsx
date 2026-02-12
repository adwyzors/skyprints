import SearchableLocationSelect from '@/components/common/SearchableLocationSelect';
import { AlertCircle, ChevronDown, Edit, Loader2, MapPin, Palette, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { Location } from '@/domain/model/location.model';
import { Order } from '@/domain/model/order.model';
import { ProcessRun, SublimationItem, SublimationRunValues } from '@/domain/model/run.model';
import { addRunToProcess, deleteRunFromProcess } from '@/services/orders.service';
import { configureRun } from '@/services/run.service';
import { User as ManagerUser } from '@/services/user.service';

interface SublimationConfigProps {
    order: Order;
    locations: Location[];
    managers: ManagerUser[];
    onSaveSuccess?: (processId: string, runId: string) => void;
    onRefresh?: () => Promise<void>;
}

const initialFormState: SublimationRunValues = {
    rate: 0,
    columnHeaders: ['Col 1', 'Col 2', 'Col 3', 'Col 4'],
    items: [],
    images: [] // Explicitly initialize images array
};

export default function SublimationConfig({ order, locations, managers, onSaveSuccess, onRefresh }: SublimationConfigProps) {
    const { hasPermission, user } = useAuth();
    const [localOrder, setLocalOrder] = useState<Order>(order);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Run Operations State
    const [isAddingRun, setIsAddingRun] = useState(false);
    const [isDeletingRun, setIsDeletingRun] = useState<string | null>(null);

    // Editing State
    const [editingRunId, setEditingRunId] = useState<string | null>(null);
    const [openRunId, setOpenRunId] = useState<string | null>(null); // For accordion
    const [editForm, setEditForm] = useState<SublimationRunValues | null>(null);
    const [editableHeaders, setEditableHeaders] = useState<[string, string, string, string]>(['Col 1', 'Col 2', 'Col 3', 'Col 4']);

    // UI State
    const [runManagers, setRunManagers] = useState<Record<string, { executorId?: string; reviewerId?: string }>>({});
    const [runImages, setRunImages] = useState<Record<string, File[]>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<string, string[]>>({});

    const [runLocations, setRunLocations] = useState<Record<string, string>>({}); // runId -> locationId



    function parseItems(items: unknown): SublimationItem[] {
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

    function isStringTuple4(value: unknown): value is [string, string, string, string] {
        return (
            Array.isArray(value) &&
            value.length === 4 &&
            value.every(item => typeof item === 'string')
        );
    }

    function parseColumnHeaders(headers: unknown): [string, string, string, string] {
        const defaultHeaders: [string, string, string, string] =
            ['Col 1', 'Col 2', 'Col 3', 'Col 4'];

        if (isStringTuple4(headers)) {
            return headers;
        }

        if (typeof headers === 'string') {
            try {
                const parsed = JSON.parse(headers);
                if (isStringTuple4(parsed)) {
                    return parsed;
                }
            } catch {
                // ignore
            }
        }

        return defaultHeaders;
    }


    function isTotalsArray(value: unknown): value is [number, number, number, number] {
        return (
            Array.isArray(value) &&
            value.length === 4 &&
            value.every(item => typeof item === 'number')
        );
    }

    function parseTotals(totals: unknown): [number, number, number, number] {
        const defaultTotals: [number, number, number, number] = [0, 0, 0, 0];

        if (isTotalsArray(totals)) {
            return totals;
        }

        if (typeof totals === 'string') {
            try {
                const parsed = JSON.parse(totals);
                if (isTotalsArray(parsed)) {
                    return parsed;
                }
            } catch {
                // ignore
            }
        }

        return defaultTotals;
    }


    // Sync local order
    useEffect(() => {
        setLocalOrder(order);
    }, [order]);



    // Initialize edit form when opening a run for edit
    useEffect(() => {
        if (editingRunId && !editForm) {
            // Find the run across all processes
            let run: ProcessRun | undefined;
            for (const p of localOrder.processes) {
                run = p.runs.find(r => r.id === editingRunId);
                if (run) break;
            }

            if (run) {
                // Initialize form from run values
                const existingValues = run.values as SublimationRunValues;
                setEditForm({
                    rate: Number(existingValues.rate) || 0,
                    columnHeaders: parseColumnHeaders(existingValues.columnHeaders),
                    items: parseItems(existingValues.items),
                    images: existingValues.images || []
                });
                setEditableHeaders(parseColumnHeaders(existingValues.columnHeaders));
                // Ensure expanded view when editing
                setOpenRunId(editingRunId);

                // Init location
                if (run.location?.id) {
                    setRunLocations(prev => ({
                        ...prev,
                        [run.id]: run.location!.id
                    }));
                }
            }
        } else if (!editingRunId) {
            setEditForm(null);
        }
    }, [editingRunId, localOrder, editForm]);


    const handleAddRun = async (processId: string) => {
        setIsAddingRun(true);
        setError(null);
        try {
            await addRunToProcess(localOrder.id, processId);
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to add run');
        } finally {
            setIsAddingRun(false);
        }
    };

    const handleDeleteRun = async (processId: string, runId: string) => {
        if (!confirm('Are you sure you want to delete this run? This action cannot be undone.')) return;
        setIsDeletingRun(runId);
        setError(null);
        try {
            await deleteRunFromProcess(localOrder.id, processId, runId);
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to delete run');
        } finally {
            setIsDeletingRun(null);
        }
    };


    const handleManagerSelect = (runId: string, type: 'executorId' | 'reviewerId', value: string) => {
        setRunManagers(prev => ({
            ...prev,
            [runId]: { ...prev[runId], [type]: value }
        }));
    };

    const handleImageSelect = (runId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setRunImages(prev => ({ ...prev, [runId]: [...(prev[runId] || []), ...files] }));

            const newPreviews = files.map(file => URL.createObjectURL(file));
            setImagePreviews(prev => ({ ...prev, [runId]: [...(prev[runId] || []), ...newPreviews] }));
        }
    };

    const removeImage = (runId: string, index: number) => {
        setRunImages(prev => {
            const newFiles = [...(prev[runId] || [])];
            newFiles.splice(index, 1);
            return { ...prev, [runId]: newFiles };
        });
        setImagePreviews(prev => {
            const newPreviews = [...(prev[runId] || [])];
            URL.revokeObjectURL(newPreviews[index]);
            newPreviews.splice(index, 1);
            return { ...prev, [runId]: newPreviews };
        });
    };

    /* --- LOGIC AND CALCULATIONS --- */

    const calculateItem = (item: SublimationItem, globalRate: number): SublimationItem => {
        // Quantities ensure numbers
        const quantities = item.quantities.map(q => Number(q) || 0) as [number, number, number, number];

        const sum = quantities.reduce((acc, curr) => acc + curr, 0);

        // Rate = W * H * Global Rate
        const rowRate = (item.width || 0) * (item.height || 0) * globalRate;

        const rowTotal = sum * rowRate;

        return {
            ...item,
            sum,
            rowRate,
            rowTotal
        };
    };

    const getTotals = (items: SublimationItem[], formRate: number) => {
        const calculatedItems = parseItems(items).map(item => calculateItem(item, formRate));

        // Column Totals
        const colTotals: [number, number, number, number] = [0, 0, 0, 0];
        let totalSum = 0;
        let totalAmount = 0;
        let totalWeightedHeight = 0; // For meter calculation: sum(height * quantity)

        calculatedItems.forEach(item => {
            item.quantities.forEach((q, idx) => {
                const val = Number(q) || 0;
                colTotals[idx] += val;
            });
            const itemSum = item.sum || 0;
            totalSum += itemSum;
            totalAmount += item.rowTotal || 0;
            totalWeightedHeight += (item.height || 0) * itemSum;
        });

        // Avg Rate = Total Amount / Total Quantity
        const avgRate = totalSum > 0 ? totalAmount / totalSum : 0;

        // Total Meters = Sum(Height * Sum) / 39.38
        const totalMeters = totalWeightedHeight / 39.38;

        return {
            items: calculatedItems,
            colTotals,
            totalSum,
            totalAmount,
            avgRate,
            totalMeters
        };
    };

    const updateField = (field: keyof SublimationRunValues, value: any) => {
        setEditForm(prev => prev ? { ...prev, [field]: value } : prev);
    };

    const handleHeaderChange = (index: number, value: string) => {
        setEditableHeaders(prev => {
            const newHeaders = [...prev] as [string, string, string, string];
            newHeaders[index] = value;
            return newHeaders;
        });
    };

    const updateItem = (index: number, field: keyof SublimationItem, value: any) => {
        setEditForm(prev => {
            if (!prev) return prev;
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, items: newItems };
        });
    };

    const updateItemQuantity = (itemIndex: number, colIndex: number, value: any) => {
        setEditForm(prev => {
            if (!prev) return prev;
            const newItems = [...prev.items];
            const newQuantities = [...newItems[itemIndex].quantities];
            newQuantities[colIndex] = value;
            newItems[itemIndex] = { ...newItems[itemIndex], quantities: newQuantities as [number, number, number, number] };
            return { ...prev, items: newItems };
        });
    };

    const addItem = () => {
        setEditForm(prev => prev ? {
            ...prev,
            items: [...prev.items, { size: '', width: 0, height: 0, quantities: [0, 0, 0, 0] }]
        } : prev);
    };

    const deleteItem = (index: number) => {
        setEditForm(prev => prev ? { ...prev, items: prev.items.filter((_, i) => i !== index) } : prev);
    };

    const saveRun = async (processId: string, runId: string) => {
        if (!editForm) return;

        const totals = getTotals(editForm.items, editForm.rate);

        const apiValues: SublimationRunValues = {
            ...editForm,
            columnHeaders: editableHeaders, // Use the separate state
            items: totals.items,

            // Persist Summaries
            totalQuantity: totals.totalSum,
            totalAmount: Number(totals.totalAmount.toFixed(2)),
            avgRate: Number(totals.avgRate.toFixed(4)),
            totalMeters: Number(totals.totalMeters.toFixed(2)),
            totals: totals.colTotals,

            'Estimated Amount': Number(totals.totalAmount.toFixed(2)) // For standard display
        } as SublimationRunValues & { 'Estimated Amount': number };

        setIsSaving(runId);
        setError(null);
        try {
            // Standard Image Upload
            const images = runImages[runId] || [];
            const imageUrls: string[] = [];

            if (images.length > 0) {
                const { apiRequest } = await import('@/services/api.service');
                const uploadPromises = images.map(async (file) => {
                    const { uploadUrl, publicUrl } = await apiRequest<{
                        uploadUrl: string;
                        publicUrl: string;
                    }>(`/orders/upload-url?filename=${encodeURIComponent(file.name)}`);
                    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
                    return publicUrl;
                });
                imageUrls.push(...(await Promise.all(uploadPromises)));
            }

            const managerSelection = runManagers[runId];

            // Find current run executor/reviewer if not changed
            let currentExecutorId: string | undefined;
            let currentReviewerId: string | undefined;

            // Find the run
            const process = localOrder.processes.find(p => p.id === processId);
            const run = process?.runs.find(r => r.id === runId);

            if (run) {
                currentExecutorId = run.executor?.id;
                currentReviewerId = run.reviewer?.id;
            }


            const res = await configureRun(
                localOrder.id,
                processId,
                runId,
                apiValues,
                imageUrls,
                managerSelection?.executorId ?? currentExecutorId,
                managerSelection?.reviewerId ?? currentReviewerId,
                runLocations[runId] ?? run?.location?.id
            );

            if (res.success) {
                if (onSaveSuccess) onSaveSuccess(processId, runId);
                setEditingRunId(null);
                setOpenRunId(null); // Close or keep open? Generally collapse to show configured state
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

    const SearchableManagerSelect = ({ label, valueId, onChange, users }: any) => (
        <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
            <select className="w-full text-sm border border-gray-300 rounded px-2 py-1" value={valueId || ''} onChange={e => onChange(e.target.value)}>
                <option value="">Select {label}...</option>
                {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
        </div>
    );

    const toggleRunOpen = (run: ProcessRun) => {
        if (openRunId === run.id) {
            setOpenRunId(null);
            // Optionally close edit mode if closing accordion, but might want to keep state?
            // For now, let's keep it simple: closing accordion hides the edit form anyway.
            if (editingRunId === run.id) {
                setEditingRunId(null);
                setEditForm(null);
            }
        } else {
            setOpenRunId(run.id);
            // Auto-enter edit mode for pending runs
            if (run.configStatus !== 'COMPLETE') {
                setEditingRunId(run.id);
                setEditForm(null); // Ensure fresh form init
            }
        }
    };

    const renderRun = (process: any, run: ProcessRun) => {
        const isConfigured = run.configStatus === 'COMPLETE';
        const isEditing = editingRunId === run.id;
        // Strict logic: Only edit if explicitly set as editingRunId
        const mode = isEditing ? 'edit' : 'view';

        // If editing, use editForm, otherwise rely on run.values (casted)
        const rawData = (mode === 'edit')
            ? (editForm || initialFormState)
            : (run.values as SublimationRunValues);

        const data: SublimationRunValues = {
            ...rawData,
            items: parseItems(rawData.items),
            columnHeaders: parseColumnHeaders(rawData.columnHeaders),
            totals: parseTotals(rawData.totals)
        };


        // Always calculate totals for display
        const totals = getTotals(data.items || [], data.rate || 0);
        const savedImages = (mode === 'view' ? (data.images || []) : []) as string[];

        // Use helper state for headers in edit mode
        const headersToDisplay = (mode === 'edit' && editingRunId === run.id)
            ? editableHeaders
            : data.columnHeaders;

        return (
            <div className="bg-gray-50 border border-gray-300 rounded p-3">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${mode === 'edit' ? 'bg-blue-500' : 'bg-green-500'}`} />
                        <h3 className="font-semibold text-sm">{mode === 'edit' ? `Configure Run ${run.runNumber}` : `Sublimation Run ${run.runNumber}`}</h3>
                        {mode === 'view' && run.location && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {run.location.code}
                            </span>
                        )}
                    </div>
                    {mode === 'view' && hasPermission(Permission.RUNS_UPDATE) && (
                        <div className="flex items-center gap-2">
                            <button onClick={() => { setEditForm(null); setEditingRunId(run.id); }} className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs border border-blue-200 flex items-center gap-1">
                                <Edit className="w-3 h-3" /> Edit
                            </button>
                            <button onClick={() => setOpenRunId(null)}><X className="w-4 h-4 text-gray-500" /></button>
                        </div>
                    )}
                    {mode === 'edit' && <button onClick={() => { setOpenRunId(null); setEditingRunId(null); }}><X className="w-4 h-4 text-gray-500" /></button>}
                </div>

                <div className="bg-white border border-gray-200 rounded p-4 space-y-6">
                    {/* 1. TOP SECTION (EXECUTOR + RATE) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <SearchableManagerSelect
                            label="Executor"
                            users={managers}
                            valueId={mode === 'edit' ? (runManagers[run.id]?.executorId ?? run.executor?.id) : run.executor?.id}
                            onChange={(id: string) => mode === 'edit' && handleManagerSelect(run.id, 'executorId', id)}
                        />
                        <SearchableManagerSelect
                            label="Reviewer"
                            users={managers}
                            valueId={mode === 'edit' ? (runManagers[run.id]?.reviewerId ?? run.reviewer?.id) : run.reviewer?.id}
                            onChange={(id: string) => mode === 'edit' && handleManagerSelect(run.id, 'reviewerId', id)}
                        />
                        {mode === 'edit' && (
                            <SearchableLocationSelect
                                label="Location"
                                locations={locations}
                                valueId={runLocations[run.id] ?? run.location?.id}
                                onChange={(id) => setRunLocations(prev => ({ ...prev, [run.id]: id }))}
                            />
                        )}

                        <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Rate <span className="text-red-500">*</span></label>
                            {mode === 'edit' ? (
                                <input type="number" className="w-full border p-1 rounded text-sm font-semibold" value={data.rate} onChange={e => updateField('rate', parseFloat(e.target.value) || 0)} />
                            ) : <div className="text-sm font-bold border-b pb-1">{data.rate}</div>}
                        </div>
                    </div>

                    {/* 2. TABLE DETAILS */}
                    <div className="border rounded overflow-hidden">
                        <div className="p-3 bg-white overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50 border-b text-gray-600">
                                        <th className="p-2 text-center w-8">#</th>
                                        <th className="p-2 text-left w-32">Size</th>
                                        <th className="p-2 text-center w-16">W</th>
                                        <th className="p-2 text-center w-16">H</th>

                                        {/* Dynamic Headers */}
                                        {headersToDisplay.map((header, idx) => (
                                            <th key={idx} className="p-2 text-center w-20">
                                                {mode === 'edit' ? (
                                                    <input
                                                        type="text"
                                                        className="w-full bg-transparent border-b border-gray-300 text-center focus:border-blue-500 outline-none font-semibold text-gray-700"
                                                        value={header}
                                                        onChange={(e) => handleHeaderChange(idx, e.target.value)}
                                                        placeholder={`Col ${idx + 1}`}
                                                    />
                                                ) : header}
                                            </th>
                                        ))}

                                        <th className="p-2 text-center w-16 bg-gray-50 font-semibold">Sum</th>
                                        <th className="p-2 text-right w-24 bg-blue-50">Rate</th>
                                        <th className="p-2 text-right w-24 bg-blue-50">Total</th>
                                        {mode === 'edit' && <th className="p-2 w-8"></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {totals.items.map((item, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                            <td className="p-2 text-center text-gray-500 font-mono">{idx + 1}</td>
                                            <td className="p-2">{mode === 'edit' ? <input type="text" className="w-full border rounded p-1 text-left" value={item.size || ''} onChange={e => updateItem(idx, 'size', e.target.value)} /> : item.size}</td>
                                            <td className="p-2 text-center">{mode === 'edit' ? <input type="number" className="w-14 border rounded p-1 text-center" value={item.width} onChange={e => updateItem(idx, 'width', parseFloat(e.target.value) || 0)} /> : item.width}</td>
                                            <td className="p-2 text-center">{mode === 'edit' ? <input type="number" className="w-14 border rounded p-1 text-center" value={item.height} onChange={e => updateItem(idx, 'height', parseFloat(e.target.value) || 0)} /> : item.height}</td>

                                            {/* Dynamic Inputs */}
                                            {item.quantities.map((qty, cIdx) => (
                                                <td key={cIdx} className="p-2 text-center">
                                                    {mode === 'edit' ? (
                                                        <input
                                                            type="number"
                                                            className="w-16 border rounded p-1 text-center"
                                                            value={qty}
                                                            onChange={e => updateItemQuantity(idx, cIdx, parseFloat(e.target.value) || 0)}
                                                        />
                                                    ) : (qty || '')}
                                                </td>
                                            ))}

                                            <td className="p-2 text-center font-bold text-gray-700 bg-gray-50">{item.sum}</td>
                                            <td className="p-2 text-right font-medium text-blue-600 bg-blue-50">{item.rowRate?.toFixed(2)}</td>
                                            <td className="p-2 text-right font-bold text-blue-800 bg-blue-50">{item.rowTotal?.toFixed(2)}</td>
                                            {mode === 'edit' && <td className="text-center"><button onClick={() => deleteItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>}
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100 font-semibold text-gray-800 border-t-2 border-gray-200">
                                    <tr>
                                        <td colSpan={4} className="p-2 text-right uppercase text-[10px] tracking-wider text-gray-500">Totals</td>
                                        {totals.colTotals.map((tot, idx) => (
                                            <td key={idx} className="p-2 text-center">{tot}</td>
                                        ))}
                                        <td className="p-2 text-center font-bold text-black">{totals.totalSum}</td>
                                        <td className="p-2 text-right text-gray-600">{totals.avgRate.toFixed(4)}</td>
                                        <td className="p-2 text-right font-bold text-black">{totals.totalAmount.toFixed(2)}</td>
                                        {mode === 'edit' && <td></td>}
                                    </tr>
                                </tfoot>
                            </table>
                            {mode === 'edit' && <button onClick={addItem} className="mt-2 text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800"><Plus className="w-3 h-3" /> Add Item</button>}
                        </div>
                    </div>

                    {/* 3. SUMMARY CARDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                        <div className="text-right sm:text-left">
                            <label className="text-[10px] uppercase text-gray-500 block">Total Mtr</label>
                            <div className="text-sm font-medium">{totals.totalMeters.toFixed(2)}</div>
                        </div>
                        <div className="text-right sm:text-left">
                            <label className="text-[10px] uppercase text-gray-500 block">Total Amount</label>
                            <div className="text-xl font-bold text-green-700">{totals.totalAmount.toFixed(2)}</div>
                        </div>
                    </div>

                    {/* 4. IMAGE UPLOAD SECTION */}
                    {mode === 'edit' && (
                        <div className="mt-3 border border-gray-300 rounded overflow-hidden bg-white p-3">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Reference Images</label>
                                <div className="text-xs text-gray-500">{(runImages[run.id] || []).length}/2 uploaded</div>
                            </div>
                            <div className="flex gap-3 items-start">
                                {(runImages[run.id] || []).length < 2 && (
                                    <div className="relative">
                                        <input type="file" id={`img-upload-${run.id}`} className="hidden" accept="image/jpeg,image/jpg,image/png,image/webp" multiple onChange={(e) => handleImageSelect(run.id, e)} />
                                        <label htmlFor={`img-upload-${run.id}`} className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors">
                                            <span className="text-gray-400 text-2xl">+</span>
                                            <span className="text-[10px] text-gray-500 mt-1">Add</span>
                                        </label>
                                    </div>
                                )}
                                {(imagePreviews[run.id] || []).map((preview, idx) => (
                                    <div key={idx} className="relative group w-20 h-20 border rounded-lg overflow-hidden">
                                        <img src={preview} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                                        <button onClick={() => removeImage(run.id, idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {mode === 'view' && savedImages.length > 0 && (
                        <div className="mt-4 border border-gray-200 rounded p-3 bg-white">
                            <h4 className="text-xs font-semibold text-gray-700 mb-2">Reference Images</h4>
                            <div className="flex gap-2 overflow-x-auto">
                                {savedImages.map((imgUrl, index) => (
                                    <a key={index} href={imgUrl} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 border rounded overflow-hidden shrink-0 hover:border-blue-500 transition-colors">
                                        <img src={imgUrl} alt={`Ref ${index + 1}`} className="w-full h-full object-cover" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SAVE */}
                    {mode === 'edit' && (
                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                            <button onClick={() => { setOpenRunId(null); setEditingRunId(null); }} className="px-3 py-1 text-sm border rounded hover:bg-gray-100">Cancel</button>
                            <button onClick={() => saveRun(process.id, run.id)} disabled={isSaving === run.id} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{isSaving === run.id ? 'Saving...' : 'Save Configuration'}</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm border border-red-200">
                    <AlertCircle className="w-4 h-4" /> {error}
                </div>
            )}

            {localOrder.processes.map(process => (
                <div key={process.id} className="space-y-3">
                    {process.runs.map(run => (
                        <div key={run.id} className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                            <div className={`w-full bg-gray-50 hover:bg-gray-100 p-4 flex items-center justify-between transition-colors border-b border-gray-100 ${run.configStatus === 'COMPLETE' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-amber-500'}`}>
                                <div
                                    className="flex items-center gap-4 flex-1 cursor-pointer"
                                    onClick={() => toggleRunOpen(run)}
                                >
                                    <div className={`p-2 rounded-lg ${run.configStatus === 'COMPLETE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                        <Palette className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="font-semibold text-gray-900">Run {run.runNumber}</h3>
                                        <div className="text-xs text-gray-500 flex gap-2">
                                            <span className={run.configStatus === 'COMPLETE' ? 'text-green-600 font-medium' : 'text-amber-600'}>{run.configStatus === 'COMPLETE' ? 'Configured' : 'Pending Configuration'}</span>
                                            <span>•</span>
                                            <span>{run.lifecycleStatus}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {hasPermission(Permission.RUNS_DELETE) && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteRun(process.id, run.id); }}
                                            disabled={isDeletingRun === run.id}
                                            className="text-gray-400 hover:text-red-500 p-1"
                                        >
                                            {isDeletingRun === run.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    )}
                                    <button onClick={() => toggleRunOpen(run)}>
                                        {openRunId === run.id ? <ChevronDown className="w-5 h-5 text-gray-400 rotate-180 transition-transform" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </button>
                                </div>
                            </div>

                            {openRunId === run.id && (
                                <div className="p-4 bg-white border-t border-gray-200">
                                    {renderRun(process, run)}
                                </div>
                            )}
                        </div>
                    ))}

                    {hasPermission(Permission.RUNS_CREATE) && (
                        <button
                            onClick={() => handleAddRun(process.id)}
                            disabled={isAddingRun}
                            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                        >
                            {isAddingRun ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Add Sublimation Run
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
