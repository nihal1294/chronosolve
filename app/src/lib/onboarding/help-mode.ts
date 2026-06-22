import { useEffect, useState } from "react";

/** Ambient "Help Mode": while on, every registered help anchor lights up with a
 *  hint dot + tooltip. The body class is the single source of truth, so any
 *  component can read or flip it without a shared React context. */
const HELP_MODE_CLASS = "help-mode-active";

/** Whether Help Mode is currently on. */
export function isHelpMode(): boolean {
  return typeof document !== "undefined" && document.body.classList.contains(HELP_MODE_CLASS);
}

/** Turn Help Mode on or off. */
export function setHelpMode(on: boolean): void {
  document.body.classList.toggle(HELP_MODE_CLASS, on);
}

/** Flip Help Mode. */
export function toggleHelpMode(): void {
  setHelpMode(!isHelpMode());
}

/** Subscribe to Help Mode; re-renders when the body class flips. */
export function useHelpMode(): boolean {
  const [on, setOn] = useState(isHelpMode);
  useEffect(() => {
    const sync = () => setOn(isHelpMode());
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    sync();
    return () => observer.disconnect();
  }, []);
  return on;
}
