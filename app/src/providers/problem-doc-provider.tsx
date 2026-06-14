import { createContext, useContext, type ReactNode } from "react";
import { useWorkspaceDoc, type WorkspaceDoc } from "../lib/use-workspace-doc";

const WorkspaceContext = createContext<WorkspaceDoc | null>(null);

/** Holds the single problem document + solve state above the router so it
    survives route changes (the structural change the route split forces). */
export function ProblemDocProvider({ children }: { children: ReactNode }) {
  return <WorkspaceContext.Provider value={useWorkspaceDoc()}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceDoc {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used within a ProblemDocProvider");
  return value;
}
