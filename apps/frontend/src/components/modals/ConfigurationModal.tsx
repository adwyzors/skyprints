'use client';

import { useRef } from 'react';

interface ConfigurationModalProps {
    run: {
        runNumber: number;
        fields?: Array<{ key: string; required: boolean }>;
        values?: Record<string, any>;
        location?: { name: string; code: string };
    };
    processName: string;
    orderCode: string;
    customerName: string;
    onClose: () => void;
    readOnly?: boolean;
}

export default function ConfigurationModal({
    run,
    processName,
    orderCode,
    customerName,
    onClose,
    readOnly
}: ConfigurationModalProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const printContent = printRef.current;
        if (printContent) {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`
          <html>
            <head>
              <title>Run ${run.runNumber} - ${processName}</title>
              <style>
                @page { size: landscape; margin: 0.5cm; }
                body { font-family: Arial, sans-serif; padding: 20px; width: 100%; box-sizing: border-box; }
                h1 { font-size: 18px; margin-bottom: 5px; color: #1f2937; }
                h2 { font-size: 14px; margin-bottom: 15px; color: #6b7280; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 15px; page-break-inside: avoid; }
                th, td { padding: 8px 12px; text-align: left; border: 1px solid #000; font-size: 12px; }
                th { background-color: #f0f0f0; font-weight: 600; color: #000; }
                td { background-color: #fff; color: #000; }
                
                /* Print optimizations */
                .print-container { 
                    width: 100%;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                
                img { 
                    max-width: 100%; 
                    max-height: 220px; 
                    height: auto; 
                    display: block; 
                    margin: 0 auto;
                    object-fit: contain; 
                }
                
                /* Grid for images in print */
                .grid-cols-2 { 
                    display: flex; 
                    flex-wrap: wrap; 
                    gap: 12px; 
                    page-break-inside: avoid;
                    margin-top: 15px;
                }
                .grid-cols-2 > div { 
                    width: 48%; 
                    page-break-inside: avoid;
                    border: 1px solid #ddd;
                }
              </style>
            </head>
            <body>
              <div class="print-container">
                  <h1>Run ${run.runNumber} - ${processName}</h1>
                  <h2>${orderCode} • ${customerName}</h2>
                  ${printContent.innerHTML}
              </div>
              <script>
                // Wait for all images to load before printing
                window.onload = function() {
                    const images = document.getElementsByTagName('img');
                    let loadedCount = 0;
                    
                    function checkAllLoaded() {
                        loadedCount++;
                        if (loadedCount >= images.length) {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 500); // Small delay to ensure rendering
                        }
                    }

                    if (images.length === 0) {
                        window.print();
                        window.close();
                    } else {
                        for (let i = 0; i < images.length; i++) {
                            if (images[i].complete) {
                                checkAllLoaded();
                            } else {
                                images[i].onload = checkAllLoaded();
                                images[i].onerror = checkAllLoaded;
                            }
                        }
                    }
                };
              </script>
            </body>
          </html>
        `);
                printWindow.document.close();
            }
        }
    };

    // Helper to parse items if they're stringified
    const parseItems = (items: unknown): any[] => {
        if (Array.isArray(items)) return items;
        if (typeof items === 'string') {
            try {
                const parsed = JSON.parse(items);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    };

    // Helper to parse column headers
    const parseColumnHeaders = (headers: unknown): string[] => {
        if (Array.isArray(headers)) return headers;
        if (typeof headers === 'string') {
            try {
                const parsed = JSON.parse(headers);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    };

    // Helper to parse totals
    const parseTotals = (totals: unknown): number[] => {
        if (Array.isArray(totals)) return totals;
        if (typeof totals === 'string') {
            try {
                const parsed = JSON.parse(totals);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    };

    // Check if this is a table-based process (has items field)
    const items = run.values?.items ? parseItems(run.values.items) : [];
    const hasTableData = items.length > 0;
    const columnHeaders = run.values?.columnHeaders ? parseColumnHeaders(run.values.columnHeaders) : [];
    const totals = run.values?.totals ? parseTotals(run.values.totals) : [];

    const normalizedProcess = (processName || '').toLowerCase();
    const isDiamond = normalizedProcess.includes('diamond');
    const isLaser = normalizedProcess.includes('laser');

    // Fields to exclude from regular grid as they're handled specifically or by tableRendering
    const tableFields = new Set([
        'items', 'columnHeaders', 'totals', 'totalQuantity', 'totalAmount',
        'avgRate', 'totalMeters', 'Estimated Amount', 'images', 'particulars',
        'End Rate', 'Average Rate', 'Total Quantity', 'Total Amount',
        'Total Laser Time', 'Total Mtr', 'rate_per_meter', 'panna', 'printer'
    ]);

    // Map a specific set of keys to the grid in the order shown in the screenshot
    const preferredGridKeys = [
        'particulars', 'Total Mtr',
        'Total Quantity', 'rate_per_meter',
        'Total Amount', 'panna',
        'printer'
    ];

    const getGridEntries = () => {
        const entries: { label: string; value: any }[] = [];

        // 1. Add specific grid keys if they exist in values
        preferredGridKeys.forEach(key => {
            const val = run.values?.[key];
            if (val !== undefined && val !== null) {
                entries.push({ label: key, value: val });
            }
        });

        // 2. Add other required fields from template that aren't already included
        (Array.isArray(run.fields) ? run.fields : []).forEach(f => {
            if (f.required && !tableFields.has(f.key) && !preferredGridKeys.includes(f.key)) {
                const val = run.values?.[f.key];
                if (val !== undefined && val !== null) {
                    entries.push({ label: f.key, value: val });
                }
            }
        });

        return entries;
    };

    const gridEntries = getGridEntries();

    const createGridRows = () => {
        const rows = [];
        for (let i = 0; i < gridEntries.length; i += 2) {
            rows.push({
                left: gridEntries[i],
                right: gridEntries[i + 1]
            });
        }
        return rows;
    };

    const gridRows = createGridRows();

    // Render table for Sublimation/Allover/Plotter/Positive/Diamond
    const renderItemsTable = () => {
        // Shared header for Location and Particulars (Universal for all processes)
        const renderSharedHeader = () => {
            if (!run.location && !run.values?.particulars) return null;
            return (
                <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    {run.location && (
                        <div className="mb-3">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Production Location</span>
                            <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {run.location.name} ({run.location.code})
                            </div>
                        </div>
                    )}
                    {run.values?.particulars && (
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Particulars</span>
                            <div className="text-sm text-gray-700 leading-relaxed font-medium">
                                {run.values.particulars}
                            </div>
                        </div>
                    )}
                </div>
            );
        };

        if (!hasTableData) {
            return renderSharedHeader();
        }

        if (isDiamond || isLaser) {
            const tableItems = items as any[];
            return (
                <div className="mb-6 text-black">
                    {renderSharedHeader()}

                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-100 border-b text-gray-600 uppercase text-[10px] font-bold tracking-wider">
                                    <th className="p-3 text-center w-12 border-r border-gray-200">#</th>
                                    <th className="p-3 text-left border-r border-gray-200">Design Sizes</th>
                                    <th className="p-3 text-center border-r border-gray-200">Quantity</th>
                                    <th className="p-3 text-center border-r border-gray-200">F. Size</th>
                                    <th className="p-3 text-center border-r border-gray-200">{isLaser ? 'Laser Time' : 'Time'}</th>
                                    {isDiamond && <th className="p-3 text-left border-r border-gray-200">Diamond</th>}
                                    <th className="p-3 text-right bg-blue-50/50 border-r border-gray-200">Rate</th>
                                    <th className="p-3 text-right bg-blue-50 text-blue-800">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {tableItems.map((item, idx) => (
                                    <tr key={idx} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                                        <td className="p-3 text-center text-gray-400 font-mono border-r border-gray-200">{idx + 1}</td>
                                        <td className="p-3 border-r border-gray-200 font-medium text-gray-800">{item.designSizes || '-'}</td>
                                        <td className="p-3 text-center border-r border-gray-200 font-bold text-gray-900">{item.quantity || 0}</td>
                                        <td className="p-3 text-center border-r border-gray-200 text-gray-500 uppercase">{item.fSize || item.fSizes || 'all'}</td>
                                        <td className="p-3 text-center border-r border-gray-200">{isLaser ? (item.laserTime || 0) : (item.time || 0)}</td>
                                        {isDiamond && <td className="p-3 border-r border-gray-200 text-gray-700">{item.diamond || '-'}</td>}
                                        <td className="p-3 text-right border-r border-gray-200 text-blue-600 font-medium">{Number(item.rate || 0).toFixed(2)}</td>
                                        <td className="p-3 text-right bg-blue-50/20 font-bold text-blue-700">{Number(item.amount || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-bold text-gray-800 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={2} className="p-3 text-right uppercase text-[10px] tracking-widest text-gray-500">Totals:</td>
                                    <td className="p-3 text-center text-lg">{run.values?.['Total Quantity'] || tableItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)}</td>
                                    <td className="border-r border-gray-200"></td>
                                    <td className="p-3 text-center">{isLaser ? (run.values?.['Total Laser Time'] || tableItems.reduce((sum, i) => sum + (Number(i.laserTime) || 0), 0)) : ''}</td>
                                    {isDiamond && <td className="border-r border-gray-200"></td>}
                                    <td className="p-3 text-right border-r border-gray-200">
                                        <span className="text-[10px] text-gray-400 uppercase block mb-0.5">{isLaser ? 'Avg Rate' : 'End Rate'}</span>
                                        {Number(run.values?.['Average Rate'] || run.values?.['End Rate'] || 0).toFixed(2)}
                                    </td>
                                    <td className="p-3 text-right text-base text-blue-900">
                                        {isLaser && '₹'}{Number(run.values?.['Total Amount'] || 0).toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            );
        }

        // Detect which fields are present in the first item
        const firstItem = items[0] || {};
        const hasDesign = 'design' in firstItem || 'designSizes' in firstItem;
        const hasSize = 'size' in firstItem;
        const hasDescription = 'description' in firstItem;
        const hasWidth = 'width' in firstItem;
        const hasHeight = 'height' in firstItem || 'H' in firstItem;
        const hasQuantities = 'quantities' in firstItem && Array.isArray(firstItem.quantities);
        const hasQuantity = 'quantity' in firstItem && !hasQuantities;
        const hasSum = 'sum' in firstItem;
        const hasRowRate = 'rowRate' in firstItem || 'rate' in firstItem;
        const hasRowTotal = 'rowTotal' in firstItem || 'rowAmount' in firstItem;
        const hasAmount = ('amount' in firstItem || 'total' in firstItem) && !hasRowTotal; // Positive uses 'amount' instead of 'rowTotal'

        return (
            <div className="mb-6 text-black">
                {renderSharedHeader()}
                <h4 className="font-bold text-gray-800 mb-3">Items</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-gray-100 border-b text-gray-600 uppercase text-[10px] font-bold tracking-wider">
                                <th className="p-3 text-center w-12 border-r border-gray-200">#</th>
                                {hasDesign && <th className="p-3 text-left border-r border-gray-200">Design</th>}
                                {hasSize && <th className="p-3 text-left border-r">Size</th>}
                                {hasDescription && <th className="p-3 text-left border-r">Description</th>}
                                {hasWidth && <th className="p-3 text-center border-r">W</th>}
                                {hasHeight && <th className="p-3 text-center border-r">H</th>}

                                {/* Dynamic column headers for Sublimation/Allover */}
                                {hasQuantities && columnHeaders.length > 0 ? (
                                    columnHeaders.map((header, idx) => (
                                        <th key={idx} className="p-3 text-center border-r">{header}</th>
                                    ))
                                ) : hasQuantities && firstItem.quantities ? (
                                    firstItem.quantities.map((_: any, idx: number) => (
                                        <th key={idx} className="p-3 text-center border-r">Col {idx + 1}</th>
                                    ))
                                ) : null}

                                {hasQuantity && <th className="p-3 text-center border-r border-gray-200">Quantity</th>}
                                {hasSum && <th className="p-3 text-center bg-gray-50/50 font-bold border-r border-gray-200">Sum</th>}
                                {hasRowRate && <th className="p-3 text-right bg-blue-50/50 border-r border-gray-200">Rate</th>}
                                {hasAmount && <th className="p-3 text-right bg-blue-50 text-blue-800 font-bold">Amount</th>}
                                {hasRowTotal && <th className="p-3 text-right bg-blue-50 text-blue-800 font-bold">Amount</th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {items.map((item, idx) => (
                                <tr key={idx} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                                    <td className="p-3 text-center text-gray-400 font-mono border-r border-gray-200">{idx + 1}</td>
                                    {hasDesign && <td className="p-3 border-r border-gray-200 font-medium">{item.design || item.designSizes || '-'}</td>}
                                    {hasSize && <td className="p-3 border-r border-gray-200">{item.size || '-'}</td>}
                                    {hasDescription && <td className="p-3 border-r border-gray-200">{item.description || '-'}</td>}
                                    {hasWidth && <td className="p-3 text-center border-r border-gray-200 font-medium">{item.width}</td>}
                                    {hasHeight && <td className="p-3 text-center border-r border-gray-200 font-medium">{item.height || item.H}</td>}

                                    {/* Dynamic quantities for Sublimation/Allover */}
                                    {hasQuantities && item.quantities && Array.isArray(item.quantities) ? (
                                        item.quantities.map((qty: any, cIdx: number) => (
                                            <td key={cIdx} className="p-3 text-center border-r">{qty || 0}</td>
                                        ))
                                    ) : hasQuantity ? (
                                        <td className="p-3 text-center border-r font-medium text-gray-700">{item.quantity}</td>
                                    ) : null}

                                    {hasSum && <td className="p-3 text-center font-bold text-gray-900 bg-gray-50/50 border-r border-gray-200">{item.sum}</td>}
                                    {hasRowRate && <td className="p-3 text-right font-medium text-blue-600 border-r border-gray-200">{Number(item.rowRate || item.rate).toFixed(2)}</td>}
                                    {hasAmount && <td className="p-3 text-right font-bold text-blue-700 bg-blue-50/20">{Number(item.amount || item.total).toFixed(2)}</td>}
                                    {hasRowTotal && <td className="p-3 text-right font-bold text-blue-700 bg-blue-50/20">{Number(item.rowTotal || item.rowAmount).toFixed(2)}</td>}
                                </tr>
                            ))}
                        </tbody>
                        {totals.length > 0 && (
                            <tfoot className="bg-gray-100 font-semibold text-gray-800 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={
                                        1 +
                                        (hasSize ? 1 : 0) +
                                        (hasDescription ? 1 : 0) +
                                        (hasWidth ? 1 : 0) +
                                        (hasHeight ? 1 : 0)
                                    } className="p-2 text-right uppercase text-[10px] tracking-wider text-gray-500">Totals</td>
                                    {totals.map((tot, idx) => (
                                        <td key={idx} className="p-2 text-center">{tot}</td>
                                    ))}
                                    {run.values?.totalQuantity !== undefined && <td className="p-2 text-center font-bold text-black">{run.values.totalQuantity}</td>}
                                    {run.values?.avgRate !== undefined && <td className="p-2 text-right text-gray-600">{Number(run.values.avgRate).toFixed(4)}</td>}
                                    {run.values?.totalAmount !== undefined && <td className="p-2 text-right font-bold text-black">{Number(run.values.totalAmount).toFixed(2)}</td>}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">
                            Run {run.runNumber} Configuration
                        </h3>
                        <p className="text-sm text-gray-500">
                            {processName} • {customerName}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Print PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1" ref={printRef}>
                    {/* Render items table if available */}
                    {renderItemsTable()}

                    {/* Regular fields table in 2-column tabular format */}
                    {gridRows.length > 0 && (
                        <div className="border border-gray-300 rounded overflow-hidden mb-6">
                            <table className="w-full border-collapse text-sm">
                                <tbody>
                                    {gridRows.map((row, rowIndex) => (
                                        <tr key={`row-${rowIndex}`} className="border-b last:border-0 border-gray-300">
                                            {/* Left item */}
                                            <td className="w-1/2 p-0 border-r border-gray-300">
                                                <div className="flex h-full">
                                                    <div className="w-[140px] bg-gray-50 p-3 font-semibold text-gray-600 border-r border-gray-300 whitespace-nowrap">
                                                        {row.left.label}
                                                    </div>
                                                    <div className="flex-1 p-3 text-gray-800 bg-white min-h-[44px] flex items-center">
                                                        {row.left.value ?? '-'}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Right item */}
                                            <td className="w-1/2 p-0">
                                                {row.right ? (
                                                    <div className="flex h-full">
                                                        <div className="w-[140px] bg-gray-50 p-3 font-semibold text-gray-600 border-r border-gray-300 whitespace-nowrap">
                                                            {row.right.label}
                                                        </div>
                                                        <div className="flex-1 p-3 text-gray-800 bg-white min-h-[44px] flex items-center">
                                                            {row.right.value ?? '-'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex h-full bg-white"></div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* IMAGES SECTION */}
                    {run.values?.images && Array.isArray(run.values.images) && run.values.images.length > 0 && (
                        <div className="mt-6 border-t border-gray-200 pt-6">
                            <h4 className="font-bold text-gray-800 mb-4">Reference Images</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {run.values.images.map((imgUrl: string, index: number) => (
                                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                                        <img
                                            src={imgUrl}
                                            alt={`Reference ${index + 1}`}
                                            className="w-full h-auto object-contain max-h-[300px]"
                                            loading="lazy"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!hasTableData && gridEntries.length === 0 && (!run.values?.images || run.values.images.length === 0) && (
                        <div className="text-center py-8 text-gray-500">
                            No configuration data available for this run.
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
