import type { HelpTopic } from "./help-topics";

/** Ambient help hints, lit up while Help Mode is on. Each points at a specific
 *  control across the chrome and every route; the overlay shows only the ones
 *  whose anchor is on the current screen. Keep blurbs to one short sentence. */
export const HINT_TOPICS: HelpTopic[] = [
  // --- Always-present chrome ---
  {
    id: "hint-palette",
    anchor: "command-palette",
    title: "Quick actions",
    blurb: "Press Cmd-K to search and jump to any command - run the scheduler, open a file, switch routes.",
    side: "bottom",
    hint: true,
  },
  {
    id: "hint-theme",
    anchor: "theme-toggle",
    title: "Theme",
    blurb: "Switch between light and dark, or follow your system from Settings.",
    side: "bottom",
    hint: true,
  },
  {
    id: "hint-help",
    anchor: "help",
    title: "Help & tour",
    blurb: "Replay the guided tour, toggle these hints, or open the keyboard shortcuts.",
    side: "bottom",
    hint: true,
  },
  {
    id: "hint-engine",
    anchor: "engine-status",
    title: "Scheduler status",
    blurb: "Live status of the local scheduling service - green means it is ready to solve.",
    side: "right",
    hint: true,
  },

  // --- Dashboard ---
  {
    id: "hint-dashboard-actions",
    anchor: "dashboard-actions",
    title: "Run & reset",
    blurb: "Start (or re-run) the scheduler, or clear everything to begin a new problem.",
    side: "bottom",
    hint: true,
  },
  {
    id: "hint-dashboard-pipeline",
    anchor: "dashboard-pipeline",
    title: "Scheduling pipeline",
    blurb: "The three stages from data to a solved schedule - each card jumps to that step.",
    side: "over",
    hint: true,
  },

  // --- Data ---
  {
    id: "hint-data-actions",
    anchor: "data-actions",
    title: "Open & import",
    blurb: "Open a saved YAML/JSON problem, or import entities from CSV files.",
    side: "bottom",
    hint: true,
  },
  {
    id: "hint-data-views",
    anchor: "data-views",
    title: "Tables, YAML & entities",
    blurb: "Edit as structured tables or raw YAML, and switch between course/instructor/group/room tabs.",
    side: "bottom",
    hint: true,
  },

  // --- Constraints ---
  {
    id: "hint-constraints-hard",
    anchor: "constraints-hard",
    title: "Hard rules",
    blurb: "Rules every timetable must satisfy - the scheduler will never break these.",
    side: "over",
    hint: true,
  },
  {
    id: "hint-constraints-presets",
    anchor: "constraints-presets",
    title: "Preference presets",
    blurb: "Pick a balance (student-first, teacher-first...) or tune each soft preference's importance.",
    side: "bottom",
    hint: true,
  },

  // --- Scheduler ---
  {
    id: "hint-solver-run",
    anchor: "solver-run",
    title: "Run controls",
    blurb: "Start the solve, re-run it, or halt a run in progress.",
    side: "bottom",
    hint: true,
  },
  {
    id: "hint-solver-state",
    anchor: "solver-state",
    title: "Live progress",
    blurb: "The current phase and the best timetable found so far, with quality and export once it finishes.",
    side: "over",
    hint: true,
  },

  // --- Timetable ---
  {
    id: "hint-timetable-toolbar",
    anchor: "timetable-toolbar",
    title: "Perspective & filters",
    blurb: "View by class, teacher, or room, and combine filters to focus any slice.",
    side: "bottom",
    hint: true,
  },
  {
    id: "hint-timetable-grid",
    anchor: "timetable-grid",
    title: "The schedule",
    blurb: "The solved week. Click a session to inspect it, then pin the ones you want to keep.",
    side: "over",
    hint: true,
  },

  // --- Settings ---
  {
    id: "hint-settings-appearance",
    anchor: "settings-appearance",
    title: "Appearance",
    blurb: "Choose a theme or follow your system.",
    side: "over",
    hint: true,
  },
  {
    id: "hint-settings-scheduler",
    anchor: "settings-scheduler",
    title: "Solver limits",
    blurb: "How long the scheduler searches before returning its best timetable.",
    side: "over",
    hint: true,
  },
];
