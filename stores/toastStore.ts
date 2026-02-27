import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(7);
    const toast: Toast = { id, message, type, duration };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export const useToast = () => {
  const { addToast, removeToast } = useToastStore();

  return {
    toast: (message: string, type?: Toast['type'], duration?: number) => {
      addToast(message, type, duration);
    },
    success: (message: string, duration?: number) => {
      addToast(message, 'success', duration);
    },
    error: (message: string, duration?: number) => {
      addToast(message, 'error', duration);
    },
    info: (message: string, duration?: number) => {
      addToast(message, 'info', duration);
    },
    warning: (message: string, duration?: number) => {
      addToast(message, 'warning', duration);
    },
    remove: removeToast,
  };
};
