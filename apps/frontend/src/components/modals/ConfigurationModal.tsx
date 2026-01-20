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
}

export default function ConfigurationModal({
    run,
    processName,
    orderCode,
    customerName,
    onClose,
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
                @page { size: landscape; margin: 1cm; }
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { font-size: 18px; margin-bottom: 10px; color: #1f2937; }
                h2 { font-size: 14px; margin-bottom: 20px; color: #6b7280; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 10px 15px; text-align: left; border: 1px solid #000; }
                th { background-color: #f0f0f0; font-weight: 600; color: #000; }
                td { background-color: #fff; color: #000; }
                .highlight { background-color: #dbeafe !important; font-weight: bold; }
              </style>
            </head>
            <body>
              <h1>Run ${run.runNumber} - ${processName}</h1>
              <h2>${orderCode} • ${customerName}</h2>
              ${printContent.innerHTML}
            </body>
          </html>
        `);
                printWindow.document.close();
                printWindow.print();
            }
        }
    };

    const requiredFields = run.fields?.filter((f) => f.required) || [];

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

                {/* Modal Body - Configuration Table */}
                <div className="p-6 max-h-[60vh] overflow-y-auto" ref={printRef}>
                    <table className="w-full border-collapse border border-gray-800">
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

                    {requiredFields.length === 0 && (
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