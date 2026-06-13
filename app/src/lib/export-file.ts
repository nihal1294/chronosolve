import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { isTauri } from "./env";
import type { ScheduleEntry } from "./solver-client";

/** RFC 4180: quote a field when it contains a delimiter, quote, or newline. */
const csvField = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Schedule as CSV with the same columns as the backend exporter
    (io/exporters.py to_csv): day, slot, subject, teachers, groups, room. */
export function toCsv(schedule: ScheduleEntry[]): string {
  const lines = [["day", "slot", "subject", "teachers", "groups", "room"].join(",")];
  for (const entry of schedule) {
    lines.push(
      [
        entry.day,
        String(entry.slot),
        entry.subject_id,
        entry.teacher_ids.join(";"),
        entry.group_ids.join(";"),
        entry.room_id ?? "",
      ]
        .map(csvField)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Save via the native dialog in the app; download via a Blob anchor in the
    browser preview. Returns false when the user cancels the dialog. */
export async function saveTextFile(suggestedName: string, text: string): Promise<boolean> {
  if (isTauri()) {
    const extension = suggestedName.split(".").pop() ?? "txt";
    const path = await save({
      defaultPath: suggestedName,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (path === null) return false;
    await writeTextFile(path, text);
    return true;
  }
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}
