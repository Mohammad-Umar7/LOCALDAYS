import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

/** Right-side drawer on desktop, bottom sheet on mobile. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  width = 460,
  side = 'right',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  side?: 'right' | 'left';
}) {
  useLockScroll(open);
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <motion.div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            className={cn(
              'absolute bottom-0 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-paper shadow-float',
              'md:top-0 md:max-h-none md:rounded-none',
              side === 'right' ? 'md:right-0 md:rounded-l-[28px]' : 'md:left-0 md:rounded-r-[28px]',
            )}
            style={{ maxWidth: typeof window !== 'undefined' && window.innerWidth >= 768 ? width : undefined }}
            initial={{ y: '100%', x: 0 }}
            animate={{ y: 0, x: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-ink/15 md:hidden" />
            <div className="flex items-center justify-between gap-4 px-6 pb-3 pt-4 md:pt-6">
              <div className="font-display text-[22px] tracking-tight text-ink">{title}</div>
              <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink transition hover:bg-ink/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="thin-scrollbar flex-1 overflow-y-auto px-6 pb-6">{children}</div>
            {footer && <div className="border-t border-line bg-white/70 px-6 py-4 backdrop-blur">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Modal({
  open,
  onClose,
  children,
  className,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  dismissable?: boolean;
}) {
  useLockScroll(open);
  useEscape(open && dismissable, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismissable ? onClose : undefined}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn('relative max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-paper shadow-float sm:max-w-lg sm:rounded-[28px]', className)}
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
          >
            {dismissable && (
              <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink transition hover:bg-ink/10">
                <X className="h-4 w-4" />
              </button>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
