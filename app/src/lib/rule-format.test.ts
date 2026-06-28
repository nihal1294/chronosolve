import { describe, expect, it } from "vitest";
import { buildNameMaps, formatTags, parseTags, summarizeParams, type NameMaps } from "./rule-format";
import { getTemplate, type RuleTemplate } from "./rule-templates";

const names: NameMaps = buildNameMaps({
  subjects: [
    { id: "pe", name: "PE" },
    { id: "chem", name: "Chemistry" },
    { id: "math", name: "Math" },
  ],
  teachers: [{ id: "t1", name: "Dr. One" }],
  groups: [{ id: "g1", name: "Year 1" }],
  rooms: [{ id: "lab1", name: "Lab 1" }],
} as Parameters<typeof buildNameMaps>[0]);

const must = (id: string): RuleTemplate => {
  const t = getTemplate(id);
  if (!t) throw new Error(`no template ${id}`);
  return t;
};

describe("parseTags / formatTags", () => {
  it("splits, trims, and drops blanks", () => {
    expect(parseTags(" gpu, projector ,, ")).toEqual(["gpu", "projector"]);
    expect(parseTags("")).toEqual([]);
  });

  it("formatTags joins an array and tolerates non-arrays", () => {
    expect(formatTags(["gpu", "hd"])).toBe("gpu, hd");
    expect(formatTags(undefined)).toBe("");
  });
});

describe("summarizeParams", () => {
  it("resolves entity-ref params to names, joined", () => {
    const t = must("subjects_not_same_day");
    expect(summarizeParams(t, { templateId: t.id, params: { a: "pe", b: "chem" } }, names)).toBe(
      "PE · Chemistry",
    );
  });

  it("formats slots and resolves the subject", () => {
    const t = must("subject_allowed_slots");
    expect(summarizeParams(t, { templateId: t.id, params: { subject: "math", slots: [1, 2] } }, names)).toBe(
      "Math · slots 1, 2",
    );
  });

  it("is empty for a global toggle with no params", () => {
    const t = must("room_capacity");
    expect(summarizeParams(t, { templateId: t.id, params: {} }, names)).toBe("");
  });
});
