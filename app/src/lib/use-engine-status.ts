import { useEffect, useState } from "react";
import { solverClient } from "./solver-client";

export type EngineStatus = "connecting" | "ready" | "offline";

/** Probes the local solver sidecar once on mount so the status bar can show a
    real reachability state. In browser preview (no sidecar) this settles on
    "offline"; under `just web`/the packaged app it reaches "ready". */
export function useEngineStatus(): EngineStatus {
  const [status, setStatus] = useState<EngineStatus>("connecting");

  useEffect(() => {
    let alive = true;
    solverClient
      .health()
      .then((ok) => alive && setStatus(ok ? "ready" : "offline"))
      .catch(() => alive && setStatus("offline"));
    return () => {
      alive = false;
    };
  }, []);

  return status;
}
