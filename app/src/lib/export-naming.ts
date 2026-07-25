/** Naming and reporting copy for a calendar export: what the saved file is
    called, and what the export could not carry. Pure string work, kept out of
    the card so both are readable and testable on their own. */

/** Filename for the save dialog. Keeps letters and digits from any script, so a
    teacher named 张伟 gets their name rather than the "-.ics" dotfile an
    ASCII-only slug leaves behind, and falls back to the id then a constant for
    a name that carries no letters at all. */
export function fileSlug(name: string, id: string): string {
  const slug = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
  return slug(name) || slug(id) || "calendar";
}

/** Labels entities for a reader who cannot see their ids. Only ids are unique,
    so two teachers may genuinely share a name; those get the id appended and
    the rest keep the plain name, since an id helps nobody when the name is
    already unambiguous. */
export function labelUniquely<T extends { id: string; name: string }>(items: T[]): (item: T) => string {
  const seen = new Map<string, number>();
  for (const item of items) seen.set(item.name, (seen.get(item.name) ?? 0) + 1);
  return (item) => ((seen.get(item.name) ?? 0) > 1 ? `${item.name} (${item.id})` : item.name);
}

/** Names what a calendar left out, so a short export is never silent: days that
    are not weekdays, and slots the labels left no room for. */
export function skipNote(skipped: string[], unplaced: number[]): string {
  const reasons = [
    skipped.length > 0 ? `unrecognized days: ${skipped.join(", ")}` : null,
    unplaced.length > 0 ? `slots with no time left in the day: ${unplaced.join(", ")}` : null,
  ].filter((reason) => reason !== null);
  return reasons.length > 0 ? ` (skipped ${reasons.join("; ")})` : "";
}
