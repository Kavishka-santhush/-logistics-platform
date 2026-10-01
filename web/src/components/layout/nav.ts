import {
  LayoutDashboard, Truck, Users, Package, MapPin, Radar, Warehouse, Boxes,
  Wrench, Fuel, ShieldCheck, Building2, ReceiptText, BarChart3, Sparkles,
  Settings, Bell, type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/types';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[]; // omitted = all authenticated internal roles
  superAdminOnly?: boolean;
}

const INTERNAL: Role[] = ['ORG_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'WAREHOUSE_MANAGER', 'COMPLIANCE_OFFICER', 'FINANCE_MANAGER'];

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/dashboard/live', label: 'Live Tracking', icon: Radar },
      { href: '/dashboard/dispatch', label: 'Dispatch Board', icon: MapPin },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/dashboard/orders', label: 'Orders', icon: Package, roles: ['ORG_ADMIN', 'OPS_MANAGER', 'DISPATCHER'] },
      { href: '/dashboard/fleet', label: 'Fleet', icon: Truck },
      { href: '/dashboard/drivers', label: 'Drivers', icon: Users },
      { href: '/dashboard/warehouses', label: 'Warehouses', icon: Warehouse, roles: ['ORG_ADMIN', 'WAREHOUSE_MANAGER', 'OPS_MANAGER'] },
      { href: '/dashboard/inventory', label: 'Inventory', icon: Boxes, roles: ['ORG_ADMIN', 'WAREHOUSE_MANAGER'] },
    ],
  },
  {
    title: 'Vehicle Lifecycle',
    items: [
      { href: '/dashboard/maintenance', label: 'Maintenance', icon: Wrench },
      { href: '/dashboard/fuel', label: 'Fuel', icon: Fuel },
      { href: '/dashboard/compliance', label: 'Compliance', icon: ShieldCheck, roles: ['ORG_ADMIN', 'COMPLIANCE_OFFICER'] },
    ],
  },
  {
    title: 'Commercial',
    items: [
      { href: '/dashboard/customers', label: 'Customers', icon: Building2, roles: ['ORG_ADMIN', 'OPS_MANAGER', 'FINANCE_MANAGER'] },
      { href: '/dashboard/invoices', label: 'Invoices', icon: ReceiptText, roles: ['ORG_ADMIN', 'FINANCE_MANAGER'] },
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/dashboard/ai', label: 'AI Insights', icon: Sparkles, roles: ['ORG_ADMIN', 'OPS_MANAGER', 'FINANCE_MANAGER'] },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
      { href: '/dashboard/admin', label: 'Platform Admin', icon: ShieldCheck, superAdminOnly: true },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function filterNav(sections: typeof NAV_SECTIONS, role: Role | undefined) {
  if (!role) return [];
  return sections
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        if (i.superAdminOnly) return role === 'SUPER_ADMIN';
        if (role === 'SUPER_ADMIN' && !INTERNAL.includes('SUPER_ADMIN')) return !i.roles; // super admin sees internal
        if (i.roles) return i.roles.includes(role);
        return true;
      }),
    }))
    .filter((s) => s.items.length > 0);
}
