import { useEffect, useState } from "react";
import { solverClient } from "./solver-client";

export type EngineStatus = "connecting" | "ready" | "offline";

const POLL_MS = 5000;

/** Polls the local solver sidecar so both the status indicator AND the Run gate
    reflect a *live* reachability state. Probes on mount, then every POLL_MS.
    Polling (not a one-shot probe) matters two ways: in the packaged app the
    sidecar can finish starting *after* the webview mounts, and a single probe
    would lose that race and pin the engine "offline" forever; and if the engine
    later dies, the status recovers within one interval. In browser preview with
    no sidecar this settles on "offline". */
export function useEngineStatus(): EngineStatus {
  const [status, setStatus] = useState<EngineStatus>("connecting");

  useEffect(() => {
    let alive = true;
    const probe = () =>
      solverClient
        .health()
        .then((ok) => alive && setStatus(ok ? "ready" : "offline"))
        .catch(() => alive && setStatus("offline"));
    probe();
    const id = setInterval(probe, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return status;
}
