'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SignedIn, UserButton } from '@clerk/nextjs';
import { Bell, Menu, Wifi, WifiOff } from 'lucide-react';
import { useNotifications } from '@/lib/queries';
import { useSocketStatus } from '@/lib/socket';
import { humanize } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: notifications } = useNotifications();
  const connected = useSocketStatus();
  const list = (notifications?.data ?? notifications ?? []) as any[];
  const unread = list.filter((n) => !n.isRead).slice(0, 8);

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu}>
          <Menu className="h-5 w-5" />
        </Button>
        <div
          className="hidden items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium sm:flex"
          title="Realtime connection"
        >
          {connected ? <Wifi className="h-3.5 w-3.5 text-success" /> : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="text-muted-foreground">{connected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
            <Bell className="h-5 w-5" />
            {unread.length > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unread.length}
              </span>
            )}
          </Button>
          {open && (
            <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-lg border bg-popover shadow-lg">
              <div className="border-b px-4 py-2 text-sm font-semibold">Notifications</div>
              <div className="max-h-96 overflow-y-auto scrollbar-thin">
                {unread.length === 0 && <p className="p-4 text-sm text-muted-foreground">You are all caught up.</p>}
                {unread.map((n) => (
                  <Link
                    key={n.id}
                    href="/dashboard/notifications"
                    onClick={() => setOpen(false)}
                    className="block border-b px-4 py-3 text-sm last:border-0 hover:bg-accent"
                  >
                    <span className="mb-0.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {humanize(n.type)}
                    </span>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted-foreground">{n.body}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <SignedIn>
          <UserButton afterSignOutUrl="/sign-in" appearance={{ variables: { colorPrimary: '#2563eb' } }} />
        </SignedIn>
      </div>
    </header>
  );
}
