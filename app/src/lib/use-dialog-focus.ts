import { useEffect, type KeyboardEvent, type RefObject } from "react";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** A minimal Tab-like event - structurally satisfied by both React's
    `KeyboardEvent` and the DOM's, so the trap is callable from a handler and
    directly unit-testable with a plain object. */
interface TabEvent {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
}

/** Keep Tab / Shift+Tab focus cycling within `container`. On open, focus sits on
    the container itself (`tabIndex={-1}`); treat that as "outside the ring" in
    both directions so the very first Tab / Shift+Tab wraps inward instead of
    escaping to content behind the modal. Exported for unit testing. */
export function trapTabFocus(event: TabEvent, container: HTMLElement | null): void {
  if (event.key !== "Tab") return;
  const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE);
  if (!focusable || focusable.length === 0) {
    // Nothing tabbable inside - keep focus on the dialog container itself.
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const atContainer = active === container;
  if (event.shiftKey && (active === first || atContainer)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || atContainer)) {
    event.preventDefault();
    first.focus();
  }
}

/** Minimal modal focus management for the app's simple dialogs: move focus into
    the dialog when it opens, trap Tab within it (see `trapTabFocus`), and
    restore focus to the opener on close. The component owns the ref (attach it
    with `ref={...}` on the same element that carries `role="dialog"` /
    `aria-modal="true"`); the returned handler goes on that element's
    `onKeyDown`. The ContextMenu does its own focus handling via item refs -
    this is the equivalent for overlay dialogs. */
export function useDialogFocus<T extends HTMLElement>(
  ref: RefObject<T | null>,
): (event: KeyboardEvent<T>) => void {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => opener?.focus?.();
  }, [ref]);

  return (event) => trapTabFocus(event, ref.current);
}
