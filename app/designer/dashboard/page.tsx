'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { StatusBadge, SkeletonDashboard, StatsCard } from '@/components/ui';

export default function DesignerDashboard() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [designerName, setDesignerName] = useState('Designer');
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [revisionProjects, setRevisionProjects] = useState<any[]>([]);
  const [pendingProjects, setPendingProjects] = useState<any[]>([]);
  const [pendingRevisions, setPendingRevisions] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    totalProjects: number;
    inDesignProjects: number;
    underReviewProjects: number;
    completedProjects: number;
    projectsTrend: { value: number; direction: 'up' | 'down' } | null;
    upcomingDeadlines: number;
  }>({
    totalProjects: 0,
    inDesignProjects: 0,
    underReviewProjects: 0,
    completedProjects: 0,
    projectsTrend: null,
    upcomingDeadlines: 0,
  });

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchDashboardData() {
      try {
        let currentUserId: string | null = null;
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const user = sessionData?.session?.user || (await supabase.auth.getUser()).data?.user;
          if (user) {
            currentUserId = user.id;
            if (user.user_metadata?.name) {
              setDesignerName(user.user_metadata.name);
            }
            const { data: profile } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', user.id)
              .maybeSingle();
            if (profile?.name) setDesignerName(profile.name);
          }
        } catch (e) {}

        let projects: any[] = [];
        try {
          const res = await fetch('/api/designer/projects');
          if (res.ok) {
            const resData = await res.json();
            projects = resData.projects || [];
          }
        } catch (e) {
          console.warn('API fetch error in designer dashboard:', e);
        }

        // Direct Supabase query fallback to get ALL real database projects
        if (!projects || projects.length === 0) {
          const { data: dbProjects } = await supabase
            .from('projects')
            .select('id, project_id_serial, project_name, client_name, area_sq_ft, payment_status, status, created_at, assigned_designer_id, deadline')
            .order('created_at', { ascending: false });
          projects = dbProjects || [];
        }

        const isSameId = (id1: any, id2: any) => {
          if (!id1 || !id2) return false;
          return String(id1).trim().toLowerCase() === String(id2).trim().toLowerCase();
        };

        // If user is logged in, prioritize projects assigned to user if any exist
        const assigned = currentUserId ? projects.filter(p => isSameId(p.assigned_designer_id, currentUserId)) : [];
        const activeProjects = assigned.length > 0 ? assigned : projects;

        setRecentProjects(activeProjects.slice(0, 5));
        setRevisionProjects(activeProjects.filter((p: any) => p.status === 'Revision Requested'));
        setPendingProjects(activeProjects.filter((p: any) => p.status === 'Submitted' || p.status === 'Under Review' || p.status === 'In Design'));

        // Fetch pending revision requests for assigned projects
        let revRequests: any[] = [];
        try {
          const { data: revData } = await supabase
            .from('revision_requests')
            .select('*, projects(id, project_name, project_id_serial, client_name, assigned_designer_id)')
            .order('created_at', { ascending: false });

          if (revData) {
            revRequests = revData.filter((r: any) => {
              const matchesUser = currentUserId ? isSameId(r.projects?.assigned_designer_id, currentUserId) : true;
              return matchesUser && (r.status === 'approved' || r.status === 'pending' || r.status === 'Submitted');
            });
          }
        } catch (e) {}

        setPendingRevisions(revRequests);

        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const createdThisMonth = activeProjects.filter((p: any) => new Date(p.created_at) >= startOfThisMonth).length;
        const createdLastMonth = activeProjects.filter((p: any) => new Date(p.created_at) >= startOfLastMonth && new Date(p.created_at) < startOfThisMonth).length;
        const projectsTrend = createdLastMonth === 0
          ? (createdThisMonth > 0 ? { value: 100, direction: 'up' as const } : null)
          : {
              value: Math.round(Math.abs((createdThisMonth - createdLastMonth) / createdLastMonth) * 100),
              direction: (createdThisMonth >= createdLastMonth ? 'up' : 'down') as 'up' | 'down',
            };

        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const upcomingDeadlines = activeProjects.filter((p: any) => {
          if (!p.deadline || p.status === 'Closed') return false;
          const d = new Date(p.deadline);
          return d >= now && d <= in7Days;
        }).length;

        setStats({
          totalProjects: activeProjects.length,
          inDesignProjects: activeProjects.filter((p: any) => p.status === 'In Design').length,
          underReviewProjects: activeProjects.filter((p: any) => p.status === 'Under Review' || p.status === 'Ready for Client Review').length,
          completedProjects: activeProjects.filter((p: any) => p.status === 'Approved' || p.status === 'Closed').length,
          projectsTrend,
          upcomingDeadlines,
        });
      } catch (err) {
        console.error('Error loading designer dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-4 font-sans">
      {/* Top Banner / Hero Card */}
      <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-md p-4 sm:p-5 xl:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-neutral-800">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base sm:text-lg xl:text-xl font-medium tracking-tight">Welcome back, {designerName}</h2>
          <p className="text-xs sm:text-sm text-neutral-450">
            Lightmaps Staff Workspace &mdash; You have {stats.inDesignProjects} active projects in your design layout workflow.
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <Link
            href="/designer/projects"
            className="px-3 py-1.5 xl:px-4 xl:py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs xl:text-sm font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap active:scale-[0.98] cursor-pointer"
          >
            <i className="bx bx-folder text-sm"></i>
            <span>All Projects</span>
          </Link>
        </div>
      </div>



      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatsCard
          title="Total"
          value={stats.totalProjects}
          subtext="All managed projects"
          trend={stats.projectsTrend || undefined}
          icon="bx-folder"
          iconBgClass="bg-neutral-50 border-neutral-200"
          iconColorClass="text-neutral-600"
        />
        <StatsCard
          title="In Design"
          value={stats.inDesignProjects}
          subtext="Active layout stage"
          icon="bx-edit"
          iconBgClass="bg-amber-50 border-amber-100"
          iconColorClass="text-amber-600"
        />
        <StatsCard
          title="In Review"
          value={stats.underReviewProjects}
          subtext="Awaiting client checks"
          icon="bx-time-five"
          iconBgClass="bg-blue-50 border-blue-100"
          iconColorClass="text-blue-600"
        />
        <StatsCard
          title="Completed"
          value={stats.completedProjects}
          subtext="Successfully closed scopes"
          icon="bx-check-double"
          iconBgClass="bg-emerald-50 border-emerald-100"
          iconColorClass="text-emerald-600"
        />
        <StatsCard
          title="Upcoming Deadlines"
          value={stats.upcomingDeadlines}
          subtext="Due within 7 days"
          href="/designer/calendar"
          icon="bx-calendar-exclamation"
          iconBgClass="bg-rose-50 border-rose-100"
          iconColorClass="text-rose-600"
        />
      </div>

      {/* Pending Revision Requests Section */}
      <div className="bg-white border border-neutral-200 rounded-md p-5 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-neutral-100">
          <div>
            <h3 className="text-sm font-medium text-neutral-900 font-sans flex items-center space-x-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${pendingRevisions.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <span>Pending Revision Requests</span>
            </h3>
            <p className="text-xs text-neutral-450 mt-0.5">Approved client feedback &amp; revision tasks assigned to your design scope</p>
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded border font-sans ${pendingRevisions.length > 0 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
            {pendingRevisions.length} Active Task{pendingRevisions.length === 1 ? '' : 's'}
          </span>
        </div>

        {pendingRevisions.length === 0 ? (
          <div className="py-6 text-center text-xs text-neutral-450 font-medium space-y-1">
            <i className="bx bx-check-circle text-2xl text-emerald-500 block mb-1"></i>
            <p>No pending revision tasks for your assigned projects.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pendingRevisions.map((rev: any) => (
              <div
                key={rev.id}
                className="flex items-center justify-between p-3 rounded-md hover:bg-neutral-50 border border-neutral-200/80 transition-all group gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <Link
                    href={`/designer/projects/${rev.project_id || rev.projects?.id}`}
                    className="font-semibold text-neutral-900 text-sm sm:text-base hover:text-amber-600 transition-colors truncate block"
                    title={rev.projects?.project_name}
                  >
                    {rev.projects?.project_name || 'Project Revision'}
                  </Link>
                  <p className="text-xs sm:text-sm text-neutral-600 font-medium line-clamp-1">
                    &quot;{rev.description}&quot;
                  </p>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  {rev.created_at && (
                    <span className="text-xs text-neutral-400 font-medium whitespace-nowrap hidden sm:inline-block">
                      {new Date(rev.created_at).toLocaleDateString()}
                    </span>
                  )}
                  <Link
                    href={`/designer/projects/${rev.project_id || rev.projects?.id}`}
                    className="px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:text-amber-600 border border-neutral-300 hover:border-amber-500 rounded-md bg-white hover:bg-neutral-50 transition-all whitespace-nowrap active:scale-[0.98] inline-flex items-center shadow-sm"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Split Grid */}
      <div className="bg-white border border-neutral-200 rounded-md p-5">
        <div className="pb-4 border-b border-neutral-100">
          <h2 className="text-base font-medium text-neutral-900">Active Workspaces</h2>
          <p className="text-sm text-neutral-450 mt-0.5">Assigned projects currently undergoing lighting layouts and simulation phases.</p>
        </div>

        {recentProjects.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-455 font-medium space-y-2">
            <i className="bx bx-folder-open text-3xl text-neutral-300"></i>
            <p>No projects assigned to you yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-4 border border-neutral-200 rounded-md bg-white">
            <table className="w-full text-left border-collapse min-w-[420px] bg-white">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-medium text-xs">
                  <th className="py-3 px-4 first:pl-5 last:pr-5 whitespace-nowrap">Project ID</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5 whitespace-nowrap">Project Name</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5 whitespace-nowrap hidden sm:table-cell">Client</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 first:pl-5 last:pr-5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700 font-medium">
                {recentProjects.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-xs text-neutral-500 whitespace-nowrap">{p.project_id_serial || 'N/A'}</td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-900 text-sm max-w-[140px] xl:max-w-none">
                      <span className="block truncate">{p.project_name}</span>
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-neutral-500 text-xs hidden sm:table-cell max-w-[100px]">
                      <span className="block truncate">{p.client_name}</span>
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3.5 px-4 first:pl-5 last:pr-5 text-right">
                      <Link
                        href={`/designer/projects/${p.id}`}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors whitespace-nowrap active:scale-[0.98] cursor-pointer"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
