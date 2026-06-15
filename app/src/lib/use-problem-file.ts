import { useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { isTauri } from "./env";

// isTauri lives in env.ts now; re-export so existing callers of this module
// keep working while other utilities import it from env directly.
export { isTauri } from "./env";

const FILTERS = [{ name: "Timetable problem", extensions: ["yaml", "yml", "json"] }];
const ACCEPT = ".yaml,.yml,.json";

const describe = (problem: unknown): string => (problem instanceof Error ? problem.message : String(problem));

/** Browser file picker (no Tauri): resolves the chosen file's text, or null
    when the dialog is dismissed. */
function pickFileText(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

/** Browser "save": download the text as a file. */
function downloadText(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/yaml" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Open/save the problem file (YAML or JSON). Uses the native Tauri dialogs in
    the desktop app and falls back to an HTML file input / download in the
    browser, so loading your own problem file works in both. Saved bytes are the
    editor text verbatim (WYSIWYG - hand-written comments reach the disk). */
export function useProblemFile(yamlText: string, editYaml: (text: string) => void) {
  const [fileError, setFileError] = useState<string | null>(null);

  const openFile = async () => {
    setFileError(null);
    try {
      if (isTauri()) {
        const path = await openDialog({ multiple: false, filters: FILTERS });
        if (typeof path !== "string") return; // cancelled
        editYaml(await readTextFile(path));
      } else {
        const text = await pickFileText(ACCEPT);
        if (text !== null) editYaml(text);
      }
    } catch (problem) {
      setFileError(`Open failed: ${describe(problem)}`);
    }
  };

  const saveFile = async () => {
    setFileError(null);
    try {
      if (isTauri()) {
        const path = await saveDialog({ filters: FILTERS, defaultPath: "problem.yaml" });
        if (!path) return; // cancelled
        await writeTextFile(path, yamlText);
      } else {
        downloadText(yamlText, "problem.yaml");
      }
    } catch (problem) {
      setFileError(`Save failed: ${describe(problem)}`);
    }
  };

  return { fileError, openFile, saveFile };
}
