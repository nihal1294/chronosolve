import { expect, it } from "vitest";
import type { ProblemDoc } from "./problem-doc";
import { SOFTENED_TEMPLATES } from "./rule-templates-soft";
import { getSoftened, isSoftened, weightKeyFor } from "./soften";

const byId = (id: string) => {
  const template = SOFTENED_TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`missing template ${id}`);
  return template;
};

const doc: ProblemDoc = {
  subjects: [
    { id: "math", name: "Math", allowed_slots: [1] },
    { id: "art", name: "Art", allowed_slots: [2] },
  ],
  constraints: {
    advanced: {
      global_breaks: [
        { day: "Mon", slots: [1] },
        { day: "Tue", slots: [2] },
      ],
      hard_teacher_daily_caps: { t1: 3 },
      same_day_exclusions: [{ first: "math", second: "art" }],
      orderings: [{ first: "art", second: "math" }],
      softened: [
        { kind: "break", key: "1" },
        { kind: "allowed_slots", key: "math" },
        { kind: "teacher_cap", key: "t1" },
        { kind: "same_day", key: "0" },
        { kind: "ordering", key: "0" },
      ],
    },
  },
};

it("covers exactly the 5 softenable kinds with soft_<kind> weights", () => {
  const kinds = ["break", "allowed_slots", "teacher_cap", "same_day", "ordering"];
  expect(SOFTENED_TEMPLATES.map((t) => t.weightKey).sort()).toEqual(kinds.map((k) => weightKeyFor(k)).sort());
  expect(SOFTENED_TEMPLATES.every((t) => t.mode === "soft")).toBe(true);
});

it("derives only softened instances, with the hard twins' param shapes", () => {
  expect(byId("softened_break").derive(doc)).toEqual([
    { templateId: "softened_break", params: { day: "Tue", slots: [2] } },
  ]);
  expect(byId("softened_allowed_slots").derive(doc)).toEqual([
    { templateId: "softened_allowed_slots", params: { subject: "math", slots: [1] } },
  ]);
  expect(byId("softened_teacher_cap").derive(doc)).toEqual([
    { templateId: "softened_teacher_cap", params: { teacher: "t1", cap: 3 } },
  ]);
  expect(byId("softened_same_day").derive(doc)).toEqual([
    { templateId: "softened_same_day", params: { a: "math", b: "art" } },
  ]);
  expect(byId("softened_ordering").derive(doc)).toEqual([
    { templateId: "softened_ordering", params: { a: "art", b: "math" } },
  ]);
});

it("soft remove deletes the ref AND the underlying instance (list kind)", () => {
  const next = byId("softened_break").remove(doc, 0);
  const advanced = (next.constraints as { advanced: Record<string, unknown> }).advanced;
  expect(advanced.global_breaks).toEqual([{ day: "Mon", slots: [1] }]);
  expect(isSoftened(next, "break", "0")).toBe(false);
  expect(isSoftened(next, "break", "1")).toBe(false);
});

it("soft remove clears an entity-field kind (allowed_slots)", () => {
  const next = byId("softened_allowed_slots").remove(doc, 0);
  const subjects = next.subjects as { id: string; allowed_slots?: number[] }[];
  expect(subjects.find((s) => s.id === "math")?.allowed_slots).toBeUndefined();
  expect(isSoftened(next, "allowed_slots", "math")).toBe(false);
});

it("soft remove clears a teacher cap", () => {
  const next = byId("softened_teacher_cap").remove(doc, 0);
  const advanced = (next.constraints as { advanced: Record<string, unknown> }).advanced;
  expect(advanced.hard_teacher_daily_caps).toEqual({});
  expect(isSoftened(next, "teacher_cap", "t1")).toBe(false);
});

it("removing one kind's entry keeps sibling refs valid (no dangling)", () => {
  const next = byId("softened_break").remove(doc, 0);
  expect(getSoftened(next)).toContainEqual({ kind: "ordering", key: "0" });
  expect(getSoftened(next)).toContainEqual({ kind: "same_day", key: "0" });
});
