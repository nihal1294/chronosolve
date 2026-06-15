import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  /** Label for the confirm button; defaults to "Confirm". */
  confirmLabel?: string;
  /** Red confirm button + warning glyph for irreversible actions. */
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Small hand-rolled confirmation modal. Escape and backdrop press cancel;
    confirming a destructive action requires an explicit click on the red
    button (no Enter shortcut, to avoid an accidental delete). */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { title, message, confirmLabel = "Confirm", destructive = false, onConfirm, onClose } = props;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const confirmTone = destructive ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:ring-white/5"
      >
        <div className="flex items-start gap-3">
          {destructive && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <AlertTriangle size={18} />
            </span>
          )}
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-neutral-800 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors ${confirmTone}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
