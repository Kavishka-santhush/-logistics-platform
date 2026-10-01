import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as currency (defaults to EUR, matching the seed org). */
export function formatCurrency(value: number | string | null | undefined, currency = 'EUR') {
  const n = typeof value === 'string' ? parseFloat(value) : value ?? 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n || 0);
}

export function formatNumber(value: number | string | null | undefined, digits = 0) {
  const n = typeof value === 'string' ? parseFloat(value) : value ?? 0;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n || 0);
}

export function formatPercent(value: number | string | null | undefined, digits = 1) {
  const n = typeof value === 'string' ? parseFloat(value) : value ?? 0;
  return `${(n || 0).toFixed(digits)}%`;
}

/** Human label for SCREAMING_SNAKE enum values. */
export function humanize(value?: string | null) {
  if (!value) return '';
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function initials(name?: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  return `${base}${path}`;
}

/** Build a public tracking URL for a shipment. */
export function trackingUrl(trackingNumber: string) {
  return `/track/${trackingNumber}`;
}
