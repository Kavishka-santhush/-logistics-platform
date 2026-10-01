'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingRows, EmptyState } from '@/components/shared';
import { cn } from '@/lib/utils';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  accessor?: (row: T) => string | number | null; // for sorting/search
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  searchable = true,
  searchPlaceholder = 'Search…',
  onRowClick,
  pageSize = 15,
  emptyTitle = 'No records',
  toolbar,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  emptyTitle?: string;
  toolbar?: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const data = rows ?? [];

  const filtered = useMemo(() => {
    let out = data;
    if (q.trim()) {
      const needle = q.toLowerCase();
      out = out.filter((row) =>
        columns.some((c) => {
          const val = c.accessor ? c.accessor(row) : (row as any)[c.key];
          return val != null && String(val).toLowerCase().includes(needle);
        })
      );
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      out = [...out].sort((a, b) => {
        const av = col?.accessor ? col.accessor(a) : (a as any)[sort.key];
        const bv = col?.accessor ? col.accessor(b) : (b as any)[sort.key];
        return (String(av) > String(bv) ? 1 : -1) * sort.dir;
      });
    }
    return out;
  }, [data, q, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, page * pageSize + pageSize);

  if (loading) return <LoadingRows />;
  if (!data.length) return <EmptyState title={emptyTitle} icon={Search} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {searchable && (
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={searchPlaceholder} className="pl-9" />
          </div>
        )}
        <div className="ml-auto">{toolbar}</div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(c.sortable && 'cursor-pointer select-none', c.className)}
                  onClick={() => c.sortable && setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={row.id} className={cn(onRowClick && 'cursor-pointer')} onClick={() => onRowClick?.(row)}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.className}>
                    {c.render ? c.render(row) : String((row as any)[c.key] ?? '—')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>Page {page + 1} of {pageCount}</span>
          <Button variant="outline" size="icon" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
