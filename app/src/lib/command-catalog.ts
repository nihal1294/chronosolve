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
  Lightbulb,
  Network,
  Play,
  Redo2,
  Save,
  Settings as SettingsIcon,
  Square,
  Undo2,
  UploadCloud,
} from "lucide-react";
import { bindingOf, runEditVerb, type KeyBinding } from "./shortcuts";

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
  shortcut?: KeyBinding;
  run: () => void;
}

export interface AppCommandDeps {
  canSolve: boolean;
  busy: boolean;
  /** A document is loaded - gates the "New problem" action. */
  hasDoc: boolean;
  /** There is YAML text to save (even an invalid draft) - gates "Save". A
      broken-YAML draft has no parsed doc but is still worth saving/recovering. */
  canSave: boolean;
  solve: () => void;
  cancel: () => void;
  loadTemplate: () => void;
  /** Clear to a fresh problem (the shell confirms before discarding). */
  requestNewProblem: () => void;
  /** null outside the Tauri shell (browser preview hides file commands). */
  fileActions: { onOpen: () => void; onSave: () => void } | null;
  navigate: (path: string) => void;
  /** Start (or replay) the guided tour - the "How to Use" entry. */
  startTour: () => void;
  /** Flip ambient help hints (also bound to Cmd-/). */
  toggleHints: () => void;
  /** Session undo/redo over timetable edits (⌘Z / ⇧⌘Z outside editors). */
  undoEdit: () => void;
  redoEdit: () => void;
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

/** The Actions group. `openShortcuts` opens the Keyboard Shortcuts sheet (its
    state lives in the hook); the tour and help hints are driven through deps. */
export function buildActions(deps: AppCommandDeps, openShortcuts: () => void): Command[] {
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
    f && deps.canSave
      ? {
          id: "save",
          group: "Actions",
          label: "Save Problem…",
          icon: Save,
          ...bindingOf("save"),
          run: f.onSave,
        }
      : null,
    {
      id: "edit-undo",
      group: "Actions",
      label: "Undo timetable edit",
      icon: Undo2,
      ...bindingOf("edit-undo"),
      run: () => runEditVerb("undo", deps.undoEdit),
    },
    {
      id: "edit-redo",
      group: "Actions",
      label: "Redo timetable edit",
      icon: Redo2,
      ...bindingOf("edit-redo"),
      run: () => runEditVerb("redo", deps.redoEdit),
    },
    // "How to Use" launches the guided tour - the same entry the native Help
    // menu item and the first-run welcome card use.
    { id: "help-guide", group: "Actions", label: "How to Use", icon: BookOpen, run: deps.startTour },
    {
      id: "toggle-help-hints",
      group: "Actions",
      label: "Show help hints",
      icon: Lightbulb,
      ...bindingOf("toggle-help-hints"),
      run: deps.toggleHints,
    },
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
