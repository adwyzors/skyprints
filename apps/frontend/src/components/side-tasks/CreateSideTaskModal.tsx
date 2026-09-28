'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Calendar, ChevronDown, Plus, X } from 'lucide-react';
import { SideTaskPriority, SideTaskStageType, SideTaskType } from '@/types/sideTask';
import { createSideTask, listStageTypes, uploadSideTaskImages } from '@/services/sideTaskService';
import { listUsers, UserListItem } from '@/services/usersService';
import { useImagePaste, extractImagesFromClipboard } from '@/hooks/useImagePaste';

interface CreateSideTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type DateOption = 'today' | 'tomorrow' | 'next_week' | 'custom';

const PRIORITY_OPTIONS: { label: string; value: SideTaskPriority }[] = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' },
];

const TASK_TYPE_OPTIONS: { label: string; value: SideTaskType }[] = [
  { label: '5 min', value: 'FIVE_MIN' },
  { label: 'Half an hr', value: 'HALF_HOUR' },
  { label: 'Long', value: 'LONG' },
];

export function CreateSideTaskModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSideTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [stageTypes, setStageTypes] = useState<SideTaskStageType[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<SideTaskPriority>('MEDIUM');
  const [taskType, setTaskType] = useState<SideTaskType>('FIVE_MIN');
  const [dateOption, setDateOption] = useState<DateOption>('today');
  const [customDate, setCustomDate] = useState('');
  const [initialStageTypeId, setInitialStageTypeId] = useState('');
  const [initialAssigneeId, setInitialAssigneeId] = useState('');

  // Image Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle('');
    setPriority('MEDIUM');
    setTaskType('FIVE_MIN');
    setDateOption('today');
    setCustomDate('');
    setSelectedFiles([]);
    setImagePreviews([]);
  };

  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      try {
        const [typesResult, usersResult] = await Promise.allSettled([
          listStageTypes(),
          listUsers(),
        ]);

        const types = typesResult.status === 'fulfilled' ? typesResult.value : [];
        const userList = usersResult.status === 'fulfilled' ? usersResult.value : [];

        if (typesResult.status === 'rejected') {
          console.error('Failed to load stage types:', typesResult.reason);
        }
        if (usersResult.status === 'rejected') {
          console.error('Failed to load user list:', usersResult.reason);
        }

        setStageTypes(types);
        const activeUsers = userList.filter((u) => u.isActive);
        setUsers(activeUsers);

        if (types.length > 0) {
          setInitialStageTypeId(types[0].id);
        }
        if (activeUsers.length > 0) {
          setInitialAssigneeId(activeUsers[0].id);
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load initial form data');
      }
    }

    loadData();
  }, [isOpen]);

  const processImages = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      if (selectedFiles.length + files.length > 2) {
        toast.error('Maximum 2 images allowed per task');
        return;
      }

      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const invalidFiles = files.filter((file) => !validTypes.includes(file.type));

      if (invalidFiles.length > 0) {
        toast.error('Invalid image type. Only JPG, PNG, and WebP are allowed.');
        return;
      }

      const newFiles = files.slice(0, 2 - selectedFiles.length);
      setSelectedFiles((prev) => [...prev, ...newFiles]);

      newFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    },
    [selectedFiles.length],
  );

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processImages(Array.from(e.target.files));
    }
  };

  useImagePaste({
    onFilesPasted: processImages,
    enabled: isOpen && selectedFiles.length < 2,
  });

  const handleRemoveImage = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  const calculateRequiredByDate = (): string | undefined => {
    const now = new Date();
    if (dateOption === 'today') {
      now.setHours(23, 59, 59, 999);
      return now.toISOString();
    }
    if (dateOption === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);
      return tomorrow.toISOString();
    }
    if (dateOption === 'next_week') {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(23, 59, 59, 999);
      return nextWeek.toISOString();
    }
    if (dateOption === 'custom' && customDate) {
      const custom = new Date(customDate);
      custom.setHours(23, 59, 59, 999);
      return custom.toISOString();
    }
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Task title is required');
      return;
    }
    if (!initialStageTypeId) {
      toast.error('Initial stage type is required');
      return;
    }
    if (!initialAssigneeId) {
      toast.error('Initial assignee is required');
      return;
    }

    setLoading(true);
    try {
      let uploadedUrls: string[] = [];
      if (selectedFiles.length > 0) {
        uploadedUrls = await uploadSideTaskImages(selectedFiles);
      }

      const computedRequiredBy = calculateRequiredByDate();

      await createSideTask({
        title: title.trim(),
        priority,
        taskType,
        requiredBy: computedRequiredBy,
        images: uploadedUrls,
        initialStageTypeId,
        initialAssigneeId,
      });

      toast.success('Side task created successfully');
      resetForm();
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create side task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4.5 flex items-center justify-between bg-[#151926] text-white">
          <div className="flex items-center gap-2.5">
            <Plus className="w-5 h-5 text-indigo-400 stroke-[2.5]" />
            <h2 className="text-lg font-bold tracking-tight text-white">Create Side Task</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* TITLE */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              TITLE <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prepare artwork proof for approval"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition bg-white"
            />
          </div>

          {/* INITIAL STAGE & ASSIGNED USER */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                INITIAL STAGE <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={initialStageTypeId}
                  onChange={(e) => setInitialStageTypeId(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                >
                  {stageTypes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                ASSIGNED USER <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={initialAssigneeId}
                  onChange={(e) => setInitialAssigneeId(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* PRIORITY */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              PRIORITY
            </label>
            <div className="flex flex-wrap gap-2.5">
              {PRIORITY_OPTIONS.map((opt) => {
                const isSelected = priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`px-7 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#151a26] text-white shadow-xs'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* REQUIRED BY DATE */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              REQUIRED BY DATE
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDateOption('today')}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                  dateOption === 'today'
                    ? 'bg-[#151a26] text-white shadow-xs'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateOption('tomorrow')}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                  dateOption === 'tomorrow'
                    ? 'bg-[#151a26] text-white shadow-xs'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setDateOption('next_week')}
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                  dateOption === 'next_week'
                    ? 'bg-[#151a26] text-white shadow-xs'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                Next Week
              </button>

              {/* Choose Date */}
              <div className="relative inline-flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setDateOption('custom');
                    dateInputRef.current?.showPicker?.();
                  }}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                    dateOption === 'custom'
                      ? 'bg-[#151a26] text-white shadow-xs'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <span>{customDate ? customDate : 'Choose Date'}</span>
                  <Calendar className="w-4 h-4 opacity-80" />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={customDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setDateOption('custom');
                  }}
                  className="sr-only"
                />
              </div>
            </div>
            {dateOption === 'custom' && (
              <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                <span>Selected date:</span>
                <input
                  type="date"
                  value={customDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setDateOption('custom');
                  }}
                  className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>

          {/* TASK TYPE */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              TASK TYPE
            </label>
            <div className="flex flex-wrap gap-2.5">
              {TASK_TYPE_OPTIONS.map((opt) => {
                const isSelected = taskType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTaskType(opt.value)}
                    className={`px-6 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#151a26] text-white shadow-xs'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TASK REFERENCE IMAGES (MAX 2) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                TASK REFERENCE IMAGES (MAX 2)
              </label>
              <span className="text-xs text-gray-400 font-medium">
                {selectedFiles.length}/2
              </span>
            </div>

            <div
              tabIndex={0}
              className="border border-gray-200 rounded-2xl p-4 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              onClick={(e) => {
                (e.currentTarget as HTMLDivElement).focus();
              }}
              onPaste={(e) => {
                const files = extractImagesFromClipboard(e);
                if (files.length > 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  processImages(files);
                }
              }}
            >
              <div className="flex gap-3 flex-wrap items-center">
                {/* Previews */}
                {imagePreviews.map((preview, index) => (
                  <div
                    key={index}
                    className="relative group w-24 h-24 rounded-xl overflow-hidden border-2 border-indigo-200 shadow-xs"
                  >
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 text-white text-[9px] font-bold text-center py-0.5">
                      NEW
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                      className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Upload Button */}
                {selectedFiles.length < 2 && (
                  <div className="relative">
                    <input
                      type="file"
                      id="side-task-img-upload"
                      className="hidden"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      multiple
                      onChange={handleImageSelect}
                    />
                    <label
                      htmlFor="side-task-img-upload"
                      className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/30 cursor-pointer transition-all"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-gray-400 text-2xl font-light leading-none mb-1">+</span>
                      <span className="text-xs text-gray-700 font-semibold">Add / Paste</span>
                      <span className="text-[10px] text-gray-400 font-mono">(Ctrl+V)</span>
                    </label>
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Upload or Paste (Ctrl+V) • JPEG, PNG, WebP • Max 2 images
              </p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-[#5551ff] hover:bg-[#4743e8] active:bg-[#3d39db] rounded-xl shadow-sm disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
