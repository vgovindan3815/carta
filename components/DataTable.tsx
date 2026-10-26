'use client';

import React, { useState } from 'react';
import { SkeletonTable } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string | number;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T extends { id?: string | number }> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  skeletonRows?: number;
  rowKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
  caption?: string;
}

type SortDir = 'asc' | 'desc';

export function DataTable<T extends { id?: string | number }>({
  columns,
  rows,
  loading,
  emptyTitle = 'No results',
  emptyDescription,
  emptyIcon = '📭',
  skeletonRows = 5,
  rowKey,
  onRowClick,
  caption,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey];
        const bv = (b as Record<string, unknown>)[sortKey];
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : rows;

  const thStyle = (col: Column<T>): React.CSSProperties => ({
    padding: '10px 14px',
    textAlign: col.align ?? 'left',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-secondary)',
    background: 'var(--surface-subtle)',
    borderBottom: '1px solid var(--border-default)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    cursor: col.sortable ? 'pointer' : 'default',
    width: col.width,
  });

  const tdStyle = (col: Column<T>): React.CSSProperties => ({
    padding: '11px 14px',
    textAlign: col.align ?? 'left',
    fontSize: 13,
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-default)',
    verticalAlign: 'middle',
  });

  if (loading) {
    return <SkeletonTable rows={skeletonRows} cols={columns.length} />;
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface-card)' }}
        aria-busy={loading}
      >
        {caption && <caption style={{ captionSide: 'top', padding: '10px 14px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'left' }}>{caption}</caption>}
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={String(col.key)}
                scope="col"
                style={thStyle(col)}
                onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                aria-sort={sortKey === String(col.key) ? (sortDir === 'asc' ? 'ascending' : 'descending') : col.sortable ? 'none' : undefined}
              >
                {col.label}
                {col.sortable && (
                  <span aria-hidden="true" style={{ marginLeft: 4, opacity: sortKey === String(col.key) ? 1 : 0.35 }}>
                    {sortKey === String(col.key) ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: 0 }}>
                <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} compact />
              </td>
            </tr>
          ) : sorted.map((row, i) => {
            const key = rowKey ? rowKey(row) : String(row.id ?? i);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(row); } : undefined}
                style={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (onRowClick) (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
              >
                {columns.map(col => (
                  <td key={String(col.key)} style={tdStyle(col)}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[String(col.key)] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
