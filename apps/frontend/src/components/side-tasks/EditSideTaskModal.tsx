'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Calendar, ChevronDown, Pencil, Trash2, Upload, X } from 'lucide-react';
import { SideTask, SideTaskPriority, SideTaskStageType, SideTaskType } from '@/types/sideTask';
import { listStageTypes, updateSideTask, uploadSideTaskImages } from '@/services/sideTaskService';
import { listUsers, UserListItem } from '@/services/usersService';
import { useImagePaste } from '@/hooks/useImagePaste';

interface EditSideTaskModalProps {
  task: SideTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type DateOption = 'keep' | 'today' | 'tomorrow' | 'next_week' | 'custom' | 'none';

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

export function EditSideTaskModal({
  task,
  isOpen,
  onClose,
  onSuccess,
}: EditSideTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [stageTypes, setStageTypes] = useState<SideTaskStageType[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<SideTaskPriority>('MEDIUM');
  const [taskType, setTaskType] = useState<SideTaskType>('FIVE_MIN');
  const [stageTypeId, setStageTypeId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  // Date State
  const [dateOption, setDateOption] = useState<DateOption>('keep');
  const [customDate, setCustomDate] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Existing Images (URLs) & New Files to upload
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  // Load stage types & users
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
        setStageTypes(types);
        setUsers(userList.filter((u) => u.isActive));
      } catch (err: any) {
        console.error('Failed to load initial data:', err);
      }
    }

    loadData();
  }, [isOpen]);

  // Pre-fill form when task changes or modal opens
  useEffect(() => {
    if (!isOpen || !task) return;

    setTitle(task.title || '');
    setPriority(task.priority || 'MEDIUM');
    setTaskType(task.taskType || 'FIVE_MIN');
    setStageTypeId(task.currentStageTypeId || '');
    setAssigneeId(task.currentAssigneeId || '');
    setExistingImages(task.images || []);
    setNewFiles([]);
    setNewPreviews([]);

    if (task.requiredBy) {
      const d = new Date(task.requiredBy);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setCustomDate(`${yyyy}-${mm}-${dd}`);
      setDateOption('keep');
    } else {
      setCustomDate('');
      setDateOption('none');
    }
  }, [isOpen, task]);

  const totalImageCount = existingImages.length + newFiles.length;

  const processImages = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      if (totalImageCount + files.length > 2) {
        toast.error('Maximum 2 images allowed per task');
        return;
      }

      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const invalidFiles = files.filter((file) => !validTypes.includes(file.type));
      if (invalidFiles.length > 0) {
        toast.error('Invalid image type. Only JPG, PNG, and WebP are allowed.');
        return;
      }

      const allowedNew = files.slice(0, 2 - totalImageCount);
      setNewFiles((prev) => [...prev, ...allowedNew]);

      allowedNew.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewPreviews((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    },
    [totalImageCount],
  );

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processImages(Array.from(e.target.files));
    }
  };

  useImagePaste({
    onFilesPasted: processImages,
    enabled: isOpen && totalImageCount < 2,
  });

  const handleRemoveExistingImage = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNewImage = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
    setNewPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  if (!isOpen || !task) return null;

  const calculateRequiredByDate = (): string | null | undefined => {
    if (dateOption === 'keep') {
      return task.requiredBy ?? null;
    }
    if (dateOption === 'none') {
      return null;
    }
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
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Task title is required');
      return;
    }

    setLoading(true);
    try {
      let uploadedUrls: string[] = [];
      if (newFiles.length > 0) {
        uploadedUrls = await uploadSideTaskImages(newFiles);
      }

      const finalImages = [...existingImages, ...uploadedUrls].slice(0, 2);
      const computedRequiredBy = calculateRequiredByDate();

      await updateSideTask(task.id, {
        title: title.trim(),
        priority,
        taskType,
        requiredBy: computedRequiredBy,
        images: finalImages,
        currentStageTypeId: stageTypeId || undefined,
        currentAssigneeId: assigneeId || undefined,
      });

      toast.success('Side task updated successfully');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update side task');
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
            <Pencil className="w-5 h-5 text-indigo-400 stroke-[2.5]" />
            <h2 className="text-lg font-bold tracking-tight text-white">Edit Side Task</h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-white/10 text-white/90">
              {task.code}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
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

          {/* STAGE & ASSIGNED USER */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                STAGE
              </label>
              <div className="relative">
                <select
                  value={stageTypeId}
                  onChange={(e) => setStageTypeId(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                >
                  <option value="">Select stage...</option>
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
                ASSIGNED USER
              </label>
              <div className="relative">
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full appearance-none px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                >
                  <option value="">Select assignee...</option>
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
              {task.requiredBy && (
                <button
                  type="button"
                  onClick={() => setDateOption('keep')}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                    dateOption === 'keep'
                      ? 'bg-[#151a26] text-white shadow-xs'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  Keep Existing
                </button>
              )}
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

              <button
                type="button"
                onClick={() => setDateOption('none')}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  dateOption === 'none'
                    ? 'bg-rose-100 text-rose-700 border border-rose-300 font-semibold'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                Clear Date
              </button>
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
                {totalImageCount}/2
              </span>
            </div>

            {/* Previews Grid */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Existing Images */}
              {existingImages.map((url, idx) => (
                <div
                  key={`existing-${idx}`}
                  className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50 aspect-video group"
                >
                  <img
                    src={url}
                    alt={`Existing reference ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingImage(idx)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-red-600 text-white transition shadow-sm cursor-pointer"
                    title="Remove image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-black/60 text-white">
                    Existing
                  </span>
                </div>
              ))}

              {/* New Previews */}
              {newPreviews.map((preview, idx) => (
                <div
                  key={`new-${idx}`}
                  className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50 aspect-video group"
                >
                  <img
                    src={preview}
                    alt={`New reference preview ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveNewImage(idx)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-red-600 text-white transition shadow-sm cursor-pointer"
                    title="Remove image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-600 text-white">
                    New
                  </span>
                </div>
              ))}
            </div>

            {/* Upload / Paste Dropzone */}
            {totalImageCount < 2 && (
              <label className="border-2 border-dashed border-gray-200 hover:border-indigo-400 bg-gray-50/50 hover:bg-indigo-50/20 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition text-center group">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  className="sr-only"
                />
                <div className="w-9 h-9 rounded-full bg-white shadow-2xs border border-gray-100 flex items-center justify-center text-gray-500 group-hover:text-indigo-600 transition">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-gray-700">
                  <span className="text-indigo-600 underline">Upload reference files</span> or paste screenshot
                </p>
                <p className="text-[11px] text-gray-400">
                  Paste anywhere inside modal (Ctrl+V) • Max 2 images (PNG, JPG, WebP)
                </p>
              </label>
            )}
          </div>

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
