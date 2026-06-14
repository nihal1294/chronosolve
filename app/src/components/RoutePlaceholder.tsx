import type { ReactNode } from "react";

interface RoutePlaceholderProps {
  title: string;
  subtitle: string;
  /** Optional anchor id for the M6 onboarding tour. */
  tour?: string;
  children?: ReactNode;
}

/** Temporary route body used while the route-based shell is being stood up.
    Each workspace route ships its real surface in a later M5 phase; this keeps
    the app runnable and navigation verifiable in the meantime. */
export function RoutePlaceholder({ title, subtitle, tour, children }: RoutePlaceholderProps) {
  return (
    <div className="relative z-10 h-full overflow-y-auto p-8" data-tour={tour}>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{title}</h1>
      <p className="mt-2 max-w-prose text-sm text-neutral-400">{subtitle}</p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-400">
        This surface lands in a later M5 phase
      </div>
      {children}
    </div>
  );
}
