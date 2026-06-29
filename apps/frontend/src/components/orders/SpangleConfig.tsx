import {
    Calendar,
    CheckCircle,
    ChevronRight,
    Edit,
    Eye,
    FileText,
    Grid,
    IndianRupee,
    Loader2,
    MapPin,
    Package,
    Plus,
    Ruler,
    Trash2,
    X,
    ClipboardPaste
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import SearchableLocationSelect from '../common/SearchableLocationSelect';
import SearchableManagerSelect from '../common/SearchableManagerSelect';
import RunCommentEditor from './RunCommentEditor';
import CreditLimitErrorDialog from '@/components/common/CreditLimitErrorDialog';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { Location } from '@/domain/model/location.model';
import { Order } from '@/domain/model/order.model';
import { ProcessRun } from '@/domain/model/run.model';
import { addRunToProcess, deleteProcessFromOrder, deleteRunFromProcess } from '@/services/orders.service';
import { configureRun } from '@/services/run.service';
import { User as ManagerUser } from '@/services/user.service';

interface SpangleConfigProps {
    order: Order;
    locations: Location[];
    managers: ManagerUser[];
    onSaveSuccess?: (processId: string, runId: string) => void;
    onRefresh?: () => Promise<void>;
}

interface SpangleItem {
    design: string;
    quantity: number;
    dotSize: number;
    cd: number;
    dotsReq: number;
    rate: number;
    amount: number;
}

interface SpangleRunValues {
    quantity: number;
    rate: number;
    amount: number;
    items: SpangleItem[] | string;
    images?: string[];
}

function parseItems(items: unknown): SpangleItem[] {
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

const getTotals = (items: SpangleItem[]) => {
    const safeItems = Array.isArray(items) ? items : [];

    const calculatedItems = safeItems.map((item) => {
        const rate = (Number(item.dotsReq) || 0) / 100;
        const amount = (Number(item.quantity) || 0) * rate;
        return {
            ...item,
            rate,
            amount
        };
    });

    const totalQuantity = calculatedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const totalAmount = calculatedItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    const averageRate = totalQuantity > 0 ? totalAmount / totalQuantity : 0;

    return {
        totalQuantity,
        totalAmount,
        averageRate,
        items: calculatedItems
    };
};

export default function SpangleConfig({
    order,
    locations,
    managers,
    onSaveSuccess,
    onRefresh,
}: SpangleConfigProps) {
    const { hasPermission } = useAuth();
    const [localOrder, setLocalOrder] = useState<Order>(order);
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [creditLimitError, setCreditLimitError] = useState<string | null>(null);

    // Run Operations State
    const [isAddingRun, setIsAddingRun] = useState(false);
    const [isDeletingRun, setIsDeletingRun] = useState<string | null>(null);

    // Editing State
    const [editingRunId, setEditingRunId] = useState<string | null>(null);
    const [openRunId, setOpenRunId] = useState<string | null>(null);

    // State for local editing
    const [editForm, setEditForm] = useState<any | null>(null);
    const [pasteSuccess, setPasteSuccess] = useState<string | null>(null);
    const pasteToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // UI State
    const [runManagers, setRunManagers] = useState<Record<string, { executorId?: string; reviewerId?: string }>>({});
    const [runImages, setRunImages] = useState<Record<string, File[]>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<string, string[]>>({});
    const [existingRunImages, setExistingRunImages] = useState<Record<string, string[]>>({});

    const [runLocations, setRunLocations] = useState<Record<string, string>>({}); // runId -> locationId
    const [preProdLocations, setPreProdLocations] = useState<Record<string, string>>({});
    const [postProdLocations, setPostProdLocations] = useState<Record<string, string>>({});

    // Sync state when order changes
    useEffect(() => {
        setLocalOrder(order);
        
        const initImages: Record<string, string[]> = {};
        order.processes.forEach(p => p.runs.forEach(r => {
            if (r.values?.images && Array.isArray(r.values.images) && r.values.images.length > 0) {
                initImages[r.id] = r.values.images as string[];
            }
        }));
        setExistingRunImages(initImages);
    }, [order]);

    // Initialize state when opening a run
    useEffect(() => {
        if (openRunId) {
            let run: ProcessRun | undefined;
            for (const p of localOrder.processes) {
                run = p.runs.find(r => r.id === openRunId);
                if (run) break;
            }

            if (run) {
                const values = (run.values || {}) as any;
                const existingItems = parseItems(values.items);
                setEditForm({
                    quantity: values.quantity || 0,
                    rate: values.rate || 0,
                    amount: values.amount || 0,
                    items: existingItems.length > 0 ? existingItems : [
                        { design: '', quantity: 0, dotSize: 0, cd: 0, dotsReq: 0, rate: 0, amount: 0 }
                    ],
                    images: values.images || []
                });

                if (run.location?.id) {
                    setRunLocations(prev => ({ ...prev, [run!.id]: run!.location!.id }));
                }
                if (run.preProductionLocation?.id) {
                    setPreProdLocations(prev => ({ ...prev, [run!.id]: run!.preProductionLocation!.id }));
                }
                if (run.postProductionLocation?.id) {
                    setPostProdLocations(prev => ({ ...prev, [run!.id]: run!.postProductionLocation!.id }));
                }
            }
        } else {
            setEditForm(null);
        }
    }, [openRunId, localOrder]);

    const handleAddRun = async (processId: string) => {
        setIsAddingRun(true);
        try {
            await addRunToProcess(localOrder.id, processId);
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Failed to add run');
        } finally {
            setIsAddingRun(false);
        }
    };

    const handleDeleteRun = async (processId: string, runId: string) => {
        if (!confirm('Delete this run?')) return;
        setIsDeletingRun(runId);
        try {
            await deleteRunFromProcess(localOrder.id, processId, runId);
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete run');
        } finally {
            setIsDeletingRun(null);
        }
    };

    const handleDeleteProcess = async (processId: string) => {
        if (!confirm('Are you sure you want to delete this entire process? This action cannot be undone.')) {
            return;
        }
        try {
            await deleteProcessFromOrder(localOrder.id, processId);
            if (onRefresh) await onRefresh();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to delete process');
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

    const removeExistingImage = (runId: string, index: number) => {
        setExistingRunImages(prev => {
            const newImages = [...(prev[runId] || [])];
            newImages.splice(index, 1);
            return { ...prev, [runId]: newImages };
        });
    };

    const updateItem = (index: number, field: keyof SpangleItem, value: any) => {
        setEditForm((prev: any) => {
            if (!prev) return prev;
            const newItems = [...prev.items];
            let typedValue = value;
            if (field !== 'design') {
                typedValue = value === '' ? '' : Number(value);
            }
            newItems[index] = { ...newItems[index], [field]: typedValue };
            
            // Recalculate row rate & amount immediately
            const rate = field === 'dotsReq' ? (Number(typedValue) || 0) / 100 : (Number(newItems[index].dotsReq) || 0) / 100;
            const quantity = field === 'quantity' ? (Number(typedValue) || 0) : (Number(newItems[index].quantity) || 0);
            newItems[index].rate = rate;
            newItems[index].amount = quantity * rate;
            
            return { ...prev, items: newItems };
        });
    };

    const addRow = () => {
        setEditForm((prev: any) => {
            if (!prev) return prev;
            return {
                ...prev,
                items: [
                    ...prev.items,
                    { design: '', quantity: 0, dotSize: 0, cd: 0, dotsReq: 0, rate: 0, amount: 0 }
                ]
            };
        });
    };

    const deleteRow = (index: number) => {
        setEditForm((prev: any) => {
            if (!prev) return prev;
            return {
                ...prev,
                items: prev.items.filter((_: any, i: number) => i !== index)
            };
        });
    };

    const updateRunState = (processId: string, runId: string, updates: any) => {
        setLocalOrder(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                processes: prev.processes.map(p => p.id !== processId ? p : {
                    ...p,
                    runs: p.runs.map(r => r.id !== runId ? r : { ...r, ...updates })
                })
            };
        });
    };

    const saveRun = async (processId: string, runId: string) => {
        if (!editForm) return;

        let currentPreProdLocationId: string | undefined;
        let currentPostProdLocationId: string | undefined;
        for (const p of localOrder.processes) {
            const r = p.runs.find(run => run.id === runId);
            if (r) {
                currentPreProdLocationId = r.preProductionLocation?.id;
                currentPostProdLocationId = r.postProductionLocation?.id;
                break;
            }
        }

        const preLoc = preProdLocations[runId] ?? currentPreProdLocationId;
        const postLoc = postProdLocations[runId] ?? currentPostProdLocationId;

        if (!preLoc || !postLoc) {
            toast.error('Please select both Pre-Prod and Post-Prod locations.');
            return;
        }

        const totals = getTotals(editForm.items);

        // Validation
        if (totals.items.some(item => !item.design || !item.quantity || !item.dotsReq)) {
            toast.error('Please fill in Design size, Qty, and Dots Req for all rows.');
            return;
        }

        setIsSaving(runId);

        try {
            // Upload Reference Images
            const images = runImages[runId] || [];
            const imageUrls = [...(existingRunImages[runId] || [])];

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

            const apiValues = {
                quantity: totals.totalQuantity,
                rate: totals.averageRate,
                amount: totals.totalAmount,
                items: JSON.stringify(totals.items),
                'Estimated Amount': totals.totalAmount // Required for order estimate calculations
            };

            const managerSelection = runManagers[runId];

            // Find current run executor/reviewer/locations if not changed in UI
            let currentExecutorId: string | undefined;
            let currentReviewerId: string | undefined;
            let currentPreProdLocationId: string | undefined;
            let currentPostProdLocationId: string | undefined;
            for (const p of localOrder.processes) {
                const r = p.runs.find(run => run.id === runId);
                if (r) {
                    currentExecutorId = r.executor?.id;
                    currentReviewerId = r.reviewer?.id;
                    currentPreProdLocationId = r.preProductionLocation?.id;
                    currentPostProdLocationId = r.postProductionLocation?.id;
                    break;
                }
            }

            const res = await configureRun(
                localOrder.id,
                processId,
                runId,
                apiValues,
                imageUrls,
                managerSelection?.executorId ?? currentExecutorId,
                managerSelection?.reviewerId ?? currentReviewerId,
                undefined,
                undefined,
                preProdLocations[runId] ?? currentPreProdLocationId,
                postProdLocations[runId] ?? currentPostProdLocationId
            );

            if (res.success) {
                const selectedExecutor = (managerSelection?.executorId) ? managers.find(u => u.id === managerSelection.executorId) : null;
                const selectedReviewer = (managerSelection?.reviewerId) ? managers.find(u => u.id === managerSelection.reviewerId) : null;

                updateRunState(processId, runId, {
                    configStatus: 'COMPLETE',
                    executor: selectedExecutor ? { id: selectedExecutor.id, name: selectedExecutor.name } : null,
                    reviewer: selectedReviewer ? { id: selectedReviewer.id, name: selectedReviewer.name } : null
                });

                setRunImages(prev => { const n = { ...prev }; delete n[runId]; return n; });
                setImagePreviews(prev => { const n = { ...prev }; delete n[runId]; return n; });

                setOpenRunId(null);
                setEditingRunId(null);
                if (onSaveSuccess) onSaveSuccess(processId, runId);
                if (onRefresh) await onRefresh();
            } else {
                throw new Error('Save failed');
            }

        } catch (err: any) {
            console.error(err);
            const msg = err.message || 'Save failed';
            if (msg.toLowerCase().includes('credit limit')) {
                setCreditLimitError(msg);
            } else {
                toast.error(msg);
            }
        } finally {
            setIsSaving(null);
        }
    };

    const toggleRunOpen = (run: ProcessRun) => {
        if (openRunId === run.id) {
            setOpenRunId(null);
            if (editingRunId === run.id) setEditingRunId(null);
        } else {
            setOpenRunId(run.id);
            if (run.configStatus !== 'COMPLETE') setEditingRunId(run.id);
        }
    };

    const renderRun = (process: any, run: ProcessRun) => {
        const isConfigured = run.configStatus === 'COMPLETE';
        const isEditing = editingRunId === run.id;
        const mode = isConfigured && !isEditing ? 'view' : 'edit';

        const data = mode === 'view' ? (run.values || {}) : editForm || {
            quantity: 0,
            rate: 0,
            amount: 0,
            items: []
        };

        const items = parseItems(data.items);
        const totals = getTotals(items);

        const handlePasteToFill = (e: React.ClipboardEvent<HTMLDivElement>) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

            const text = e.clipboardData.getData('text');
            if (!text.includes('\t') && !text.includes('\n')) return;

            e.preventDefault();

            const rows = text.split('\n').map(r => r.replace(/\r$/, '')).filter(r => r.trim() !== '');
            if (rows.length === 0) return;

            const newItems: SpangleItem[] = rows.map(row => {
                const cols = row.split('\t');
                const qty = parseFloat(cols[1]?.replace(/,/g, '')) || 0;
                const dotsReq = parseFloat(cols[4]?.replace(/,/g, '')) || 0;
                const rate = dotsReq / 100;
                const amount = qty * rate;
                return {
                    design: cols[0]?.trim() || '',
                    quantity: qty,
                    dotSize: parseFloat(cols[2]?.replace(/,/g, '')) || 0,
                    cd: parseFloat(cols[3]?.replace(/,/g, '')) || 0,
                    dotsReq: dotsReq,
                    rate: rate,
                    amount: amount
                };
            });

            setEditForm((prev: any) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    items: newItems
                };
            });

            if (pasteToastRef.current) clearTimeout(pasteToastRef.current);
            setPasteSuccess(`✓ Pasted ${newItems.length} rows from Excel!`);
            pasteToastRef.current = setTimeout(() => setPasteSuccess(null), 3500);
        };

        return (
            <div className="bg-gray-50 border border-gray-300 rounded p-2 sm:p-3" onPaste={handlePasteToFill}>
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${mode === 'edit' ? 'bg-blue-500' : 'bg-green-500'}`} />
                        <h3 className="font-semibold text-sm">
                            {mode === 'edit' ? `Configure Spangle Run ${run.runNumber}` : `Spangle Run ${run.runNumber}`}
                        </h3>
                        {mode === 'view' && (
                            <div className="flex gap-1 ml-2">
                                {run.preProductionLocation && (
                                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1" title="Pre-Production Location">
                                        <MapPin className="w-3 h-3" />
                                        PRE: {run.preProductionLocation.code}
                                    </span>
                                )}
                                {run.postProductionLocation && (
                                    <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full flex items-center gap-1" title="Post-Production Location">
                                        <MapPin className="w-3 h-3" />
                                        POST: {run.postProductionLocation.code}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    {mode === 'view' && hasPermission(Permission.RUNS_UPDATE) && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    setEditingRunId(run.id);
                                    // Load editing state
                                    const parsed = parseItems((run.values || {}).items);
                                    setEditForm({
                                        quantity: run.values.quantity || 0,
                                        rate: run.values.rate || 0,
                                        amount: run.values.amount || 0,
                                        items: parsed.length > 0 ? parsed : [{ design: '', quantity: 0, dotSize: 0, cd: 0, dotsReq: 0, rate: 0, amount: 0 }],
                                        images: run.values.images || []
                                    });
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-200 transition-colors"
                            >
                                <Edit className="w-3 h-3" />
                                Edit
                            </button>
                            <button onClick={() => setOpenRunId(null)} className="text-gray-500 hover:text-gray-700 text-sm">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {mode === 'edit' && (
                        <button onClick={() => { setOpenRunId(null); setEditingRunId(null); }}>
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    )}
                </div>

                <div className="bg-white border border-gray-200 rounded p-3 sm:p-4 space-y-6">
                    {mode === 'edit' && (
                        <div className="mb-3 flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                            <ClipboardPaste className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-blue-700">
                                    Paste to Fill Table
                                    <span className="ml-1.5 text-[10px] font-normal text-blue-500">
                                        Copy rows from Excel &amp; press <kbd className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[9px]">Ctrl+V</kbd> outside fields
                                    </span>
                                </p>
                                <p className="text-[10px] text-blue-400 mt-0.5 font-mono leading-relaxed truncate">
                                    Cols: <span className="text-blue-500">Design Sizes → Qty → Dot Size → CD → Dots Req</span>
                                </p>
                            </div>
                        </div>
                    )}

                    {mode === 'edit' && pasteSuccess && (
                        <div className="mb-3 flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-xs text-green-700 font-medium">{pasteSuccess}</p>
                        </div>
                    )}

                    {/* Location & Manager Select (Edit Mode) */}
                    {mode === 'edit' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <SearchableLocationSelect
                                    label="Pre-Prod Location"
                                    locations={locations}
                                    valueId={preProdLocations[run.id] ?? run.preProductionLocation?.id}
                                    onChange={(id) => setPreProdLocations(prev => ({ ...prev, [run.id]: id }))}
                                    required
                                />
                                <SearchableLocationSelect
                                    label="Post-Prod Location"
                                    locations={locations}
                                    valueId={postProdLocations[run.id] ?? run.postProductionLocation?.id}
                                    onChange={(id) => setPostProdLocations(prev => ({ ...prev, [run.id]: id }))}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <SearchableManagerSelect
                                    label="Executor"
                                    users={managers}
                                    selectedUserId={runManagers[run.id]?.executorId ?? run.executor?.id ?? null}
                                    onSelect={(id: string) => handleManagerSelect(run.id, 'executorId', id)}
                                />
                                <SearchableManagerSelect
                                    label="Reviewer"
                                    users={managers}
                                    selectedUserId={runManagers[run.id]?.reviewerId ?? run.reviewer?.id ?? null}
                                    onSelect={(id: string) => handleManagerSelect(run.id, 'reviewerId', id)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Compact read-only view of managers/locations */}
                    {mode === 'view' && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-2 bg-gray-50 rounded border text-xs">
                            <div>
                                <span className="text-gray-500 font-semibold block">Executor</span>
                                <span className="font-medium text-gray-800">{run.executor?.name || '-'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 font-semibold block">Reviewer</span>
                                <span className="font-medium text-gray-800">{run.reviewer?.name || '-'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 font-semibold block">Pre-Prod Location</span>
                                <span className="font-medium text-gray-800">{run.preProductionLocation?.code || '-'}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 font-semibold block">Post-Prod Location</span>
                                <span className="font-medium text-gray-800">{run.postProductionLocation?.code || '-'}</span>
                            </div>
                        </div>
                    )}

                    {/* Spangle Grid Items Table */}
                    <div className="border rounded overflow-hidden">
                        <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
                            <span className="font-semibold text-xs text-gray-700 flex items-center gap-1.5">
                                <Grid className="w-4 h-4 text-blue-600" /> Size Configuration Details
                            </span>
                            {mode === 'edit' && (
                                <button
                                    onClick={addRow}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Add Size Row
                                </button>
                            )}
                        </div>

                        <div className="p-3 overflow-x-auto bg-white">
                            <table className="w-full text-xs min-w-max border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b text-gray-600 uppercase tracking-wider text-[10px] text-center font-bold">
                                        <th className="p-2 border-r w-8">#</th>
                                        <th className="p-2 border-r w-24 text-left">Design Sizes</th>
                                        <th className="p-2 border-r w-20">Qty</th>
                                        <th className="p-2 border-r w-20">Dot Size</th>
                                        <th className="p-2 border-r w-24">CD</th>
                                        <th className="p-2 border-r w-20">Dots Req</th>
                                        <th className="p-2 border-r w-20 bg-blue-50/50">Rate</th>
                                        <th className="p-2 w-24 bg-blue-50/50">Amount</th>
                                        {mode === 'edit' && <th className="p-2 w-8"></th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {totals.items.map((item, idx) => (
                                        <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                            {/* Row # */}
                                            <td className="p-2 border-r text-center font-semibold text-gray-400">{idx + 1}</td>
                                            
                                            {/* Design Sizes */}
                                            <td className="p-2 border-r">
                                                {mode === 'edit' ? (
                                                    <input
                                                        type="text"
                                                        className="w-full border rounded px-1.5 py-0.5 text-sm"
                                                        value={item.design}
                                                        onChange={(e) => updateItem(idx, 'design', e.target.value)}
                                                        placeholder="e.g. 1"
                                                    />
                                                ) : (
                                                    <span className="font-medium text-gray-800">{item.design}</span>
                                                )}
                                            </td>

                                            {/* Qty */}
                                            <td className="p-2 border-r text-center">
                                                {mode === 'edit' ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="w-16 border rounded px-1 py-0.5 text-center text-sm font-medium"
                                                        value={item.quantity === 0 ? '' : item.quantity}
                                                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                    />
                                                ) : (
                                                    <span className="font-semibold text-gray-800">{item.quantity}</span>
                                                )}
                                            </td>

                                            {/* Dot Size */}
                                            <td className="p-2 border-r text-center">
                                                {mode === 'edit' ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.1"
                                                        className="w-14 border rounded px-1 py-0.5 text-center text-sm"
                                                        value={item.dotSize === 0 ? '' : item.dotSize}
                                                        onChange={(e) => updateItem(idx, 'dotSize', e.target.value)}
                                                    />
                                                ) : (
                                                    <span className="text-gray-700">{item.dotSize || '-'}</span>
                                                )}
                                            </td>

                                            {/* CD */}
                                            <td className="p-2 border-r text-center">
                                                {mode === 'edit' ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.0001"
                                                        className="w-20 border rounded px-1 py-0.5 text-center text-sm"
                                                        value={item.cd === 0 ? '' : item.cd}
                                                        onChange={(e) => updateItem(idx, 'cd', e.target.value)}
                                                    />
                                                ) : (
                                                    <span className="text-gray-700">{item.cd || '-'}</span>
                                                )}
                                            </td>

                                            {/* Dots Req */}
                                            <td className="p-2 border-r text-center">
                                                {mode === 'edit' ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="w-16 border rounded px-1 py-0.5 text-center text-sm"
                                                        value={item.dotsReq === 0 ? '' : item.dotsReq}
                                                        onChange={(e) => updateItem(idx, 'dotsReq', e.target.value)}
                                                    />
                                                ) : (
                                                    <span className="text-gray-700">{item.dotsReq || '-'}</span>
                                                )}
                                            </td>

                                            {/* Rate */}
                                            <td className="p-2 border-r text-center bg-blue-50/20 font-medium text-gray-700">
                                                ₹{item.rate.toFixed(2)}
                                            </td>

                                            {/* Amount */}
                                            <td className="p-2 text-right bg-blue-50/20 font-semibold text-gray-900">
                                                ₹{item.amount.toFixed(2)}
                                            </td>

                                            {/* Delete Row Icon */}
                                            {mode === 'edit' && (
                                                <td className="p-1 text-center">
                                                    <button
                                                        onClick={() => deleteRow(idx)}
                                                        disabled={items.length <= 1}
                                                        className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30"
                                                        title="Delete Row"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}

                                    {/* Bottom Totals Row */}
                                    <tr className="bg-blue-50 border-t-2 border-blue-200 font-bold text-gray-800 text-center">
                                        <td className="p-2 border-r"></td>
                                        <td className="p-2 border-r text-left text-[10px] uppercase">Totals</td>
                                        <td className="p-2 border-r text-blue-900 text-sm">{totals.totalQuantity}</td>
                                        <td className="p-2 border-r"></td>
                                        <td className="p-2 border-r text-gray-500 font-medium text-[10px] italic">In meters</td>
                                        <td className="p-2 border-r"></td>
                                        <td className="p-2 border-r text-blue-900">₹{totals.averageRate.toFixed(2)}</td>
                                        <td className="p-2 text-right text-blue-900 text-sm">₹{totals.totalAmount.toFixed(2)}</td>
                                        {mode === 'edit' && <td></td>}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Run Comments */}
                    {mode === 'view' && (
                        <RunCommentEditor 
                            orderId={localOrder.id}
                            processId={process.id}
                            run={run}
                            onRefresh={onRefresh}
                            canEdit={hasPermission(Permission.RUNS_UPDATE)}
                        />
                    )}

                    {/* Reference Images */}
                    {mode === 'edit' && (
                        <div className="border border-gray-200 rounded p-3 bg-gray-50">
                            <div className="flex justify-between mb-2">
                                <label className="text-xs font-bold text-gray-700">Reference Images</label>
                                <span className="text-xs text-gray-500">
                                    {((runImages[run.id] || []).length + (existingRunImages[run.id] || []).length)}/2
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <input type="file" id={`img-${run.id}`} className="hidden" multiple accept="image/*" onChange={e => handleImageSelect(run.id, e)} />
                                {((runImages[run.id] || []).length + (existingRunImages[run.id] || []).length) < 2 && (
                                    <label htmlFor={`img-${run.id}`} className="w-16 h-16 border-2 border-dashed bg-white rounded flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                                        <Plus className="w-4 h-4 text-gray-400" />
                                    </label>
                                )}
                                {/* New Previews */}
                                {(imagePreviews[run.id] || []).map((src, i) => (
                                    <div key={`new-${i}`} className="relative w-16 h-16 border rounded overflow-hidden group">
                                        <img src={src} className="w-full h-full object-cover" />
                                        <button onClick={() => removeImage(run.id, i)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                                {/* Existing Images */}
                                {(existingRunImages[run.id] || []).map((src, i) => (
                                    <div key={`exist-${i}`} className="relative w-16 h-16 border rounded overflow-hidden group">
                                        <img src={src} className="w-full h-full object-cover" />
                                        <button onClick={() => removeExistingImage(run.id, i)} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Display Images in View Mode */}
                    {mode === 'view' && run.values?.images && Array.isArray(run.values.images) && run.values.images.length > 0 && (
                        <div className="border border-gray-200 rounded p-3">
                            <label className="text-xs font-bold text-gray-700 block mb-2">Reference Images</label>
                            <div className="flex gap-2">
                                {run.values.images.map((src: string, i: number) => (
                                    <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="w-16 h-16 border rounded overflow-hidden hover:opacity-85 transition-opacity">
                                        <img src={src} className="w-full h-full object-cover" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Save Buttons */}
                    {mode === 'edit' && (
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <button onClick={() => { setOpenRunId(null); setEditingRunId(null); }} className="px-3 py-1 text-sm border rounded hover:bg-gray-50 transition-colors">Cancel</button>
                            <button onClick={() => saveRun(process.id, run.id)} disabled={isSaving === run.id} className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1">
                                {isSaving === run.id && <Loader2 className="w-3 h-3 animate-spin" />}
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
            <CreditLimitErrorDialog
                isOpen={!!creditLimitError}
                onClose={() => setCreditLimitError(null)}
                message={creditLimitError || undefined}
            />
            {localOrder.processes.map(p => (
                <div key={p.id} className="space-y-3">
                    {p.runs.map(run => (
                        <div key={run.id} className="mb-4">
                            {!openRunId || openRunId !== run.id ? (
                                <div
                                    onClick={() => toggleRunOpen(run)}
                                    className={`p-3 border rounded cursor-pointer flex justify-between items-center ${run.configStatus === 'COMPLETE' ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${run.configStatus === 'COMPLETE' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                        <span className="font-medium text-sm">Run {run.runNumber}</span>
                                        {run.configStatus === 'COMPLETE' && (
                                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" /> Configured
                                            </span>
                                        )}
                                        {run.preProductionLocation && (
                                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1" title="Pre-Production Location">
                                                <MapPin className="w-3 h-3" />
                                                PRE: {run.preProductionLocation.code}
                                            </span>
                                        )}
                                        {run.postProductionLocation && (
                                            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full flex items-center gap-1" title="Post-Production Location">
                                                <MapPin className="w-3 h-3" />
                                                POST: {run.postProductionLocation.code}
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
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteRun(p.id, run.id);
                                                }}
                                                disabled={isDeletingRun === run.id}
                                                className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                                title="Delete Run"
                                            >
                                                {isDeletingRun === run.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    </div>
                                </div>
                            ) : (
                                renderRun(p, run)
                            )}
                        </div>
                    ))}
                    <div className="flex gap-2">
                        {hasPermission(Permission.RUNS_CREATE) && (
                            <button
                                onClick={() => handleAddRun(p.id)}
                                disabled={isAddingRun}
                                className="flex-1 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                            >
                                {isAddingRun ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                Add Configuration Run
                            </button>
                        )}

                        {p.runs.length === 0 && (
                            <button
                                onClick={() => handleDeleteProcess(p.id)}
                                className="flex-1 py-2 border-2 border-dashed border-red-300 rounded-lg text-red-500 hover:border-red-500 hover:text-red-600 hover:bg-red-50 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Process
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
