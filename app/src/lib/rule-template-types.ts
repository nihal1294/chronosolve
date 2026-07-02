/** Type surface of the M7.2 rule registry, extracted from rule-template-kit
    so the kit stays within the file-size budget. */

import type { ProblemDoc } from "./problem-doc";

export type ParamKind =
  | "subject"
  | "teacher"
  | "group"
  | "room"
  | "subjects"
  | "slots"
  | "tags"
  | "day"
  | "half"
  | "number";

export interface ParamDef {
  key: string;
  label: string;
  kind: ParamKind;
}

export type RuleCategory = "Time" | "Teacher" | "Group" | "Subject" | "Room" | "Fairness";
export type RuleMode = "hard" | "soft";

export interface RuleInstance {
  templateId: string;
  params: Record<string, unknown>;
}

export interface RuleTemplate {
  id: string;
  category: RuleCategory;
  label: string;
  mode: RuleMode;
  params: ParamDef[];
  /** Global soft-weight lever (the importance control); set only for soft rules. */
  weightKey?: string;
  serialize: (instance: RuleInstance, doc: ProblemDoc) => ProblemDoc;
  derive: (doc: ProblemDoc) => RuleInstance[];
  /** Remove the index-th derived instance of this template from the doc. */
  remove: (doc: ProblemDoc, index: number) => ProblemDoc;
}
