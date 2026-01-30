'use client';

import { Activity, CheckCircle, ChevronRight, Clock, DollarSign, Package, User, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// Define the Run type locally or import if available
interface RunCardProps {
    run: any; // Using any to match the flexible data structure
    active?: boolean;
    onClick?: () => void;
}

export default function RunCard({ run, active = true, onClick }: RunCardProps) {
    const router = useRouter();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    if (!run) return null;

    // specific extraction based on analysis
    const images: string[] = run.fields?.images || [];
    const hasImages = images.length > 0;
    const rawOrderCode = run.orderProcess?.order?.code;
    const orderCode = typeof rawOrderCode === 'object' ? (rawOrderCode as any).code : rawOrderCode;
    const customerName = run.orderProcess?.order?.customer?.name;
    const rawName = run.runTemplate?.name || 'Process Run';
    const displayName = rawName.replace(/ Template$/i, '');
    const runNumber = run.runNumber;
    const status = run.lifeCycleStatusCode || run.statusCode; // Fallback

    // Fields from user request
    const quantity = run.fields?.Quantity;
    const estimatedAmount = run.fields?.['Estimated Amount'];

    const executorName = run.executor?.name;
    const reviewerName = run.reviewer?.name;
    const priority = run.priority;

    // Helper for status configuration
    const getStatusConfig = (status: string) => {
        const s = status?.toUpperCase();
        switch (s) {
            case 'COMPLETED':
            case 'COMPLETE':
                return {
                    label: 'Completed',
                    color: 'bg-green-50 text-green-700 border-green-200',
                    icon: <CheckCircle className="w-3.5 h-3.5" />,
                };
            case 'IN_PROGRESS':
                return {
                    label: 'In Progress',
                    color: 'bg-blue-50 text-blue-700 border-blue-200',
                    icon: <Activity className="w-3.5 h-3.5" />,
                };
            case 'PENDING':
                return {
                    label: 'Pending',
                    color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                    icon: <Clock className="w-3.5 h-3.5" />,
                };
            case 'CONFIGURE':
                return {
                    label: 'Configure',
                    color: 'bg-orange-50 text-orange-700 border-orange-200',
                    icon: <Activity className="w-3.5 h-3.5" />,
                };
            case 'DESIGN':
                return {
                    label: 'Design',
                    color: 'bg-purple-50 text-purple-700 border-purple-200',
                    icon: <Activity className="w-3.5 h-3.5" />,
                };
            default:
                return {
                    label: status || 'Unknown',
                    color: 'bg-gray-50 text-gray-700 border-gray-200',
                    icon: <Clock className="w-3.5 h-3.5" />,
                };
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p?.toUpperCase()) {
            case 'HIGH': return 'text-red-600 bg-red-50 border-red-100';
            case 'MEDIUM': return 'text-orange-600 bg-orange-50 border-orange-100';
            case 'LOW': return 'text-blue-600 bg-blue-50 border-blue-100';
            default: return 'text-gray-600 bg-gray-50 border-gray-100';
        }
    };

    const statusConfig = getStatusConfig(status);

    const nextImage = useCallback(
        (e?: React.MouseEvent) => {
            if (e) e.stopPropagation();
            setCurrentImageIndex((prev) => (prev + 1) % images.length);
        },
        [images.length]
    );

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    // Auto-slide effect
    useEffect(() => {
        if (!active || !hasImages || images.length <= 1 || isPaused) return;

        const interval = setInterval(() => {
            nextImage();
        }, 4000);

        return () => clearInterval(interval);
    }, [hasImages, images.length, isPaused, nextImage]);

    return (
        <div className="relative">
            {/* STATUS & PRIORITY BADGES */}
            <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-1.5">
                <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 shadow-sm backdrop-blur-sm ${statusConfig.color}`}
                >
                    {statusConfig.icon}
                    <span className="truncate max-w-[80px]">{statusConfig.label}</span>
                </span>
                {priority && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider shadow-sm ${getPriorityColor(priority)}`}>
                        {priority}
                    </span>
                )}
            </div>

            {/* CARD CONTENT */}
            <div
                onClick={onClick || (() => router.push(`/admin/orders/${run.orderProcess?.order?.id}`))}
                className="group bg-white rounded-2xl border border-gray-200 cursor-pointer hover:shadow-xl hover:border-blue-300 transition-all duration-300 hover:-translate-y-1 flex flex-col isolate overflow-hidden h-full"
            >
                {/* IMAGE CAROUSEL */}
                <div
                    className="relative w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden"
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                >
                    {hasImages ? (
                        <>
                            {images.map((image, index) => (
                                <img
                                    key={index}
                                    src={image}
                                    alt={`${displayName} - ${orderCode}`}
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                                    loading="lazy"
                                    decoding="async"
                                />
                            ))}

                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={prevImage}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-lg transition-all hover:scale-110 z-20"
                                        aria-label="Previous image"
                                    >
                                        <ChevronRight className="w-4 h-4 text-gray-800 rotate-180" />
                                    </button>
                                    <button
                                        onClick={nextImage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-lg transition-all hover:scale-110 z-20"
                                        aria-label="Next image"
                                    >
                                        <ChevronRight className="w-4 h-4 text-gray-800" />
                                    </button>
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-2 py-0.5 rounded-full text-[10px] font-medium z-20">
                                        {currentImageIndex + 1} / {images.length}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <Activity className="w-12 h-12 mb-2 opacity-50" />
                            <span className="text-xs font-medium">No images</span>
                        </div>
                    )}
                </div>

                {/* RUN DETAILS */}
                <div className="p-4 space-y-3 flex-1 flex flex-col bg-white">
                    {/* Header: Title */}
                    <div>
                        <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate text-[15px]">
                            {displayName} <span className="text-gray-400 font-normal">#{runNumber}</span>
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                            <span className="font-medium text-gray-700">{orderCode}</span>
                            <span>•</span>
                            <span className="truncate">{customerName}</span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 py-2 border-t border-b border-gray-50">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Quantity</span>
                            <div className="flex items-center gap-1 text-sm font-semibold text-gray-700">
                                <Package className="w-3.5 h-3.5 text-gray-400" />
                                {quantity || '-'}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Est. Amount</span>
                            <div className="flex items-center gap-1 text-sm font-semibold text-gray-700">
                                <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                                {estimatedAmount ? estimatedAmount.toLocaleString() : '-'}
                            </div>
                        </div>
                    </div>

                    {/* Assignees */}
                    <div className="space-y-1.5 flex-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Executor</span>
                            <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                                <User className="w-3 h-3 text-gray-400" />
                                <span className="truncate max-w-[100px]">{executorName || 'Unassigned'}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Reviewer</span>
                            <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                                <Users className="w-3 h-3 text-gray-400" />
                                <span className="truncate max-w-[100px]">{reviewerName || 'Unassigned'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
