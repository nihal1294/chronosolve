/** One global key binding. `shift` is exact-match: bindings without it reject
    shifted presses, so ⌘⇧Z (redo) never triggers a plain ⌘Z command. */
export interface KeyBinding {
  meta: boolean;
  key: string;
  shift?: boolean;
}

export interface ShortcutSpec {
  /** Command id this binding belongs to. */
  id: string;
  /** Plain-language label for the Shortcuts sheet. */
  label: string;
  /** Display chips, e.g. ["⌘", "Enter"]. */
  keys: string[];
  /** Key binding the browser keydown dispatcher fires. */
  shortcut: KeyBinding;
}

/** The exhaustive, canonical list of keyboard shortcuts - the single source of
    truth for the palette chips, the browser keydown dispatcher, AND the
    Shortcuts sheet (which lists ALL of them regardless of whether the command is
    currently available). On desktop the native menu owns these accelerators (see
    `menu.rs`) and the JS dispatcher defers, so keep this list and `menu.rs` in
    sync. ⌘K (palette) is listed separately in the sheet - it is not a command. */
export const SHORTCUTS: ShortcutSpec[] = [
  { id: "solve", label: "Run scheduler", keys: ["⌘", "Enter"], shortcut: { meta: true, key: "enter" } },
  { id: "halt", label: "Halt scheduler", keys: ["⌘", "."], shortcut: { meta: true, key: "." } },
  { id: "new", label: "New problem", keys: ["⌘", "N"], shortcut: { meta: true, key: "n" } },
  { id: "open", label: "Open problem", keys: ["⌘", "O"], shortcut: { meta: true, key: "o" } },
  { id: "save", label: "Save problem", keys: ["⌘", "S"], shortcut: { meta: true, key: "s" } },
  { id: "edit-undo", label: "Undo timetable edit", keys: ["⌘", "Z"], shortcut: { meta: true, key: "z" } },
  {
    id: "edit-redo",
    label: "Redo timetable edit",
    keys: ["⇧", "⌘", "Z"],
    shortcut: { meta: true, key: "z", shift: true },
  },
  { id: "nav-/settings", label: "Settings", keys: ["⌘", ","], shortcut: { meta: true, key: "," } },
  { id: "toggle-help-hints", label: "Show help hints", keys: ["⌘", "/"], shortcut: { meta: true, key: "/" } },
];

/** Just the binding fields for a command id, spreadable into a Command. */
export function bindingOf(id: string): Pick<ShortcutSpec, "keys" | "shortcut"> | undefined {
  const spec = SHORTCUTS.find((entry) => entry.id === id);
  return spec ? { keys: spec.keys, shortcut: spec.shortcut } : undefined;
}

/** Does a keydown-shaped press match a binding? Exact on every axis. */
export function matchesShortcut(
  binding: KeyBinding,
  press: { meta: boolean; shift: boolean; key: string },
): boolean {
  return binding.meta === press.meta && !!binding.shift === press.shift && binding.key === press.key;
}

/** Is this a target whose own editing keys we must not steal? */
export const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Run a timetable undo/redo verb - unless an editable is focused. The menu
    accelerator (desktop) and the keydown dispatcher (browser) both swallow ⌘Z
    before a focused field ever sees it, so restore the field's own text
    undo/redo by hand and keep the session verb for everywhere else. */
export function runEditVerb(direction: "undo" | "redo", sessionVerb: () => void): void {
  if (isEditable(document.activeElement)) document.execCommand(direction);
  else sessionVerb();
}
