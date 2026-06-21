import { useEffect, useMemo, useRef, useState } from "react";
import { isTauri } from "./env";
import { type AppCommandDeps, buildActions, buildNav } from "./command-catalog";

export type { Command } from "./command-catalog";

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Command palette state + the single global keydown dispatcher. Bindings live
    on the commands so the palette, shortcut sheet, and handlers cannot drift. */
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
      deps.startTour,
      deps.toggleHints,
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
      // Desktop: native menu owns + shows shortcuts (keep only ⌘K here); browser owns them all.
      if (isTauri()) return;
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
    openShortcuts: () => setShortcutsOpen(true),
    closeShortcuts: () => setShortcutsOpen(false),
  };
}
