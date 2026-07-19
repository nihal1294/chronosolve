import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { CommandPalette } from "./CommandPalette";
import type { Command } from "../lib/use-app-commands";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("CommandPalette", () => {
  it("releases focus from its search input before running a command", () => {
    // Guards commands that inspect document.activeElement (the edit-undo /
    // edit-redo editable fallback): with the palette input still focused,
    // they would execCommand on the palette instead of running the verb.
    let activeAtRun: Element | null = null;
    const command: Command = {
      id: "edit-undo",
      group: "Actions",
      label: "Undo timetable edit",
      icon: (() => null) as unknown as Command["icon"],
      run: () => {
        activeAtRun = document.activeElement;
      },
    };
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<CommandPalette commands={[command]} onClose={() => {}} />));
    const input = host.querySelector("input");
    expect(document.activeElement).toBe(input); // the palette auto-focuses its search box
    const label = [...host.querySelectorAll("span")].find((el) => el.textContent === "Undo timetable edit");
    act(() => label?.click());
    expect(activeAtRun).not.toBeNull();
    expect(activeAtRun).not.toBe(input);
    act(() => root.unmount());
    host.remove();
  });
});
