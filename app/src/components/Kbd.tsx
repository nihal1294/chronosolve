/** Keycap chip per the Command Palette spec. */
export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded border bg-neutral-100 border-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300 shadow-[0_2px_0_rgba(0,0,0,0.1)]">
      {children}
    </kbd>
  );
}
