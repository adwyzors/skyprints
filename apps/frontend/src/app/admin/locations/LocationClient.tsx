'use client';

import Pagination from '@/components/common/Pagination';
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
        <div className="bg-gray-50/50 min-h-full">
            {/* HEAD & TOOLBAR - STICKY */}
            <div className=" top-0 flex-shrink-0 px-4 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-xl z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                        <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Locations</h1>
                        <p className="text-sm text-gray-500">Manage physical locations and workstations</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* SEARCH */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search locations..."
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
                        <span className="hidden sm:inline">New Location</span>
                    </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="p-4">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto text-center">
                        <table className="min-w-full divide-y divide-gray-200 text-center">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Code
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Description
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
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
                                                    <div className="h-4 bg-gray-100 rounded w-full"></div>
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : locationsData.locations.length > 0 ? (
                                    locationsData.locations.map((location) => (
                                        <tr
                                            key={location.id}
                                            onClick={() => handleEditClick(location)}
                                            className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                                                {location.code}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-gray-900">{location.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                                    {location.type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[240px] truncate text-left">
                                                {location.description || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span
                                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${location.isActive
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                        }`}
                                                >
                                                    {location.isActive ? 'ACTIVE' : 'INACTIVE'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                                {new Date(location.createdAt).toLocaleDateString('en-GB')}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <MapPin className="h-12 w-12 text-gray-300 mb-3" />
                                                <p className="font-medium text-gray-900 text-lg">No locations found</p>
                                                <p className="text-sm">Try adjusting your search query</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t border-gray-100">
                        <Pagination
                            currentPage={locationsData.page}
                            totalPages={locationsData.totalPages}
                            onPageChange={onPageChange}
                            totalItems={locationsData.total}
                            pageSize={locationsData.limit}
                            itemLabel="locations"
                        />
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
