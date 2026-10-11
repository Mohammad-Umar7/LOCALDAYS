import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUI } from '@/store/ui';

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink p-4 text-paper shadow-float"
          >
            <span className="mt-0.5">
              {t.tone === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              ) : t.tone === 'warning' ? (
                <TriangleAlert className="h-5 w-5 text-honey-300" />
              ) : (
                <Info className="h-5 w-5 text-sand-300" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">{t.title}</div>
              {t.body && <div className="mt-0.5 text-[13px] text-paper/70">{t.body}</div>}
              {t.action && (
                <Link to={t.action.to} onClick={() => dismiss(t.id)} className="mt-2 inline-block text-[13px] font-semibold text-honey-300 underline-offset-4 hover:underline">
                  {t.action.label}
                </Link>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-paper/50 hover:text-paper">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
