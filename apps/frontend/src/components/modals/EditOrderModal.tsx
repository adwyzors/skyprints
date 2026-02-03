'use client';

import { Customer } from '@/domain/model/customer.model';
import { Order } from '@/domain/model/order.model';
import { apiRequest } from '@/services/api.service';
import { getCustomers } from '@/services/customer.service';
import { updateOrder } from '@/services/orders.service';
import { Loader2, Save, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    order: Order;
}

export default function EditOrderModal({ open, onClose, onSuccess, order }: Props) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Form State
    const [customerId, setCustomerId] = useState(order.customer?.id || '');
    const [customerSearch, setCustomerSearch] = useState(order.customer?.name || '');
    const [showCustomerList, setShowCustomerList] = useState(false);

    const [quantity, setQuantity] = useState<number>(order.quantity);
    const [jobCode, setJobCode] = useState<string>(order.jobCode || '');

    // Image State
    const [newImages, setNewImages] = useState<File[]>([]);
    const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
    const [existingImages, setExistingImages] = useState<string[]>(order.images || []);

    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load customers on mount
    useEffect(() => {
        if (open) {
            setLoadingUsers(true);
            getCustomers()
                .then(setCustomers)
                .catch(console.error)
                .finally(() => setLoadingUsers(false));

            // Reset state to order values
            setCustomerId(order.customer?.id || '');
            setCustomerSearch(order.customer?.name || '');
            setQuantity(order.quantity);
            setJobCode(order.jobCode || '');
            setExistingImages(order.images || []);
            setNewImages([]);
            setNewImagePreviews([]);
            setError(null);
        }
    }, [open, order]);

    // Filter customers
    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.code?.toLowerCase().includes(customerSearch.toLowerCase())
    );

    // Image Handling
    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const fileArray = Array.from(files);

        // Limits
        if (existingImages.length + newImages.length + fileArray.length > 2) {
            setError('Maximum 2 images allowed');
            return;
        }

        try {
            // Process images (simple compression if needed, here just basic check)
            // Reusing logic from RunConfigForm roughly for compression if desired, 
            // but for now let's stick to simple file handling to minimize dependencies issues
            // unless user insists on compression immediately. 
            // User asked for "Production level", so let's include the compression.

            const compressedFilesPromises = fileArray.map(async (file) => {
                const options = {
                    maxSizeMB: 0.1,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    fileType: 'image/webp',
                    initialQuality: 0.8,
                };

                try {
                    const imageCompression = (await import('browser-image-compression')).default;
                    const compressedBlob = await imageCompression(file, options);
                    return new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                        type: 'image/webp',
                        lastModified: Date.now(),
                    });
                } catch (e) {
                    console.error("Compression failed", e);
                    return file;
                }
            });

            const compressedFiles = await Promise.all(compressedFilesPromises);

            setNewImages(prev => [...prev, ...compressedFiles]);

            // Previews
            compressedFiles.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setNewImagePreviews(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });

            setError(null);
        } catch (err) {
            console.error(err);
            setError('Failed to process images');
        }
    };

    const removeNewImage = (index: number) => {
        setNewImages(prev => prev.filter((_, i) => i !== index));
        setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingImage = (index: number) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!customerId) {
            setError("Please select a valid customer");
            return;
        }
        if (quantity <= 0) {
            setError("Quantity must be greater than 0");
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            // Upload new images
            const uploadedUrls: string[] = [];
            if (newImages.length > 0) {
                const uploadPromises = newImages.map(async (file) => {
                    const { uploadUrl, publicUrl } = await apiRequest<{ uploadUrl: string; publicUrl: string }>(
                        `/orders/upload-url?filename=${encodeURIComponent(file.name)}`
                    );
                    await fetch(uploadUrl, {
                        method: 'PUT',
                        body: file,
                        headers: { 'Content-Type': file.type },
                    });
                    return publicUrl;
                });
                const urls = await Promise.all(uploadPromises);
                uploadedUrls.push(...urls);
            }

            const finalImages = [...existingImages, ...uploadedUrls];

            await updateOrder(order.id, {
                customerId,
                quantity,
                jobCode,
                images: finalImages
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to update order');
        } finally {
            setProcessing(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">Edit Order {order.code}</h3>
                        <p className="text-xs text-gray-500">Update order details</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={processing}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-5">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Customer Select */}
                    <div className="space-y-1.5 relative">
                        <label className="text-sm font-medium text-gray-700">Customer</label>
                        <input
                            type="text"
                            value={customerSearch}
                            onChange={(e) => {
                                setCustomerSearch(e.target.value);
                                if (e.target.value === '') setCustomerId('');
                                setShowCustomerList(true);
                            }}
                            onFocus={() => setShowCustomerList(true)}
                            onBlur={() => setTimeout(() => setShowCustomerList(false), 200)}
                            placeholder="Search customer..."
                            disabled={processing}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                        {showCustomerList && filteredCustomers.length > 0 && (
                            <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                {filteredCustomers.map(c => (
                                    <div
                                        key={c.id}
                                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            setCustomerId(c.id);
                                            setCustomerSearch(c.name);
                                            setShowCustomerList(false);
                                        }}
                                    >
                                        <div className="font-medium text-gray-800">{c.name}</div>
                                        <div className="text-xs text-gray-500">{c.code}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quantity & Job Code */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Quantity</label>
                            <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                disabled={processing}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Job Code</label>
                            <input
                                type="text"
                                value={jobCode}
                                onChange={(e) => setJobCode(e.target.value)}
                                placeholder="Optional"
                                disabled={processing}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Images */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-gray-700">Images (Max 2)</label>
                            <span className="text-xs text-gray-400">{existingImages.length + newImages.length}/2</span>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {/* Existing */}
                            {existingImages.map((src, i) => (
                                <div key={`exist-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                                    <img src={src} alt="Order reference" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => removeExistingImage(i)}
                                        disabled={processing}
                                        className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}

                            {/* New */}
                            {newImagePreviews.map((src, i) => (
                                <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                                    <img src={src} alt="New upload" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => removeNewImage(i)}
                                        disabled={processing}
                                        className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}

                            {existingImages.length + newImages.length < 2 && (
                                <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all text-gray-400 hover:text-blue-500">
                                    <Upload className="w-6 h-6 mb-1" />
                                    <span className="text-xs font-medium">Upload</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handleImageSelect}
                                        disabled={processing}
                                    />
                                </label>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={processing}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={processing}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {processing ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
