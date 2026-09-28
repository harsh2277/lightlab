'use client';

import Link from 'next/link';

export interface NavItem {
  name: string;
  path: string;
  icon: string;
  group: string;
}

interface SidebarProps {
  workspaceTitle?: string;
  workspaceSubtitle?: string;
  workspaceIcon?: string;
  navItems: NavItem[];
  isCollapsed: boolean;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  pathname: string;
}

export default function Sidebar({
  workspaceTitle = 'Lightmaps',
  workspaceSubtitle = 'Workspace',
  workspaceIcon = 'bx bxs-map-pin',
  navItems,
  isCollapsed,
  isMobileOpen,
  setIsMobileOpen,
  pathname,
}: SidebarProps) {
  const navGroups = Array.from(new Set(navItems.map((item) => item.group)));

  // Determine the single "most specific" matching nav item for the current
  // pathname (exact match, or longest path prefix match on a segment
  // boundary) so that items sharing a common prefix (e.g. /admin/payments
  // vs /admin/pay) never both light up — only the longest match wins.
  const matchingItem = navItems.reduce<NavItem | null>((best, item) => {
    const matches = pathname === item.path || pathname.startsWith(`${item.path}/`);
    if (!matches) return best;
    if (!best || item.path.length > best.path.length) return item;
    return best;
  }, null);

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar — dark theme */}
      <aside
        className={`bg-neutral-950 flex flex-col justify-between text-neutral-300 transition-all duration-300 fixed inset-y-0 left-0 z-50 md:static md:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          } ${isCollapsed ? 'md:w-14' : 'md:w-56 xl:w-56 2xl:w-64'} w-64`}
      >
        <div className="overflow-y-auto flex-1">
          {/* Logo & Branding */}
          <div
            className={`p-3 xl:p-4 flex items-center bg-neutral-950 border-b border-neutral-900 ${isCollapsed && !isMobileOpen ? 'justify-center' : 'space-x-2.5'
              }`}
          >
            <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
              <img src="/new-logo.png" alt="Lightmaps Logo" className="w-full h-full object-contain" />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="min-w-0">
                <span className="font-semibold text-white tracking-tight text-sm block truncate">
                  {workspaceTitle}
                </span>
                <span className="text-xs text-[#9a9a9a] font-medium truncate block">
                  {workspaceSubtitle}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Groups */}
          <nav className="p-2 space-y-3 xl:space-y-4">
            {navGroups.map((group) => (
              <div key={group} className="space-y-0.5">
                {(!isCollapsed || isMobileOpen) && (
                  <p className="text-xs font-medium text-[#9a9a9a] px-3 mb-1.5 truncate">
                    {group}
                  </p>
                )}
                {navItems
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const isActive = matchingItem?.path === item.path;
                    return (
                      <Link
                        key={item.name}
                        href={item.path}
                        onClick={() => setIsMobileOpen(false)}
                        title={isCollapsed && !isMobileOpen ? item.name : undefined}
                        className={`flex items-center transition-all group ${isCollapsed && !isMobileOpen
                            ? 'justify-center p-2 mx-auto w-9 h-9 xl:w-10 xl:h-10 rounded-md'
                            : 'justify-between px-3 py-2 rounded-md'
                          } text-xs xl:text-sm font-medium ${isActive
                            ? 'bg-amber-500 text-white font-medium'
                            : 'text-[#9a9a9a] hover:bg-neutral-900 hover:text-white'
                          }`}
                      >
                        <div
                          className={`flex items-center ${isCollapsed && !isMobileOpen ? 'justify-center' : 'space-x-2.5'
                            }`}
                        >
                          <i className={`${item.icon} text-base xl:text-lg`}></i>
                          {(!isCollapsed || isMobileOpen) && (
                            <span className="truncate">{item.name}</span>
                          )}
                        </div>
                        {isActive && (!isCollapsed || isMobileOpen) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 flex-shrink-0"></span>
                        )}
                      </Link>
                    );
                  })}
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
