'use client';

import React, { useEffect, useRef } from 'react';
import Portal from './Portal';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width class for the dialog panel. Defaults to a medium modal. */
  maxWidthClassName?: string;
  labelledBy?: string;
  describedBy?: string;
  /** Set false to disable closing on backdrop click (e.g. mid-submit). */
  closeOnBackdrop?: boolean;
}

/**
 * Generic modal shell providing the Escape-to-close + backdrop-click-to-close
 * + focus-on-open behavior that ConfirmModal already implements, so ad-hoc
 * modals across the app can share one accessible base instead of
 * hand-rolling their own backdrop/dialog markup.
 */
export default function Modal({
  isOpen,
  onClose,
  children,
  maxWidthClassName = 'max-w-md',
  labelledBy,
  describedBy,
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const hasFocusedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        const frame = requestAnimationFrame(() => {
          if (!panelRef.current?.contains(document.activeElement)) {
            // Prioritize input or textarea first, then other focusable elements
            const inputElement = panelRef.current?.querySelector<HTMLElement>(
              'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
            );
            const fallbackElement = panelRef.current?.querySelector<HTMLElement>(
              'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
            );
            (inputElement || fallbackElement)?.focus();
          }
        });
        return () => cancelAnimationFrame(frame);
      }
    } else {
      hasFocusedRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          ref={panelRef}
          className={`bg-white border border-neutral-200 rounded-md w-full shadow-lg pointer-events-auto ${maxWidthClassName}`}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
