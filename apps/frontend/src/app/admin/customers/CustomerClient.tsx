import Pagination from '@/components/common/Pagination';
import CustomerModal from '@/components/modals/CustomerModal';
import { Customer } from '@/domain/model/customer.model';
import { deleteCustomer, deleteCustomers } from '@/services/customer.service';
import { Loader2, Plus, Search, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

interface CustomerClientProps {
    customersData: {
        customers: Customer[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    refetch: () => void;
    loading: boolean;
}

export default function CustomerClient({
    customersData,
    searchQuery,
    setSearchQuery,
    onPageChange,
    onPageSizeChange,
    refetch,
    loading,
}: CustomerClientProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleCreateClick = () => {
        setSelectedCustomer(undefined);
        setIsModalOpen(true);
    };

    const handleEditClick = (customer: Customer) => {
        setSelectedCustomer(customer);
        setIsModalOpen(true);
    };

    const handleSuccess = () => {
        setIsModalOpen(false);
        setSelectedCustomer(undefined);
        refetch();
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === customersData.customers.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(customersData.customers.map(c => c.id));
        }
    };

    const toggleSelect = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleDeleteSingle = async (id: string, name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete customer "${name}"?`)) return;

        setIsDeleting(true);
        try {
            await deleteCustomer(id);
            refetch();
        } catch (err: any) {
            alert(err.message || 'Failed to delete customer');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteBulk = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} customers?`)) return;

        setIsDeleting(true);
        try {
            await deleteCustomers(selectedIds);
            setSelectedIds([]);
            refetch();
        } catch (err: any) {
            alert(err.message || 'Failed to delete customers');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="bg-gray-50/50 min-h-full">
            {/* HEAD & TOOLBAR - STICKY */}
            <div className=" top-0 flex-shrink-0 px-4 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-xl z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                        <span className="relative">
                            <Users className="w-5 h-5" />
                            {selectedIds.length > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-in zoom-in-0">
                                    {selectedIds.length}
                                </span>
                            )}
                        </span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Customers</h1>
                        <p className="text-sm text-gray-500">
                            {selectedIds.length > 0
                                ? `${selectedIds.length} selected for action`
                                : 'Manage your customer base'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* BATCH ACTIONS */}
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleDeleteBulk}
                            disabled={isDeleting}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-all border border-red-200 group text-sm"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Delete Selected
                        </button>
                    )}

                    {/* SEARCH */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search customers..."
                            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-64 bg-white shadow-sm transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleCreateClick}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">New Customer</span>
                    </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="p-4">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 w-10">
                                        <input
                                            type="checkbox"
                                            checked={customersData.customers.length > 0 && selectedIds.length === customersData.customers.length}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Code
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Contact Info
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Joined
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                                        Tax / TDS
                                    </th>
                                    <th className="px-6 py-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    [...Array(customersData.limit)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            {[...Array(8)].map((_, j) => (
                                                <td key={j} className="px-6 py-4 whitespace-nowrap">
                                                    <div className="h-4 bg-gray-100 rounded w-full"></div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : customersData.customers.length > 0 ? (
                                    customersData.customers.map((customer) => {
                                        const isSelected = selectedIds.includes(customer.id);
                                        return (
                                            <tr
                                                key={customer.id}
                                                onClick={() => handleEditClick(customer)}
                                                className={`hover:bg-blue-50/40 transition-colors group cursor-pointer ${isSelected ? 'bg-blue-50/60' : ''}`}
                                            >
                                                <td className="px-6 py-4" onClick={(e) => toggleSelect(customer.id, e)}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => { }} // handled by row/td click
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-blue-600">
                                                    {customer.code}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-semibold text-gray-900">{customer.name}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{customer.email || '-'}</div>
                                                    <div className="text-xs text-gray-500">{customer.phone || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span
                                                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${customer.isActive
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-red-100 text-red-700'
                                                            }`}
                                                    >
                                                        {customer.isActive ? 'ACTIVE' : 'INACTIVE'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                                    {new Date(customer.createdAt).toLocaleDateString('en-GB')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {customer.tax && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                                                TAX
                                                            </span>
                                                        )}
                                                        {customer.tds && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-50 text-orange-700 text-[10px] font-bold border border-orange-100">
                                                                TDS
                                                            </span>
                                                        )}
                                                        {!customer.tax && !customer.tds && <span className="text-gray-400 text-xs">-</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={(e) => handleDeleteSingle(customer.id, customer.name, e)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="Delete Customer"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <Users className="h-12 w-12 text-gray-300 mb-3" />
                                                <p className="font-bold text-gray-900 text-lg">No customers found</p>
                                                <p className="text-sm">Try adjusting your search criteria</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>


                </div>
            </div>
            <div className="p-5 border-t border-gray-100">
                <Pagination
                    currentPage={customersData.page}
                    totalPages={customersData.totalPages}
                    onPageChange={onPageChange}
                    totalItems={customersData.total}
                    pageSize={customersData.limit}
                    itemLabel="customers"
                />
            </div>

            {/* Modal */}
            <CustomerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
                customer={selectedCustomer}
            />
        </div>
    );
}
