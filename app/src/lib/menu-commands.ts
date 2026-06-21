import type { Command } from "./use-app-commands";

/** Run the app command whose id matches a native menu item's id. A no-op when no
    command currently has that id - e.g. "solve" while a solve is running (the
    command is absent), or a predefined item's auto-generated id. The native menu
    reuses command ids as its custom item ids, so this is the whole dispatch. */
export function dispatchMenuCommand(commands: Command[], id: string): void {
  commands.find((command) => command.id === id)?.run();
}
