import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/* Maps domain status strings to a colored badge. */

const ORDER_STATUS: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'muted' | 'default'> = {
  DRAFT: 'muted',
  CONFIRMED: 'info',
  ASSIGNED: 'secondary' as any,
  PICKED_UP: 'info',
  IN_TRANSIT: 'info',
  OUT_FOR_DELIVERY: 'warning',
  DELIVERED: 'success',
  FAILED: 'destructive',
  RETURNED: 'warning',
  CANCELLED: 'muted',
};

const VEHICLE_STATUS: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'muted'> = {
  AVAILABLE: 'success',
  ON_DELIVERY: 'info',
  UNDER_MAINTENANCE: 'warning',
  OUT_OF_SERVICE: 'destructive',
  RETIRED: 'muted',
};

const DRIVER_STATUS: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'muted'> = {
  AVAILABLE: 'success',
  ON_DELIVERY: 'info',
  OFF_DUTY: 'muted',
  ON_LEAVE: 'warning',
  SUSPENDED: 'destructive',
};

const INVOICE_STATUS: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'muted'> = {
  DRAFT: 'muted',
  SENT: 'info',
  PAID: 'success',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'destructive',
  CANCELLED: 'muted',
};

const DOC_STATUS: Record<string, 'success' | 'info' | 'warning' | 'destructive' | 'muted'> = {
  APPROVED: 'success',
  PENDING_REVIEW: 'warning',
  REJECTED: 'destructive',
  EXPIRED: 'destructive',
};

const MAPS = {
  order: ORDER_STATUS,
  vehicle: VEHICLE_STATUS,
  driver: DRIVER_STATUS,
  invoice: INVOICE_STATUS,
  document: DOC_STATUS,
} as const;

export function StatusBadge({
  status,
  kind = 'order',
  className,
}: {
  status?: string | null;
  kind?: keyof typeof MAPS;
  className?: string;
}) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const variant = MAPS[kind][status] ?? 'secondary';
  const label = status.replace(/_/g, ' ');
  return (
    <Badge variant={variant as any} className={cn('capitalize', className)}>
      {label}
    </Badge>
  );
}
