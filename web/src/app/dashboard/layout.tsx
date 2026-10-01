'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { NAV_SECTIONS, filterNav } from '@/components/layout/nav';
import { useOrgRole } from '@/lib/use-org-role';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role } = useOrgRole();
  const sections = filterNav(NAV_SECTIONS, role);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r bg-card p-3">
            {sections.map((s) => (
              <div key={s.title} className="mb-4">
                <p className="px-3 pb-1 text-xs font-semibold uppercase text-muted-foreground">{s.title}</p>
                {s.items.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent')}
                  >
                    <i.icon className="h-4 w-4" /> {i.label}
                  </Link>
                ))}
              </div>
            ))}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden bg-muted/30 p-4 md:p-6">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
