'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    pageSize?: number;
    itemLabel?: string;
}

export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    pageSize,
    itemLabel = 'items'
}: PaginationProps) {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages = [];
        const showMax = 5;

        if (totalPages <= showMax) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
            }

            if (currentPage < totalPages - 2) pages.push('...');
            if (!pages.includes(totalPages)) pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className="flex items-center justify-between bg-white px-4 py-4 border border-gray-200 rounded-2xl shadow-sm mt-6 mb-10">
            {/* Mobile Pagination */}
            <div className="flex flex-1 justify-between sm:hidden">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                    Previous
                </button>
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                    Next
                </button>
            </div>

            {/* Desktop Pagination */}
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                    {totalItems !== undefined && pageSize !== undefined ? (
                        <p className="text-sm text-gray-700 font-medium">
                            Showing <span className="font-bold text-gray-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                            <span className="font-bold text-gray-900">{Math.min(currentPage * pageSize, totalItems)}</span> of{' '}
                            <span className="font-bold text-gray-900">{totalItems}</span> {itemLabel}
                        </p>
                    ) : (
                        <p className="text-sm text-gray-700 font-medium">
                            Page <span className="font-bold text-gray-900">{currentPage}</span> of <span className="font-bold text-gray-900">{totalPages}</span>
                        </p>
                    )}
                </div>
                <div>
                    <nav className="isolate inline-flex gap-2" aria-label="Pagination">
                        <button
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center p-2 text-gray-500 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <span className="sr-only">Previous</span>
                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>

                        <div className="flex items-center gap-1.5">
                            {getPageNumbers().map((page, index) => {
                                if (page === '...') {
                                    return (
                                        <span key={`dots-${index}`} className="px-2 text-gray-400">...</span>
                                    );
                                }
                                const isCurrent = currentPage === page;
                                return (
                                    <button
                                        key={`page-${page}`}
                                        onClick={() => onPageChange(page as number)}
                                        className={`min-w-[40px] h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm ${isCurrent
                                                ? 'bg-blue-600 text-white shadow-blue-200'
                                                : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400 hover:text-blue-600'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center p-2 text-gray-500 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <span className="sr-only">Next</span>
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </nav>
                </div>
            </div>
        </div>
    );
}
