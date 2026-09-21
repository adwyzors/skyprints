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
                        margin: 2.5mm;
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
                        grid-template-rows: auto !important;
                        gap: 4px !important;
                        padding: 1.5px !important;
                        background: white !important;
                        box-sizing: border-box !important;
                        width: 100% !important;
                        align-content: start !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .print-page-grid.print-last-page {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .print-card-box {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        box-sizing: border-box !important;
                    }
                    .print-card-box .group {
                        border-radius: 0.375rem !important;
                        border: 1px solid #d1d5db !important;
                        box-shadow: none !important;
                        display: flex !important;
                        flex-direction: column !important;
                        background-color: white !important;
                        overflow: hidden !important;
                    }
                    /* CARD IMAGE AREA: Matching original card size */
                    .print-card-box .h-48 {
                        height: 4.5rem !important;
                    }
                    .print-card-box .p-4 {
                        padding: 0.3rem 0.45rem !important;
                    }
                    .print-card-box .space-y-3 > :not([hidden]) ~ :not([hidden]) {
                        margin-top: 0.12rem !important;
                    }
                    .print-card-box .py-2 {
                        padding-top: 0.1rem !important;
                        padding-bottom: 0.1rem !important;
                    }
                    .print-card-box .space-y-1\.5 > :not([hidden]) ~ :not([hidden]) {
                        margin-top: 0.08rem !important;
                    }
                    .print-card-box .text-\[15px\] {
                        font-size: 10.5px !important;
                        line-height: 13px !important;
                    }
                    .print-card-box .text-xs {
                        font-size: 9px !important;
                        line-height: 11px !important;
                    }
                    .print-card-box .text-sm {
                        font-size: 9.5px !important;
                        line-height: 11.5px !important;
                    }
                    .print-card-box .text-\[10px\] {
                        font-size: 8px !important;
                        line-height: 10px !important;
                    }
                    .print-card-box span {
                        line-height: 1.1 !important;
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
