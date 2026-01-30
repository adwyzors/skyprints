// apps\frontend\src\components\orders\OrderCard.tsx
'use client';

import { OrderCardData } from '@/domain/model/order.model';
import {
    CheckCircle,
    ChevronRight,
    Clock,
    FileText,
    Package,
    Settings,
    User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface OrderCardProps {
    order: OrderCardData;
    active?: boolean;
    showConfigure?: boolean;
    onClick?: () => void;
}

export default function OrderCard({ order, active = true, showConfigure = true, onClick }: OrderCardProps) {
    const router = useRouter();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    if (!order) return null;

    const images = order.images || [];
    const hasImages = images.length > 0;

    // ... (keep existing helper functions like getStatusConfig) ...

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'CONFIGURE':
                return {
                    label: 'Configure',
                    color: 'bg-orange-50 text-orange-700 border-orange-200',
                    bgColor: 'bg-orange-50/30',
                    icon: <Settings className="w-3.5 h-3.5" />,
                };
            case 'PRODUCTION_READY':
                return {
                    label: 'Production Ready',
                    color: 'bg-blue-50 text-blue-700 border-blue-200',
                    bgColor: 'bg-blue-50/30',
                    icon: <Clock className="w-3.5 h-3.5" />,
                };
            case 'IN_PRODUCTION':
                return {
                    label: 'In Production',
                    color: 'bg-green-50 text-green-700 border-green-200',
                    bgColor: 'bg-green-50/30',
                    icon: <CheckCircle className="w-3.5 h-3.5" />,
                };
            case 'COMPLETE':
            case 'COMPLETED':
                return {
                    label: 'Rate Config',
                    color: 'bg-purple-50 text-purple-700 border-purple-200',
                    bgColor: 'bg-purple-50/30',
                    icon: <Clock className="w-3.5 h-3.5" />,
                };
            case 'BILLED':
                return {
                    label: 'Billed',
                    color: 'bg-green-50 text-green-700 border-green-200',
                    bgColor: 'bg-green-50/30',
                    icon: <CheckCircle className="w-3.5 h-3.5" />,
                };
            default:
                return {
                    label: status,
                    color: 'bg-gray-50 text-gray-700 border-gray-200',
                    bgColor: 'bg-gray-50/30',
                    icon: <Clock className="w-3.5 h-3.5" />,
                };
        }
    };

    const statusConfig = getStatusConfig(order.status);

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
            {/* STATUS BADGE - Positioned absolutely at the parent level, outside the card */}
            <div className="absolute top-3 right-3 z-30">
                <span
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 shadow-md ${statusConfig.color}`}
                >
                    {statusConfig.icon}
                    <span className="truncate">{statusConfig.label === "Billed" ? "Billing Ready" : statusConfig.label}</span>
                </span>
            </div>

            {/* CARD CONTENT - isolated stacking context */}
            <div
                onClick={onClick || (() => router.push(`/admin/orders?selectedOrder=${order.id}`))}
                className="group bg-white rounded-2xl border border-gray-200 cursor-pointer hover:shadow-xl hover:border-blue-300 transition-all duration-300 hover:-translate-y-1 flex flex-col isolate"
            >
                {/* IMAGE CAROUSEL */}
                <div
                    className="relative w-full h-64 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden rounded-t-2xl"
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                >
                    {hasImages ? (
                        <>
                            {images.map((image, index) => (
                                <img
                                    key={index}
                                    src={image}
                                    alt={`Order ${order.code}`}
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                                    loading="lazy"
                                    decoding="async"
                                />
                            ))}

                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={prevImage}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all hover:scale-110 z-20"
                                        aria-label="Previous image"
                                    >
                                        <ChevronRight className="w-5 h-5 text-gray-800 rotate-180" />
                                    </button>
                                    <button
                                        onClick={nextImage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all hover:scale-110 z-20"
                                        aria-label="Next image"
                                    >
                                        <ChevronRight className="w-5 h-5 text-gray-800" />
                                    </button>
                                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-medium z-20">
                                        {currentImageIndex + 1} / {images.length}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <Package className="w-16 h-16 mb-2" />
                            <span className="text-sm font-medium">No images uploaded</span>
                        </div>
                    )}
                </div>

                {/* ORDER DETAILS */}
                <div className="p-3 space-y-2 flex-1">
                    {/* HEADER: Code + Job */}
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors truncate text-[15px]">
                            {order.code}
                        </h3>
                        {order.jobCode && (
                            <div className="flex items-center gap-1 shrink-0 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-[11px] text-gray-600 font-medium">
                                <FileText className="w-3 h-3 text-gray-400" />
                                <span className="truncate max-w-[80px]">{order.jobCode}</span>
                            </div>
                        )}
                    </div>

                    {/* CUSTOMER */}
                    <div className="flex items-center gap-1.5 pb-2 border-b border-gray-50">
                        <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-600 truncate">
                            {order.customer?.name}
                        </span>
                    </div>

                    {/* STATS - Optimized Row */}
                    <div className="flex items-center justify-between text-sm py-0.5">
                        <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded text-xs font-medium text-gray-700">
                            <Package className="w-3.5 h-3.5 text-gray-400" />
                            <span>Qty: {order.quantity}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded text-xs font-medium text-gray-700">
                            <Settings className="w-3.5 h-3.5 text-gray-400" />
                            <span>Runs: {order.totalRuns}</span>
                        </div>
                    </div>

                    {/* ACTION */}
                    {showConfigure && (
                        <div className="pt-2 border-t border-gray-100">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/admin/orders/${order.id}`);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors flex items-center gap-0.5"
                            >
                                Configure order <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}