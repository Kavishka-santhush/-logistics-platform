export function formatCurrency(value: number | string | null | undefined, currency = 'EUR'): string {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
}

export function humanize(s?: string | null): string {
  if (!s) return '';
  return s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
