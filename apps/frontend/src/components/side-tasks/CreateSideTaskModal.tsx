'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Image as ImageIcon, Plus, User, X } from 'lucide-react';
import { SideTaskPriority, SideTaskStageType } from '@/types/sideTask';
import { createSideTask, listStageTypes } from '@/services/sideTaskService';
import { listUsers, UserListItem } from '@/services/usersService';

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
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');

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

  if (!isOpen) return null;

  const handleAddImage = () => {
    if (images.length >= 2) {
      toast.error('Maximum 2 images allowed');
      return;
    }
    if (!imageUrlInput.trim()) return;
    setImages([...images, imageUrlInput.trim()]);
    setImageUrlInput('');
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
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
      await createSideTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        requiredBy: requiredBy ? new Date(requiredBy).toISOString() : undefined,
        images,
        initialStageTypeId,
        initialAssigneeId,
      });

      toast.success('Side task created successfully');
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

          {/* Image Uploads (Max 2) */}
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-500 mb-1">
              Task Images (Max 2)
            </label>
            {images.length < 2 && (
              <div className="flex gap-2 mb-2">
                <input
                  type="url"
                  placeholder="Paste image URL..."
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddImage}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition"
                >
                  Add
                </button>
              </div>
            )}
            <div className="flex gap-2">
              {images.map((img, index) => (
                <div key={index} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
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
