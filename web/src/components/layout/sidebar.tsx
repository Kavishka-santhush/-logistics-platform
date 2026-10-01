'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { filterNav, NAV_SECTIONS } from '@/components/layout/nav';
import { useOrgRole } from '@/lib/use-org-role';
import { Truck } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useOrgRole();
  const sections = filterNav(NAV_SECTIONS, role);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Truck className="h-5 w-5" />
        </div>
        <span className="font-semibold">SwiftFreight</span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto p-3 scrollbar-thin">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active =
                  item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
