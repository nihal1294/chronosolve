import { useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

const FILTERS = [{ name: "Timetable problem", extensions: ["yaml", "yml", "json"] }];

/** Native dialogs need the Tauri shell; the browser preview rig has none. */
export const isTauri = (): boolean => "__TAURI_INTERNALS__" in window;

const describe = (problem: unknown): string => (problem instanceof Error ? problem.message : String(problem));

/** Open/save the problem file via native dialogs. The saved bytes are the
    editor text verbatim (WYSIWYG - hand-written comments reach the disk). */
export function useProblemFile(yamlText: string, editYaml: (text: string) => void) {
  const [fileError, setFileError] = useState<string | null>(null);

  const openFile = async () => {
    setFileError(null);
    try {
      const path = await openDialog({ multiple: false, filters: FILTERS });
      if (typeof path !== "string") return; // cancelled
      editYaml(await readTextFile(path));
    } catch (problem) {
      setFileError(`Open failed: ${describe(problem)}`);
    }
  };

  const saveFile = async () => {
    setFileError(null);
    try {
      const path = await saveDialog({ filters: FILTERS, defaultPath: "problem.yaml" });
      if (!path) return; // cancelled
      await writeTextFile(path, yamlText);
    } catch (problem) {
      setFileError(`Save failed: ${describe(problem)}`);
    }
  };

  return { fileError, openFile, saveFile };
}
