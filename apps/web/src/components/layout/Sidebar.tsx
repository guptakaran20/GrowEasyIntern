'use client';

import {
  LayoutDashboard,
  Users,
  Upload,
  Settings,
  BarChart3,
  Building2,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    label: 'Main',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', active: false, disabled: true },
      { icon: Users, label: 'Manage Leads', active: true, disabled: false },
      { icon: Building2, label: 'Properties', active: false, disabled: true },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { icon: BarChart3, label: 'Reports', active: false, disabled: true },
    ],
  },
  {
    label: 'Settings',
    items: [
      { icon: Settings, label: 'Settings', active: false, disabled: true },
    ],
  },
];

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500">
          <span className="text-sm font-bold text-white">G</span>
        </div>
        <span className="text-lg font-semibold text-slate-900">Importlyai</span>
      </div>

      {/* Workspace card */}
      <div className="border-b border-slate-200 px-4 py-3">
        <button className="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left hover:bg-slate-50">
          <div>
            <p className="text-xs text-slate-500">Workspace</p>
            <p className="text-sm font-medium text-slate-900">Importlyai CRM</p>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-slate-400">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.label}>
                  <button
                    disabled={item.disabled}
                    title={item.disabled ? "Coming soon" : ""}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      item.active
                        ? 'bg-teal-50 font-medium text-teal-700'
                        : item.disabled
                        ? 'text-slate-400 opacity-60 cursor-not-allowed'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed left-4 top-4 z-50 rounded-lg border border-slate-200 bg-white p-2 shadow-sm lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-slate-50 transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

export function PageHeader({ onImportClick }: { onImportClick: () => void }) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Manage Leads</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Import and manage your lead data
        </p>
      </div>
      <button className="btn-primary" onClick={onImportClick}>
        <Upload className="h-4 w-4" />
        Import CSV
      </button>
    </div>
  );
}
