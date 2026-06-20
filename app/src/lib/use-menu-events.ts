import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "./env";
import { dispatchMenuCommand } from "./menu-commands";
import type { Command } from "./use-app-commands";

/** Availability flags that gate the state-dependent native menu items. */
export interface MenuState {
  canSolve: boolean;
  busy: boolean;
  hasDoc: boolean;
}

/** In the Tauri shell, route native menu-bar clicks to the matching app command
    AND keep the state-dependent items (Run/Halt/New/Save) enabled only when
    their command is available, so the menu never offers an action that no-ops.
    Both are no-ops in the browser - there is no native menu there. */
export function useMenuEvents(commands: Command[], state: MenuState): void {
  const ref = useRef(commands);
  useEffect(() => {
    ref.current = commands;
  });

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let unlisten: UnlistenFn | undefined;
    listen<string>("menu", (event) => dispatchMenuCommand(ref.current, event.payload)).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    void invoke("set_menu_states", {
      canSolve: state.canSolve,
      busy: state.busy,
      hasDoc: state.hasDoc,
    }).catch(() => {});
  }, [state.canSolve, state.busy, state.hasDoc]);
}
