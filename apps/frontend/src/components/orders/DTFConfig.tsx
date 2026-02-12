import {
    CheckCircle,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    Eye,
    Palette,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { Location } from '@/domain/model/location.model';
import { Order } from '@/domain/model/order.model';
import { DTFItem, DTFRunValues, ProcessRun } from '@/domain/model/run.model';
import { addRunToProcess, deleteRunFromProcess } from '@/services/orders.service';
import { configureRun } from '@/services/run.service';
import { User as ManagerUser } from '@/services/user.service';

interface DTFConfigProps {
    order: Order;
    locations: Location[];
    managers: ManagerUser[];
    onRefresh?: () => Promise<void>;
    onSaveSuccess?: (processId: string, runId: string) => void;
}

export default function DTFConfig({
    order,
    locations,
    managers,
    onRefresh,
    onSaveSuccess,
}: DTFConfigProps) {
    const [localOrder, setLocalOrder] = useState<Order>(order);
    const [openRunId, setOpenRunId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isAddingRun, setIsAddingRun] = useState(false);
    const [isDeletingRun, setIsDeletingRun] = useState<string | null>(null);
    const [editingRunId, setEditingRunId] = useState<string | null>(null);
    const [expandedLayouts, setExpandedLayouts] = useState<boolean>(true);

    // State for local editing
    const [editForm, setEditForm] = useState<DTFRunValues | null>(null);

    // --- Image Handling ---
    const [runImages, setRunImages] = useState<Record<string, File[]>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<string, string[]>>({});

    const handleImageSelect = async (runId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        // ... (Same standard image upload logic)
        const files = e.target.files;
        if (!files) return;

        const fileArray = Array.from(files);
        const currentImages = runImages[runId] || [];

        if (currentImages.length + fileArray.length > 2) {
            alert('Maximum 2 photos allowed per run');
            return;
        }

        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const invalidFiles = fileArray.filter((file) => !validTypes.includes(file.type));

        if (invalidFiles.length > 0) {
            alert('Only JPEG, PNG, and WebP images are allowed');
            return;
        }

        const oversizedFiles = fileArray.filter((file) => file.size > 5 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            alert('Each image must be less than 5MB');
            return;
        }

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
                    return new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '') + '.webp', {
                        type: 'image/webp',
                        lastModified: Date.now(),
                    });
                } catch (error) {
                    console.error('Compression failed', error);
                    return file;
                }
            });

            const compressedFiles = await Promise.all(compressedFilesPromises);

            setRunImages((prev) => ({
                ...prev,
                [runId]: [...(prev[runId] || []), ...compressedFiles],
            }));

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

    const initialFormState: DTFRunValues = {
        particulars: '',
        isFusing: false,
        isJobDifference: false,
        pcs: 0,
        customPcs: 0,
        rate: 0,
        items: [],
    };

    const { hasPermission } = useAuth();
    const [runManagers, setRunManagers] = useState<
        Record<string, { executorId?: string; reviewerId?: string }>
    >({});



    const [runLocations, setRunLocations] = useState<Record<string, string>>({}); // runId -> locationId



    const handleManagerSelect = (
        runId: string,
        type: 'executorId' | 'reviewerId',
        userId: string,
    ) => {
        setRunManagers((prev) => ({ ...prev, [runId]: { ...prev[runId], [type]: userId } }));
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

    function parseItems(items: unknown): DTFItem[] {
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

    useEffect(() => {
        if (openRunId) {
            const process = localOrder.processes.find((p) => p.runs.some((r) => r.id === openRunId));
            const run = process?.runs.find((r) => r.id === openRunId);

            if (run) {
                const values = run.values as DTFRunValues;
                const existingItems = parseItems(values.items);
                setEditForm({
                    particulars: values.particulars || '',
                    isFusing: values.isFusing || false,
                    isJobDifference: values.isJobDifference || false,
                    pcs: values.pcs || 0,
                    customPcs: values.customPcs || 0,
                    rate: values.rate || 0,
                    items:
                        existingItems.length > 0
                            ? existingItems
                            : [
                                {
                                    particulars: '',
                                    height: 0,
                                    pcsPerLayout: 0,
                                    quantityActual: 0,
                                    adjustment: 0,
                                    fromOther: 0,
                                },
                            ],
                    images: values.images || [],
                });
            }
        } else {
            setEditForm(null);
        }
    }, [openRunId, localOrder]);

    // --- Calculations ---
    const calculateRow = (item: DTFItem, rate: number): DTFItem => {
        const width = 23;
        // "quantity req(qty act-from other)"
        const quantityRequired = (item.quantityActual || 0) - (item.fromOther || 0);
        // "layouts Req = ROUNDUP(Quantity Req / Pcs in Layout)"
        const numberOfLayouts =
            item.pcsPerLayout > 0 ? Math.ceil(quantityRequired / item.pcsPerLayout) : 0;
        // "Area(w*h)"
        const area = width * (item.height || 0);
        // "price/layout(rate*Area)"
        const pricePerLayout = rate * area;
        // "total(price/layout*no of layouts)"
        const rowTotal = numberOfLayouts * pricePerLayout;

        return {
            ...item,
            quantityRequired,
            numberOfLayouts,
            area,
            pricePerLayout,
            rowTotal,
        };
    };

    const getTotals = (items: DTFItem[], form: DTFRunValues) => {
        const safeItems = Array.isArray(items) ? items : [];

        const calculatedItems = safeItems.map((i) => calculateRow(i, form.rate || 0));

        const totalLayouts = calculatedItems.reduce((sum, i) => sum + (i.numberOfLayouts || 0), 0);
        const totalArea = calculatedItems.reduce((sum, i) => sum + (i.area || 0), 0);
        const layoutTotalAmount = calculatedItems.reduce((sum, i) => sum + (i.rowTotal || 0), 0);

        // "Total Meter = Sum(Height * Number of Layouts) / 39.38"
        const totalMeter =
            calculatedItems.reduce((sum, i) => sum + (i.height || 0) * (i.numberOfLayouts || 0), 0) /
            39.38;

        // "Actual Meter = 23 * 39.38 * Rate * TotalMeter"
        const actualMeter = 23 * 39.38 * (form.rate || 0) * totalMeter;

        // "Efficiency = 100 - ((Actual Meter Total - Layout Total Amount) / Layout Total Amount * 100)"
        const efficiency =
            layoutTotalAmount > 0
                ? 100 - ((actualMeter - layoutTotalAmount) / layoutTotalAmount) * 100
                : 0;

        // "Fusing Cost"
        // If (Fusing == Yes AND Job Diff == Yes): 5 * 2 * Custom PCS
        // If (Fusing == Yes AND Job Diff == No): 5 * 2 * PCS
        // If (Fusing == No): 0
        let actualFusingCost = 0;
        if (form.isFusing) {
            const fusingPcs = form.isJobDifference ? form.customPcs || 0 : form.pcs || 0;
            actualFusingCost = 5 * 2 * fusingPcs;
        }

        // "Actual Total"
        const baseTotal = Math.max(layoutTotalAmount, actualMeter);
        const actualTotal = baseTotal + actualFusingCost;

        // "Per PC Cost = Actual Total / PCS"
        const perPcCost = (form.pcs || 0) > 0 ? actualTotal / form.pcs : 0;
        return {
            totalLayouts,
            totalArea,
            layoutTotalAmount,
            totalMeter,
            actualMeter,
            efficiency,
            actualFusingCost,
            actualTotal,
            perPcCost,
            items: calculatedItems,
        };
    };

    const updateField = (field: keyof DTFRunValues, value: any) => {
        setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    };

    const updateItem = (index: number, field: keyof DTFItem, value: any) => {
        setEditForm((prev) => {
            if (!prev) return prev;
            const newItems = [...prev.items];
            newItems[index] = { ...newItems[index], [field]: value };
            return { ...prev, items: newItems };
        });
    };

    const addItem = () => {
        setEditForm((prev) =>
            prev
                ? {
                    ...prev,
                    items: [
                        ...prev.items,
                        {
                            particulars: '',
                            height: 0,
                            pcsPerLayout: 0,
                            quantityActual: 0,
                            adjustment: 0,
                            fromOther: 0,
                        },
                    ],
                }
                : prev,
        );
    };

    const deleteItem = (index: number) => {
        setEditForm((prev) =>
            prev ? { ...prev, items: prev.items.filter((_, i) => i !== index) } : prev,
        );
    };

    const saveRun = async (processId: string, runId: string) => {
        if (!editForm) return;
        if (!editForm.particulars || !editForm.pcs) {
            alert('Required fields missing');
            return;
        }

        const totals = getTotals(editForm.items, editForm);

        const apiValues = {
            ...editForm,
            items: totals.items,

            // Summaries
            'Total Layouts': totals.totalLayouts,
            'Total Area': totals.totalArea,
            'Layout Amount': Number(totals.layoutTotalAmount.toFixed(2)),
            'Actual Meter Cost': Number(totals.actualMeter.toFixed(2)),
            'Efficiency %': Number(totals.efficiency.toFixed(2)),
            'Fusing Cost': Number(totals.actualFusingCost.toFixed(2)),
            'Actual Total': Number(totals.actualTotal.toFixed(2)),
            'Per PC Cost': Number(totals.perPcCost.toFixed(2)),

            'Estimated Amount': Number(totals.actualTotal.toFixed(2)),
        };

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
                    await fetch(uploadUrl, {
                        method: 'PUT',
                        body: file,
                        headers: { 'Content-Type': file.type },
                    });
                    return publicUrl;
                });
                imageUrls.push(...(await Promise.all(uploadPromises)));
            }

            const managerSelection = runManagers[runId];
            const process = localOrder.processes.find((p) => p.id === processId);
            const run = process?.runs.find((r) => r.id === runId);

            const res = await configureRun(
                localOrder.id,
                processId,
                runId,
                apiValues,
                imageUrls,
                managerSelection?.executorId ?? run?.executor?.id,
                managerSelection?.reviewerId ?? run?.reviewer?.id,
                runLocations[runId] ?? run?.locationId ?? undefined
            );

            if (res.success) {
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

    const SearchableManagerSelect = ({ label, valueId, onChange, users }: any) => (
        <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">{label}</label>
            <select
                className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                value={valueId || ''}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">Select {label}...</option>
                {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                        {u.name}
                    </option>
                ))}
            </select>
        </div>
    );

    const renderRun = (process: any, run: ProcessRun) => {
        const isConfigured = run.configStatus === 'COMPLETE';
        const isEditing = editingRunId === run.id;
        const mode = isConfigured && !isEditing ? 'view' : 'edit';
        const data = mode === 'view' ? (run.values as DTFRunValues) : editForm || initialFormState;
        const totals = getTotals(parseItems(data.items) || [], data);
        const savedImages = (mode === 'view' ? data.images || [] : []) as string[];

        return (
            <div className="bg-gray-50 border border-gray-300 rounded p-3">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-2 h-2 rounded-full ${mode === 'edit' ? 'bg-blue-500' : 'bg-green-500'}`}
                        />
                        <h3 className="font-semibold text-sm">
                            {mode === 'edit' ? `Configure DTF Run ${run.runNumber}` : `DTF Run ${run.runNumber}`}
                        </h3>
                    </div>
                    {mode === 'view' && hasPermission(Permission.RUNS_UPDATE) && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setEditingRunId(run.id)}
                                className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs border border-blue-200"
                            >
                                Edit
                            </button>
                            <button onClick={() => setOpenRunId(null)}>
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                    )}
                    {mode === 'edit' && (
                        <button
                            onClick={() => {
                                setOpenRunId(null);
                                setEditingRunId(null);
                            }}
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    )}
                </div>

                <div className="bg-white border border-gray-200 rounded p-4 space-y-6">
                    {/* 2. TOP SECTION */}
                    {mode === 'edit' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
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
                            </div>
                            <div className="mb-4">
                                <SearchableLocationSelect
                                    label="Location"
                                    locations={locations}
                                    valueId={runLocations[run.id] ?? run.location?.id ?? undefined}
                                    onChange={(id: string) => setRunLocations(prev => ({ ...prev, [run.id]: id }))}
                                />
                            </div>
                        </>

                    )}

                    {/* Location Read Only */}
                    {mode === 'view' && run.location && (
                        <div className="mb-4 text-xs flex items-center gap-1 text-gray-600">
                            <span className="font-semibold">Location: </span>
                            <span className="font-medium text-gray-800">{run.location.name} ({run.location.code})</span>
                        </div>
                    )}

                    {/* 3. PRIMARY INPUTS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div className="lg:col-span-1">
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                                Particulars <span className="text-red-500">*</span>
                            </label>
                            {mode === 'edit' ? (
                                <input
                                    className="w-full border p-1 rounded text-sm"
                                    value={data.particulars || ''}
                                    onChange={(e) => updateField('particulars', e.target.value)}
                                />
                            ) : (
                                <div className="text-sm border-b pb-1">{data.particulars}</div>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                                PCS <span className="text-red-500">*</span>
                                <span className="text-gray-500 text-[10px] ml-1">
                                    (Ord. Qty: {localOrder.quantity})
                                </span>
                            </label>
                            {mode === 'edit' ? (
                                <input
                                    type="number"
                                    className="w-full border p-1 rounded text-sm"
                                    value={data.pcs}
                                    onChange={(e) => updateField('pcs', parseFloat(e.target.value) || 0)}
                                />
                            ) : (
                                <div className="text-sm border-b pb-1">{data.pcs}</div>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer border p-2 rounded hover:bg-gray-50 w-full justify-center">
                                <input
                                    type="checkbox"
                                    checked={data.isFusing}
                                    disabled={mode === 'view'}
                                    onChange={(e) => {
                                        updateField('isFusing', e.target.checked);
                                        if (!e.target.checked) updateField('isJobDifference', false); // Type safety: reset job diff if fusing off
                                    }}
                                    className="w-4 h-4"
                                />
                                <span className="text-gray-700 font-medium">Fusing</span>
                            </label>
                            {data.isFusing && (
                                <label className="flex items-center gap-2 text-sm cursor-pointer border p-2 rounded hover:bg-gray-50 w-full justify-center">
                                    <input
                                        type="checkbox"
                                        checked={data.isJobDifference}
                                        disabled={mode === 'view'}
                                        onChange={(e) => updateField('isJobDifference', e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-gray-700 font-medium">Job Diff</span>
                                </label>
                            )}
                        </div>
                        {data.isFusing && data.isJobDifference && (
                            <div>
                                <label className="text-xs font-semibold text-blue-700 block mb-1">Custom PCS</label>
                                {mode === 'edit' ? (
                                    <input
                                        type="number"
                                        className="w-full border border-blue-300 bg-blue-50 p-1 rounded text-sm"
                                        value={data.customPcs}
                                        onChange={(e) => updateField('customPcs', parseFloat(e.target.value) || 0)}
                                    />
                                ) : (
                                    <div className="text-sm font-medium text-blue-700">{data.customPcs}</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 4. LAYOUT DETAILS (Collapsible) */}
                    <div className="border rounded overflow-hidden">
                        <button
                            onClick={() => setExpandedLayouts(!expandedLayouts)}
                            className="w-full bg-gray-100 p-2 flex items-center justify-between hover:bg-gray-200 transition-colors"
                        >
                            <span className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                                <Eye className="w-4 h-4" /> Layout Details
                            </span>
                            {expandedLayouts ? (
                                <ChevronUp className="w-4 h-4" />
                            ) : (
                                <ChevronDown className="w-4 h-4" />
                            )}
                        </button>

                        {expandedLayouts && (
                            <div className="p-3 bg-white overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-gray-50 border-b text-gray-600">
                                            <th className="p-2 text-center w-8">#</th>
                                            <th className="p-2 text-left w-32">Particulars</th>
                                            <th className="p-2 text-center w-12 text-gray-400">W</th>
                                            <th className="p-2 text-center w-16">H</th>
                                            <th className="p-2 text-center w-16">Pcs</th>
                                            <th className="p-2 text-center w-16">Qty Act</th>
                                            <th className="p-2 text-center w-16">Adjust</th>
                                            <th className="p-2 text-center w-16">Other</th>
                                            <th className="p-2 text-center w-16 bg-gray-50">Req</th>
                                            <th className="p-2 text-center w-16 bg-gray-50">Layouts</th>
                                            <th className="p-2 text-center w-16 bg-gray-50">Area</th>
                                            <th className="p-2 text-right bg-blue-50">Price/Layout</th>
                                            <th className="p-2 text-right bg-blue-50">Total</th>
                                            {mode === 'edit' && <th className="p-2 w-8"></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {totals.items.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="p-2 text-center text-gray-500 font-mono">{idx + 1}</td>
                                                <td className="p-2">
                                                    {mode === 'edit' ? (
                                                        <input
                                                            type="text"
                                                            className="w-full border rounded p-1 text-left"
                                                            value={item.particulars || ''}
                                                            onChange={(e) => updateItem(idx, 'particulars', e.target.value)}
                                                        />
                                                    ) : (
                                                        item.particulars
                                                    )}
                                                </td>
                                                <td className="p-2 text-center text-gray-400">23</td>
                                                <td className="p-2 text-center">
                                                    {mode === 'edit' ? (
                                                        <input
                                                            type="number"
                                                            className="w-16 border rounded p-1 text-center"
                                                            value={item.height}
                                                            onChange={(e) =>
                                                                updateItem(idx, 'height', parseFloat(e.target.value) || 0)
                                                            }
                                                        />
                                                    ) : (
                                                        item.height
                                                    )}
                                                </td>
                                                <td className="p-2 text-center">
                                                    {mode === 'edit' ? (
                                                        <input
                                                            type="number"
                                                            className="w-16 border rounded p-1 text-center"
                                                            value={item.pcsPerLayout}
                                                            onChange={(e) =>
                                                                updateItem(idx, 'pcsPerLayout', parseFloat(e.target.value) || 0)
                                                            }
                                                        />
                                                    ) : (
                                                        item.pcsPerLayout
                                                    )}
                                                </td>
                                                <td className="p-2 text-center">
                                                    {mode === 'edit' ? (
                                                        <input
                                                            type="number"
                                                            className="w-16 border rounded p-1 text-center"
                                                            value={item.quantityActual}
                                                            onChange={(e) =>
                                                                updateItem(idx, 'quantityActual', parseFloat(e.target.value) || 0)
                                                            }
                                                        />
                                                    ) : (
                                                        item.quantityActual
                                                    )}
                                                </td>
                                                <td className="p-2 text-center">
                                                    {mode === 'edit' ? (
                                                        <input
                                                            type="number"
                                                            className="w-16 border rounded p-1 text-center"
                                                            value={item.adjustment}
                                                            onChange={(e) =>
                                                                updateItem(idx, 'adjustment', parseFloat(e.target.value) || 0)
                                                            }
                                                        />
                                                    ) : (
                                                        item.adjustment
                                                    )}
                                                </td>
                                                <td className="p-2 text-center">
                                                    {mode === 'edit' ? (
                                                        <input
                                                            type="number"
                                                            className="w-16 border rounded p-1 text-center"
                                                            value={item.fromOther}
                                                            onChange={(e) =>
                                                                updateItem(idx, 'fromOther', parseFloat(e.target.value) || 0)
                                                            }
                                                        />
                                                    ) : (
                                                        item.fromOther
                                                    )}
                                                </td>
                                                <td className="p-2 text-center font-medium text-gray-600">
                                                    {Math.round(item.quantityRequired || 0)}
                                                </td>
                                                <td className="p-2 text-center font-medium text-gray-600">
                                                    {item.numberOfLayouts}
                                                </td>
                                                <td className="p-2 text-center text-gray-500">{item.area}</td>
                                                <td className="p-2 text-right font-medium text-blue-600">
                                                    {item.pricePerLayout?.toFixed(2)}
                                                </td>
                                                <td className="p-2 text-right font-bold text-blue-600">
                                                    {item.rowTotal?.toFixed(2)}
                                                </td>
                                                {mode === 'edit' && (
                                                    <td className="text-center">
                                                        <button
                                                            onClick={() => deleteItem(idx)}
                                                            className="text-red-400 hover:text-red-600"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 font-semibold text-gray-700">
                                        <tr>
                                            <td
                                                colSpan={9}
                                                className="p-2 text-right text-gray-500 uppercase text-[10px] tracking-wider"
                                            >
                                                Layout Totals
                                            </td>
                                            <td className="p-2 text-center">{totals.totalLayouts}</td>
                                            <td className="p-2 text-center">{totals.totalArea}</td>
                                            <td className="p-2"></td>
                                            <td className="p-2 text-right">{totals.layoutTotalAmount.toFixed(2)}</td>
                                            {mode === 'edit' && <td></td>}
                                        </tr>
                                    </tfoot>
                                </table>
                                {mode === 'edit' && (
                                    <button
                                        onClick={addItem}
                                        className="mt-2 text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                    >
                                        <Plus className="w-3 h-3" /> Add Layout Row
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 6. RATE & METERS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-4 rounded border">
                        <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Rate</label>
                            {mode === 'edit' ? (
                                <input
                                    type="number"
                                    className="w-full border p-1 rounded text-sm font-semibold"
                                    value={data.rate}
                                    onChange={(e) => updateField('rate', parseFloat(e.target.value) || 0)}
                                />
                            ) : (
                                <div className="text-sm font-bold">{data.rate}</div>
                            )}
                        </div>
                        <div className="text-right sm:text-left">
                            <label className="text-[10px] uppercase text-gray-500 block">Total Mtr</label>
                            <div className="text-sm font-medium">{totals.totalMeter.toFixed(2)}</div>
                        </div>
                        <div className="text-right sm:text-left">
                            <label className="text-[10px] uppercase text-gray-500 block">Act. Meter Total</label>
                            <div className="text-sm font-medium">{totals.actualMeter.toFixed(2)}</div>
                        </div>
                        <div className="text-right sm:text-left">
                            <label className="text-[10px] uppercase text-gray-500 block">Efficiency</label>
                            <div
                                className={`text-sm font-medium ${totals.efficiency < 0 ? 'text-red-500' : 'text-green-600'}`}
                            >
                                {totals.efficiency.toFixed(2)}%
                            </div>
                        </div>
                    </div>

                    {/* 7. FUSING COST & FINAL AMOUNT */}
                    <div className="flex flex-col sm:flex-row justify-end items-end gap-6 bg-blue-50 p-4 rounded border border-blue-100">
                        {data.isFusing && (
                            <div className="text-right">
                                <label className="text-xs text-blue-400 uppercase tracking-wider block">
                                    Fusing Cost
                                </label>
                                <div className="text-lg font-semibold text-blue-800">
                                    {totals.actualFusingCost.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-blue-400">
                                    {data.isJobDifference ? '5 x 2 x Custom PCS' : '5 x 2 x PCS'}
                                </div>
                            </div>
                        )}
                        <div className="text-right">
                            <label className="text-xs text-gray-500 uppercase tracking-wider block">
                                Per PC Cost
                            </label>
                            <div className="text-lg font-medium text-gray-700">{totals.perPcCost.toFixed(2)}</div>
                        </div>
                        <div className="text-right">
                            <label className="text-xs text-gray-500 uppercase tracking-wider block">
                                Actual Total
                            </label>
                            <div className="text-2xl font-bold text-gray-900 border-b-2 border-gray-900 leading-none pb-1">
                                {totals.actualTotal.toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* IMAGE UPLOAD SECTION */}
                    {mode === 'edit' && (
                        <div className="mt-3 border border-gray-300 rounded overflow-hidden bg-white p-3">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                                    <Palette className="w-3.5 h-3.5" /> Reference Images
                                </label>
                                <div className="text-xs text-gray-500">
                                    {(runImages[run.id] || []).length}/2 uploaded
                                </div>
                            </div>
                            <div className="flex gap-3 items-start">
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
                                            <span className="text-[10px] text-gray-500 mt-1">Add</span>
                                        </label>
                                    </div>
                                )}
                                {(imagePreviews[run.id] || []).map((preview, idx) => (
                                    <div
                                        key={idx}
                                        className="relative group w-20 h-20 border rounded-lg overflow-hidden"
                                    >
                                        <img
                                            src={preview}
                                            alt={`Preview ${idx}`}
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
                    )}
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

                    {/* SAVE */}
                    {mode === 'edit' && (
                        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                            <button
                                onClick={() => {
                                    setOpenRunId(null);
                                    setEditingRunId(null);
                                }}
                                className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => saveRun(process.id, run.id)}
                                disabled={isSaving === run.id}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isSaving === run.id ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {localOrder.processes.map((process) => (
                <div key={process.id}>
                    {process.runs.map((run) => (
                        <div key={run.id} className="mb-4">
                            {!openRunId || openRunId !== run.id ? (
                                <div
                                    onClick={() => setOpenRunId(run.id)}
                                    className={`p-3 border rounded cursor-pointer flex justify-between items-center ${run.configStatus === 'COMPLETE' ? 'bg-green-50 border-green-200' : 'bg-white hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-2 h-2 rounded-full ${run.configStatus === 'COMPLETE' ? 'bg-green-500' : 'bg-yellow-500'}`}
                                        />
                                        <span className="font-medium text-sm">Run {run.runNumber}</span>
                                        {run.configStatus === 'COMPLETE' && (
                                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" /> Configured
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                </div>
                            ) : (
                                renderRun(process, run)
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
