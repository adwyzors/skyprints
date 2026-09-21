'use client';

import React from 'react';
import RunCard from './RunCard';

interface PrintRunCardsProps {
    runs: any[];
}

const CARDS_PER_PAGE = 12; // 4 columns x 3 rows in landscape mode

export default function PrintRunCards({ runs }: PrintRunCardsProps) {
    if (!runs || runs.length === 0) return null;

    // Chunk runs into pages of 12 cards each
    const pages: any[][] = [];
    for (let i = 0; i < runs.length; i += CARDS_PER_PAGE) {
        pages.push(runs.slice(i, i + CARDS_PER_PAGE));
    }

    return (
        <>
            <style jsx global>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 2mm;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, body, #__next, root, div, main, article, section {
                        background: white !important;
                        color: black !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        min-height: 0 !important;
                        max-height: none !important;
                        overflow: visible !important;
                    }
                    header, nav, aside, footer, .no-print-area {
                        display: none !important;
                    }
                    #print-runs-container {
                        display: block !important;
                        width: 100% !important;
                        position: relative !important;
                        background: white !important;
                    }
                    .print-page-grid {
                        display: grid !important;
                        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                        grid-template-rows: repeat(3, minmax(0, 1fr)) !important;
                        gap: 2px !important;
                        padding: 1px !important;
                        background: white !important;
                        box-sizing: border-box !important;
                        width: 100% !important;
                        height: 202mm !important;
                        max-height: 202mm !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        overflow: hidden !important;
                    }
                    .print-page-grid.print-last-page {
                        page-break-after: auto !important;
                        break-after: auto !important;
                        height: auto !important;
                        max-height: 202mm !important;
                    }
                    .print-card-box {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        height: 100% !important;
                        box-sizing: border-box !important;
                    }
                    .print-card-box .group {
                        border-radius: 0.25rem !important;
                        border: 1px solid #d1d5db !important;
                        box-shadow: none !important;
                        height: 100% !important;
                        display: flex !important;
                        flex-direction: column !important;
                        background-color: white !important;
                        overflow: hidden !important;
                    }
                    /* ENLARGED IMAGE AREA FOR 4x3 FULL-PAGE LAYOUT */
                    .print-card-box .h-48 {
                        height: 4.8rem !important;
                        flex-grow: 1 !important;
                        flex-shrink: 0 !important;
                    }
                    .print-card-box .p-4 {
                        padding: 0.2rem 0.35rem !important;
                        flex-shrink: 0 !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: flex-end !important;
                    }
                    .print-card-box .space-y-3 > :not([hidden]) ~ :not([hidden]) {
                        margin-top: 0.1rem !important;
                    }
                    .print-card-box .py-2 {
                        padding-top: 0.08rem !important;
                        padding-bottom: 0.08rem !important;
                    }
                    .print-card-box .space-y-1\.5 > :not([hidden]) ~ :not([hidden]) {
                        margin-top: 0.05rem !important;
                    }
                    .print-card-box .text-\[15px\] {
                        font-size: 10px !important;
                        line-height: 12px !important;
                    }
                    .print-card-box .text-xs {
                        font-size: 8.5px !important;
                        line-height: 10px !important;
                    }
                    .print-card-box .text-sm {
                        font-size: 9px !important;
                        line-height: 11px !important;
                    }
                    .print-card-box .text-\[10px\] {
                        font-size: 8px !important;
                        line-height: 9.5px !important;
                    }
                    .print-card-box span {
                        line-height: 1.05 !important;
                    }
                }
            `}</style>

            <div id="print-runs-container" className="hidden print:block w-full text-black">
                {pages.map((pageRuns, pageIdx) => (
                    <div
                        key={pageIdx}
                        className={`print-page-grid grid grid-cols-4 gap-1 p-0.5 bg-white w-full ${
                            pageIdx === pages.length - 1 ? 'print-last-page' : ''
                        }`}
                        style={{
                            pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : 'auto',
                            breakAfter: pageIdx < pages.length - 1 ? 'page' : 'auto',
                        }}
                    >
                        {pageRuns.map((run) => (
                            <div key={run.id} className="print-card-box">
                                <RunCard
                                    run={run}
                                    active={false}
                                    selectable={false}
                                />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </>
    );
}
