'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '48px 24px', textAlign: 'center', gap: 16,
        }} role="alert">
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#1F3864' }}>Something went wrong</div>
          {this.state.error?.message && (
            <div style={{ fontSize: 13, color: '#6B7280', maxWidth: 420, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 16px' }}>
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleRetry}
            style={{ background: 'linear-gradient(135deg, #1F3864, #1C7293)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode,
) {
  const Wrapped = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `withErrorBoundary(${Component.displayName ?? Component.name})`;
  return Wrapped;
}
