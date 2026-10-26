'use client';

import React, { useId } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  helper?: string;
  required?: boolean;
  children?: React.ReactNode;
}

interface InputFieldProps extends FieldProps, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'> {
  as?: 'input';
}

interface TextareaFieldProps extends FieldProps, Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> {
  as: 'textarea';
}

type Props = InputFieldProps | TextareaFieldProps;

export function Field({ label, error, helper, required, children, ...rest }: Props) {
  const uid = useId();
  const inputId = `field-${uid}`;
  const errorId = `field-err-${uid}`;
  const helperId = `field-help-${uid}`;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: (rest as InputFieldProps).as === 'textarea' ? undefined : 44,
    minHeight: (rest as InputFieldProps).as === 'textarea' ? 112 : undefined,
    padding: '0 12px',
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
    border: `1px solid ${error ? 'var(--mkp-red-600)' : 'var(--border-default)'}`,
    borderRadius: 'var(--radius-sm)',
    fontSize: 14,
    fontFamily: 'var(--font-body)',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    resize: (rest as InputFieldProps).as === 'textarea' ? 'vertical' : undefined,
  };

  const describedBy = [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label
        htmlFor={inputId}
        style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: '18px' }}
      >
        {label}
        {required && <span aria-hidden="true" style={{ color: 'var(--mkp-red-600)', marginLeft: 3 }}>*</span>}
      </label>

      {children
        ? React.cloneElement(children as React.ReactElement, {
            id: inputId,
            'aria-required': required,
            'aria-invalid': !!error,
            'aria-describedby': describedBy,
            style: { ...inputStyle, ...((children as React.ReactElement).props.style ?? {}) },
            onFocus: (e: React.FocusEvent<HTMLElement>) => {
              (e.target as HTMLElement).style.borderColor = 'var(--mkp-blue-600)';
              (e.target as HTMLElement).style.boxShadow = 'var(--focus-ring)';
            },
            onBlur: (e: React.FocusEvent<HTMLElement>) => {
              (e.target as HTMLElement).style.borderColor = error ? 'var(--mkp-red-600)' : 'var(--border-default)';
              (e.target as HTMLElement).style.boxShadow = 'none';
            },
          })
        : (rest as InputFieldProps).as === 'textarea'
        ? (
          <textarea
            id={inputId}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            style={{ ...inputStyle, padding: '10px 12px' }}
            onFocus={e => { e.target.style.borderColor = 'var(--mkp-blue-600)'; e.target.style.boxShadow = 'var(--focus-ring)'; }}
            onBlur={e => { e.target.style.borderColor = error ? 'var(--mkp-red-600)' : 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
            {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={inputId}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = 'var(--mkp-blue-600)'; e.target.style.boxShadow = 'var(--focus-ring)'; }}
            onBlur={e => { e.target.style.borderColor = error ? 'var(--mkp-red-600)' : 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
            {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        )
      }

      {error && (
        <span id={errorId} role="alert" style={{ fontSize: 12, color: 'var(--mkp-red-600)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span aria-hidden="true">⚠</span> {error}
        </span>
      )}
      {!error && helper && (
        <span id={helperId} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{helper}</span>
      )}
    </div>
  );
}

/** Password field with show/hide toggle */
export function SecretField({ label, error, helper, required, ...rest }: Omit<InputFieldProps, 'as' | 'type'>) {
  const [show, setShow] = React.useState(false);
  return (
    <Field label={label} error={error} helper={helper} required={required}>
      <div style={{ position: 'relative', display: 'flex' }}>
        <input
          type={show ? 'text' : 'password'}
          style={{ paddingRight: 44 }}
          {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        />
        <button
          type="button"
          aria-label={show ? 'Hide' : 'Show'}
          onClick={() => setShow(v => !v)}
          style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 14, padding: 4,
            minWidth: 40, minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </Field>
  );
}
