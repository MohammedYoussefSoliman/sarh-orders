import { type ReactNode, useId } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

import { usePrefersReducedMotion } from '@/hooks';
import { cn } from '@/lib';

import { Button } from '../Button';
import { useModalBehavior } from '../Overlay';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

/**
 * Centred modal dialog (motion #2). Enter/exit animation is brief and disabled
 * under reduced-motion; focus is trapped and the background is made inert.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  const reduced = usePrefersReducedMotion();
  const { panelRef } = useModalBehavior({ open, onClose });
  const titleId = useId();
  const descId = useId();

  const duration = reduced ? 0 : 0.18;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={cn(
              'relative w-full rounded-2xl border border-divider bg-surface shadow-lg',
              'outline-none',
              SIZE[size],
            )}
            initial={reduced ? false : { opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration, ease: 'easeOut' }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-divider px-5 py-4">
              <div>
                <h2 id={titleId} className="text-base font-bold text-ink">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-[13px] text-ink-muted">
                    {description}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close dialog"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </header>
            {children && <div className="px-5 py-4">{children}</div>}
            {footer && (
              <footer className="flex justify-end gap-2 border-t border-divider px-5 py-3.5">
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
