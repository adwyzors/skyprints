'use client';

import { Customer } from '@/domain/model/customer.model';
import { ProcessSummary } from '@/domain/model/process.model';
import { getCustomers } from '@/services/customer.service';
import { createOrder } from '@/services/orders.service';
import { getProcesses } from '@/services/process.service';
import { NewOrderPayload } from '@/types/planning';
import { useEffect, useMemo, useState } from 'react';

/* ================= TYPES ================= */

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (order: any) => void;
}

interface ProcessRow {
  processId: string;
  runs: number;
}

/* ================= COMPONENT ================= */

export default function CreateOrderModal({ open, onClose, onCreate }: Props) {
  /* ================= STATE (ALWAYS CALLED) ================= */

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [jobCode, setJobCode] = useState<string>('');
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  /* ================= RESET FORM ================= */
  const resetForm = () => {
    setCustomerSearch('');
    setSelectedCustomerId(null);
    setQuantity(0);
    setJobCode('');
    setProcessRows([]);
    setError(null);
    setSelectedImages([]);
    setImagePreviews([]);
  };

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const fetchData = async () => {
      try {
        setDataLoading(true);
        const [customersData, processesData] = await Promise.all([getCustomers(), getProcesses()]);

        if (!cancelled) {
          setCustomers(customersData);
          setProcesses(processesData);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to load data';
          setError(message);
          console.error(error);
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [open]);

  /* ================= DERIVED ================= */

  const [showCustomerList, setShowCustomerList] = useState(false);

  const filteredCustomers = useMemo(() => {
    const s = customerSearch.toLowerCase().trim();
    // Show all customers when focused and no search, or filter by search
    if (!s) return showCustomerList ? customers : [];
    return customers.filter(
      (c) => c.name.toLowerCase().includes(s) || c.code?.toLowerCase().includes(s),
    );
  }, [customerSearch, customers, showCustomerList]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [customers, selectedCustomerId],
  );

  /* ================= IMAGE HANDLING ================= */

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);

    // Restrict to 2 photos
    if (selectedImages.length + fileArray.length > 2) {
      setError('Maximum 2 photos allowed');
      return;
    }

    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = fileArray.filter(file => !validTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      setError('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    // Validate original file sizes (max 5MB per file just as a sane limit before compression)
    const oversizedFiles = fileArray.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError('Each image must be less than 5MB');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const compressedFilesPromises = fileArray.map(async (file) => {
        const options = {
          maxSizeMB: 0.1, // 100KB
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/webp',
          initialQuality: 0.8,
        };

        try {
          // Dynamic import to avoid SSR issues if any (though this is a client component)
          const imageCompression = (await import('browser-image-compression')).default;

          console.log(`Compressing ${file.name} (${(file.size / 1024).toFixed(2)} KB)...`);
          const compressedBlob = await imageCompression(file, options);

          // Create a new File object from the compressed blob
          const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
            type: 'image/webp',
            lastModified: Date.now(),
          });

          console.log(`Compressed to ${compressedFile.name} (${(compressedFile.size / 1024).toFixed(2)} KB)`);
          return compressedFile;
        } catch (error) {
          console.error("Compression failed for", file.name, error);
          return file; // Fallback to original if compression fails
        }
      });

      const compressedFiles = await Promise.all(compressedFilesPromises);

      setSelectedImages(prev => [...prev, ...compressedFiles]);

      // Create previews
      compressedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });

    } catch (err) {
      console.error("Image processing error", err);
      setError('Failed to process images');
    } finally {
      setLoading(false);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  /* ================= CREATE ================= */

  const handleCreate = async () => {
    if (!selectedCustomer) {
      setError('Please select a customer');
      return;
    }

    if (quantity <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    if (processRows.length === 0) {
      setError('Please add at least one process');
      return;
    }

    // Validate all process rows have process selected
    const invalidRows = processRows.some((row) => !row.processId || row.runs <= 0);
    if (invalidRows) {
      setError('Please fill all process details correctly');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Based on the error, it seems backend expects a full Order object
      // Let's create a complete order object
      const now = new Date().toISOString();

      // Generate a simple order code
      const orderCode = `ORD-${Date.now().toString().slice(-6)}`;

      // First, try with the original payload
      const payload: NewOrderPayload = {
        customerId: selectedCustomer.id,
        quantity,
        processes: processRows.map((r) => ({
          processId: r.processId,
          count: r.runs,
        })),
        // Only include jobCode if it has a value
        ...(jobCode.trim() ? { jobCode: jobCode.trim() } : {}),
        // Include images directly in payload
        images: selectedImages,
      };

      // Create order with images in a single call
      const createdOrder = await createOrder(payload);

      // Pass the created order to parent
      onCreate(createdOrder);

      // Reset form and close modal
      resetForm();
      onClose();
    } catch (err: any) {
      // If we get validation errors, try a different approach
      if (err.message?.includes('invalid_type') || err.message?.includes('expected')) {
        setError('Server validation error. Please check your data and try again.');
        console.error('Validation error details:', err);
      } else {
        setError(err.message || 'Failed to create order');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ================= PROCESS ROWS ================= */
  const addProcessRow = () => {
    setProcessRows((prev) => [...prev, { processId: '', runs: 1 }]);
  };

  const updateProcessRow = (index: number, patch: Partial<ProcessRow>) => {
    setProcessRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeProcessRow = (index: number) => {
    setProcessRows((prev) => prev.filter((_, i) => i !== index));
  };

  /* ================= CLOSE HANDLER ================= */
  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  /* ================= RENDER ================= */

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* HEADER */}
        <div className="px-6 py-4 border-b bg-linear-to-r from-blue-50 to-gray-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Create New Order</h2>
              <p className="text-sm text-gray-600 mt-1">Add order details and processes</p>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-50"
            >
              <span className="text-lg">×</span>
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ERROR MESSAGE */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* LOADING DATA */}
          {dataLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading data...</span>
            </div>
          )}

          {!dataLoading && (
            <>
              {/* ORDER INFO */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Order Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CUSTOMER SEARCH */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Customer</label>
                    <div className="relative">
                      <input
                        placeholder="Click to select or search..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setSelectedCustomerId(null);
                          setError(null);
                        }}
                        onFocus={() => setShowCustomerList(true)}
                        onBlur={() => {
                          // Delay to allow click on dropdown item
                          setTimeout(() => setShowCustomerList(false), 200);
                        }}
                        disabled={loading}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                      />
                      {showCustomerList &&
                        !selectedCustomer &&
                        filteredCustomers?.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {filteredCustomers?.map((c) => (
                              <div
                                key={c.id}
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent blur before click
                                  setSelectedCustomerId(c.id);
                                  setCustomerSearch(c.name);
                                  setShowCustomerList(false);
                                  setError(null);
                                }}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                              >
                                <div className="font-medium">{c.name}</div>
                                <div className="text-sm text-gray-500">Code: {c.code}</div>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* CUSTOMER CODE */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Customer Code</label>
                    <div className="relative">
                      <input
                        placeholder="Customer Code"
                        value={selectedCustomer?.code ?? ''}
                        readOnly
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-gray-700"
                      />
                      {selectedCustomer && (
                        <div className="absolute right-3 top-3">
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            ✓
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* QUANTITY */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      placeholder="Enter quantity..."
                      value={quantity || ''}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setQuantity(isNaN(value) ? 0 : value);
                        setError(null);
                      }}
                      disabled={loading}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                      min="1"
                    />
                  </div>

                  {/* ORDER CODE */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Order Code</label>
                    <div className="relative">
                      <input
                        placeholder="Auto Generated"
                        value="Auto Generated"
                        readOnly
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-gray-600 italic"
                      />
                      <div className="absolute right-3 top-3">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          Auto
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* JOB CODE */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Job Code (Optional)</label>
                    <input
                      type="text"
                      placeholder="Enter job code..."
                      value={jobCode}
                      onChange={(e) => {
                        setJobCode(e.target.value);
                        setError(null);
                      }}
                      disabled={loading}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* IMAGE UPLOAD */}
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Order Images (Optional)</label>
                  <div className="space-y-3">
                    {/* Upload Button */}
                    {selectedImages.length < 2 && (
                      <div>
                        <input
                          type="file"
                          id="image-upload"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          multiple
                          onChange={handleImageSelect}
                          disabled={loading}
                          className="hidden"
                        />
                        <label
                          htmlFor="image-upload"
                          className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 cursor-pointer transition-all disabled:opacity-50"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          Upload Images ({selectedImages.length}/2)
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          Max 2 photos • JPEG, PNG, WebP • Max 5MB each
                        </p>
                      </div>
                    )}

                    {/* Image Previews */}
                    {imagePreviews.length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {imagePreviews.map((preview, index) => (
                          <div
                            key={index}
                            className="relative group rounded-lg overflow-hidden border-2 border-gray-200 aspect-square"
                          >
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              disabled={loading}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-1 px-2 text-center">
                              {selectedImages[index]?.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PROCESSES */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                    Processes
                  </h3>
                  <button
                    onClick={addProcessRow}
                    disabled={loading}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    <span className="text-lg">+</span>
                    Add Process
                  </button>
                </div>

                {processRows.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl">
                    <div className="text-gray-400 mb-2">
                      <svg
                        className="w-12 h-12 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">No processes added yet</p>
                    <p className="text-gray-400 text-xs mt-1">Add your first process to continue</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {processRows.map((row, i) => (
                      <div
                        key={i}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </div>
                            <span className="text-sm text-gray-600">Process {i + 1}</span>
                          </div>
                          <button
                            onClick={() => removeProcessRow(i)}
                            disabled={loading}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 disabled:opacity-50"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Process</label>
                            <select
                              value={row.processId}
                              onChange={(e) => {
                                updateProcessRow(i, { processId: e.target.value });
                                setError(null);
                              }}
                              disabled={loading}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                            >
                              <option value="">Select process...</option>
                              {processes.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Runs</label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                value={row.runs}
                                onChange={(e) =>
                                  updateProcessRow(i, { runs: parseInt(e.target.value) || 1 })
                                }
                                disabled={loading}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                              />
                              <span className="absolute right-3 top-2.5 text-sm text-gray-500">
                                runs
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={
                loading ||
                dataLoading ||
                !selectedCustomer ||
                quantity <= 0 ||
                processRows.length === 0
              }
              className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
