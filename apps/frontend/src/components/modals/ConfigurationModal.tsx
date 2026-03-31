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
                @page { size: A4 portrait; margin: 10mm; }
                body { 
                  font-family: Arial, sans-serif; 
                  margin: 0; 
                  padding: 0; 
                  box-sizing: border-box; 
                  width: 100%;
                }
                
                .print-wrapper {
                    width: 100%;
                    transform-origin: top left;
                }

                h1 { font-size: 20px; margin-bottom: 4px; color: #111827; }
                h2 { font-size: 14px; margin-bottom: 16px; color: #4b5563; }
                
                * { box-sizing: border-box; }
                
                /* Override Tailwind paddings/margins to be compact for A4 */
                .mb-6 { margin-bottom: 12px !important; }
                .mb-4 { margin-bottom: 8px !important; }
                .p-4 { padding: 8px !important; }
                .p-6 { padding: 12px !important; }
                .mt-6 { margin-top: 12px !important; }
                .pt-6 { padding-top: 12px !important; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
                th, td { padding: 6px 8px; text-align: left; border: 1px solid #d1d5db; font-size: 11px; }
                th { background-color: #f3f4f6; font-weight: bold; color: #1f2937; }
                td { color: #1f2937; }
                
                /* Images layout */
                .grid-cols-2 { 
                    display: flex !important; 
                    gap: 12px; 
                    justify-content: center;
                }
                .grid-cols-2 > div { 
                    flex: 1;
                    min-width: 0;
                    border: 1px solid #e5e7eb;
                    padding: 8px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                img { 
                    max-width: 100%; 
                    max-height: 280px; 
                    height: auto; 
                    object-fit: contain; 
                }
                
                /* Neutralize flex-1 from react layout */
                .flex-1 { flex: none !important; }
                .overflow-y-auto { overflow: visible !important; }
              </style>
            </head>
            <body>
              <div class="print-wrapper" id="print-wrapper">
                  <h1>Run ${run.runNumber} - ${processName}</h1>
                  <h2>${orderCode} • ${customerName}</h2>
                  ${printContent.innerHTML}
              </div>
              <script>
                window.onload = function() {
                    const images = document.getElementsByTagName('img');
                    let loadedCount = 0;
                    
                    function adjustAndPrint() {
                        const wrapper = document.getElementById('print-wrapper');
                        
                        // Max A4 height at 96PPI is ~1123px. With 10mm margins (~38px top/bottom),
                        // max safe height is ~1040px.
                        const maxPageHeight = 1040; 
                        
                        setTimeout(() => {
                            const contentHeight = wrapper.scrollHeight;
                            if (contentHeight > maxPageHeight) {
                                const scale = maxPageHeight / contentHeight;
                                // Use zoom if supported, otherwise fallback to transform
                                if ('zoom' in document.body.style) {
                                    document.body.style.zoom = scale;
                                } else {
                                    wrapper.style.transform = 'scale(' + scale + ')';
                                    wrapper.style.width = (100 / scale) + '%';
                                    document.body.style.height = maxPageHeight + 'px';
                                    document.body.style.overflow = 'hidden';
                                }
                            }
                            
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 250);
                        }, 100);
                    }

                    if (images.length === 0) {
                        adjustAndPrint();
                    } else {
                        for (let i = 0; i < images.length; i++) {
                            if (images[i].complete) {
                                loadedCount++;
                                if (loadedCount === images.length) adjustAndPrint();
                            } else {
                                images[i].onload = function() {
                                    loadedCount++;
                                    if (loadedCount === images.length) adjustAndPrint();
                                };
                                images[i].onerror = function() {
                                    loadedCount++;
                                    if (loadedCount === images.length) adjustAndPrint();
                                };
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
    const isDTF = normalizedProcess.includes('dtf') || normalizedProcess.includes('direct to film');
    const isPlotter = normalizedProcess.includes('plotter');
    const isSublimation = normalizedProcess.includes('sublimation');

    // Fields to exclude from regular grid as they're handled specifically or by tableRendering
    const tableFields = new Set([
        'items', 'columnHeaders', 'totals', 'totalQuantity', 'totalAmount',
        'avgRate', 'totalMeters', 'Estimated Amount', 'images', 'particulars',
        'End Rate', 'Average Rate', 'Total Quantity', 'Total Amount',
        'Total Laser Time', 'Total Mtr', 'rate_per_meter', 'panna', 'printer',
        'Total Layouts', 'Total Area', 'Layout Amount', 'Actual Meter Cost',
        'Efficiency %', 'Fusing Cost', 'Actual Total', 'Per PC Cost', 'pcs', 'rate',
        'isFusing', 'isJobDifference', 'customPcs', 'sheetsToCut', 'Total Sheet Req',
        'Total Sheet Req (Meters)'
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

        if (isDTF) {
            const dtfItems = items as any[];
            return (
                <div className="mb-6 text-black">
                    {renderSharedHeader()}
                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-100 border-b text-gray-600 uppercase text-[10px] font-bold tracking-wider">
                                    <th className="p-2 text-center w-10 border-r border-gray-200">#</th>
                                    <th className="p-2 text-left border-r border-gray-200">Particulars</th>
                                    <th className="p-2 text-center border-r border-gray-200">H</th>
                                    <th className="p-2 text-center border-r border-gray-200">Pcs/L</th>
                                    <th className="p-2 text-center border-r border-gray-200">Qty Act</th>
                                    <th className="p-2 text-center border-r border-gray-200">Req</th>
                                    <th className="p-2 text-center border-r border-gray-200">Layouts</th>
                                    <th className="p-2 text-center border-r border-gray-200">Area</th>
                                    <th className="p-2 text-right bg-blue-50/50 border-r border-gray-200">Price/L</th>
                                    <th className="p-2 text-right bg-blue-50 text-blue-800">Total</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {dtfItems.map((item, idx) => (
                                    <tr key={idx} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                                        <td className="p-2 text-center text-gray-400 font-mono border-r border-gray-200">{idx + 1}</td>
                                        <td className="p-2 border-r border-gray-200 font-medium text-gray-800">{item.particulars || '-'}</td>
                                        <td className="p-2 text-center border-r border-gray-200">{item.height || 0}</td>
                                        <td className="p-2 text-center border-r border-gray-200">{item.pcsPerLayout || 0}</td>
                                        <td className="p-2 text-center border-r border-gray-200">{item.quantityActual || 0}</td>
                                        <td className="p-2 text-center border-r border-gray-200 font-bold">{item.quantityRequired || 0}</td>
                                        <td className="p-2 text-center border-r border-gray-200 font-bold text-blue-600">{item.numberOfLayouts || 0}</td>
                                        <td className="p-2 text-center border-r border-gray-200">{Number(item.area || 0).toFixed(2)}</td>
                                        <td className="p-2 text-right border-r border-gray-200 text-blue-600 font-medium font-mono">₹{Number(item.pricePerLayout || 0).toFixed(2)}</td>
                                        <td className="p-2 text-right bg-blue-50/20 font-bold text-blue-700 font-mono">₹{Number(item.rowTotal || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-bold text-gray-800 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={2} className="p-2 text-right uppercase text-[10px] tracking-widest text-gray-500">Totals:</td>
                                    <td colSpan={4}></td>
                                    <td className="p-2 text-center bg-gray-100/50 text-blue-700">{run.values?.['Total Layouts'] || dtfItems.reduce((sum, i) => sum + (Number(i.numberOfLayouts) || 0), 0)}</td>
                                    <td className="p-2 text-center bg-gray-100/50">{Number(run.values?.['Total Area'] || 0).toFixed(2)}</td>
                                    <td className="p-2 text-right border-r border-gray-200">
                                        <span className="text-[10px] text-gray-400 uppercase block mb-0.5">Rate</span>
                                        {Number(run.values?.rate || 0).toFixed(2)}
                                    </td>
                                    <td className="p-2 text-right text-base text-blue-900 bg-blue-50/30 font-mono">
                                        ₹{Number(run.values?.['Layout Amount'] || 0).toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            );
        }

        if (isPlotter) {
            const pItems = items as any[];
            return (
                <div className="mb-6 text-black">
                    {renderSharedHeader()}
                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-100 border-b text-gray-600 uppercase text-[10px] font-bold tracking-wider">
                                    <th className="p-2 text-center w-10 border-r border-gray-200">#</th>
                                    <th className="p-2 text-left border-r border-gray-200">Files/Sizes</th>
                                    <th className="p-2 text-center border-r border-gray-200">Qty</th>
                                    <th className="p-2 text-center border-r border-gray-200">W x H</th>
                                    <th className="p-2 text-center border-r border-gray-200">Layout (H/Pc)</th>
                                    <th className="p-2 text-center border-r border-gray-200 bg-blue-50/50">Sheet Req</th>
                                    <th className="p-2 text-right border-r border-gray-200 bg-blue-50/50">Rate</th>
                                    <th className="p-2 text-right bg-blue-50 text-blue-800">Total</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {pItems.map((item, idx) => (
                                    <tr key={idx} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                                        <td className="p-2 text-center text-gray-400 font-mono border-r border-gray-200">{idx + 1}</td>
                                        <td className="p-2 border-r border-gray-200 font-medium text-gray-800">{item.fileSizes || '-'}</td>
                                        <td className="p-2 text-center border-r border-gray-200">{item.quantity || 0}</td>
                                        <td className="p-2 text-center border-r border-gray-200">{item.sizeW || 0} x {item.sizeH || 0}</td>
                                        <td className="p-2 text-center border-r border-gray-200">{item.layoutHeight || 0} / {item.layoutPcs || 0}</td>
                                        <td className="p-2 text-center border-r border-gray-200 bg-blue-50/20 font-medium">{Number(item.sheetReq || 0).toFixed(2)}</td>
                                        <td className="p-2 text-right border-r border-gray-200 bg-blue-50/20 text-gray-600">₹{Number(item.rate || 0).toFixed(2)}</td>
                                        <td className="p-2 text-right bg-blue-50/30 font-bold text-blue-700 font-mono">₹{Number(item.total || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-bold text-gray-800 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={2} className="p-2 text-right uppercase text-[10px] tracking-widest text-gray-500 font-bold">Totals:</td>
                                    <td className="p-2 text-center text-gray-900">{run.values?.['Total Quantity'] || pItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)}</td>
                                    <td colSpan={2}></td>
                                    <td className="p-2 text-center bg-gray-100/50 text-blue-700">{Number(run.values?.['Total Sheet Req'] || 0).toFixed(2)}</td>
                                    <td></td>
                                    <td className="p-2 text-right text-base text-blue-900 bg-blue-50/30 font-mono">
                                        ₹{Number(run.values?.['Total Amount'] || 0).toFixed(2)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            );
        }

        if (isSublimation) {
            const sItems = items as any[];
            const isAllover = sItems.some((i: any) => 'height' in i && !('quantities' in i));

            return (
                <div className="mb-6 text-black">
                    {renderSharedHeader()}
                    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-100 border-b text-gray-600 uppercase text-[10px] font-bold tracking-wider">
                                    <th className="p-2 text-center w-10 border-r border-gray-200">#</th>
                                    <th className="p-2 text-left border-r border-gray-200">{isAllover ? 'Design' : 'Size'}</th>
                                    {isAllover ? (
                                        <>
                                            <th className="p-2 text-center border-r border-gray-200">Height</th>
                                            <th className="p-2 text-center border-r border-gray-200 bg-blue-50/50">Rate</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="p-2 text-center border-r border-gray-200">W</th>
                                            <th className="p-2 text-center border-r border-gray-200">H</th>
                                            {columnHeaders.map((h, i) => (
                                                <th key={i} className="p-2 text-center border-r border-gray-200">{h}</th>
                                            ))}
                                            <th className="p-2 text-center border-r border-gray-200 bg-gray-50">Sum</th>
                                        </>
                                    )}
                                    <th className="p-2 text-right border-r border-gray-200 font-bold bg-blue-50/50">Qty</th>
                                    <th className="p-2 text-right bg-blue-50 text-blue-800 font-bold">Total</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {sItems.map((item, idx) => (
                                    <tr key={idx} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                                        <td className="p-2 text-center text-gray-400 font-mono border-r border-gray-200">{idx + 1}</td>
                                        <td className="p-2 border-r border-gray-200 font-medium text-gray-800">{isAllover ? (item.design || '-') : (item.size || '-')}</td>
                                        {isAllover ? (
                                            <>
                                                <td className="p-2 text-center border-r border-gray-200">{item.height || 0}</td>
                                                <td className="p-2 text-center border-r border-gray-200 bg-blue-50/20 text-blue-600 font-medium">₹{Number(item.rate || 0).toFixed(2)}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-2 text-center border-r border-gray-200">{item.width || 0}</td>
                                                <td className="p-2 text-center border-r border-gray-200">{item.height || 0}</td>
                                                {(item.quantities || [0, 0, 0, 0]).map((q: any, i: number) => (
                                                    <td key={i} className="p-2 text-center border-r border-gray-200 text-gray-500">{q}</td>
                                                ))}
                                                <td className="p-2 text-center border-r border-gray-200 font-bold text-gray-700 bg-gray-50/50">{item.sum || 0}</td>
                                            </>
                                        )}
                                        <td className="p-2 text-right border-r border-gray-200 font-bold text-gray-900 bg-blue-50/20">{item.quantity || item.sum || 0}</td>
                                        <td className="p-2 text-right bg-blue-50/30 font-bold text-blue-700 font-mono">₹{Number(item.amount || item.rowTotal || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 font-bold text-gray-800 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={2} className="p-2 text-right uppercase text-[10px] tracking-widest text-gray-500 font-bold">Totals:</td>
                                    {isAllover ? (
                                        <td colSpan={2}></td>
                                    ) : (
                                        <>
                                            <td colSpan={2}></td>
                                            {totals.map((t, i) => (
                                                <td key={i} className="p-2 text-center">{t}</td>
                                            ))}
                                            <td></td>
                                        </>
                                    )}
                                    <td className="p-2 text-right font-bold text-blue-700 text-lg">{run.values?.['Total Quantity'] || run.values?.totalQuantity || 0}</td>
                                    <td className="p-2 text-right text-base text-blue-900 bg-blue-50/30 font-mono">
                                        ₹{Number(run.values?.['Total Amount'] || run.values?.totalAmount || 0).toFixed(2)}
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
        const hasDesign = 'design' in firstItem || 'designSizes' in firstItem || 'particulars' in firstItem;
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
                                {hasSize && <th className="p-3 text-left border-r border-gray-200">Size</th>}
                                {hasDescription && <th className="p-3 text-left border-r border-gray-200">Description</th>}
                                {hasWidth && <th className="p-3 text-center border-r border-gray-200">W</th>}
                                {hasHeight && <th className="p-3 text-center border-r border-gray-200">H</th>}

                                {/* Dynamic column headers for Sublimation/Allover */}
                                {hasQuantities && columnHeaders.length > 0 ? (
                                    columnHeaders.map((header, idx) => (
                                        <th key={idx} className="p-3 text-center border-r border-gray-200">{header}</th>
                                    ))
                                ) : hasQuantities && firstItem.quantities ? (
                                    firstItem.quantities.map((_: any, idx: number) => (
                                        <th key={idx} className="p-3 text-center border-r border-gray-200">Col {idx + 1}</th>
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
                                    {hasDesign && <td className="p-3 border-r border-gray-200 font-medium">{item.design || item.designSizes || item.particulars || '-'}</td>}
                                    {hasSize && <td className="p-3 border-r border-gray-200">{item.size || '-'}</td>}
                                    {hasDescription && <td className="p-3 border-r border-gray-200">{item.description || '-'}</td>}
                                    {hasWidth && <td className="p-3 text-center border-r border-gray-200 font-medium">{item.width}</td>}
                                    {hasHeight && <td className="p-3 text-center border-r border-gray-200 font-medium">{item.height || item.H}</td>}

                                    {/* Dynamic quantities for Sublimation/Allover */}
                                    {hasQuantities && item.quantities && Array.isArray(item.quantities) ? (
                                        item.quantities.map((qty: any, cIdx: number) => (
                                            <td key={cIdx} className="p-3 text-center border-r border-gray-200">{qty || 0}</td>
                                        ))
                                    ) : hasQuantity ? (
                                        <td className="p-3 text-center border-r border-gray-200 font-medium">{item.quantity}</td>
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
                                        (hasDesign ? 1 : 0) +
                                        (hasSize ? 1 : 0) +
                                        (hasDescription ? 1 : 0) +
                                        (hasWidth ? 1 : 0) +
                                        (hasHeight ? 1 : 0)
                                    } className="p-2 text-right uppercase text-[10px] tracking-wider text-gray-500">Totals</td>
                                    {totals.map((tot, idx) => (
                                        <td key={idx} className="p-2 text-center border-r border-gray-200">{tot}</td>
                                    ))}
                                    {run.values?.totalQuantity !== undefined && <td className="p-2 text-center font-bold text-black border-r border-gray-200">{run.values.totalQuantity}</td>}
                                    {run.values?.avgRate !== undefined && <td className="p-2 text-right text-gray-600 border-r border-gray-200">{Number(run.values.avgRate).toFixed(4)}</td>}
                                    {run.values?.totalAmount !== undefined && <td className="p-2 text-right font-bold text-black">₹{Number(run.values.totalAmount).toFixed(2)}</td>}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

            </div>
        );
    };

    const renderRunSummary = () => {
        const summaryFields = [
            { label: 'Total PCS', key: 'pcs' },
            { label: 'Fusing', key: 'isFusing', type: 'boolean' },
            { label: 'Job Diff', key: 'isJobDifference', type: 'boolean' },
            { label: 'Custom PCS', key: 'customPcs' },
            { label: 'Fusing Cost', key: 'Fusing Cost', prefix: '₹' },
            { label: 'Efficiency', key: 'Efficiency %', suffix: '%' },
            { label: 'Meter Cost', key: 'Actual Meter Cost', prefix: '₹' },
            { label: 'Per PC Cost', key: 'Per PC Cost', prefix: '₹' },
            { label: 'Actual Total', key: 'Actual Total', prefix: '₹', highlight: true },
            // Plotter
            { label: 'Sheets to Cut', key: 'sheetsToCut' },
            { label: 'Sheet Req', key: 'Total Sheet Req', suffix: ' in' },
            { label: 'Sheet Req (M)', key: 'Total Sheet Req (Meters)', suffix: ' m' },
            { label: 'Total Qty', key: 'Total Quantity' },
            { label: 'Total Amount', key: 'Total Amount', prefix: '₹', highlight: true },
            // Sublimation
            { label: 'Panna', key: 'panna' },
            { label: 'Printer', key: 'printer' },
            { label: 'Rate/Mtr', key: 'rate_per_meter', prefix: '₹' },
            { label: 'Total Mtr', key: 'Total Mtr', suffix: ' m' },
            { label: 'Avg Rate', key: 'avgRate', prefix: '₹' },
            { label: 'Total Mtrs', key: 'totalMeters', suffix: ' m' },
            { label: 'Total Qty', key: 'totalQuantity' },
            { label: 'Total Amount', key: 'totalAmount', prefix: '₹', highlight: true },
        ];

        const activeFields = summaryFields.filter(f => run.values?.[f.key] !== undefined && run.values?.[f.key] !== null);
        if (activeFields.length === 0) return null;

        return (
            <div className="mt-6 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-bold text-[10px] uppercase tracking-wider text-gray-500">
                    Execution Summary
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0">
                    {activeFields.map((field, idx) => {
                        let val = run.values?.[field.key];
                        if (field.type === 'boolean') val = val ? 'Yes' : 'No';
                        else if (typeof val === 'number') {
                            if (field.key === 'pcs' || field.key === 'customPcs') val = val.toString();
                            else val = val.toFixed(2);
                        }

                        return (
                            <div key={idx} className={`p-4 border-r border-b border-gray-100 ${field.highlight ? 'bg-blue-50/50' : ''}`}>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{field.label}</span>
                                <div className={`text-sm font-bold ${field.highlight ? 'text-blue-900' : 'text-gray-800'}`}>
                                    {field.prefix}{val}{field.suffix}
                                </div>
                            </div>
                        );
                    })}
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

                    {/* Run Summary Grid */}
                    {renderRunSummary()}

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
