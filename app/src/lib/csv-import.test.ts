import { describe, expect, it } from "vitest";
import { applyMapping, autoMatch, missingRequired } from "./csv-import";

const COURSE_HEADERS = [
  "Course_ID",
  "Course_Title",
  "Abbrev",
  "Hours_Per_Week",
  "Is_Lab",
  "Instructor_Name",
  "Section",
];

describe("autoMatch", () => {
  it("matches the legacy course headers, leaving unknown ones unmapped", () => {
    expect(autoMatch(COURSE_HEADERS, "subjects")).toEqual({
      Course_ID: "id",
      Course_Title: "name",
      Abbrev: "",
      Hours_Per_Week: "hours_per_week",
      Is_Lab: "type",
      Instructor_Name: "teacher_ids",
      Section: "group_ids",
    });
  });

  it("resolves the same header by entity kind: Instructor_Name is a professor's name", () => {
    expect(autoMatch(["Instructor_Name", "Department"], "teachers")).toEqual({
      Instructor_Name: "name",
      Department: "",
    });
    expect(autoMatch(["Section", "Section_Name", "Strength"], "student_groups")).toEqual({
      Section: "id",
      Section_Name: "name",
      Strength: "size",
    });
  });
});

describe("missingRequired", () => {
  it("treats a mapped name as satisfying the id requirement", () => {
    expect(missingRequired({ Instructor_Name: "name" }, "teachers")).toEqual([]);
    expect(missingRequired({ Department: "" }, "teachers")).toEqual(["ID (primary key)", "Name"]);
  });

  it("lists unmapped required subject fields", () => {
    const partial = autoMatch(["Course_ID", "Course_Title"], "subjects");
    expect(missingRequired(partial, "subjects")).toEqual(["Hours per week", "Teachers", "Student groups"]);
  });
});

describe("applyMapping", () => {
  const mapping = autoMatch(COURSE_HEADERS, "subjects");

  it("coerces ints, booleans-to-type, and slugged id lists", () => {
    const { entities, errors } = applyMapping(
      [
        {
          Course_ID: "DS-DSD-LAB-A",
          Course_Title: "DS Lab",
          Hours_Per_Week: "6",
          Is_Lab: "True",
          Instructor_Name: "Sannidhan M S, Raghunandan K R",
          Section: "sec_a",
        },
      ],
      mapping,
      "subjects",
    );
    expect(errors).toEqual([]);
    expect(entities).toEqual([
      {
        id: "DS-DSD-LAB-A",
        name: "DS Lab",
        hours_per_week: 6,
        type: "lab",
        teacher_ids: ["sannidhan_m_s", "raghunandan_k_r"],
        group_ids: ["sec_a"],
      },
    ]);
  });

  it("derives teacher ids from names when no id column is mapped", () => {
    const { entities } = applyMapping(
      [{ Instructor_Name: "Minu P Abraham" }],
      { Instructor_Name: "name" },
      "teachers",
    );
    expect(entities).toEqual([{ id: "minu_p_abraham", name: "Minu P Abraham" }]);
  });

  it("collects per-row errors and skips those rows", () => {
    const { entities, errors } = applyMapping(
      [
        { Course_ID: "X", Course_Title: "Bad", Hours_Per_Week: "lots", Instructor_Name: "T", Section: "g" },
        { Course_ID: "OK", Course_Title: "Fine", Hours_Per_Week: "3", Instructor_Name: "T", Section: "g" },
      ],
      mapping,
      "subjects",
    );
    expect(entities.map((entity) => entity.id)).toEqual(["OK"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Row 1: .*positive whole number/);
  });
});
