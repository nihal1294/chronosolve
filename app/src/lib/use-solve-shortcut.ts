import { useEffect } from "react";

/** Design-system global shortcut: Cmd/Ctrl+Enter = Start Optimization.
    Subscribed without deps so the latest solve closure is always invoked. */
export function useSolveShortcut(solve: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        solve();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
}
