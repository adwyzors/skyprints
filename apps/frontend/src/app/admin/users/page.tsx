'use client';

import { useAuth } from '@/auth/AuthProvider';
import { Permission } from '@/auth/permissions';
import { withAuth } from '@/auth/withAuth';
import { Location } from '@/domain/model/location.model';
import { getLocations } from '@/services/location.service';
import {
  CreateUserPayload,
  UpdateUserPayload,
  UserListItem,
  createUser,
  deleteUser,
  listUsers,
  resetPassword,
  revokeSession,
  updatePermissions,
  updateUser,
} from '@/services/usersService';
import {
  Check,
  Key,
  Loader2,
  LogOut,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

// ─── Permission data (mirrors apps/backend/src/auth/permissions.map.ts) ──────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    'analytics:sync', 'analytics:view', 'billings:create', 'billings:create-test',
    'billings:delete', 'billings:update', 'billings:view', 'customers:create',
    'customers:delete', 'customers:update', 'customers:view', 'locations:all:view',
    'locations:create', 'locations:delete', 'locations:update', 'locations:view',
    'orders:create', 'orders:create-test', 'orders:delete', 'orders:reorder',
    'orders:start-production', 'orders:update', 'orders:view', 'process:create',
    'process:delete', 'process:update', 'process:view', 'rates:create', 'rates:delete',
    'rates:update', 'rates:view', 'runs:create', 'runs:delete', 'runs:lifecycle:rollback',
    'runs:lifecycle:update', 'runs:transition:digital', 'runs:transition:fusing',
    'runs:update', 'runs:view', 'settings:view', 'users:create', 'users:delete',
    'users:update', 'users:view',
  ],
  ADMIN: [
    'analytics:sync', 'analytics:view', 'billings:create', 'billings:create-test',
    'billings:delete', 'billings:update', 'billings:view', 'customers:create',
    'customers:delete', 'customers:update', 'customers:view', 'locations:all:view',
    'locations:create', 'locations:delete', 'locations:update', 'locations:view',
    'orders:create', 'orders:create-test', 'orders:delete', 'orders:reorder',
    'orders:start-production', 'orders:update', 'orders:view', 'process:create',
    'process:delete', 'process:update', 'process:view', 'rates:create', 'rates:delete',
    'rates:update', 'rates:view', 'runs:create', 'runs:delete', 'runs:lifecycle:rollback',
    'runs:lifecycle:update', 'runs:transition:digital', 'runs:transition:fusing',
    'runs:update', 'runs:view', 'settings:view',
  ],
  MANAGER: [
    'analytics:view', 'billings:create', 'billings:update', 'billings:view',
    'customers:view', 'locations:view', 'orders:create', 'orders:reorder',
    'orders:start-production', 'orders:update', 'orders:view', 'process:view',
    'rates:view', 'runs:create', 'runs:lifecycle:update', 'runs:transition:digital',
    'runs:transition:fusing', 'runs:update', 'runs:view',
  ],
};

const ALL_PERMISSIONS = Array.from(
  new Set(Object.values(ROLE_PERMISSIONS).flat()),
).sort();

