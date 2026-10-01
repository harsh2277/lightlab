'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CustomSelect from '@/components/ui/CustomSelect';
import LayoutToggle from '@/components/ui/LayoutToggle';
import { StatusBadge, PaymentBadge, DeadlineBadge, useToast, Pagination, SkeletonProjectsList } from '@/components/ui';
import SearchInput from '@/components/ui/SearchInput';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmModal from '@/components/ui/ConfirmModal';
import EmptyState from '@/components/ui/EmptyState';

const PAGE_SIZE = 10;

export default function ArchitectProjectsList() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { error: toastError } = useToast();

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
        }
      } catch (err) {
        console.error('Error fetching projects:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  const handleDelete = async (id: string) => {
    setProjectToDelete(id);
    setShowConfirm(true);
    return; // exit early, modal will handle deletion
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    const rowsToExport = filteredProjects;

    if (format === 'csv') {
      const headers = ['Project Name', 'Client Name', 'Location', 'Area (sq ft)', 'Payment Status', 'Workflow Status', 'Created Date'];
      const rows = rowsToExport.map((proj) => [
        `"${proj.project_name.replace(/"/g, '""')}"`,
        `"${proj.client_name.replace(/"/g, '""')}"`,
        `"${(proj.site_location || 'N/A').replace(/"/g, '""')}"`,
        proj.area_sq_ft,
        proj.payment_status,
        proj.status,
        new Date(proj.created_at).toLocaleDateString(),
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,'
        + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `my_projects_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.print();
    }
  };

  const statuses = [
    'All', 'Submitted', 'Under Review', 'In Design',
    'Ready for Client Review', 'Revision Requested', 'Approved', 'Closed'
  ];

  const filteredProjects = projects
    .filter((p) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        p.project_name.toLowerCase().includes(query) ||
        p.client_name.toLowerCase().includes(query) ||
        (p.project_id_serial && p.project_id_serial.toLowerCase().includes(query));
      const matchesStatus = selectedStatus === 'All' || p.status === selectedStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'area-desc') return Number(b.area_sq_ft) - Number(a.area_sq_ft);
      if (sortBy === 'area-asc') return Number(a.area_sq_ft) - Number(b.area_sq_ft);
      return 0;
    });

  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedStatus, sortBy]);

  if (loading) {
    return <SkeletonProjectsList />;
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-neutral-900 tracking-tight">My Projects</h2>
          <p className="text-sm text-neutral-450 mt-0.5">Submit new project designs, view deliverables, and track current statuses.</p>
        </div>
        <Link
          href="/architect/projects/create"
          className="inline-flex items-center px-4.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-medium transition-all space-x-1.5 active:scale-[0.98] cursor-pointer shrink-0 text-center justify-center"
        >
          <i className="bx bx-plus text-sm"></i>
          <span>Add Project</span>
        </Link>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by ID, name, or client..."
        />

        <div className="flex items-center space-x-2">
          <CustomSelect
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'newest', label: 'Sort by: Newest' },
              { value: 'area-desc', label: 'Area: High to Low' },
              { value: 'area-asc', label: 'Area: Low to High' }
            ]}
          />

          {/* Filter Popover */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`px-3.5 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-all flex items-center space-x-1.5 cursor-pointer active:scale-[0.98] ${selectedStatus !== 'All' ? 'border-amber-500 text-amber-600 bg-amber-50/20' : ''}`}
            >
              <i className="bx bx-filter text-base"></i>
              <span>Filter{selectedStatus !== 'All' ? `: ${selectedStatus}` : ''}</span>
            </button>

            {showFilterDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFilterDropdown(false)}
                />
                <div className="absolute right-0 mt-1.5 w-56 bg-white border border-neutral-200 rounded-md py-1.5 z-20">
                  <div className="px-3 py-1.5 text-xs font-medium text-neutral-400 border-b border-neutral-50">
                    Filter by Status
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {statuses.map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setSelectedStatus(status);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${selectedStatus === status ? 'bg-amber-50 text-amber-700 font-medium' : 'text-neutral-700 hover:bg-neutral-50' }`}
                      >
                        <span>{status}</span>
                        {selectedStatus === status && <i className="bx bx-check text-sm"></i>}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* View Mode Toggle */}
          <LayoutToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Projects Render Area */}
      <div>
        {filteredProjects.length === 0 ? (
          <EmptyState
            title="No projects found"
            description="Try adjusting your filters or search query, or click &quot;Add Project&quot; to onboard your first design project."
          />
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {paginatedProjects.map((proj) => (
              <div
                key={proj.id}
                className="border border-neutral-200 hover:border-neutral-300 rounded-md p-6 bg-white flex flex-col justify-between space-y-4 hover: transition-all duration-300 group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium text-neutral-400">
                      {proj.project_id_serial || 'Generating ID...'}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={proj.status} type="workflow" />
                      <DeadlineBadge deadline={proj.deadline} />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-neutral-900 group-hover:text-amber-600 transition-colors line-clamp-1">
                    <Link href={`/architect/projects/${proj.id}`}>{proj.project_name}</Link>
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">Client: {proj.client_name}</p>
                  {proj.site_location && (
                    <p className="text-xs text-neutral-450 font-medium flex items-center mt-1">
                      <i className="bx bx-map mr-1 text-sm text-neutral-400"></i> {proj.site_location}
                    </p>
                  )}
                  {proj.status === 'Revision Requested' && proj.project_notes && proj.project_notes.startsWith('Rejection Reason:') && (
                    <div className="mt-2.5 p-3 bg-rose-50 border border-rose-100 rounded-md text-xs text-rose-800 font-medium">
                      <p className="font-medium text-[10px] text-rose-500 mb-0.5">Admin Feedback</p>
                      {proj.project_notes.replace('Rejection Reason:', '').trim()}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-neutral-100 space-y-3">
                  <div className="flex justify-between items-center text-xs font-medium text-neutral-500">
                    <span>Total Area</span>
                    <span className="text-neutral-805">{Number(proj.area_sq_ft).toLocaleString()} sq ft</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-medium text-neutral-500">
                    <span>Payment</span>
                    <PaymentBadge status={proj.payment_status} />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-neutral-450 font-medium">
                      {new Date(proj.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDelete(proj.id)}
                        className="inline-flex items-center px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs border border-rose-150/40 rounded-md transition-all cursor-pointer active:scale-[0.98]"
                      >
                        Delete
                      </button>
                      <Link
                        href={`/architect/projects/${proj.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 font-medium text-xs border border-neutral-200 rounded-md transition-all active:scale-[0.98]"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto border border-neutral-200 rounded-md bg-white">
            <table className="w-full text-left border-collapse text-sm min-w-[700px] md:min-w-0 bg-white">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-medium text-xs">
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Project Name</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Client</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Location</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Total Area</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Payment</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Status</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Created</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {paginatedProjects.map((proj) => (
                  <tr
                    key={proj.id}
                    onClick={() => router.push(`/architect/projects/${proj.id}`)}
                    className="hover:bg-neutral-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5">
                      <p className="text-sm font-medium text-neutral-900">{proj.project_name}</p>
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-500 text-sm font-medium">{proj.client_name}</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-500 text-sm font-medium">{proj.site_location || 'N/A'}</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-550 text-sm">{Number(proj.area_sq_ft).toLocaleString()} sq ft</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5">
                      <PaymentBadge status={proj.payment_status} />
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={proj.status} type="workflow" />
                        <DeadlineBadge deadline={proj.deadline} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-xs text-neutral-450 font-medium">
                      {new Date(proj.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(proj.id); }}
                          className="inline-flex items-center px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs border border-rose-150/45 rounded-md transition-all cursor-pointer active:scale-[0.98]"
                        >
                          Delete
                        </button>
                        <Link
                          href={`/architect/projects/${proj.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-805 font-medium text-xs border border-neutral-200 rounded-md transition-all active:scale-[0.98]"
                        >
                          View
                        </Link>
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
          totalItems={filteredProjects.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="Confirm Deletion"
        message="Are you sure you want to delete this project? All associated payments, comments, and files will be permanently deleted."
        onConfirm={async () => {
          if (projectToDelete) {
            try {
              const { error } = await supabase.from('projects').delete().eq('id', projectToDelete);
              if (error) throw error;
              setProjects(prev => prev.filter(p => p.id !== projectToDelete));
            } catch (err) {
              console.error('Error deleting project:', err);
              toastError('Failed to delete project.');
            }
          }
          setShowConfirm(false);
          setProjectToDelete(null);
        }}
        onClose={() => { setShowConfirm(false); setProjectToDelete(null); }}
      />
    </div>
  );
}
