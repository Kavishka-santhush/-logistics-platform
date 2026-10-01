'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNotifications, useMarkNotificationRead } from '@/lib/queries';
import { useSocketEvent } from '@/lib/socket';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/types';
import { useState } from 'react';

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [extra, setExtra] = useState<NotificationItem[]>([]);

  const server: NotificationItem[] = (data as any)?.data ?? (Array.isArray(data) ? data : []);
  const rows = [...extra, ...server];

  // Live push from the server.
  useSocketEvent<NotificationItem>('notification', (n) => {
    if (n?.id) setExtra((prev) => [n, ...prev]);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${rows.filter((r) => !r.isRead).length} unread`}
        actions={<Badge variant={rows.some((r) => !r.isRead) ? 'warning' : 'muted'}><Bell className="mr-1 h-3 w-3" />{rows.length} total</Badge>}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No notifications" icon={Bell} />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {rows.map((n) => (
              <div key={n.id} className={cn('flex items-start justify-between gap-4 p-4', !n.isRead && 'bg-accent/40')}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{n.title}</p>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()} · {n.channel}</p>
                </div>
                {!n.isRead && (
                  <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}><CheckCheck className="mr-1 h-3.5 w-3.5" />Mark read</Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
