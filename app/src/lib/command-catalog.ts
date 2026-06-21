import type { ComponentType } from "react";
import {
  Activity,
  BookOpen,
  CalendarDays,
  Database,
  FilePlus2,
  FileText,
  FolderOpen,
  Keyboard,
  LayoutTemplate,
  Network,
  Play,
  Save,
  Settings as SettingsIcon,
  Square,
  UploadCloud,
} from "lucide-react";

export type IconType = ComponentType<{ size?: number; className?: string }>;

export interface Command {
  id: string;
  group: "Actions" | "Navigation";
  label: string;
  icon: IconType;
  /** Display chips, e.g. ["⌘", "Enter"]. */
  keys?: string[];
  /** Global key binding dispatched by the command center (browser only - on
      desktop the native menu owns shortcuts). */
  shortcut?: { meta: boolean; key: string };
  run: () => void;
}

export interface AppCommandDeps {
  canSolve: boolean;
  busy: boolean;
  /** A document is loaded - gates the "New problem" action. */
  hasDoc: boolean;
  solve: () => void;
  cancel: () => void;
  loadTemplate: () => void;
  /** Clear to a fresh problem (the shell confirms before discarding). */
  requestNewProblem: () => void;
  /** null outside the Tauri shell (browser preview hides file commands). */
  fileActions: { onOpen: () => void; onSave: () => void } | null;
  navigate: (path: string) => void;
}

export interface ShortcutSpec {
  /** Command id this binding belongs to. */
  id: string;
  /** Plain-language label for the Shortcuts sheet. */
  label: string;
  /** Display chips, e.g. ["⌘", "Enter"]. */
  keys: string[];
  /** Key binding the browser keydown dispatcher fires. */
  shortcut: { meta: boolean; key: string };
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
  { id: "nav-/settings", label: "Settings", keys: ["⌘", ","], shortcut: { meta: true, key: "," } },
];

/** Just the binding fields for a command id, spreadable into a Command. */
function bindingOf(id: string): Pick<ShortcutSpec, "keys" | "shortcut"> | undefined {
  const spec = SHORTCUTS.find((entry) => entry.id === id);
  return spec ? { keys: spec.keys, shortcut: spec.shortcut } : undefined;
}

interface NavSpec {
  path: string;
  label: string;
  icon: IconType;
}

const NAV: NavSpec[] = [
  { path: "/", label: "Go to Dashboard", icon: LayoutTemplate },
  { path: "/data", label: "Go to Data", icon: Database },
  { path: "/constraints", label: "Go to Constraints", icon: Network },
  { path: "/solver", label: "Go to Scheduler", icon: Activity },
  { path: "/timetable", label: "Go to Timetable", icon: CalendarDays },
  { path: "/settings", label: "Go to Settings", icon: SettingsIcon },
];

/** The Actions group. `openShortcuts`/`openGuide` open the two Help overlays;
    their state lives in the hook. */
export function buildActions(
  deps: AppCommandDeps,
  openShortcuts: () => void,
  openGuide: () => void,
): Command[] {
  const f = deps.fileActions;
  const specs: (Command | null)[] = [
    deps.canSolve && !deps.busy
      ? {
          id: "solve",
          group: "Actions",
          label: "Run scheduler",
          icon: Play,
          ...bindingOf("solve"),
          // Mirror the Dashboard/Timetable Run buttons: jump to the Scheduler
          // route so its live panel surfaces progress AND any solve error (e.g.
          // the engine being unreachable) - otherwise a menu/⌘↵ Run triggered
          // from another route would fail silently with nowhere to show it.
          run: () => {
            deps.solve();
            deps.navigate("/solver");
          },
        }
      : null,
    deps.busy
      ? {
          id: "halt",
          group: "Actions",
          label: "Halt scheduler",
          icon: Square,
          ...bindingOf("halt"),
          run: deps.cancel,
        }
      : null,
    deps.hasDoc
      ? {
          id: "new",
          group: "Actions",
          label: "New Problem…",
          icon: FilePlus2,
          ...bindingOf("new"),
          run: deps.requestNewProblem,
        }
      : null,
    { id: "template", group: "Actions", label: "Load Template", icon: FileText, run: deps.loadTemplate },
    {
      id: "import",
      group: "Actions",
      label: "Import CSV…",
      // ?import=1 is read by the Data route to open the wizard from any route.
      icon: UploadCloud,
      run: () => deps.navigate("/data?import=1"),
    },
    f
      ? {
          id: "open",
          group: "Actions",
          label: "Open Problem…",
          icon: FolderOpen,
          ...bindingOf("open"),
          run: f.onOpen,
        }
      : null,
    f
      ? {
          id: "save",
          group: "Actions",
          label: "Save Problem…",
          icon: Save,
          ...bindingOf("save"),
          run: f.onSave,
        }
      : null,
    { id: "help-guide", group: "Actions", label: "How to Use", icon: BookOpen, run: openGuide },
    { id: "shortcuts", group: "Actions", label: "Keyboard Shortcuts", icon: Keyboard, run: openShortcuts },
  ];
  return specs.filter((command): command is Command => command !== null);
}

export function buildNav(deps: AppCommandDeps): Command[] {
  return NAV.map((item) => ({
    id: `nav-${item.path}`,
    group: "Navigation",
    label: item.label,
    icon: item.icon,
    ...bindingOf(`nav-${item.path}`),
    run: () => deps.navigate(item.path),
  }));
}
