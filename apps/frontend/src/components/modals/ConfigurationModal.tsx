'use client';

import { useRef } from 'react';

interface ConfigurationModalProps {
    run: {
        runNumber: number;
        fields?: Array<{ key: string; required: boolean }>;
        values?: Record<string, any>;
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
                
                img { max-width: 100%; height: auto; display: block; }
                
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
                                images[i].onload = checkAllLoaded;
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

    const requiredFields = (Array.isArray(run.fields) ? run.fields : []).filter((f) => f.required);

    // Create a 2-column grid layout for the table like in the image
    const createGridData = () => {
        const data = [];
        const fields = requiredFields;

        // Group fields in pairs for 2-column layout
        for (let i = 0; i < fields.length; i += 2) {
            const row = {
                leftField: fields[i],
                rightField: fields[i + 1]
            };
            data.push(row);
        }

        return data;
    };

    const gridData = createGridData();

    return (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden">
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

                <div className="p-6 max-h-[60vh] overflow-y-auto" ref={printRef}>
                    <table className="w-full border-collapse border border-gray-800 mb-6">
                        <tbody>
                            {gridData.map((row, rowIndex) => (
                                <tr key={`row-${rowIndex}`} className="border-b border-gray-800">
                                    {/* Left column */}
                                    <td className="border-r border-gray-800 p-0 w-1/2">
                                        <div className="flex">
                                            <div className="w-2/5 bg-gray-100 p-3 font-semibold border-r border-gray-800">
                                                {row.leftField?.key || ''}
                                            </div>
                                            <div className="w-3/5 p-3">
                                                {row.leftField ? (run.values?.[row.leftField.key] ?? '-') : ''}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Right column - only if exists */}
                                    {row.rightField && (
                                        <td className="p-0 w-1/2">
                                            <div className="flex">
                                                <div className="w-2/5 bg-gray-100 p-3 font-semibold border-r border-gray-800">
                                                    {row.rightField.key}
                                                </div>
                                                <div className="w-3/5 p-3">
                                                    {run.values?.[row.rightField.key] ?? '-'}
                                                </div>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>

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

                    {requiredFields.length === 0 && (!run.values?.images || run.values.images.length === 0) && (
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