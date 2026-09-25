import { Inbox, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/** Inline spinner + message for loading regions. */
export function LoadingState({
  message = "Loading…",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-center",
        className,
      )}
    >
      <span className="spinner" aria-hidden="true" />
      <p className="text-small text-(--color-muted)">{message}</p>
    </div>
  );
}

/** Skeleton blocks for loading layouts — shape hints, not content. */
export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-3", className)} aria-hidden="true">
      <div className="skeleton h-5 w-2/3" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-5/6" />
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** First-run / no-results state with an optional action slot. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12 text-center",
        className,
      )}
    >
      <Inbox size={32} aria-hidden="true" className="text-(--color-stone-500)" />
      <h2 className="text-h3 mt-2">{title}</h2>
      {description ? (
        <p className="text-body max-w-md text-(--color-muted)">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/** Failure state — message plus optional retry action. */
export function ErrorState({
  title = "Something went wrong",
  description = "Please try again. If the problem continues, contact support.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12 text-center",
        className,
      )}
    >
      <TriangleAlert
        size={32}
        aria-hidden="true"
        className="text-(--color-danger-700)"
      />
      <h2 className="text-h3 mt-2">{title}</h2>
      <p className="text-body max-w-md text-(--color-muted)">{description}</p>
      {onRetry ? (
        <div className="mt-4">
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
