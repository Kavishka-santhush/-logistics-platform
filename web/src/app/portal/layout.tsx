'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignOutButton } from '@clerk/nextjs';
import { LayoutDashboard, Package, ReceiptText, LogOut, Ship } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/portal', label: 'Overview', icon: LayoutDashboard },
  { href: '/portal/orders', label: 'My Orders', icon: Package },
  { href: '/portal/invoices', label: 'Invoices', icon: ReceiptText },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/portal" className="flex items-center gap-2 font-bold"><Ship className="h-5 w-5 text-primary" /> Client Portal</Link>
          <nav className="flex items-center gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors', pathname === l.href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
              >
                <l.icon className="h-4 w-4" /> <span className="hidden sm:inline">{l.label}</span>
              </Link>
            ))}
            <SignOutButton redirectUrl="/">
              <button className="ml-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"><LogOut className="h-4 w-4" /></button>
            </SignOutButton>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
