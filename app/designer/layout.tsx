'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import CommandPalette from '@/components/ui/CommandPalette';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const navItems = [
  { name: 'Dashboard', path: '/designer/dashboard', icon: 'bx bx-grid-alt', group: 'Overview' },
  { name: 'Projects', path: '/designer/projects', icon: 'bx bx-folder', group: 'Management' },
  { name: 'Calendar', path: '/designer/calendar', icon: 'bx bx-calendar', group: 'Management' },
];

export default function DesignerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);
  // Persist sidebar collapse state in localStorage (same pattern as admin)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('designer_sidebar_collapsed');
    return saved !== null ? saved === 'true' : window.innerWidth < 1024;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [allProjects, setAllProjects] = useState<any[]>([]);

  // Notification badge state — mirrors the real Supabase-backed data and
  // read/dismissed tracking used by /designer/notifications so the bell
  // badge reflects the actual unread count instead of a hardcoded placeholder.
  const [notifications, setNotifications] = useState<Array<{ id: string | number; title: string; time: string; read: boolean; icon: string; color: string }>>([]);

  // Auto-collapse sidebar below lg breakpoint; persist preference above lg
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      }
      if (window.innerWidth >= 768) {
        setIsMobileOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persist sidebar state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('designer_sidebar_collapsed', String(isCollapsed));
    }
  }, [isCollapsed]);

  const authFetchedRef = useRef(false);

  useEffect(() => {
    if (authFetchedRef.current) return;
    authFetchedRef.current = true;

    async function checkAuth() {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (!data.profile || data.profile.role !== 'designer') {
          router.push('/login');
          return;
        }

        setProfile({ name: data.profile.name, email: data.profile.email });
        setLoading(false);

        // Fetch projects for Cmd+K palette
        try {
          const res2 = await fetch('/api/designer/projects');
          if (res2.ok) {
            const d2 = await res2.json();
            setAllProjects(d2.projects || []);
          }
        } catch (e) {}

        // Fetch recent events for the notification bell badge, using the
        // same read/dismissed tracking (localStorage key) as the full
        // /designer/notifications page so the badge count stays accurate.
        try {
          const NOTIF_STORAGE_KEY = 'lightmap_designer_notification_state';
          let readIds = new Set<string>();
          let dismissedIds = new Set<string>();
          try {
            const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              readIds = new Set(parsed.read || []);
              dismissedIds = new Set(parsed.dismissed || []);
            }
          } catch { }

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: myProjects } = await supabase
              .from('projects')
              .select('id, project_name, created_at')
              .eq('assigned_designer_id', user.id)
              .order('created_at', { ascending: false })
              .limit(10);
            const projectIds = (myProjects || []).map((p: any) => p.id);

            const { data: recentRevisions } = projectIds.length
              ? await supabase.from('revision_requests').select('id, status, created_at, projects!project_id(project_name)').in('project_id', projectIds).order('created_at', { ascending: false }).limit(10)
              : { data: [] as any[] };

            const items = [
              ...(myProjects || []).map((p: any) => ({
                id: `project_${p.id}`, title: `Assigned project: ${p.project_name}`, created_at: p.created_at,
                icon: 'bx-folder-plus', color: 'text-amber-600 bg-amber-50',
              })),
              ...(recentRevisions || []).map((rev: any) => ({
                id: `revision_${rev.id}`, title: `Revision update${rev.projects ? ` for ${rev.projects.project_name}` : ''}`, created_at: rev.created_at,
                icon: 'bx-git-pull-request', color: 'text-rose-600 bg-rose-50',
              })),
            ]
              .filter((item) => !dismissedIds.has(item.id))
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .slice(0, 6)
              .map((item) => ({
                id: item.id,
                title: item.title,
                time: timeAgo(item.created_at),
                read: readIds.has(item.id),
                icon: item.icon,
                color: item.color,
              }));

            setNotifications(items);
          }
        } catch (e) { }
      } catch {
        router.push('/login');
      }
    }
    checkAuth();
  }, [router]);

  const activeItem = navItems.reduce<typeof navItems[number] | null>((best, item) => {
    const matches = pathname === item.path || pathname.startsWith(`${item.path}/`);
    if (!matches) return best;
    if (!best || item.path.length > best.path.length) return item;
    return best;
  }, null);
  const activeTab = activeItem ? activeItem.name : 'Dashboard';

  // Build extra breadcrumb segments beyond the top-level nav item, e.g.
  // "Designer > Projects > {Project Name} > {Tab}" when drilled into a
  // project detail route. Resolves the id segment against the projects
  // already fetched for the Cmd+K palette instead of leaving it raw.
  const breadcrumbExtra: string[] = [];
  if (activeItem) {
    const rest = pathname.slice(activeItem.path.length).split('/').filter(Boolean);
    if (rest.length > 0) {
      const [maybeId, ...tail] = rest;
      const matchedProject = allProjects.find((p) => String(p.id) === maybeId);
      if (matchedProject) {
        breadcrumbExtra.push(matchedProject.project_name || matchedProject.client_name || 'Project Details');
      } else if (!/^[0-9a-f-]{8,}$/i.test(maybeId)) {
        breadcrumbExtra.push(maybeId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      } else {
        breadcrumbExtra.push('Project Details');
      }
      if (tail.length > 0) {
        breadcrumbExtra.push(tail[0].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center space-y-4">
          <svg className="animate-spin h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-neutral-400 text-xs font-medium font-sans">Verifying Session...</span>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="h-screen flex bg-neutral-900 text-neutral-800 overflow-hidden font-sans">
      <CommandPalette projects={allProjects} basePath="/designer/projects" />

      {/* Reusable Sidebar Component */}
      <Sidebar
        workspaceTitle="Lightmaps"
        workspaceSubtitle="Designer Workspace"
        workspaceIcon="bx bxs-palette"
        navItems={navItems}
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        pathname={pathname}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-white border border-neutral-200 rounded-md my-1.5 mr-1.5 ml-0.5 overflow-hidden">
        {/* Reusable Topbar Header Component */}
        <Topbar
          portalName="Designer"
          activeTab={activeTab}
          breadcrumbExtra={breadcrumbExtra}
          isCollapsed={isCollapsed}
          isMobileOpen={isMobileOpen}
          setIsCollapsed={setIsCollapsed}
          setIsMobileOpen={setIsMobileOpen}
          profile={profile}
          notifications={notifications}
          setNotifications={setNotifications}
          handleSignOut={handleSignOut}
          notificationsBasePath="/designer/notifications"
          profileHref="/designer/profile"
          showQuickSearch={true}
        />

        {/* Page Content */}
        {pathname.startsWith('/designer/projects/') && !pathname.endsWith('/create') ? (
          children
        ) : (
          <main className="flex-1 overflow-y-auto p-4 bg-neutral-50/30">
            <div className="content-container">
              {children}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
