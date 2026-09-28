'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import EmptyState from '@/components/ui/EmptyState';
import LayoutToggle from '@/components/ui/LayoutToggle';
import CustomSelect from '@/components/ui/CustomSelect';
import { StatusBadge, DeadlineBadge, Pagination, SkeletonProjectsList } from '@/components/ui';
import SearchInput from '@/components/ui/SearchInput';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

import { createClient } from '@/utils/supabase/client';

const PAGE_SIZE = 10;

export default function DesignerProjectsList() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [page, setPage] = useState(1);

  async function fetchProjects() {
    try {
      let userId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          setCurrentUserId(user.id);
        }
      } catch (e) {}

      let loadedProjects: any[] = [];
      try {
        const apiUrl = userId ? `/api/designer/projects?userId=${userId}` : '/api/designer/projects';
        const res = await fetch(apiUrl);
        if (res.ok) {
          const resData = await res.json();
          loadedProjects = resData.projects || [];
          if (resData.currentUserId && !userId) {
            setCurrentUserId(resData.currentUserId);
            userId = resData.currentUserId;
          }
        }
      } catch (e) {
        console.warn('API error in designer projects list, falling back:', e);
      }

      // Direct Supabase query fallback
      if (!loadedProjects || loadedProjects.length === 0) {
        const { data: dbProjects } = await supabase
          .from('projects')
          .select('id, project_id_serial, project_name, client_name, area_sq_ft, payment_status, status, created_at, assigned_designer_id')
          .order('created_at', { ascending: false });
        loadedProjects = dbProjects || [];
      }

      setProjects(loadedProjects);
    } catch (err) {
      console.error('Error fetching designer projects:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  const statuses = [
    'All', 'Submitted', 'Payment Pending', 'Under Review', 'In Design',
    'Ready for Client Review', 'Revision Requested', 'Approved', 'Closed'
  ];



  const filteredProjects = projects
    .filter((p) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        (p.project_name || '').toLowerCase().includes(query) ||
        (p.client_name || '').toLowerCase().includes(query) ||
        (p.project_id_serial || '').toLowerCase().includes(query);
      const matchesStatus = selectedStatus === 'All' || p.status === selectedStatus;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'area-desc') return Number(b.area_sq_ft || 0) - Number(a.area_sq_ft || 0);
      if (sortBy === 'area-asc') return Number(a.area_sq_ft || 0) - Number(b.area_sq_ft || 0);
      return 0;
    });

  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedStatus, sortBy]);

  const handleExport = (format: 'csv' | 'pdf') => {
    const rowsToExport = filteredProjects;

    if (format === 'csv') {
      const headers = ['Project Name', 'Client Name', 'Area (sq ft)', 'Payment Status', 'Design Status', 'Added Date'];
      const rows = rowsToExport.map((proj) => [
        `"${(proj.project_name || '').replace(/"/g, '""')}"`,
        `"${(proj.client_name || '').replace(/"/g, '""')}"`,
        proj.area_sq_ft || '',
        proj.payment_status || '',
        proj.status || '',
        new Date(proj.created_at).toLocaleDateString(),
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,'
        + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `design_board_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.print();
    }
  };

  if (loading) {
    return <SkeletonProjectsList />;
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Title block */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-medium text-neutral-900 tracking-tight">Project Design Board</h2>
          <p className="text-sm text-neutral-450 mt-0.5">Filter project layouts, review onboarding requirements, and manage active designs.</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by ID, name, or client..."
          />
          <CustomSelect
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={statuses.map(s => ({ value: s, label: s === 'All' ? 'All Statuses' : s }))}
          />
          <CustomSelect
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'newest', label: 'Sort by: Newest' },
              { value: 'area-desc', label: 'Area: High to Low' },
              { value: 'area-asc', label: 'Area: Low to High' }
            ]}
          />
        </div>

        {/* View Mode Toggle */}
        <LayoutToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {/* Projects Render Area */}
      <div>
        {filteredProjects.length === 0 ? (
          <EmptyState
            title="No projects found"
            description="Try adjusting your search query or status filter to find matching design board projects."
          />
        ) : viewMode === 'card' ? (
          /* Card View */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {paginatedProjects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => router.push(`/designer/projects/${proj.id}`)}
                className="border border-neutral-200 hover:border-neutral-300 rounded-md p-6 bg-white flex flex-col justify-between space-y-4 hover: transition-all duration-300 group cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium text-neutral-400">
                      {proj.project_id_serial || 'KL-2025-XXXX'}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      {proj.payment_status === 'pending' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                          Payment Pending (Hold)
                        </span>
                      ) : (
                        <StatusBadge status={proj.status} type="workflow" />
                      )}
                      <DeadlineBadge deadline={proj.deadline} />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-neutral-900 group-hover:text-amber-600 transition-colors line-clamp-1">
                    <Link href={`/designer/projects/${proj.id}`} onClick={(e) => e.stopPropagation()}>
                      {proj.project_name}
                    </Link>
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">Client: {proj.client_name}</p>
                </div>

                <div className="pt-4 border-t border-neutral-100 space-y-3">
                  <div className="flex justify-between items-center text-xs font-medium text-neutral-500">
                    <span>Total Area</span>
                    <span className="text-neutral-805">{Number(proj.area_sq_ft).toLocaleString()} sq ft</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium text-neutral-500">
                    <span>Design Status</span>
                    <StatusBadge status={proj.status} size="sm" />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-neutral-450 font-medium">
                      Added: {new Date(proj.created_at).toLocaleDateString()}
                    </span>
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
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Client Name</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Area (Sq Ft)</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Design Status</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5">Added Date</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {paginatedProjects.map((proj) => (
                  <tr
                    key={proj.id}
                    onClick={() => router.push(`/designer/projects/${proj.id}`)}
                    className="hover:bg-neutral-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5">
                      <Link
                        href={`/designer/projects/${proj.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-neutral-900 font-medium hover:text-amber-600 transition-colors block"
                      >
                        {proj.project_name}
                      </Link>
                      <span className="text-xs text-neutral-450 block mt-0.5">{proj.project_id_serial || 'NO-ID'}</span>
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-500 text-sm font-medium">{proj.client_name}</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-550 text-sm">{proj.area_sq_ft ? proj.area_sq_ft.toLocaleString() : 'N/A'}</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5">
                      <div className="flex flex-col gap-1 items-start">
                        {proj.payment_status === 'pending' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                            Payment Pending (Hold)
                          </span>
                        ) : (
                          <StatusBadge status={proj.status} type="workflow" />
                        )}
                        <DeadlineBadge deadline={proj.deadline} />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-xs text-neutral-450 font-medium">
                      {new Date(proj.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/designer/projects/${proj.id}`}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-neutral-600 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors whitespace-nowrap active:scale-[0.98] cursor-pointer"
                      >
                        Manage
                      </Link>
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
    </div>
  );
}
