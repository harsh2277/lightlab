'use client';

import React, { useEffect, useRef, useState } from 'react';
import Portal from './Portal';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isBusy = loading || isProcessing;

  useEffect(() => {
    if (isOpen) setIsProcessing(false);
  }, [isOpen]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus trap + ESC close
  useEffect(() => {
    if (!isOpen) return;

    // Focus cancel button on open (safer default for destructive actions)
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmBtnClass = variant === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700 text-white focus-visible:outline-rose-500'
    : 'bg-amber-500 hover:bg-amber-600 text-white focus-visible:outline-amber-500';

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-white border border-neutral-200 rounded-md max-w-sm w-full p-6 shadow-lg pointer-events-auto">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            {variant === 'danger' && (
              <div className="w-9 h-9 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
                <i className="bx bx-trash text-rose-600 text-base" />
              </div>
            )}
            <div>
              <h2 id="confirm-modal-title" className="text-base font-semibold text-neutral-900">
                {title}
              </h2>
              <p id="confirm-modal-desc" className="text-sm text-neutral-500 mt-1 leading-snug">
                {message}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              ref={cancelRef}
              onClick={onClose}
              disabled={isBusy}
              className="px-4 py-2 text-sm font-medium bg-white border border-neutral-200 text-neutral-700 rounded-md hover:bg-neutral-50 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={async () => {
                setIsProcessing(true);
                try {
                  await onConfirm();
                } finally {
                  setIsProcessing(false);
                  onClose();
                }
              }}
              disabled={isBusy}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus-visible:outline focus-visible:outline-2 disabled:opacity-50 flex items-center gap-1.5 ${confirmBtnClass}`}
            >
              {isBusy && (
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
