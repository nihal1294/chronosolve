import { useEffect, useRef } from "react";
import { Compass, MousePointerClick, X } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { useDialogFocus } from "../lib/use-dialog-focus";

interface WelcomeCardProps {
  isDark: boolean;
  /** Launch the guided tour (and mark the user welcomed). */
  onTakeTour: () => void;
  /** Turn on ambient help hints and let the user explore (marks welcomed). */
  onLookAround: () => void;
  /** Dismiss without choosing - also marks welcomed so it shows only once. */
  onClose: () => void;
}

/** First-run greeting. Offers the two onboarding paths the design settled on - a
 *  guided tour or self-directed exploration with ambient hints - rather than
 *  forcing the tour on the user. Shown once (persisted via markWelcomed); every
 *  help affordance stays reachable afterwards from the Help menu. */
export function WelcomeCard({ isDark, onTakeTour, onLookAround, onClose }: WelcomeCardProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onDialogKeyDown = useDialogFocus(dialogRef);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-6"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onKeyDown={onDialogKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-2xl ring-1 ring-black/5 outline-none animate-in zoom-in-95 duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:ring-white/5"
      >
        <button
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-black/5 dark:text-neutral-500 dark:hover:bg-white/5"
        >
          <X size={16} />
        </button>

        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10">
          <BrandLogo variant="app-icon" size={36} animated theme={isDark ? "dark" : "light"} />
        </div>
        <h2
          id="welcome-title"
          className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100"
        >
          Welcome to ChronoSolve
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          Turn your courses, instructors, and rooms into a conflict-free timetable. Want a quick guided tour,
          or would you rather explore on your own?
        </p>

        <div className="mt-6 space-y-2.5">
          <button
            onClick={onTakeTour}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Compass size={16} />
            Take the quick tour
          </button>
          <button
            onClick={onLookAround}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <MousePointerClick size={16} />
            I&apos;ll look around
          </button>
        </div>

        <p className="mt-5 text-xs text-neutral-400 dark:text-neutral-500">
          You can reopen the tour and hints any time from the Help menu.
        </p>
      </div>
    </div>
  );
}
