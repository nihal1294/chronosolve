import { useEffect, useRef } from "react";

/** Design-system global shortcut: Cmd/Ctrl+Enter = Start Optimization.
    The listener registers once; it reads the latest solve closure through
    a ref so re-renders don't churn the window subscription. */
export function useSolveShortcut(solve: () => void) {
  const solveRef = useRef(solve);
  useEffect(() => {
    solveRef.current = solve;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        solveRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