const PERMISSION_GROUPS: Record<string, string[]> = ALL_PERMISSIONS.reduce(
  (acc, p) => {
    const group = p.split(':')[0];
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  },
  {} as Record<string, string[]>,
);

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmModal({
  isOpen, title, message, confirmLabel = 'Confirm', danger = false,
  loading = false, onConfirm, onClose,
}: ConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium rounded-lg disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2 text-sm font-bold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2 ${
              danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CreateUserModal ──────────────────────────────────────────────────────────

interface CreateUserModalProps {
  isOpen: boolean;
  locations: Location[];
  onClose: () => void;
  onSuccess: () => void;
}

function CreateUserModal({ isOpen, locations, onClose, onSuccess }: CreateUserModalProps) {
  const [form, setForm] = useState<CreateUserPayload>({
    name: '', email: '', role: 'MANAGER', password: '',
    permissions: [...ROLE_PERMISSIONS.MANAGER],
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({ name: '', email: '', role: 'MANAGER', password: '', permissions: [...ROLE_PERMISSIONS.MANAGER] });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRoleChange = (role: string) => {
    setForm(prev => ({ ...prev, role: role as CreateUserPayload['role'], permissions: [...(ROLE_PERMISSIONS[role] ?? [])] }));
  };

  const togglePerm = (p: string) => {
    setForm(prev => {
      const current = prev.permissions ?? [];
      return {
        ...prev,
        permissions: current.includes(p) ? current.filter(x => x !== p) : [...current, p],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createUser({ ...form, locationId: form.locationId || undefined });
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const perms = form.permissions ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        <div className="bg-blue-600 p-4 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Create User</h2>
              <p className="text-blue-100 text-xs">Add a new user account</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="overflow-y-auto p-5 space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
                <input type="text" required value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Email <span className="text-red-500">*</span></label>
                <input type="email" required value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Role <span className="text-red-500">*</span></label>
                <select value={form.role} onChange={e => handleRoleChange(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Location</label>
                <select value={form.locationId ?? ''}
                  onChange={e => setForm(p => ({ ...p, locationId: e.target.value || undefined }))}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— None —</option>
                  {locations.filter(l => l.isActive).map(l => (
                    <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Password <span className="text-red-500">*</span></label>
              <input type="password" required autoComplete="new-password" value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-700">
                  Permissions <span className="text-gray-400 font-normal">({perms.length} selected)</span>
                </label>
                <button type="button" onClick={() => setForm(p => ({ ...p, permissions: [...(ROLE_PERMISSIONS[p.role] ?? [])] }))}
                  className="text-xs text-blue-600 hover:underline">
                  Load role defaults
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {Object.entries(PERMISSION_GROUPS).map(([group, groupPerms]) => (
                  <div key={group}>
                    <div className="px-3 py-1 bg-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500 sticky top-0">
                      {group}
                    </div>
                    <div className="grid grid-cols-2">
                      {groupPerms.map(p => (
                        <label key={p} className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50/50 cursor-pointer text-xs border-b border-gray-50">
                          <input type="checkbox" checked={perms.includes(p)} onChange={() => togglePerm(p)}
                            className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded" />
                          <span className="text-gray-700">{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="p-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium rounded-lg disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── EditUserModal ────────────────────────────────────────────────────────────

interface EditUserModalProps {
  isOpen: boolean;
  user: UserListItem | null;
  locations: Location[];
  onClose: () => void;
  onSuccess: () => void;
}

function EditUserModal({ isOpen, user, locations, onClose, onSuccess }: EditUserModalProps) {
  const [form, setForm] = useState<UpdateUserPayload>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setForm({ name: user.name, role: user.role as UpdateUserPayload['role'], locationId: user.locationId, isActive: user.isActive });
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateUser(user.id, form);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-blue-600 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Edit User</h2>
              <p className="text-blue-100 text-xs truncate max-w-[200px]">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Name</label>
            <input type="text" value={form.name ?? ''}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Role</label>
              <select value={form.role ?? ''}
                onChange={e => setForm(p => ({ ...p, role: e.target.value as UpdateUserPayload['role'] }))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Location</label>
              <select value={form.locationId ?? ''}
                onChange={e => setForm(p => ({ ...p, locationId: e.target.value || null }))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— None —</option>
                {locations.filter(l => l.isActive).map(l => (
                  <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={form.isActive ?? true}
              onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
              className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded" />
            <span className="text-xs font-medium text-gray-700">Account Active</span>
          </label>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium rounded-lg disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── PermissionsDrawer ────────────────────────────────────────────────────────

interface PermissionsDrawerProps {
  isOpen: boolean;
  user: UserListItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

function PermissionsDrawer({ isOpen, user, onClose, onSuccess }: PermissionsDrawerProps) {
  const [perms, setPerms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setPerms([...(user.login?.permissions ?? [])]);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const toggle = (p: string) =>
    setPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await updatePermissions(user.id, { permissions: perms });
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update permissions');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="bg-blue-600 p-4 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5" />
            <div>
              <h2 className="text-base font-bold">Permissions</h2>
              <p className="text-blue-100 text-xs truncate max-w-[180px]">{user.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-gray-500">{perms.length} / {ALL_PERMISSIONS.length} selected</span>
          <button onClick={() => setPerms([...(ROLE_PERMISSIONS[user.role] ?? [])])}
            className="text-xs font-medium text-blue-600 hover:underline">
            Load role defaults ({user.role})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {Object.entries(PERMISSION_GROUPS).map(([group, groupPerms]) => (
            <div key={group}>
              <div className="px-4 py-1.5 bg-gray-50 border-y border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500 sticky top-0 z-10">
                {group}
              </div>
              {groupPerms.map(p => (
                <label key={p} onClick={() => toggle(p)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/40 cursor-pointer border-b border-gray-50">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    perms.includes(p) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                  }`}>
                    {perms.includes(p) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-xs text-gray-700">{p}</span>
                </label>
              ))}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={submitting}
            className="flex-1 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium rounded-lg disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </>
  );
}

// ─── ResetPasswordModal ───────────────────────────────────────────────────────

interface ResetPasswordModalProps {
  isOpen: boolean;
  user: UserListItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ResetPasswordModal({ isOpen, user, onClose, onSuccess }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) { setPassword(''); }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await resetPassword(user.id, { password });
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-blue-600 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Reset Password</h2>
              <p className="text-blue-100 text-xs truncate max-w-[160px]">{user.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">New Password <span className="text-red-500">*</span></label>
            <input type="password" required autoComplete="new-password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 font-medium rounded-lg disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Reset Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── UsersClient ──────────────────────────────────────────────────────────────

interface UsersClientProps {
  users: UserListItem[];
  locations: Location[];
  loading: boolean;
  onRefresh: () => void;
  currentUserId: string;
}

function UsersClient({ users, locations, loading, onRefresh, currentUserId }: UsersClientProps) {
  const { hasPermission } = useAuth();

  const canCreate = hasPermission(Permission.USERS_CREATE);
  const canUpdate = hasPermission(Permission.USERS_UPDATE);
  const canDelete = hasPermission(Permission.USERS_DELETE);

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<UserListItem | null>(null);
  const [permTarget, setPermTarget] = useState<UserListItem | null>(null);
  const [resetPwTarget, setResetPwTarget] = useState<UserListItem | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<UserListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserListItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const filtered = search
    ? users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  const closeAndRefresh = (setter: (v: null) => void) => {
    setter(null);
    onRefresh();
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setActionLoading(true);
    try {
      await revokeSession(revokeTarget.id);
      setRevokeTarget(null);
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteUser(deleteTarget.id);
      setDeleteTarget(null);
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-gray-50/50 min-h-full">
      {/* Toolbar */}
      <div className="px-4 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Users</h1>
            <p className="text-sm text-gray-500">Manage user accounts and permissions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 bg-white shadow-sm"
            />
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New User</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Account</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Login</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Perms</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Last Login</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Failed Logins</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(10)].map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <Users className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No users found</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(u => {
                    const isSelf = u.id === currentUserId;
                    const loginActive = u.login?.isActive ?? false;
                    const permCount = u.login?.permissions?.length ?? 0;
                    const roleColor: Record<string, string> = {
                      SUPER_ADMIN: 'bg-red-100 text-red-700',
                      ADMIN: 'bg-purple-100 text-purple-700',
                      MANAGER: 'bg-blue-100 text-blue-700',
                    };
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium text-sm text-gray-900 flex items-center gap-1.5">
                                {u.name}
                                {isSelf && (
                                  <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">YOU</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${roleColor[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.location ? (
                            <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{u.location.code}</span>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {u.isActive ? 'ACTIVE' : 'DISABLED'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            !u.login ? 'bg-gray-100 text-gray-500' :
                            loginActive ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {!u.login ? 'NONE' : loginActive ? 'OK' : 'LOCKED'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-gray-700">{permCount}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {u.login?.lastLoginAt ? (
                            <div>
                              <div className="text-xs text-gray-700">{new Date(u.login.lastLoginAt).toLocaleDateString('en-GB')}</div>
                              <div className="text-[10px] text-gray-400">{new Date(u.login.lastLoginAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          ) : <span className="text-gray-300 text-xs">Never</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {u.login && u.login.failedLoginAttempts > 0 ? (
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                                {u.login.failedLoginAttempts}x
                              </span>
                              {u.login.lastFailedLoginAt && (
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  {new Date(u.login.lastFailedLoginAt).toLocaleDateString('en-GB')}{' '}
                                  {new Date(u.login.lastFailedLoginAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-xs text-gray-700">{new Date(u.createdAt).toLocaleDateString('en-GB')}</div>
                          <div className="text-[10px] text-gray-400">{new Date(u.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-0.5">
                            {canUpdate && (
                              <>
                                <button title="Edit user" onClick={() => setEditTarget(u)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                  <UserCog className="w-4 h-4" />
                                </button>
                                <button title="Manage permissions" onClick={() => setPermTarget(u)}
                                  className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                                  <Shield className="w-4 h-4" />
                                </button>
                                <button title="Reset password" onClick={() => setResetPwTarget(u)}
                                  className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                                  <Key className="w-4 h-4" />
                                </button>
                                <button
                                  title={isSelf ? 'Cannot revoke own session' : 'Revoke session'}
                                  onClick={() => { if (!isSelf) setRevokeTarget(u); }}
                                  disabled={isSelf}
                                  className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                  <LogOut className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {canDelete && (
                              <button
                                title={isSelf ? 'Cannot delete own account' : 'Delete user'}
                                onClick={() => { if (!isSelf) setDeleteTarget(u); }}
                                disabled={isSelf}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
      </div>

      <CreateUserModal isOpen={showCreate} locations={locations}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { setShowCreate(false); onRefresh(); }} />

      <EditUserModal isOpen={!!editTarget} user={editTarget} locations={locations}
        onClose={() => setEditTarget(null)}
        onSuccess={() => closeAndRefresh(setEditTarget)} />

      <PermissionsDrawer isOpen={!!permTarget} user={permTarget}
        onClose={() => setPermTarget(null)}
        onSuccess={() => closeAndRefresh(setPermTarget)} />

      <ResetPasswordModal isOpen={!!resetPwTarget} user={resetPwTarget}
        onClose={() => setResetPwTarget(null)}
        onSuccess={() => { setResetPwTarget(null); onRefresh(); }} />

      <ConfirmModal
        isOpen={!!revokeTarget}
        title="Revoke Session"
        message={`Sign out ${revokeTarget?.name ?? 'this user'} immediately? They will need to log in again.`}
        confirmLabel="Revoke"
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        loading={actionLoading} />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete User"
        message={`Delete ${deleteTarget?.name ?? 'this user'}? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={actionLoading} />
    </div>
  );
}

// ─── Page (data fetching wrapper) ─────────────────────────────────────────────

function UsersPageWrapper() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [usersData, locsData] = await Promise.all([listUsers(), getLocations()]);
        if (!cancelled) { setUsers(usersData); setLocations(locsData); }
      } catch (err) {
        console.error('Failed to load users page data', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const onRefresh = useCallback(() => setRefreshTrigger(p => p + 1), []);
  const currentUserId = user?.user?.id ?? '';

  return (
    <UsersClient
      users={users}
      locations={locations}
      loading={loading}
      onRefresh={onRefresh}
      currentUserId={currentUserId}
    />
  );
}

export default withAuth(UsersPageWrapper, { permission: Permission.USERS_VIEW });
