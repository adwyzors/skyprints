'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ImagePreviewModalProps {
    imageUrl: string | null;
    onClose: () => void;
    title?: string;
}

export default function ImagePreviewModal({ imageUrl, onClose, title }: ImagePreviewModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (imageUrl) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [imageUrl, onClose]);

    if (!imageUrl) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 transition-all duration-200"
            onClick={onClose}
        >
            <div
                className="relative max-w-sm w-full max-h-[60vh] flex flex-col items-center bg-white p-2 rounded-lg shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute -top-3 -right-3 p-1.5 bg-white text-gray-500 hover:text-red-500 rounded-full shadow-md border border-gray-100 transition-colors z-10"
                    aria-label="Close preview"
                >
                    <X className="w-4 h-4" />
                </button>

                {title && (
                    <div className="text-gray-800 font-medium text-sm mb-2 w-full text-center truncate px-4">
                        {title}
                    </div>
                )}

                <img
                    src={imageUrl}
                    alt={title || "Preview"}
                    className="w-full h-full max-h-[50vh] object-contain rounded bg-gray-50"
                />
            </div>
        </div>
    );
}
