import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  BarChart3,
  Database,
  FileCode2,
  FileText,
  FolderOpen,
  Keyboard,
  LayoutGrid,
  Network,
  Play,
  Save,
  Square,
  UploadCloud,
} from "lucide-react";
import type { EntityKind } from "../components/Sidebar";

export interface Command {
  id: string;
  group: "Actions" | "Navigation";
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Display chips, e.g. ["⌘", "Enter"]. */
  keys?: string[];
  /** Global key binding dispatched by the command center. */
  shortcut?: { meta: boolean; key: string };
  run: () => void;
}

interface CommandDeps {
  canSolve: boolean;
  busy: boolean;
  solve: () => void;
  cancel: () => void;
  loadTemplate: () => void;
  openImport: () => void;
  /** null outside the Tauri shell (browser preview hides file commands). */
  fileActions: { onOpen: () => void; onSave: () => void } | null;
  goToView: (view: "editor" | "constraints" | "timeline" | "analytics") => void;
  goToTable: (entity: EntityKind) => void;
  /** Pin/unpin the Inspector-selected block; null when nothing is selected. */
  toggleSelectedLock: (() => void) | null;
}

const TABLES: { entity: EntityKind; label: string }[] = [
  { entity: "subjects", label: "Go to Courses" },
  { entity: "teachers", label: "Go to Professors" },
  { entity: "groups", label: "Go to Student Groups" },
  { entity: "rooms", label: "Go to Rooms" },
];

function buildCommands(deps: CommandDeps, openShortcuts: () => void): Command[] {
  const actions: Command[] = [];
  if (deps.canSolve && !deps.busy) {
    actions.push({
      id: "solve",
      group: "Actions",
      label: "Run OR-Tools Solver",
      icon: Play,
      keys: ["⌘", "Enter"],
      shortcut: { meta: true, key: "enter" },
      run: deps.solve,
    });
  }
  if (deps.busy) {
    actions.push({
      id: "halt",
      group: "Actions",
      label: "Halt / Cancel Solver",
      icon: Square,
      keys: ["⌘", "."],
      shortcut: { meta: true, key: "." },
      run: deps.cancel,
    });
  }
  actions.push({
    id: "template",
    group: "Actions",
    label: "Load Template",
    icon: FileText,
    run: deps.loadTemplate,
  });
  actions.push({
    id: "import",
    group: "Actions",
    label: "Import CSV…",
    icon: UploadCloud,
    run: deps.openImport,
  });
  if (deps.fileActions) {
    actions.push({
      id: "open",
      group: "Actions",
      label: "Open Problem…",
      icon: FolderOpen,
      run: deps.fileActions.onOpen,
    });
    actions.push({
      id: "save",
      group: "Actions",
      label: "Save Problem…",
      icon: Save,
      run: deps.fileActions.onSave,
    });
  }
  if (deps.toggleSelectedLock) {
    actions.push({
      id: "lock",
      group: "Actions",
      label: "Lock / Unlock Selected Block",
      icon: LayoutGrid,
      keys: ["L"],
      shortcut: { meta: false, key: "l" },
      run: deps.toggleSelectedLock,
    });
  }
  actions.push({
    id: "shortcuts",
    group: "Actions",
    label: "Keyboard Shortcuts",
    icon: Keyboard,
    run: openShortcuts,
  });

  return [
    ...actions,
    {
      id: "nav-editor",
      group: "Navigation",
      label: "Go to Problem Definition",
      icon: FileCode2,
      run: () => deps.goToView("editor"),
    },
    {
      id: "nav-constraints",
      group: "Navigation",
      label: "Go to Constraints",
      icon: Network,
      run: () => deps.goToView("constraints"),
    },
    {
      id: "nav-timeline",
      group: "Navigation",
      label: "Go to Timeline",
      icon: LayoutGrid,
      run: () => deps.goToView("timeline"),
    },
    ...TABLES.map((table) => ({
      id: `nav-${table.entity}`,
      group: "Navigation" as const,
      label: table.label,
      icon: Database,
      run: () => deps.goToTable(table.entity),
    })),
    {
      id: "nav-analytics",
      group: "Navigation",
      label: "Go to Analytics",
      icon: BarChart3,
      run: () => deps.goToView("analytics"),
    },
  ];
}

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Command palette state + the single global keydown dispatcher. Bindings
    live on the commands themselves, so the palette chips, the shortcut
    sheet, and the actual handlers cannot drift apart. */
export function useCommandCenter(deps: CommandDeps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // `deps` is a fresh object each render; memoize over the fields buildCommands
  // actually reads so the registry (and the stateRef sync below) is stable.
  const commands = useMemo(
    () => buildCommands(deps, () => setShortcutsOpen(true)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      deps.canSolve,
      deps.busy,
      deps.solve,
      deps.cancel,
      deps.loadTemplate,
      deps.openImport,
      deps.fileActions,
      deps.goToView,
      deps.goToTable,
      deps.toggleSelectedLock,
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
    closePalette: () => setPaletteOpen(false),
    shortcutsOpen,
    closeShortcuts: () => setShortcutsOpen(false),
  };
}
