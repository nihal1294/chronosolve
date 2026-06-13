import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Command } from "../lib/use-commands";
import { Kbd } from "./Kbd";

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

/** Cmd+K palette per the Command Palette spec: search row with esc keycap,
    grouped results, indigo active row, arrow/Enter keyboard driving. */
export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = commands.filter((command) =>
    command.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const groups: Command["group"][] = ["Actions", "Navigation"];
  // Clamp at render: the command list can shrink while open (e.g. a solve
  // finishing retires "Halt Solver"), which would strand the highlight.
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0));

  useEffect(() => inputRef.current?.focus(), []);

  const search = (text: string) => {
    setQuery(text);
    setActive(0); // a new filter highlights its top match
  };

  const run = (command: Command) => {
    onClose();
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") onClose();
    else if (event.key === "ArrowDown") setActive(Math.min(activeIndex + 1, matches.length - 1));
    else if (event.key === "ArrowUp") setActive(Math.max(activeIndex - 1, 0));
    else if (event.key === "Enter" && matches[activeIndex]) run(matches[activeIndex]);
    else return;
    event.preventDefault();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center px-6 pt-[16vh]"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          <Search size={18} className="text-neutral-500 dark:text-neutral-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => search(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 ml-3 bg-transparent text-sm outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
          />
          <Kbd>esc</Kbd>
        </div>

        <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
          {matches.length === 0 && (
            <p className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">No matching commands.</p>
          )}
          {groups.map((group) => {
            const items = matches.filter((command) => command.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="text-[10px] font-bold px-2 py-1 uppercase text-neutral-500 dark:text-neutral-400">
                  {group}
                </div>
                {items.map((command) => {
                  const matchIndex = matches.indexOf(command);
                  return (
                    <PaletteRow
                      key={command.id}
                      command={command}
                      active={matchIndex === activeIndex}
                      onHover={() => setActive(matchIndex)}
                      onRun={() => run(command)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface PaletteRowProps {
  command: Command;
  active: boolean;
  onHover: () => void;
  onRun: () => void;
}

function PaletteRow({ command, active, onHover, onRun }: PaletteRowProps) {
  const Icon = command.icon;
  return (
    <div
      onClick={onRun}
      onMouseMove={onHover}
      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer ${
        active ? "bg-indigo-600 text-white" : "hover:bg-black/5 dark:hover:bg-white/5"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={14} className={active ? "" : "text-neutral-500 dark:text-neutral-400"} />
        <span className={`text-sm ${active ? "font-medium" : ""}`}>{command.label}</span>
      </div>
      {command.keys && (
        <div className={`flex gap-1 ${active ? "opacity-80" : ""}`}>
          {command.keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </div>
      )}
    </div>
  );
}
