'use client';

import { Location } from '@/domain/model/location.model';
import { MapPin, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import LocationModal from './components/LocationModal';

interface LocationClientProps {
    locationsData: {
        locations: Location[];
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

export default function LocationClient({
    locationsData,
    searchQuery,
    setSearchQuery,
    onPageChange,
    onPageSizeChange,
    refetch,
    loading,
}: LocationClientProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<Location | undefined>(undefined);

    const handleCreateClick = () => {
        setSelectedLocation(undefined);
        setIsModalOpen(true);
    };

    const handleEditClick = (location: Location) => {
        setSelectedLocation(location);
        setIsModalOpen(true);
    };

    const handleSuccess = () => {
        setIsModalOpen(false);
        setSelectedLocation(undefined);
        refetch();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage physical locations and workstations</p>
                </div>

                <div className="relative w-full sm:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search locations..."
                        className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button
                    onClick={handleCreateClick}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Location
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Code
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Name
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Type
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Description
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Created At
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                [...Array(locationsData.limit)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {[...Array(6)].map((_, j) => (
                                            <td key={j} className="px-6 py-4 whitespace-nowrap">
                                                <div className="h-4 bg-gray-200 rounded w-full"></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : locationsData.locations.length > 0 ? (
                                locationsData.locations.map((location) => (
                                    <tr
                                        key={location.id}
                                        onClick={() => handleEditClick(location)}
                                        className="hover:bg-gray-50 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                            {location.code}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{location.name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                {location.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[200px] truncate">
                                            {location.description || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${location.isActive
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {location.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(location.createdAt).toLocaleDateString('en-GB')}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <MapPin className="h-10 w-10 text-gray-300 mb-2" />
                                            <p>No locations found matching your search.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                    <p className="text-sm text-gray-500">
                        Showing {locationsData.locations.length} of {locationsData.total} locations
                    </p>

                    <div className="flex items-center gap-2">
                        <select
                            value={locationsData.limit}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="border px-2 py-1 rounded"
                        >
                            {[10, 25, 50, 100].map((size) => (
                                <option key={size} value={size}>
                                    {size} per page
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={() => onPageChange(locationsData.page - 1)}
                            disabled={locationsData.page === 1}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            Previous
                        </button>

                        {[...Array(locationsData.totalPages)].map((_, i) => (
                            <button
                                key={i + 1}
                                onClick={() => onPageChange(i + 1)}
                                className={`px-3 py-1 rounded ${locationsData.page === i + 1 ? 'bg-blue-600 text-white' : 'border'}`}
                            >
                                {i + 1}
                            </button>
                        ))}

                        <button
                            onClick={() => onPageChange(locationsData.page + 1)}
                            disabled={locationsData.page === locationsData.totalPages}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            <LocationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleSuccess}
                location={selectedLocation}
            />
        </div>
    );
}
