'use client';

import { useEffect } from 'react';

interface FilterDrawerProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

/**
 * Renders filter content as a fixed overlay drawer on mobile (< md)
 * and as an inline collapsible sidebar on desktop (md+).
 * Children are rendered once — no remounting on open/close.
 */
export default function FilterDrawer({ open, onClose, children }: FilterDrawerProps) {
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        if (open && mq.matches) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    return (
        <>
            {/* BACKDROP — mobile only, dismisses drawer on tap */}
            <div
                aria-hidden="true"
                className={`md:hidden fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
                    open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            />

            {/* PANEL
                Mobile  : fixed overlay drawer from the left edge
                Desktop : inline collapsible sidebar (reverts to relative flow via md: overrides)
            */}
            <div
                className={[
                    'bg-white overflow-y-auto scrollbar-hide transition-all duration-300 ease-in-out',
                    // Mobile: fixed full-height drawer
                    'fixed inset-y-0 left-0 z-50',
                    open ? 'w-72 translate-x-0 shadow-xl' : 'w-72 -translate-x-full',
                    // Desktop: revert to inline layout
                    'md:relative md:inset-auto md:z-40 md:translate-x-0 md:shadow-none',
                    'md:flex-shrink-0 md:border-r md:border-gray-200',
                    open
                        ? 'md:w-72 md:opacity-100'
                        : 'md:w-0 md:opacity-0 md:overflow-hidden md:pointer-events-none',
                ].join(' ')}
            >
                {/* Fixed-width inner wrapper so content doesn't collapse during animation */}
                <div className="w-72">
                    {children}
                </div>
            </div>
        </>
    );
}
