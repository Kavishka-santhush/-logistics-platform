// Central design tokens for the driver app.
export const theme = {
  colors: {
    primary: '#2563eb',
    primaryDark: '#1d4ed8',
    bg: '#f8fafc',
    card: '#ffffff',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#dc2626',
    info: '#0ea5e9',
  },
  radius: 12,
  gap: 12,
} as const;

// Map order status -> token color used for pills/badges.
export const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#64748b',
  CONFIRMED: '#0ea5e9',
  ASSIGNED: '#2563eb',
  PICKED_UP: '#0ea5e9',
  IN_TRANSIT: '#2563eb',
  OUT_FOR_DELIVERY: '#f59e0b',
  DELIVERED: '#16a34a',
  FAILED: '#dc2626',
  RETURNED: '#f59e0b',
  CANCELLED: '#64748b',
};
