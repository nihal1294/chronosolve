import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  /** Display-only shortcut hint, e.g. "⌘E". */
  shortcut?: string;
  destructive?: boolean;
  onSelect: () => void;
}

export interface MenuState {
  x: number;
  y: number;
  /** Uppercase context line above the items, e.g. "CS-401 • Turing Hall". */
  header?: string;
  items: (MenuItem | "divider")[];
  /** Per the design spec: w-64 for timeline blocks, w-56 for table rows. */
  width?: "w-56" | "w-64";
}

const Divider = () => <div className="border-t border-neutral-100 dark:border-neutral-700/50 my-1" />;

function MenuRow({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const Icon = item.icon;
  const tone = item.destructive
    ? "text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
    : "text-neutral-700 dark:text-neutral-200 hover:bg-indigo-500 hover:text-white";
  return (
    <button
      onClick={() => {
        item.onSelect();
        onClose();
      }}
      className={`w-full px-3 py-1.5 text-sm flex items-center justify-between cursor-default group transition-colors ${tone}`}
    >
      <span className="flex items-center gap-2">
        <Icon size={14} className="opacity-70 group-hover:opacity-100" />
        <span>{item.label}</span>
      </span>
      {item.shortcut && (
        <span className="text-[10px] ml-4 opacity-50 font-mono tracking-widest">{item.shortcut}</span>
      )}
    </button>
  );
}

/** Right-click menu per the design system's Context Menus spec: translucent
    blurred panel, indigo hover items, red destructive rows. Rendered in a
    portal with a full-screen catcher that closes it on any outside press. */
export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Keep the panel on-screen when opened near the right/bottom viewport edge.
  const width = menu.width ?? "w-56";
  const rows = menu.items.length + (menu.header ? 2 : 0);
  const x = Math.max(8, Math.min(menu.x, window.innerWidth - (width === "w-64" ? 256 : 224) - 8));
  const y = Math.max(8, Math.min(menu.y, window.innerHeight - rows * 30 - 20));

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      onMouseDown={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        style={{ left: x, top: y }}
        onMouseDown={(event) => event.stopPropagation()}
        className={`absolute ${width} rounded-xl border bg-white/90 border-neutral-200/50 dark:bg-neutral-800/90 dark:border-neutral-700/50 backdrop-blur-xl shadow-2xl py-1.5 animate-in zoom-in-95 duration-200`}
      >
        {menu.header && (
          <>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {menu.header}
            </div>
            <Divider />
          </>
        )}
        {menu.items.map((item, index) =>
          item === "divider" ? (
            <Divider key={index} />
          ) : (
            <MenuRow key={index} item={item} onClose={onClose} />
          ),
        )}
      </div>
    </div>,
    document.body,
  );
}
