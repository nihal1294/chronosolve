import { useEffect, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Minimal modal focus management for the app's simple dialogs: move focus into
    the dialog when it opens, keep Tab cycling within it (so focus never lands on
    the backdrop content behind the modal), and restore focus to the opener on
    close. The component owns the ref (attach it with `ref={...}` on the same
    element that carries `role="dialog"` / `aria-modal="true"`); the returned
    handler goes on that element's `onKeyDown`. The ContextMenu does its own
    focus handling via item refs - this is the equivalent for overlay dialogs. */
export function useDialogFocus<T extends HTMLElement>(
  ref: RefObject<T | null>,
): (event: KeyboardEvent<T>) => void {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => opener?.focus?.();
  }, [ref]);

  return (event) => {
    if (event.key !== "Tab") return;
    const focusable = ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!focusable || focusable.length === 0) {
      // Nothing tabbable inside - keep focus on the dialog container itself.
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };
}
