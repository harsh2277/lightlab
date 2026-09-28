'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import CustomSelect from '@/components/ui/CustomSelect';
import LayoutToggle from '@/components/ui/LayoutToggle';
import Portal from '@/components/ui/Portal';
import SearchInput from '@/components/ui/SearchInput';
import PasswordInput from '@/components/ui/PasswordInput';
import { RoleBadge, ConfirmModal, useToast, SkeletonUsersPage, Pagination } from '@/components/ui';

const PAGE_SIZE = 10;

export default function AdminUsersManagement() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [roleFilter, setRoleFilter] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { success: toastSuccess, error: toastError } = useToast();

  // Form states
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role: 'architect',
    mobileNumber: '',
  });

  const [editingUser, setEditingUser] = useState<any>(null);

  async function fetchUsers() {
    try {
      let loadedUsers: any[] = [];
      try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
          const resData = await res.json();
          loadedUsers = resData.users || [];
        }
      } catch (e) {
        console.warn('Error fetching users from API, falling back:', e);
      }

      if (loadedUsers.length === 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, email, role, mobile_number, created_at')
          .order('created_at', { ascending: false });
        loadedUsers = data || [];
      }

      setUsers(loadedUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  // Show notifications helper
  const triggerNotification = (success: string | null, error: string | null) => {
    if (success) {
      setSuccessMsg(success);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
    if (error) {
      setErrorMsg(error);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // Translate raw Supabase/API errors into human-friendly messages
  const friendlyError = (raw: string): string => {
    if (!raw) return 'Something went wrong. Please try again.';
    const msg = raw.toLowerCase();
    if (msg.includes('email address') && msg.includes('invalid'))
      return 'The email address you entered is invalid. Please use a real email like name@company.com';
    if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already exists') || msg.includes('duplicate'))
      return 'This email is already registered. Try a different email address.';
    if (msg.includes('password') && (msg.includes('short') || msg.includes('weak') || msg.includes('characters')))
      return 'Password is too weak. Please use at least 8 characters with letters and numbers.';
    if (msg.includes('rate limit') || msg.includes('too many'))
      return 'Too many requests. Please wait a moment and try again.';
    if (msg.includes('unauthorized') || msg.includes('not allowed'))
      return 'You do not have permission to perform this action.';
    if (msg.includes('network') || msg.includes('fetch'))
      return 'Network error. Please check your connection and try again.';
    // Return raw but cleaned up
    return raw.replace(/^Error:\s*/i, '');
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    // Client-side validation
    if (!newUser.email.includes('@') || !newUser.email.includes('.')) {
      setFormError('Please enter a valid email address (e.g. name@company.com)');
      setSubmitting(false);
      return;
    }
    if (newUser.password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      setSubmitting(false);
      return;
    }

    const addedEmail = newUser.email;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      const addedUserObj = {
        id: data.user?.id || crypto.randomUUID(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        mobile_number: newUser.mobileNumber || '',
        created_at: new Date().toISOString()
      };

      // Optimistically add user to table state
      setUsers(prev => [addedUserObj, ...prev.filter(u => u.id !== addedUserObj.id)]);
      setShowAddModal(false);
      setFormError(null);
      setNewUser({ email: '', password: '', name: '', role: 'architect', mobileNumber: '' });
      triggerNotification(`User "${newUser.name}" created successfully. They can now log in directly.`, null);
      fetchUsers();
    } catch (err: any) {
      // Show error INSIDE the modal so it stays open
      setFormError(friendlyError(err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const exportUsersToCSV = () => {
    if (!users || users.length === 0) {
      toastError('No users available to export.');
      return;
    }
    const headers = ['User ID', 'Full Name', 'Email', 'Role', 'Mobile Number', 'Joined Date'];
    const rows = users
      .filter(u => u.role !== 'admin')
      .map(u => [
        `"${u.id || ''}"`,
        `"${(u.name || '').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`,
        `"${(u.role || '').toUpperCase()}"`,
        `"${(u.mobile_number || '').replace(/"/g, '""')}"`,
        `"${u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : ''}"`
      ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Lightmaps_Users_Master_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess('User directory exported successfully!');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    if (editingUser.newPassword && editingUser.newPassword.trim().length > 0 && editingUser.newPassword.trim().length < 8) {
      setFormError('New password must be at least 8 characters long.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          email: editingUser.email,
          name: editingUser.name,
          role: editingUser.role,
          mobileNumber: editingUser.mobile_number,
          password: editingUser.newPassword && editingUser.newPassword.trim().length >= 8 ? editingUser.newPassword.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      triggerNotification('User updated successfully!', null);
      setShowEditModal(false);
      setFormError(null);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setFormError(friendlyError(err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');

      toastSuccess(data.message || 'User deleted successfully!');
      setUsers(prev => prev.filter(u => u.id !== userId && u.email !== userId));
      fetchUsers();
    } catch (err: any) {
      toastError(friendlyError(err.message));
    } finally {
      setUserToDelete(null);
    }
  };

  const filteredUsers = users
    .filter(u => {
      if (u.role === 'admin') return false; // Admin accounts are managed outside this directory
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.mobile_number && u.mobile_number.includes(searchQuery));
      const matchesRole = roleFilter === 'All' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      return 0;
    });

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, sortBy]);

  if (loading) return <SkeletonUsersPage />;

  const totalArchitects = users.filter(u => u.role === 'architect').length;
  const totalDesigners = users.filter(u => u.role === 'designer').length;
  const totalAdmins = users.filter(u => u.role === 'admin').length;

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium text-neutral-900 font-sans">User Directory</h2>
          <p className="text-sm text-neutral-400 mt-0.5">Manage credentials, coordinate designer assignments, and update system roles.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportUsersToCSV}
            className="inline-flex items-center px-3.5 py-2 bg-white hover:bg-neutral-50 text-neutral-700 font-medium text-sm border border-neutral-200 rounded-md transition-colors cursor-pointer shadow-xs"
            title="Export User Master to CSV spreadsheet"
          >
            <i className="bx bx-download text-sm mr-1.5 text-neutral-500"></i>
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm rounded-md transition-colors cursor-pointer shadow-xs"
          >
            <i className="bx bx-plus text-sm mr-1.5"></i>
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {(successMsg || errorMsg) && (
        <div className="space-y-2">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium rounded-md flex items-center space-x-2 animate-fade-in">
              <i className="bx bx-check-circle text-base"></i>
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium rounded-md flex items-center space-x-2 animate-fade-in">
              <i className="bx bx-error-circle text-base"></i>
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-neutral-200 rounded-md p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-sm font-medium text-neutral-400 block">Total Architects</span>
            <span className="text-2xl font-medium text-neutral-900 font-sans">{totalArchitects}</span>
            <span className="text-xs text-neutral-400 block">Registered partners</span>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-md flex items-center justify-center text-blue-600 border border-blue-100">
            <i className="bx bx-buildings text-xl"></i>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-md p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-sm font-medium text-neutral-400 block">Active Designers</span>
            <span className="text-2xl font-medium text-neutral-900 font-sans">{totalDesigners}</span>
            <span className="text-xs text-neutral-400 block">Internal workspace staff</span>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-md flex items-center justify-center text-emerald-600 border border-emerald-100">
            <i className="bx bx-pencil text-xl"></i>
          </div>
        </div>
      </div>

      {/* User Management Directory Container */}
      <div className="space-y-4">

        {/* Interactive controls bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-4">
          <div className="flex items-center space-x-2 flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name, email..."
            />
            <CustomSelect
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: 'All', label: 'All Roles' },
                { value: 'architect', label: 'Architect' },
                { value: 'designer', label: 'Designer' }
              ]}
            />
            <CustomSelect
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'newest', label: 'Sort by: Newest' },
                { value: 'oldest', label: 'Sort by: Oldest' },
                { value: 'name-asc', label: 'Name: A to Z' },
                { value: 'name-desc', label: 'Name: Z to A' }
              ]}
            />
          </div>

          {/* View Layout Toggle */}
          <LayoutToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        {/* List/Table Render Area */}
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {paginatedUsers.map((u) => (
              <div
                key={u.id}
                onClick={() => router.push(`/admin/users/${u.id}`)}
                className="border border-neutral-200 hover:border-neutral-300 rounded-md p-5 bg-white flex flex-col justify-between space-y-4 hover: transition-all duration-200 cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-700 flex items-center justify-center font-medium text-sm">
                      {u.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 line-clamp-1">
                        {u.name}
                      </h3>
                      <RoleBadge role={u.role} className="mt-0.5" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-neutral-500 font-medium pt-2">
                    <p className="truncate">Email: {u.email}</p>
                    <p>Phone: {u.mobile_number || 'Not Provided'}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-50 flex items-center justify-between">
                  <span className="text-sm text-neutral-400 font-sans font-medium">
                    Joined: {new Date(u.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setShowEditModal(true);
                      }}
                      className="px-2.5 py-1 text-sm font-medium text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setUserToDelete(u.id);
                        setShowDeleteConfirm(true);
                      }}
                      className="px-2.5 py-1 text-sm font-medium text-rose-750 bg-rose-50 border border-rose-100 rounded hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto mt-3 border border-neutral-200 rounded-md bg-white">
            <table className="w-full text-left border-collapse text-sm min-w-[700px] md:min-w-0 bg-white">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-normal text-xs">
                  <th className="py-3 px-4 first:pl-5 last:pr-5">User</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Email Address</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Contact Number</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Role Badge</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Sign Up Date</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700 font-normal">
                {paginatedUsers.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                    className="hover:bg-neutral-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-700 flex items-center justify-center font-medium text-xs flex-shrink-0">
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-neutral-900 font-medium">{u.name}</span>
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-500">{u.email}</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-400 font-sans">{u.mobile_number || 'Not Provided'}</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-sm text-neutral-400 font-medium font-sans">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setShowEditModal(true);
                          }}
                          className="px-2.5 py-1 text-sm font-medium text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setUserToDelete(u.id);
                            setShowDeleteConfirm(true);
                          }}
                          className="px-2.5 py-1 text-sm font-medium text-rose-750 bg-rose-50 border border-rose-100 rounded hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={currentPage}
          pageCount={pageCount}
          totalItems={filteredUsers.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <Portal>
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
            <div className="bg-white border border-neutral-200 rounded-md max-w-md w-full p-6 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-neutral-900">Add New User</h3>
                <p className="text-sm text-neutral-400">Create credentials and profile metadata for staff or architect portal access.</p>
              </div>

              {/* Inline form error — stays visible inside modal */}
              {formError && (
                <div className="flex items-start space-x-2.5 p-3 bg-rose-50 border border-rose-200 rounded-md">
                  <i className="bx bx-error-circle text-rose-500 text-lg flex-shrink-0 mt-0.5"></i>
                  <p className="text-sm text-rose-700 font-medium leading-snug">{formError}</p>
                </div>
              )}

              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Sarah Jenkins"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-sm focus:outline-none focus:bg-white focus:border-amber-500 transition-colors font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => {
                      setNewUser(prev => ({ ...prev, email: e.target.value }));
                      if (formError) setFormError(null);
                    }}
                    placeholder="sarah@company.com"
                    className={`w-full px-3 py-2 bg-neutral-50 border rounded-md text-sm focus:outline-none focus:bg-white transition-colors font-medium ${
                      formError && formError.toLowerCase().includes('email')
                        ? 'border-rose-300 focus:border-rose-400'
                        : 'border-neutral-200 focus:border-amber-500'
                    }`}
                  />
                  <p className="text-xs text-neutral-400 mt-1">Use a real email domain like @gmail.com or @company.com</p>
                </div>

                <PasswordInput
                  id="new-user-password"
                  label="Password *"
                  required
                  minLength={8}
                  value={newUser.password}
                  onChange={(e) => {
                    setNewUser(prev => ({ ...prev, password: e.target.value }));
                    if (formError) setFormError(null);
                  }}
                  placeholder="••••••••"
                  helperText="Minimum 8 characters"
                  error={Boolean(formError && formError.toLowerCase().includes('password'))}
                />

                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1.5">Access Role *</label>
                  <CustomSelect
                    value={newUser.role}
                    onChange={(val) => setNewUser(prev => ({ ...prev, role: val }))}
                    options={[
                      { value: 'architect', label: 'Architect' },
                      { value: 'designer', label: 'Designer' }
                    ]}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1.5">Contact Phone</label>
                  <input
                    type="text"
                    value={newUser.mobileNumber}
                    onChange={(e) => setNewUser(prev => ({ ...prev, mobileNumber: e.target.value }))}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-sm focus:outline-none focus:bg-white focus:border-amber-500 transition-colors font-medium"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setFormError(null); }}
                    disabled={submitting}
                    className="px-4 py-2 border border-neutral-200 hover:bg-neutral-50 rounded-md text-sm font-medium text-neutral-600 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm font-medium transition-colors cursor-pointer disabled:opacity-55 flex items-center space-x-1.5"
                  >
                    {submitting && (
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    <span>{submitting ? 'Creating...' : 'Create User'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <Portal>
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
            <div className="bg-white border border-neutral-200 rounded-md max-w-md w-full p-6 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-neutral-900">Update User Profile</h3>
                <p className="text-sm text-neutral-400">Modify credentials, system access roles, or contact numbers.</p>
              </div>

              {/* Inline form error — stays visible inside modal */}
              {formError && (
                <div className="flex items-start space-x-2.5 p-3 bg-rose-50 border border-rose-200 rounded-md">
                  <i className="bx bx-error-circle text-rose-500 text-lg flex-shrink-0 mt-0.5"></i>
                  <p className="text-sm text-rose-700 font-medium leading-snug">{formError}</p>
                </div>
              )}

              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-sm focus:outline-none focus:bg-white focus:border-amber-500 transition-colors font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editingUser.email}
                    onChange={(e) => {
                      setEditingUser({ ...editingUser, email: e.target.value });
                      if (formError) setFormError(null);
                    }}
                    className={`w-full px-3 py-2 bg-neutral-50 border rounded-md text-sm focus:outline-none focus:bg-white transition-colors font-medium ${
                      formError && formError.toLowerCase().includes('email')
                        ? 'border-rose-300 focus:border-rose-400'
                        : 'border-neutral-200 focus:border-amber-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1.5">Access Role *</label>
                  <CustomSelect
                    value={editingUser.role}
                    onChange={(val) => setEditingUser({ ...editingUser, role: val })}
                    options={[
                      { value: 'architect', label: 'Architect' },
                      { value: 'designer', label: 'Designer' }
                    ]}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1.5">Contact Phone</label>
                  <input
                    type="text"
                    value={editingUser.mobile_number || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, mobile_number: e.target.value })}
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-sm focus:outline-none focus:bg-white focus:border-amber-500 transition-colors font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-600 mb-1.5">
                    Reset Password <span className="text-xs text-neutral-400 font-normal">(leave blank to keep current)</span>
                  </label>
                  <PasswordInput
                    value={editingUser.newPassword || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, newPassword: e.target.value })}
                    placeholder="Enter new password (min. 8 characters)"
                    minLength={8}
                    id="edit-user-password"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingUser(null);
                      setFormError(null);
                    }}
                    disabled={submitting}
                    className="px-4 py-2 border border-neutral-200 hover:bg-neutral-50 rounded-md text-sm font-medium text-neutral-600 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm font-medium transition-colors cursor-pointer disabled:opacity-55 flex items-center space-x-1.5"
                  >
                    {submitting && (
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    <span>{submitting ? 'Saving...' : 'Save Updates'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete User Account"
        message="Are you sure you want to delete this user? This will permanently remove their credentials and profile access."
        confirmLabel="Delete User"
        variant="danger"
        onConfirm={() => {
          if (userToDelete) handleDeleteUser(userToDelete);
        }}
        onClose={() => {
          setShowDeleteConfirm(false);
          setUserToDelete(null);
        }}
      />
    </div>
  );
}
