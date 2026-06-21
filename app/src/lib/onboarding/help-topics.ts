import type { Side } from "driver.js";

/** Single source of truth for the app's help content. Each topic is keyed to an
 *  element's `data-tour` anchor and feeds one of the two presentations:
 *   - the guided tour (`TOUR_TOPICS`, stepped through in order), and
 *   - help hints (`HINT_TOPICS` in ./hint-topics, lit up while Help Mode is on).
 *  Annotate an element once and it is available to whichever consumer needs it.
 *  Anchorless topics (welcome/finish) render a centered tour popover. */

/** Every `data-tour` anchor a topic may reference. Renaming or removing one in
 *  the UI without updating this list breaks the contract test, not the feature. */
export const HELP_ANCHORS = [
  "sidebar",
  "command-palette",
  "engine-status",
  "theme-toggle",
  "help",
  "data",
  "constraints",
  "solver",
  "timetable",
  "dashboard-actions",
  "dashboard-pipeline",
  "data-actions",
  "data-views",
  "constraints-hard",
  "constraints-presets",
  "solver-run",
  "solver-state",
  "timetable-toolbar",
  "timetable-grid",
  "settings-appearance",
  "settings-scheduler",
] as const;

export type HelpAnchor = (typeof HELP_ANCHORS)[number];

export interface HelpTopic {
  /** Stable id (unique across topics; an anchor can back both a tour + hint topic). */
  id: string;
  /** `data-tour` anchor; absent for the centered welcome/finish tour steps. */
  anchor?: HelpAnchor;
  /** Route to navigate to before highlighting (tour only). */
  route?: string;
  title: string;
  blurb: string;
  /** Popover/tooltip placement relative to the anchor. */
  side?: Side;
  /** 1-based position in the guided tour; absent = not part of the tour. */
  tourOrder?: number;
  /** Surfaced as an ambient help hint while Help Mode is on. */
  hint?: boolean;
}

/** CSS selector for an anchor id, e.g. `[data-tour="solver"]`. */
export const anchorSelector = (anchor: string): string => `[data-tour="${anchor}"]`;

/** The guided tour: a centered welcome, one stop per workflow stage (each on its
 *  route), and a finish on the command palette that points at the help system. */
export const TOUR_TOPICS: HelpTopic[] = [
  {
    id: "welcome",
    title: "Welcome to ChronoSolve",
    blurb:
      "Build a conflict-free timetable in a few guided steps. This quick tour shows you the workflow - you can skip anytime.",
    tourOrder: 1,
  },
  {
    id: "tour-sidebar",
    anchor: "sidebar",
    title: "Your workspace",
    blurb:
      "Each section here is one stage of scheduling, top to bottom: data, constraints, the scheduler, then the finished timetable.",
    side: "right",
    tourOrder: 2,
  },
  {
    id: "tour-data",
    anchor: "data",
    route: "/data",
    title: "1. Add your data",
    blurb:
      "Import courses, instructors, rooms and groups from CSV - or load the bundled template to explore. Edit as tables or raw YAML.",
    side: "over",
    tourOrder: 3,
  },
  {
    id: "tour-constraints",
    anchor: "constraints",
    route: "/constraints",
    title: "2. Set the rules",
    blurb:
      "Toggle the hard rules the scheduler must satisfy, and weight the soft preferences it should optimize for.",
    side: "over",
    tourOrder: 4,
  },
  {
    id: "tour-solver",
    anchor: "solver",
    route: "/solver",
    title: "3. Run the scheduler",
    blurb:
      "Start the optimizer and watch it converge live - the best timetable improves as it runs, and you can halt anytime.",
    side: "over",
    tourOrder: 5,
  },
  {
    id: "tour-timetable",
    anchor: "timetable",
    route: "/timetable",
    title: "4. View your timetable",
    blurb:
      "Your solved schedule appears here - view it by class, teacher or room, filter it, and pin sessions to keep before re-solving.",
    side: "over",
    tourOrder: 6,
  },
  {
    id: "finish",
    anchor: "command-palette",
    title: "You're all set",
    blurb:
      "Press Cmd-K anytime for quick actions, and turn on help hints (Cmd-/) for a guided dot on every key control. Replay this tour from the Help menu whenever you like.",
    side: "bottom",
    tourOrder: 7,
  },
];

/** One step of the guided tour (the shape `use-onboarding` consumes). */
export interface TourStep {
  anchor?: HelpAnchor;
  route?: string;
  title: string;
  body: string;
  side?: Side;
}

/** Routes the tour navigates to (contract-tested). */
export const TOUR_ROUTES = ["/", "/data", "/constraints", "/solver", "/timetable"] as const;

/** The ordered guided tour, derived from the tour topics. */
export const TOUR_STEPS: TourStep[] = [...TOUR_TOPICS]
  .sort((a, b) => (a.tourOrder ?? 0) - (b.tourOrder ?? 0))
  .map((topic) => ({
    anchor: topic.anchor,
    route: topic.route,
    title: topic.title,
    body: topic.blurb,
    side: topic.side,
  }));
