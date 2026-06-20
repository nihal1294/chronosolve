import { describe, expect, it, vi } from "vitest";
import { dispatchMenuCommand } from "./menu-commands";
import type { Command } from "./use-app-commands";

const cmd = (id: string, run: () => void): Command => ({
  id,
  group: "Actions",
  label: id,
  icon: () => null,
  run,
});

describe("dispatchMenuCommand", () => {
  it("runs the command whose id matches the menu id", () => {
    const ran = vi.fn();
    dispatchMenuCommand([cmd("open", ran), cmd("save", () => {})], "open");
    expect(ran).toHaveBeenCalledOnce();
  });

  it("no-ops on an id no command currently has", () => {
    const ran = vi.fn();
    expect(() => dispatchMenuCommand([cmd("open", ran)], "solve")).not.toThrow();
    expect(ran).not.toHaveBeenCalled();
  });
});
