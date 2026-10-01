import { create } from 'zustand';

export type ToastKind = 'info' | 'error' | 'success';

interface ToastState {
  id: number;
  message: string | null;
  kind: ToastKind;
  action?: { label: string; onPress: () => void };
  show: (message: string, kind?: ToastKind, action?: ToastState['action']) => void;
  hide: () => void;
}

export const useToast = create<ToastState>()((set, get) => ({
  id: 0,
  message: null,
  kind: 'info',
  show: (message, kind = 'info', action) => set({ id: get().id + 1, message, kind, action }),
  hide: () => set({ message: null, action: undefined }),
}));

export const toast = {
  info: (message: string, action?: ToastState['action']) => useToast.getState().show(message, 'info', action),
  error: (message: string, action?: ToastState['action']) => useToast.getState().show(message, 'error', action),
  success: (message: string) => useToast.getState().show(message, 'success'),
};
