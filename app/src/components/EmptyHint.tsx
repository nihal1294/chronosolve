/** Centered one-line placeholder for views that need a loaded problem. */
export function EmptyHint({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-sm">{label}</p>
    </div>
  );
}
