'use client';

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export interface NotificationItem {
  id: number | string;
  title: string;
  time: string;
  read: boolean;
  icon: string;
  color: string;
}

interface TopbarProps {
  portalName: string;
  activeTab: string;
  /** Optional additional breadcrumb segments rendered after activeTab,
   * e.g. ['Modern Penthouse', 'Overview'] to show
   * "Portal > Section > Modern Penthouse > Overview". */
  breadcrumbExtra?: string[];
  isCollapsed: boolean;
  isMobileOpen: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  setIsMobileOpen: (open: boolean) => void;
  profile: { name: string; email: string } | null;
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  handleSignOut: () => void;
  notificationsBasePath?: string;
  profileHref?: string;
  showQuickSearch?: boolean;
}

export default function Topbar({
  portalName,
  activeTab,
  breadcrumbExtra = [],
  isCollapsed,
  isMobileOpen,
  setIsCollapsed,
  setIsMobileOpen,
  profile,
  notifications,
  setNotifications,
  handleSignOut,
  notificationsBasePath = '/admin/notifications',
  profileHref,
  showQuickSearch = true,
}: TopbarProps) {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const targetProfileHref = profileHref || `/${portalName.toLowerCase()}/profile`;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-12 md:h-14 bg-white border-b border-neutral-100 px-4 flex items-center justify-between flex-shrink-0">
      {/* Breadcrumbs & Sidebar Toggle */}
      <div className="flex items-center space-x-1.5 text-xs font-medium text-neutral-400 min-w-0">
        <button
          onClick={() => {
            if (window.innerWidth < 768) {
              setIsMobileOpen(!isMobileOpen);
            } else {
              setIsCollapsed(!isCollapsed);
            }
          }}
          className="p-1.5 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-950 rounded-md transition-colors mr-1 cursor-pointer flex items-center flex-shrink-0"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <i className={`bx ${isCollapsed ? 'bx-menu' : 'bx-menu-alt-left'} text-lg`}></i>
        </button>
        <span className="hidden sm:inline truncate">{portalName}</span>
        <i className="bx bx-chevron-right text-xs hidden sm:inline flex-shrink-0"></i>
        {breadcrumbExtra.length > 0 ? (
          <span className="hidden sm:inline truncate max-w-[160px]">{activeTab}</span>
        ) : (
          <span className="text-neutral-800 font-medium truncate max-w-[120px] sm:max-w-[200px] xl:max-w-none">
            {activeTab}
          </span>
        )}
        {breadcrumbExtra.map((segment, idx) => (
          <span key={`${segment}-${idx}`} className="hidden sm:flex items-center space-x-1.5 min-w-0">
            <i className="bx bx-chevron-right text-xs flex-shrink-0"></i>
            <span
              className={`truncate ${idx === breadcrumbExtra.length - 1
                  ? 'text-neutral-800 font-medium max-w-[120px] sm:max-w-[200px] xl:max-w-none'
                  : 'max-w-[140px]'
                }`}
            >
              {segment}
            </span>
          </span>
        ))}
      </div>

      {/* Ctrl+K Search Hint */}
      {showQuickSearch && (
        <button
          onClick={() =>
            document.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
            )
          }
          className="hidden md:flex items-center justify-between w-[324px] px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md text-xs text-neutral-400 font-medium hover:border-amber-400 hover:text-neutral-600 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <i className="bx bx-search text-sm" />
            <span>Quick search...</span>
          </div>
          <kbd className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded text-[10px] font-medium">
            Ctrl K
          </kbd>
        </button>
      )}

      {/* Right controls */}
      <div className="flex items-center space-x-2 xl:space-x-4 flex-shrink-0">
        {/* Notification Dropdown Container */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={notifications.some((n) => !n.read) ? 'Notifications (unread)' : 'Notifications'}
            className="relative p-1.5 hover:bg-neutral-100 rounded-md cursor-pointer transition-colors flex items-center justify-center text-neutral-600 focus:outline-none"
          >
            <i className="bx bx-bell text-lg" aria-hidden="true"></i>
            {notifications.some((n) => !n.read) && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" aria-hidden="true"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-md py-1 z-50 text-neutral-800 font-sans shadow-lg select-none">
              <div className="px-4 py-2.5 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                <span className="text-xs font-semibold text-neutral-800">Notifications</span>
                <button
                  onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                  className="text-xs text-amber-600 hover:text-amber-700 transition-colors font-medium cursor-pointer"
                >
                  Mark all as read
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-neutral-100">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      setNotifications((prev) =>
                        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
                      );
                      setShowNotifications(false);
                      if (notificationsBasePath) {
                        router.push(notificationsBasePath);
                      }
                    }}
                    className={`p-3 flex items-start space-x-3 hover:bg-neutral-50 cursor-pointer transition-colors ${
                      !notif.read ? 'bg-amber-50/5' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${notif.color}`}
                    >
                      <i className={`bx ${notif.icon} text-sm`}></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs leading-normal ${
                          !notif.read
                            ? 'text-neutral-900 font-medium'
                            : 'text-neutral-600 font-normal'
                        }`}
                      >
                        {notif.title}
                      </p>
                      <span className="text-xs text-neutral-400 font-medium mt-1 block">
                        {notif.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar & Dropdown Menu */}
        <div className="relative" ref={profileDropdownRef}>
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="flex items-center space-x-2 p-1 hover:bg-neutral-100 rounded-md cursor-pointer transition-colors text-left focus:outline-none"
          >
            <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-full bg-neutral-900 text-white font-medium text-xs flex items-center justify-center border border-neutral-700 shrink-0">
              {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden xl:block min-w-0">
              <span className="text-xs font-semibold text-neutral-900 block truncate">
                {profile?.name || 'User'}
              </span>
              <span className="text-[10px] text-neutral-400 block truncate">
                {profile?.email || ''}
              </span>
            </div>
            <i className="bx bx-chevron-down text-neutral-400 text-xs hidden xl:block"></i>
          </button>

          {showProfileDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-md py-1.5 z-50 text-neutral-800 font-sans shadow-lg">
              <div className="px-4 py-2 border-b border-neutral-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-900 truncate">
                    {profile?.name || 'User'}
                  </p>
                  <span className="text-[10px] font-medium bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                    {portalName}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 truncate">{profile?.email || ''}</p>
              </div>

              <div className="py-1 border-b border-neutral-100">
                <Link
                  href={targetProfileHref}
                  onClick={() => setShowProfileDropdown(false)}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors flex items-center space-x-2 cursor-pointer"
                >
                  <i className="bx bx-user text-sm text-neutral-500"></i>
                  <span>Profile</span>
                </Link>
              </div>

              <div className="py-1">
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors flex items-center space-x-2 cursor-pointer"
                >
                  <i className="bx bx-log-out text-sm"></i>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
