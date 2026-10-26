'use client';

import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 4, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
      <Skeleton width={100} height={14} borderRadius={3} />
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <Skeleton key={i} width={`${Math.floor(60 + Math.random() * 40)}%`} height={14} borderRadius={3} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div>
      <style>{`@keyframes skeleton-pulse{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div style={{ background: '#fff', border: '1.5px solid #E5E7EB', borderRadius: 10, padding: 20 }}>
      <style>{`@keyframes skeleton-pulse{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <Skeleton width="60%" height={18} borderRadius={4} style={{ marginBottom: 10 }} />
      <Skeleton width="100%" height={12} borderRadius={3} style={{ marginBottom: 6 }} />
      <Skeleton width="80%" height={12} borderRadius={3} />
    </div>
  );
}
