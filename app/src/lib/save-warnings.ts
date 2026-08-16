/** What Save should warn about before writing the problem file: session edits
    live outside the document until Apply writes them in, so saving now
    produces a problem that re-solves away from what the screen shows.

    Pins and unplaced sessions are counted SEPARATELY on purpose. An unplace
    has no pin for Apply to write - "un-decided" is the document's default
    state, so there is nothing to record - which means a warning gated on the
    pin count alone stays silent while the edit really does vanish on save.
    Folding the two together would be worse than silence: it would tell
    someone to Apply an unplace, which does nothing. */
export function saveWarnings(unappliedPins: number, unplaced: number): string[] {
  const warnings: string[] = [];
  if (unappliedPins > 0) {
    const subject = unappliedPins === 1 ? "edit is" : "edits are";
    warnings.push(
      `${unappliedPins} session ${subject} not applied - Apply edits writes them into the problem`,
    );
  }
  if (unplaced > 0) {
    const subject = unplaced === 1 ? "session is" : "sessions are";
    warnings.push(
      `${unplaced} unplaced ${subject} not saved - re-run with locks to have the scheduler place those hours`,
    );
  }
  return warnings;
}
