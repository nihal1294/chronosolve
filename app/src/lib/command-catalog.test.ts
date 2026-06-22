import { describe, expect, it, vi } from "vitest";
import { SHORTCUTS, buildActions, buildNav, type AppCommandDeps } from "./command-catalog";

function deps(over: Partial<AppCommandDeps> = {}): AppCommandDeps {
  return {
    canSolve: true,
    busy: false,
    hasDoc: true,
    canSave: true,
    solve: vi.fn(),
    cancel: vi.fn(),
    loadTemplate: vi.fn(),
    requestNewProblem: vi.fn(),
    fileActions: { onOpen: vi.fn(), onSave: vi.fn() },
    navigate: vi.fn(),
    startTour: vi.fn(),
    toggleHints: vi.fn(),
    ...over,
  };
}

describe("command catalog shortcuts", () => {
  it("every command that advertises a shortcut matches SHORTCUTS exactly (no drift)", () => {
    const d = deps({ busy: false });
    const commands = [...buildActions(d, vi.fn()), ...buildNav(d)];
    for (const command of commands) {
      if (!command.shortcut) continue;
      const spec = SHORTCUTS.find((entry) => entry.id === command.id);
      expect(spec, `command "${command.id}" has a shortcut but no SHORTCUTS entry`).toBeDefined();
      expect(command.shortcut).toEqual(spec!.shortcut);
      expect(command.keys).toEqual(spec!.keys);
    }
  });

  it("halt is bound to Cmd+. and runs cancel when busy", () => {
    const cancel = vi.fn();
    const halt = buildActions(deps({ busy: true, cancel }), vi.fn()).find((c) => c.id === "halt");
    expect(halt).toBeDefined();
    expect(halt!.shortcut).toEqual({ meta: true, key: "." });
    halt!.run();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("solve/new/open/save carry their accelerators and run the right action", () => {
    const solve = vi.fn();
    const onOpen = vi.fn();
    const onSave = vi.fn();
    const requestNewProblem = vi.fn();
    const navigate = vi.fn();
    const commands = buildActions(
      deps({ solve, requestNewProblem, navigate, fileActions: { onOpen, onSave } }),
      vi.fn(),
    );
    const byId = Object.fromEntries(commands.map((c) => [c.id, c]));
    expect(byId.solve.shortcut).toEqual({ meta: true, key: "enter" });
    expect(byId.new.shortcut).toEqual({ meta: true, key: "n" });
    expect(byId.open.shortcut).toEqual({ meta: true, key: "o" });
    expect(byId.save.shortcut).toEqual({ meta: true, key: "s" });
    byId.solve.run();
    byId.new.run();
    byId.open.run();
    byId.save.run();
    expect(solve).toHaveBeenCalledOnce();
    // Run jumps to the Scheduler route so its panel can show progress/errors.
    expect(navigate).toHaveBeenCalledWith("/solver");
    expect(requestNewProblem).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("Save is offered whenever there is text to save, hidden when there is not", () => {
    const fileActions = { onOpen: vi.fn(), onSave: vi.fn() };
    // canSave true even with no parsed doc (an invalid YAML draft is still savable).
    const savable = buildActions(deps({ hasDoc: false, canSave: true, fileActions }), vi.fn());
    expect(savable.find((c) => c.id === "save")).toBeDefined();
    const empty = buildActions(deps({ canSave: false, fileActions }), vi.fn());
    expect(empty.find((c) => c.id === "save")).toBeUndefined();
  });

  it("How to Use launches the tour; Show help hints toggles hints (bound to Cmd+/)", () => {
    const startTour = vi.fn();
    const toggleHints = vi.fn();
    const commands = buildActions(deps({ startTour, toggleHints }), vi.fn());
    const byId = Object.fromEntries(commands.map((c) => [c.id, c]));
    expect(byId["help-guide"].label).toBe("How to Use");
    byId["help-guide"].run();
    expect(startTour).toHaveBeenCalledOnce();
    expect(byId["toggle-help-hints"].shortcut).toEqual({ meta: true, key: "/" });
    byId["toggle-help-hints"].run();
    expect(toggleHints).toHaveBeenCalledOnce();
  });

  it("settings nav carries Cmd+, and exposes an exhaustive shortcut list", () => {
    const settings = buildNav(deps()).find((c) => c.id === "nav-/settings");
    expect(settings!.shortcut).toEqual({ meta: true, key: "," });
    expect(SHORTCUTS.map((s) => s.id)).toEqual([
      "solve",
      "halt",
      "new",
      "open",
      "save",
      "nav-/settings",
      "toggle-help-hints",
    ]);
    for (const spec of SHORTCUTS) {
      expect(spec.keys.length).toBeGreaterThan(0);
      expect(spec.shortcut.meta).toBe(true);
    }
  });
});
