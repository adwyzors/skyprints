'use client';

import React from 'react';
import { Activity, CheckCircle, Clock, FileText, IndianRupee, MapPin, Package, User, Users } from 'lucide-react';

interface PrintRunCardsProps {
    runs: any[];
}

const CARDS_PER_PAGE = 8; // 4 columns x 2 rows in landscape mode

export default function PrintRunCards({ runs }: PrintRunCardsProps) {
    if (!runs || runs.length === 0) return null;

    // Chunk runs into pages of 8 cards each
    const pages: any[][] = [];
    for (let i = 0; i < runs.length; i += CARDS_PER_PAGE) {
        pages.push(runs.slice(i, i + CARDS_PER_PAGE));
    }

    const getStatusConfig = (status: string) => {
        const s = status?.toUpperCase();
        switch (s) {
            case 'COMPLETED':
            case 'COMPLETE':
                return {
                    label: 'Completed',
                    color: 'bg-green-50 text-green-700 border-green-200',
                    icon: <CheckCircle className="w-3 h-3 text-green-600" />,
                };
            case 'IN_PROGRESS':
                return {
                    label: 'In Progress',
                    color: 'bg-blue-50 text-blue-700 border-blue-200',
                    icon: <Activity className="w-3 h-3 text-blue-600" />,
                };
            case 'PENDING':
                return {
                    label: 'Pending',
                    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                    icon: <Clock className="w-3 h-3 text-yellow-600" />,
                };
            case 'CONFIGURE':
                return {
                    label: 'Configure',
                    color: 'bg-orange-50 text-orange-700 border-orange-200',
                    icon: <Activity className="w-3 h-3 text-orange-600" />,
                };
            default:
                return {
                    label: status || 'Unknown',
                    color: 'bg-gray-50 text-gray-700 border-gray-200',
                    icon: <Clock className="w-3 h-3 text-gray-600" />,
                };
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p?.toUpperCase()) {
            case 'HIGH': return 'text-red-600 bg-red-50 border-red-200';
            case 'MEDIUM': return 'text-orange-600 bg-orange-50 border-orange-200';
            case 'LOW': return 'text-blue-600 bg-blue-50 border-blue-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    return (
        <>
            <style jsx global>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 4mm;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #print-runs-container, #print-runs-container * {
                        visibility: visible !important;
                    }
                    #print-runs-container {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        background: white !important;
                    }
                    .print-page-break {
                        break-after: page !important;
                        page-break-after: always !important;
                    }
                }
            `}</style>

            <div id="print-runs-container" className="hidden print:block w-full text-black">
                {pages.map((pageRuns, pageIdx) => (
                    <div
                        key={pageIdx}
                        className={`w-full h-screen p-2 box-border flex flex-col justify-between ${
                            pageIdx < pages.length - 1 ? 'print-page-break' : ''
                        }`}
                        style={{ height: '98vh' }}
                    >
                        {/* 4x2 Grid Container */}
                        <div className="grid grid-cols-4 grid-rows-2 gap-2 flex-1 w-full h-full">
                            {pageRuns.map((run) => {
                                const images: string[] = run.fields?.images || [];
                                const hasImages = images.length > 0;
                                const rawOrderCode = run.orderProcess?.order?.code;
                                const orderCode = typeof rawOrderCode === 'object' ? (rawOrderCode as any).code : (rawOrderCode || '');
                                const shortOrderCode = orderCode ? orderCode.split('/')[0] : '';
                                const customerName = run.orderProcess?.order?.customer?.name || '';
                                const processName = run.orderProcess?.name;
                                const internalProcessName = run.fields?.['Process Name'] || run.fields?.process_name;
                                const rawName = run.runTemplate?.name || 'Process Run';
                                let displayName = rawName.replace(/ Template$/i, '');

                                if (processName === 'Embellishment' || rawName.includes('Embellishment')) {
                                    displayName = internalProcessName || processName;
                                } else if (processName) {
                                    displayName = processName;
                                }

                                const runNumber = run.runNumber;
                                const status = run.statusCode === 'CONFIGURE' ? 'CONFIGURE' : (run.lifeCycleStatusCode || run.statusCode);
                                const isDTF = displayName?.toLowerCase() === 'dtf' || displayName?.toLowerCase()?.includes('direct to film');
                                const quantity = isDTF
                                    ? (run.fields?.customPcs || run.fields?.pcs || run.fields?.Quantity || run.orderProcess?.order?.quantity)
                                    : (run.fields?.Quantity || run.orderProcess?.order?.quantity);
                                const estimatedAmount = run.fields?.['Estimated Amount'];
                                const executorName = run.executor?.name;
                                const reviewerName = run.reviewer?.name;
                                const priority = run.priority;
                                const locationCode = run.location?.code;
                                const statusConfig = getStatusConfig(status);

                                return (
                                    <div
                                        key={run.id}
                                        className="border border-gray-300 rounded-lg p-2 flex flex-col justify-between bg-white text-xs overflow-hidden"
                                    >
                                        {/* Card Top: Badges */}
                                        <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-gray-100">
                                            <div className="flex items-center gap-1 font-bold text-gray-900 truncate">
                                                <span className="truncate">{displayName}</span>
                                                <span className="text-gray-500 font-normal">#{runNumber}</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${statusConfig.color}`}>
                                                    {statusConfig.label}
                                                </span>
                                                {priority && (
                                                    <span className={`px-1 py-0.5 rounded text-[8px] font-bold border uppercase ${getPriorityColor(priority)}`}>
                                                        {priority}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Main Details & Image split */}
                                        <div className="flex gap-2 flex-1 items-start min-h-0">
                                            {/* Image Thumbnail */}
                                            {hasImages ? (
                                                <div className="w-16 h-16 rounded border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                                                    <img
                                                        src={images[0]}
                                                        alt={displayName}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-16 h-16 rounded border border-gray-100 bg-gray-50 flex items-center justify-center shrink-0 text-gray-300">
                                                    <Activity className="w-6 h-6 opacity-40" />
                                                </div>
                                            )}

                                            {/* Info Column */}
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className="font-bold text-blue-700">{shortOrderCode}</span>
                                                    {locationCode && (
                                                        <span className="bg-gray-100 px-1 py-0.2 rounded text-[8px] font-semibold text-gray-600">
                                                            {locationCode}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="font-semibold text-gray-800 text-[11px] truncate" title={customerName}>
                                                    {customerName}
                                                </div>

                                                {/* Stats */}
                                                <div className="grid grid-cols-2 gap-1 bg-gray-50 p-1 rounded text-[10px]">
                                                    <div>
                                                        <span className="text-gray-400 block text-[8px] uppercase">Qty</span>
                                                        <span className="font-bold text-gray-700">{quantity || '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-400 block text-[8px] uppercase">Amount</span>
                                                        <span className="font-bold text-emerald-600">
                                                            {estimatedAmount ? `₹${estimatedAmount.toLocaleString()}` : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer: Executor & Reviewer & Comments */}
                                        <div className="mt-1 pt-1 border-t border-gray-100 text-[9px] text-gray-600 space-y-0.5">
                                            <div className="flex items-center justify-between">
                                                <span>Ex: <strong>{executorName || 'Unassigned'}</strong></span>
                                                <span>Rev: <strong>{reviewerName || 'Unassigned'}</strong></span>
                                            </div>
                                            {run.comments && (
                                                <p className="text-[8.5px] italic text-gray-500 truncate" title={run.comments}>
                                                    "{run.comments}"
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
