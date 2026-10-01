'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import ConfirmModal from '@/components/ui/ConfirmModal';
import EmptyState from '@/components/ui/EmptyState';
import CustomSelect from '@/components/ui/CustomSelect';
import LayoutToggle from '@/components/ui/LayoutToggle';
import SearchInput from '@/components/ui/SearchInput';
import { StatusBadge, PaymentBadge, DeadlineBadge, useToast, Pagination, SkeletonProjectsList } from '@/components/ui';

const PAGE_SIZE = 10;

export default function AdminArchitectProjectsList() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const architectId = params.architectId as string;

  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [architect, setArchitect] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [page, setPage] = useState(1);
  const { error: toastError } = useToast();

  useEffect(() => {
    async function fetchArchitect() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email, mobile_number')
          .eq('id', architectId)
          .single();
        if (error) throw error;
        setArchitect(data);
      } catch (err) {
        console.error('Error fetching architect:', err);
      }
    }

    async function fetchProjects() {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, project_id_serial, project_name, client_name, area_sq_ft, payment_status, status, site_location, created_at, deadline')
          .eq('architect_id', architectId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProjects(data || []);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setProjects([]);
      }
    }

    async function loadData() {
      setLoading(true);
      await Promise.all([fetchArchitect(), fetchProjects()]);
      setLoading(false);
    }

    if (architectId) loadData();
  }, [architectId]);

  const statuses = [
    'All', 'Submitted', 'Under Review', 'In Design',
    'Ready for Client Review', 'Revision Requested', 'Approved', 'Closed'
  ];

  const filteredProjects = projects
    .filter((p) => {
      const matchesSearch = p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.project_id_serial && p.project_id_serial.toLowerCase().includes(searchQuery.toLowerCase()));
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

  const initials = (architect?.name || 'A')
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <Link href="/admin/projects" className="text-xs font-medium text-neutral-400 hover:text-neutral-700 flex items-center gap-1 mb-2">
            <i className="bx bx-arrow-back text-sm" /> All Projects
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-medium text-neutral-900 font-sans">{architect?.name || 'Architect'}</h2>
              <p className="text-sm text-neutral-400 mt-0.5">{architect?.email} · {projects.length} project{projects.length === 1 ? '' : 's'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by ID or project name..."
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
              className={`px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-md text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors flex items-center space-x-1.5 cursor-pointer ${selectedStatus !== 'All' ? 'border-amber-500 text-amber-600 bg-amber-50/20' : ''}`}
              aria-label="Filter projects"
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
                <div className="absolute right-0 mt-1.5 w-56 bg-white border border-neutral-200 rounded-md py-1 z-20">
                  <div className="px-3 py-1.5 text-sm font-medium text-neutral-400 border-b border-neutral-50">
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
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${selectedStatus === status ? 'bg-amber-50 text-amber-700 font-medium' : 'text-neutral-700 hover:bg-neutral-50'}`}
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

          {/* View Layout Toggle */}
          <LayoutToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Projects List Render Area */}
      <div className="mt-4">
        {filteredProjects.length === 0 ? (
          <EmptyState title="No projects found" description="This architect has no projects matching your filters yet." />
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {paginatedProjects.map((proj) => (
              <div
                key={proj.id}
                className="border border-neutral-200 hover:border-neutral-300 rounded-md p-5 bg-white flex flex-col justify-between space-y-4 transition-all duration-200"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-neutral-400">
                      {proj.project_id_serial || 'KL-2025-XXXX'}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={proj.status} type="workflow" />
                      <DeadlineBadge deadline={proj.deadline} />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-neutral-900 line-clamp-1">{proj.project_name}</h3>
                  <p className="text-sm text-neutral-500 font-medium">Representative: {proj.client_name}</p>
                  {proj.site_location && (
                    <p className="text-sm text-neutral-400 font-medium flex items-center mt-1">
                      <i className="bx bx-map mr-1 text-sm text-neutral-500"></i> {proj.site_location}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-neutral-50 space-y-2.5">
                  <div className="flex justify-between items-center text-sm font-medium text-neutral-500">
                    <span>Total Area</span>
                    <span className="font-sans text-neutral-855">{Number(proj.area_sq_ft).toLocaleString()} sq ft</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium text-neutral-500">
                    <span>Payment</span>
                    <PaymentBadge status={proj.payment_status} />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-sm text-neutral-400 font-sans font-medium">
                      {new Date(proj.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => { setProjectToDelete(proj.id); setShowConfirm(true); }}
                        className="inline-flex items-center px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-sm border border-rose-200 rounded-md transition-colors cursor-pointer"
                        aria-label={`Delete project ${proj.project_name}`}
                      >
                        Delete
                      </button>
                      <Link
                        href={`/admin/projects/${proj.id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 font-medium text-sm border border-neutral-200 rounded-md transition-colors"
                        aria-label={`Manage project ${proj.project_name}`}
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto mt-3 border border-neutral-200 rounded-md bg-white">
            <table className="w-full text-left border-collapse text-sm min-w-[640px] md:min-w-0 bg-white">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-normal text-xs">
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Project Name</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Client Name</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Location</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Total Area</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Payment</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Workflow Status</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Created Date</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700 font-normal">
                {paginatedProjects.map((proj) => (
                  <tr
                    key={proj.id}
                    onClick={() => router.push(`/admin/projects/${proj.id}`)}
                    className="hover:bg-neutral-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-900 font-medium">{proj.project_name}</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-550">{proj.client_name}</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-500 font-medium">{proj.site_location || 'N/A'}</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-500 font-sans">{Number(proj.area_sq_ft).toLocaleString()} sq ft</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5">
                      <StatusBadge status={proj.payment_status} type="payment" />
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={proj.status} type="workflow" />
                        <DeadlineBadge deadline={proj.deadline} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-sm text-neutral-400 font-medium font-sans">
                      {new Date(proj.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(proj.id);
                            setShowConfirm(true);
                          }}
                          className="inline-flex items-center px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-sm border border-rose-200 rounded-md transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                        <Link
                          href={`/admin/projects/${proj.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 font-medium text-sm border border-neutral-200 rounded-md transition-colors"
                        >
                          Manage
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
        message="Are you sure you want to delete this project? This action cannot be undone."
        onConfirm={async () => {
          if (projectToDelete) {
            try {
              const { error } = await supabase.from('projects').delete().eq('id', projectToDelete);
              if (error) throw error;
              setProjects(prev => prev.filter(p => p.id !== projectToDelete));
            } catch (err) {
              console.error('Error deleting project:', err);
              toastError('Failed to delete project. Please try again.');
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
