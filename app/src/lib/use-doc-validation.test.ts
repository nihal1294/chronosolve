import { describe, expect, it } from "vitest";
import { reportFromError } from "./use-doc-validation";
import { SolverHttpError } from "./solver-client";

describe("reportFromError", () => {
  it("surfaces a 422 schema/load rejection as a banner error", () => {
    const report = reportFromError(new SolverHttpError(422, "soft weight must be <= 100", "msg"));
    expect(report).toEqual({ errors: ["soft weight must be <= 100"], warnings: [] });
  });

  it("treats a server fault (5xx) as unknown - no banner", () => {
    expect(reportFromError(new SolverHttpError(500, "Internal Server Error", "msg"))).toBeNull();
  });

  it("treats a transport failure (network/timeout) as unknown - no banner", () => {
    expect(reportFromError(new TypeError("Failed to fetch"))).toBeNull();
    expect(reportFromError(new DOMException("timed out", "TimeoutError"))).toBeNull();
  });
});
