import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? 'var(--space-8) var(--space-6)' : 'var(--space-12) var(--space-8)',
        textAlign: 'center',
        gap: 'var(--space-3)',
      }}
      role="status"
      aria-live="polite"
    >
      {icon && (
        <div style={{ fontSize: compact ? 32 : 48, lineHeight: 1, marginBottom: 'var(--space-2)' }} aria-hidden="true">
          {icon}
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: compact ? 15 : 17, color: 'var(--text-primary)' }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.6 }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
    </div>
  );
}
