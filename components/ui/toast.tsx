"use client";

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";

type ToastTone = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (toast: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Call `notify()` from any client component inside the provider. */
export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return value;
}

const toneIcon: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
};

const toneClass: Record<ToastTone, string> = {
  success: "text-(--color-success-700)",
  error: "text-(--color-danger-700)",
  warning: "text-(--color-slate-700)",
  info: "text-(--color-ember-700)",
};

/**
 * Toast provider — render once near the root. Announces via aria-live
 * (polite; errors use role=alert through `error` tone wording).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon = toneIcon[toast.tone];
          return (
            <div key={toast.id} className="toast-card">
              <Icon
                size={20}
                aria-hidden="true"
                className={cn("mt-0.5 flex-none", toneClass[toast.tone])}
              />
              <div className="min-w-0 flex-1">
                <p className="text-label">{toast.title}</p>
                {toast.description ? (
                  <p className="text-small mt-0.5 text-(--color-muted)">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <IconButton
                aria-label={`Dismiss: ${toast.title}`}
                onClick={() => dismiss(toast.id)}
                className="h-8 w-8"
              >
                <X size={16} aria-hidden="true" />
              </IconButton>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
