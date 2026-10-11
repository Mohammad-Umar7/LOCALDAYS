import { create } from 'zustand';
import { uid } from '@/lib/utils';

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone?: 'default' | 'success' | 'warning';
  action?: { label: string; to: string };
}

interface UIState {
  cartOpen: boolean;
  demoOpen: boolean;
  authOpen: boolean;
  /** Pre-fills the create-account form (e.g. a guest who just booked) */
  authPrefill: { name: string; email: string } | null;
  toasts: Toast[];
  setCartOpen: (v: boolean) => void;
  setDemoOpen: (v: boolean) => void;
  setAuthOpen: (v: boolean, prefill?: { name: string; email: string }) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useUI = create<UIState>((set, get) => ({
  cartOpen: false,
  demoOpen: false,
  authOpen: false,
  authPrefill: null,
  toasts: [],
  setCartOpen: (v) => set({ cartOpen: v }),
  setDemoOpen: (v) => set({ demoOpen: v }),
  setAuthOpen: (v, prefill) => set({ authOpen: v, authPrefill: v ? prefill ?? null : null }),
  toast: (t) => {
    const id = uid('t');
    set({ toasts: [...get().toasts, { ...t, id }] });
    setTimeout(() => get().dismiss(id), 4800);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));
