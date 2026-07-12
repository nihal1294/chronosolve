/** Timeline block hue priority (v26 Timeline spec): a hard conflict outranks
    the pinned indigo, which outranks the standard teal placement. */
export type BlockHue = "rose" | "indigo" | "teal";

export const blockHue = (conflicted: boolean, locked: boolean): BlockHue =>
  conflicted ? "rose" : locked ? "indigo" : "teal";
