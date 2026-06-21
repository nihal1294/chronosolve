import { describe, expect, test } from "vitest";

import { HELP_ANCHORS, TOUR_ROUTES, TOUR_STEPS, TOUR_TOPICS } from "./help-topics";
import { HINT_TOPICS } from "./hint-topics";

const ALL_TOPICS = [...TOUR_TOPICS, ...HINT_TOPICS];

describe("help-topics registry", () => {
  test("every topic that targets an element uses a declared anchor", () => {
    const valid = new Set<string>(HELP_ANCHORS);
    for (const topic of ALL_TOPICS) {
      if (topic.anchor) expect(valid.has(topic.anchor), `unknown anchor "${topic.anchor}"`).toBe(true);
    }
  });

  test("topic ids are unique across tour and hints", () => {
    const ids = ALL_TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every hint topic is anchored (a hint with nothing to point at is useless)", () => {
    expect(HINT_TOPICS.length).toBeGreaterThan(0);
    for (const topic of HINT_TOPICS) {
      expect(topic.hint).toBe(true);
      expect(topic.anchor, `hint "${topic.id}" has no anchor`).toBeDefined();
    }
  });

  test("the tour is ordered, opens with a centered welcome, and ends anchored", () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(5);
    expect(TOUR_STEPS[0].anchor).toBeUndefined();
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].anchor).toBeDefined();
  });

  test("every routed tour step navigates to a known route", () => {
    const routes = new Set<string>(TOUR_ROUTES);
    for (const step of TOUR_STEPS) {
      if (step.route) expect(routes.has(step.route)).toBe(true);
    }
  });
});
