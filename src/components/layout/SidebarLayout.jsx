"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SidebarLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const navItems = useMemo(
    () => [
      { label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
      { label: "Tasks", href: "/dashboard/tasks", icon: TasksIcon },
      { label: "Projects", href: "/projects", icon: ProjectsIcon },
      { label: "Schedule", href: "/schedule", icon: ScheduleIcon },
      { label: "Report", href: "/report", icon: ReportIcon },
    ],
    []
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside
        className={`${collapsed ? "w-16" : "w-64"} bg-white border-r border-gray-200 transition-all duration-200 flex flex-col`}
      >
        <div className="h-14 border-b border-gray-200 flex items-center justify-between px-3">
          {!collapsed && (
            <span className="font-semibold text-gray-900">Menu</span>
          )}
          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((c) => !c)}
            className="p-2 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <HamburgerIcon collapsed={collapsed} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-1">
            {navItems.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`group flex items-center ${collapsed ? "justify-center" : "px-3"} h-10 mx-2 rounded transition-colors ${
                      active
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                    title={collapsed ? label : undefined}
                  >
                    <Icon className={`w-5 h-5 ${collapsed ? "" : "mr-3"}`} />
                    {!collapsed && <span className="text-sm font-medium">{label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 text-xs text-gray-400 border-t border-gray-100">
          {!collapsed && <span>© {new Date().getFullYear()}</span>}
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}

function HamburgerIcon({ collapsed }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-600 transition-transform ${collapsed ? "rotate-180" : "rotate-0"}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function DashboardIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
    </svg>
  );
}

function TasksIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ProjectsIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
    </svg>
  );
}

function ScheduleIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  );
}

function ReportIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6a2 2 0 00-2-2H5m8 8V7a2 2 0 012-2h2m-6 12H5a2 2 0 01-2-2V7a2 2 0 012-2h2m10 4h2m-2 4h2" />
    </svg>
  );
}


