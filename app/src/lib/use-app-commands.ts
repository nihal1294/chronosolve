import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  Activity,
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

type IconType = ComponentType<{ size?: number; className?: string }>;

export interface Command {
  id: string;
  group: "Actions" | "Navigation";
  label: string;
  icon: IconType;
  /** Display chips, e.g. ["⌘", "Enter"]. */
  keys?: string[];
  /** Global key binding dispatched by the command center. */
  shortcut?: { meta: boolean; key: string };
  run: () => void;
}

interface AppCommandDeps {
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

interface NavSpec {
  path: string;
  label: string;
  icon: IconType;
  keys?: string[];
  shortcut?: { meta: boolean; key: string };
}

const NAV: NavSpec[] = [
  { path: "/", label: "Go to Dashboard", icon: LayoutTemplate },
  { path: "/data", label: "Go to Data", icon: Database },
  { path: "/constraints", label: "Go to Constraints", icon: Network },
  { path: "/solver", label: "Go to Scheduler", icon: Activity },
  { path: "/timetable", label: "Go to Timetable", icon: CalendarDays },
  {
    path: "/settings",
    label: "Go to Settings",
    icon: SettingsIcon,
    keys: ["⌘", ","],
    shortcut: { meta: true, key: "," },
  },
];

function buildActions(deps: AppCommandDeps, openShortcuts: () => void): Command[] {
  const f = deps.fileActions;
  const specs: (Command | null)[] = [
    deps.canSolve && !deps.busy
      ? {
          id: "solve",
          group: "Actions",
          label: "Run scheduler",
          icon: Play,
          keys: ["⌘", "Enter"],
          shortcut: { meta: true, key: "enter" },
          run: deps.solve,
        }
      : null,
    deps.busy
      ? {
          id: "halt",
          group: "Actions",
          label: "Halt scheduler",
          icon: Square,
          keys: ["⌘", "."],
          shortcut: { meta: true, key: "." },
          run: deps.cancel,
        }
      : null,
    deps.hasDoc
      ? {
          id: "new",
          group: "Actions",
          label: "New Problem…",
          icon: FilePlus2,
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
    f ? { id: "open", group: "Actions", label: "Open Problem…", icon: FolderOpen, run: f.onOpen } : null,
    f ? { id: "save", group: "Actions", label: "Save Problem…", icon: Save, run: f.onSave } : null,
    { id: "shortcuts", group: "Actions", label: "Keyboard Shortcuts", icon: Keyboard, run: openShortcuts },
  ];
  return specs.filter((command): command is Command => command !== null);
}

function buildNav(deps: AppCommandDeps): Command[] {
  return NAV.map((item) => ({
    id: `nav-${item.path}`,
    group: "Navigation",
    label: item.label,
    icon: item.icon,
    keys: item.keys,
    shortcut: item.shortcut,
    run: () => deps.navigate(item.path),
  }));
}

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Command palette state + the single global keydown dispatcher, rebound to
    route navigation. Bindings live on the commands themselves so the palette
    chips, the shortcut sheet, and the handlers cannot drift apart. */
export function useAppCommands(deps: AppCommandDeps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const commands = useMemo(
    () => [...buildActions(deps, () => setShortcutsOpen(true)), ...buildNav(deps)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      deps.canSolve,
      deps.busy,
      deps.hasDoc,
      deps.solve,
      deps.cancel,
      deps.loadTemplate,
      deps.requestNewProblem,
      deps.fileActions,
      deps.navigate,
    ],
  );

  const stateRef = useRef({ commands, paletteOpen });
  useEffect(() => {
    stateRef.current = { commands, paletteOpen };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (stateRef.current.paletteOpen) return; // palette owns the keyboard
      if (!meta && isEditable(event.target)) return; // don't steal plain typing
      const match = stateRef.current.commands.find(
        (command) =>
          command.shortcut &&
          command.shortcut.meta === meta &&
          command.shortcut.key === event.key.toLowerCase(),
      );
      if (match) {
        event.preventDefault();
        match.run();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return {
    commands,
    paletteOpen,
    openPalette: () => setPaletteOpen(true),
    closePalette: () => setPaletteOpen(false),
    shortcutsOpen,
    closeShortcuts: () => setShortcutsOpen(false),
  };
}
