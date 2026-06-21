import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { nextItemIndex } from "../lib/menu-nav";

// Approx. rendered height of one menu row (px), used to keep the panel on-screen
// when it opens near the bottom edge. Matches the py-1.5 + text-sm row styling.
const ROW_HEIGHT_PX = 30;

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

const Divider = () => (
  <div role="separator" className="border-t border-neutral-100 dark:border-neutral-700/50 my-1" />
);

function MenuRow({
  item,
  onClose,
  buttonRef,
}: {
  item: MenuItem;
  onClose: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  const Icon = item.icon;
  const tone = item.destructive
    ? "text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white"
    : "text-neutral-700 dark:text-neutral-200 hover:bg-indigo-500 hover:text-white";
  return (
    <button
      ref={buttonRef}
      role="menuitem"
      onClick={() => {
        item.onSelect();
        onClose();
      }}
      className={`w-full px-3 py-1.5 text-sm flex items-center justify-between cursor-default group transition-colors outline-none focus:bg-indigo-500 focus:text-white ${tone}`}
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

/** Right-click menu. Focusable like a native menu: opening focuses the first item;
    Up/Down move (skipping dividers, wrapping), Home/End jump, Enter/Space activate
    (native button behavior), Escape or an outside press closes. Focus returns to
    where it was on close. */
export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const restore = document.activeElement as HTMLElement | null;
    const selectable = menu.items.map((item) => item !== "divider");
    itemRefs.current[nextItemIndex(selectable, -1, 1)]?.focus();
    return () => restore?.focus?.();
    // Mount-only: focus the first item on open, restore focus on close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const selectable = menu.items.map((item) => item !== "divider");
    const focusAt = (from: number, step: 1 | -1) =>
      itemRefs.current[nextItemIndex(selectable, from, step)]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      const current = itemRefs.current.findIndex((el) => el === document.activeElement);
      switch (event.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowDown":
          event.preventDefault();
          focusAt(current, 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          focusAt(current === -1 ? selectable.length : current, -1);
          break;
        case "Home":
          event.preventDefault();
          focusAt(-1, 1);
          break;
        case "End":
          event.preventDefault();
          focusAt(selectable.length, -1);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, menu.items]);

  // Keep the panel on-screen when opened near the right/bottom viewport edge.
  const width = menu.width ?? "w-56";
  const rows = menu.items.length + (menu.header ? 2 : 0);
  const x = Math.max(8, Math.min(menu.x, window.innerWidth - (width === "w-64" ? 256 : 224) - 8));
  const y = Math.max(8, Math.min(menu.y, window.innerHeight - rows * ROW_HEIGHT_PX - 20));

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
        role="menu"
        aria-orientation="vertical"
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
            <MenuRow
              key={index}
              item={item}
              onClose={onClose}
              buttonRef={(el) => {
                itemRefs.current[index] = el;
              }}
            />
          ),
        )}
      </div>
    </div>,
    document.body,
  );
}
