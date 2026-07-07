import { afterEach, describe, expect, it, vi } from "vitest";
import { solverClient, type SolveStreamOptions } from "./solver-client";

// Minimal SSE body: one result event, so solveStream resolves cleanly.
const SSE_RESULT = 'event: result\ndata: {"status":"optimal","schedule":[],"quality_score":100}\n\n';

describe("solveStream request body (M7.5 refine)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function captureBody(options: SolveStreamOptions = {}): Promise<Record<string, unknown>> {
    vi.stubEnv("VITE_SOLVER_URL", "http://solver.test");
    let body: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(SSE_RESULT, { status: 200 });
      }),
    );
    await solverClient.solveStream({ teachers: [] }, 5, options);
    return body;
  }

  it("sends refine: true when polish is requested", async () => {
    const body = await captureBody({ refine: true });
    expect(body.refine).toBe(true);
    expect(body.time_limit).toBe(5);
  });

  it("defaults to refine: false so plain solves are unchanged", async () => {
    expect((await captureBody()).refine).toBe(false);
  });
});
