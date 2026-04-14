"use client";
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import BillingContextCard from "@/components/billing/BillingContextCard";
import BillingContextTable from "@/components/billing/BillingContextTable";
import BillsFilter from "@/components/billing/BillsFilter";
import Pagination from '@/components/common/Pagination';
import BillingGroupModal from "@/components/modals/BillingGroupModal";
import OrdersViewToggle from "@/components/orders/OrdersViewToggle";
import PageSizeSelector from "@/components/orders/PageSizeSelector";
import { GetBillingContextsResponse } from '@/domain/model/billing.model';
import InvoicePDF from '@/components/billing/InvoicePDF';
import { pdf } from '@react-pdf/renderer';
import { getBillingContextById, getBillingContexts } from '@/services/billing.service';
import debounce from 'lodash/debounce';
import { ChevronLeft, Download, FileText, Filter, Loader2, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from 'react';

export default function BillsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        }>
            <ProtectedBillsPageContent />
        </Suspense>
    );
}

const ProtectedBillsPageContent = withAuth(BillsPageContent, { permission: Permission.BILLINGS_VIEW });

function BillsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedGroupId = searchParams.get('SelectedGroup');

    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [pageSize, setPageSize] = useState(12);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [data, setData] = useState<GetBillingContextsResponse>({
        data: [],
        total: 0,
        page: 1,
        limit: 12,
        totalPages: 0,
        totalQuantity: 0,
        totalEstimatedAmount: 0
    });

    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isTest, setIsTest] = useState(searchParams.get('isTest') === 'true');
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [isDownloading, setIsDownloading] = useState(false);

    // Debounce search input
    const debouncedSearchUpdate = useCallback(
        debounce((value: string) => {
            setDebouncedSearch(value);
            // Reset to page 1 when search changes
            setData((prev) => ({ ...prev, page: 1 }));
        }, 500),
        []
    );

    useEffect(() => {
        debouncedSearchUpdate(searchQuery);
        return () => debouncedSearchUpdate.cancel();
    }, [searchQuery, debouncedSearchUpdate]);

    useEffect(() => {
        const fetchContexts = async () => {
            setLoading(true);
            try {
                const response = await getBillingContexts({
                    page: data.page,
                    limit: pageSize,
                    search: debouncedSearch,
                    isTest: isTest
                });
                setData(response);
            } catch (error) {
                console.error('Failed to fetch billing contexts:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchContexts();
    }, [data.page, debouncedSearch, pageSize, isTest]);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= data.totalPages) {
            setData((prev) => ({ ...prev, page: newPage }));
        }
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setData((prev) => ({ ...prev, page: 1 })); // Reset to page 1 on size change
    };

    const handleContextClick = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('SelectedGroup', id);
        router.push(`/admin/bills?${params.toString()}`);
    };

    const handleCloseModal = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('SelectedGroup');
        router.push(`/admin/bills?${params.toString()}`);
    };

    const handleSelectRow = (id: string, checked: boolean) => {
        if (checked) setSelectedGroupIds(prev => [...prev, id]);
        else setSelectedGroupIds(prev => prev.filter(gid => gid !== id));
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedGroupIds(data.data.map(item => item.id));
        } else {
            setSelectedGroupIds([]);
        }
    };

    const handleDownloadMergedInvoice = async () => {
        if (selectedGroupIds.length === 0) return;
        setIsDownloading(true);

        try {
            // Fetch all details
            const contextsDetails = await Promise.all(
                selectedGroupIds.map(id => getBillingContextById(id))
            );

            // Construct invoiceDataList
            const invoiceDataList = contextsDetails.map(details => {
                const totalAmount = details.orders.reduce((sum, order) => sum + (Number(order.billing?.result) || 0), 0);
                const cgstAmount = details.orders[0]?.customer?.tax ? (totalAmount * 2.5) / 100 : 0;
                const sgstAmount = details.orders[0]?.customer?.tax ? (totalAmount * 2.5) / 100 : 0;
                const tdsRate = 2;
                const tdsAmount = details.orders[0]?.customer?.tds ? (totalAmount * tdsRate) / 100 : 0;
                const finalTotal = totalAmount + cgstAmount + sgstAmount - tdsAmount;

                return {
                    heading: details.orders[0]?.customer?.tax ? 'Tax Invoice' : 'Delivery Challan',
                    companyName: 'Sky Art Prints LLP',
                    companyAddress: '13, Bhavani Complex, Bhavani Shankar Road, Dadar West, Mumbai 400053',
                    msmeReg: 'MSME Reg#: UDYAM-MH-19-0217047',
                    gstin: details.orders[0]?.customer?.gstno || 'NA',
                    billTo: details.orders[0]?.customer?.name || 'NA',
                    address: details.orders[0]?.customer?.address || 'NA',
                    date: details.latestSnapshot?.createdAt
                        ? new Date(details.latestSnapshot.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                        })
                        : 'NA',
                    billNumber: details.name,
                    items: details.orders.map((order, index) => ({
                        srNo: index + 1,
                        orderCode: order.code,
                        jobCode: order.jobCode || '',
                        quantity: order.quantity,
                        rate: order.billing?.result && order.quantity > 0
                                ? (Number(order.billing.result) / order.quantity).toFixed(2) : '0.00',
                        amount: order.billing?.result || '0',
                    })),
                    subtotal: totalAmount.toFixed(2),
                    cgstAmount: cgstAmount.toFixed(2),
                    sgstAmount: sgstAmount.toFixed(2),
                    tdsAmount: tdsAmount.toFixed(2),
                    tdsRate: tdsRate.toString(),
                    total: finalTotal.toFixed(2),
                };
            });

            // generate merged pdf
            const blob = await pdf(<InvoicePDF invoiceDataList={invoiceDataList} />).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `merged_invoices_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // optional: clear selection after download
            setSelectedGroupIds([]);
        } catch (err) {
            console.error('Merged invoice download failed:', err);
            alert('Failed to generate merged invoices.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="flex h-full bg-gray-50/50 overflow-hidden scrollbar-hide">
            {/* LEFT SIDEBAR FILTERS */}
            <div
                className={`
                flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto scrollbar-hide transition-all duration-300 ease-in-out
                ${isSidebarOpen ? 'w-72 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-full lg:w-0 lg:opacity-0'}
            `}
            >
                <div className="w-72 h-full">
                    <BillsFilter 
                        onClose={() => setIsSidebarOpen(false)} 
                        isTest={isTest}
                        onIsTestChange={(val) => {
                            setIsTest(val);
                            const params = new URLSearchParams(searchParams.toString());
                            if (val) params.set('isTest', 'true');
                            else params.delete('isTest');
                            params.set('page', '1');
                            router.push(`/admin/bills?${params.toString()}`);
                        }}
                    />
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col w-full relative overflow-hidden">
                {/* Header Section */}
                <div className="flex-shrink-0 px-4 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-xl z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className={`p-2 rounded-lg border transition-colors ${isSidebarOpen
                                ? 'bg-blue-50 border-blue-200 text-blue-600'
                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            title={isSidebarOpen ? "Collapse Filters" : "Expand Filters"}
                        >
                            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
                        </button>

                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Billing Groups</h1>
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full border border-green-200 whitespace-nowrap">
                                        Total: ₹{data.totalEstimatedAmount?.toLocaleString() || 0}
                                    </span>
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-sm font-bold rounded-full border border-blue-100 whitespace-nowrap">
                                        <span className="text-[10px] text-blue-400 uppercase tracking-wider">Total pcs</span>
                                        {data.totalQuantity?.toLocaleString() || 0}
                                    </div>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">Manage and view all billing groups</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, description, order code..."
                                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 bg-white shadow-sm transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                                >
                                    <X className="w-3 h-3 text-gray-400" />
                                </button>
                            )}
                        </div>

                        <OrdersViewToggle view={viewMode} onViewChange={setViewMode} />
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <div className="p-4 md:p-6 space-y-6">
                        {/* Results Summary */}
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                Showing <span className="font-semibold text-gray-800">{data.data.length}</span>{' '}
                                of <span className="font-semibold text-gray-800">{data.total}</span> groups
                            </p>
                            <PageSizeSelector pageSize={pageSize} onPageSizeChange={handlePageSizeChange} />
                        </div>

                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                                <p className="text-gray-500 font-medium">Loading billing groups...</p>
                            </div>
                        ) : data.data.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed shadow-sm">
                                <FileText className="w-16 h-16 mb-4 text-gray-300" />
                                <p className="text-lg font-medium">No billing groups found</p>
                                {debouncedSearch ? (
                                    <p className="text-sm mt-1">Try adjusting your search query</p>
                                ) : (
                                    <p className="text-sm mt-1">Create a group from the Completed Orders page</p>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* GRID VIEW */}
                                {viewMode === 'grid' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                        {data.data.map((context) => (
                                            <BillingContextCard
                                                key={context.id}
                                                context={context}
                                                onClick={() => handleContextClick(context.id)}
                                                selected={selectedGroupIds.includes(context.id)}
                                                onSelect={(checked) => handleSelectRow(context.id, checked)}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* TABLE VIEW */}
                                {viewMode === 'table' && (
                                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                        <BillingContextTable
                                            data={data.data}
                                            startIndex={(data.page - 1) * pageSize}
                                            onRowClick={handleContextClick}
                                            selectedIds={selectedGroupIds}
                                            onSelect={handleSelectRow}
                                            onSelectAll={handleSelectAll}
                                        />
                                    </div>
                                )}

                                {/* PAGINATION */}
                                <Pagination
                                    currentPage={data.page}
                                    totalPages={data.totalPages}
                                    onPageChange={handlePageChange}
                                    totalItems={data.total}
                                    pageSize={pageSize}
                                    itemLabel="groups"
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* BULK ACTIONS BAR */}
            {selectedGroupIds.length > 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
                    <div className="bg-gray-900 shadow-2xl rounded-2xl px-6 py-4 flex items-center gap-6 border border-gray-800">
                        <div className="flex items-center gap-3 border-r border-gray-700 pr-6">
                            <div className="bg-blue-500/20 text-blue-400 p-2 rounded-lg">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-white font-medium text-sm">
                                    {selectedGroupIds.length} group{selectedGroupIds.length > 1 ? 's' : ''} selected
                                </p>
                                <button
                                    onClick={() => setSelectedGroupIds([])}
                                    className="text-gray-400 text-xs hover:text-white transition-colors"
                                >
                                    Clear selection
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex items-center">
                            <button
                                onClick={handleDownloadMergedInvoice}
                                disabled={isDownloading}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                {isDownloading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Generating PDF...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4" />
                                        Download Merged Invoice
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BillingGroupModal
                isOpen={!!selectedGroupId}
                onClose={handleCloseModal}
                groupId={selectedGroupId || ''}
            />
        </div>
    );
}
