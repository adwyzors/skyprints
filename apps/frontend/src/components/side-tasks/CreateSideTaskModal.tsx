'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Image as ImageIcon, Plus, User, X } from 'lucide-react';
import { SideTaskPriority, SideTaskStageType } from '@/types/sideTask';
import { createSideTask, listStageTypes, uploadSideTaskImages } from '@/services/sideTaskService';
import { listUsers, UserListItem } from '@/services/usersService';
import { useImagePaste, extractImagesFromClipboard } from '@/hooks/useImagePaste';

interface CreateSideTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateSideTaskModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateSideTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [stageTypes, setStageTypes] = useState<SideTaskStageType[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<SideTaskPriority>('MEDIUM');
  const [requiredBy, setRequiredBy] = useState('');
  const [initialStageTypeId, setInitialStageTypeId] = useState('');
  const [initialAssigneeId, setInitialAssigneeId] = useState('');

  // Image Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setRequiredBy('');
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

  const processImages = useCallback(async (files: File[]) => {
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
  }, [selectedFiles.length]);

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

      await createSideTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        requiredBy: requiredBy ? new Date(requiredBy).toISOString() : undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-900 to-gray-800 text-white">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Create Side Task</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prepare artwork proof for approval"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed instructions or specifications..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Initial Stage <span className="text-red-500">*</span>
              </label>
              <select
                value={initialStageTypeId}
                onChange={(e) => setInitialStageTypeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
              >
                {stageTypes.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Assigned User <span className="text-red-500">*</span>
              </label>
              <select
                value={initialAssigneeId}
                onChange={(e) => setInitialAssigneeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as SideTaskPriority)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
                Required By Date
              </label>
              <input
                type="date"
                value={requiredBy}
                onChange={(e) => setRequiredBy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          {/* Reference Images Upload / Paste (Max 2) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase text-gray-500">
                Task Reference Images (Max 2)
              </label>
              <span className="text-xs text-gray-400 font-medium">
                {selectedFiles.length}/2
              </span>
            </div>

            <div
              tabIndex={0}
              className="border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
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
                  <div key={index} className="relative group w-20 h-20 rounded-lg overflow-hidden border-2 border-indigo-200 shadow-sm">
                    <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 text-white text-[8px] font-bold text-center py-0.5">
                      NEW
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                    >
                      <X className="w-3 h-3" />
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
                      className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-gray-400 text-xl font-light">+</span>
                      <span className="text-[10px] text-gray-600 font-medium">Add / Paste</span>
                      <span className="text-[9px] text-gray-400 font-mono">(Ctrl+V)</span>
                    </label>
                  </div>
                )}
              </div>
              <p className="mt-2 text-[10px] text-gray-400">
                Upload or Paste (Ctrl+V) • JPEG, PNG, WebP • Max 2 images
              </p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
