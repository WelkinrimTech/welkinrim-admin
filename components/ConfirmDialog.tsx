'use client';

import { useState, useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmType?: 'danger' | 'warning' | 'primary';
  requireTyping?: string; // Text user must type to confirm
  isLoading?: boolean; // Show loading state
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmType = 'danger',
  requireTyping,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typedText, setTypedText] = useState('');
  const [wasOpen, setWasOpen] = useState(isOpen);
  const isConfirmEnabled = requireTyping ? typedText.trim() === requireTyping.trim() : true;

  // Reset typed text when the dialog closes (adjust state during render, not in an effect)
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setTypedText('');
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="confirm-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-header">
          <h3 className="confirm-title">{title}</h3>
          <button type="button" className="confirm-close" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className="confirm-body">
          <p className="confirm-message">{message}</p>

          {requireTyping && (
            <div className="confirm-input-group">
              <label htmlFor="confirm-input" className="confirm-label">
                Type <strong>{requireTyping}</strong> to confirm
              </label>
              <input
                id="confirm-input"
                type="text"
                className="confirm-input"
                value={typedText}
                onChange={e => setTypedText(e.target.value)}
                placeholder={`Type "${requireTyping}"`}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="confirm-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn btn-${confirmType}`}
            onClick={onConfirm}
            disabled={!isConfirmEnabled || isLoading}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(14, 14, 15, 0.7);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
        }

        .confirm-dialog {
          background: var(--color-white-pure, #fff);
          border-radius: 8px;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }

        .confirm-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--color-white-border, #e5e5e5);
        }

        .confirm-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin: 0;
          color: var(--color-ink, #0e0e0f);
        }

        .confirm-close {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--color-ink-soft, #666);
          font-size: 24px;
          line-height: 1;
          border-radius: 4px;
          transition: all 150ms ease;
        }
        .confirm-close:hover {
          background: var(--color-white-grey, #f5f5f5);
          color: var(--color-ink, #0e0e0f);
        }

        .confirm-body {
          padding: 24px;
        }

        .confirm-message {
          font-family: var(--font-body);
          font-size: 14px;
          line-height: 1.6;
          color: var(--color-ink, #0e0e0f);
          margin: 0 0 16px 0;
        }

        .confirm-input-group {
          margin-top: 16px;
        }

        .confirm-label {
          display: block;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--color-ink-soft, #666);
          margin-bottom: 8px;
        }

        .confirm-label strong {
          color: var(--color-error, #e53e3e);
          font-weight: 700;
        }

        .confirm-input {
          width: 100%;
          padding: 10px 12px;
          font-family: var(--font-mono);
          font-size: 13px;
          border: 1px solid var(--color-white-border, #e5e5e5);
          border-radius: 4px;
          background: var(--color-white-pure, #fff);
          color: var(--color-ink, #0e0e0f);
          transition: border-color 150ms ease;
        }
        .confirm-input:focus {
          outline: none;
          border-color: var(--color-gold, #ffd700);
          box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.2);
        }

        .confirm-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 24px;
          border-top: 1px solid var(--color-white-border, #e5e5e5);
          background: var(--color-white-warm, #fafafa);
        }

        .btn {
          padding: 10px 20px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-radius: 4px;
          cursor: pointer;
          transition: all 150ms ease;
          border: 1px solid transparent;
        }

        .btn-secondary {
          background: var(--color-white-pure, #fff);
          border-color: var(--color-white-border, #e5e5e5);
          color: var(--color-ink, #0e0e0f);
        }
        .btn-secondary:hover {
          background: var(--color-white-grey, #f5f5f5);
        }

        .btn-danger {
          background: var(--color-error, #e53e3e);
          border-color: var(--color-error, #e53e3e);
          color: white;
        }
        .btn-danger:hover:not(:disabled) {
          background: color-mix(in srgb, var(--color-error, #e53e3e) 85%, black);
        }
        .btn-danger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-warning {
          background: var(--color-warning, #ed8936);
          border-color: var(--color-warning, #ed8936);
          color: white;
        }
        .btn-warning:hover:not(:disabled) {
          background: color-mix(in srgb, var(--color-warning, #ed8936) 85%, black);
        }
        .btn-warning:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--color-gold, #ffd700);
          border-color: var(--color-gold, #ffd700);
          color: var(--color-ink, #0e0e0f);
        }
        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.1);
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
