import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  subMessage?: string;
  type: ToastType;
  imageUrl?: string;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, opts?: { subMessage?: string; type?: ToastType; imageUrl?: string }) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timerRef.current[id]);
    delete timerRef.current[id];
  }, []);

  const showToast = useCallback(
    (
      message: string,
      opts?: { subMessage?: string; type?: ToastType; imageUrl?: string },
    ) => {
      const id = `${Date.now()}-${Math.random()}`;
      const toast: Toast = {
        id,
        message,
        subMessage: opts?.subMessage,
        type: opts?.type ?? 'success',
        imageUrl: opts?.imageUrl,
      };

      setToasts((prev) => [toast, ...prev].slice(0, 4)); // Max 4 toasts

      // Auto-dismiss after 3.5 seconds
      timerRef.current[id] = setTimeout(() => removeToast(id), 3500);
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
