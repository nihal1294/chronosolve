import { useState } from "react";
import type { NavSelection, EntityKind } from "../components/Sidebar";
import type { WorkspaceView } from "../components/Toolbar";

/** Workspace view + entity-table selection, and the sidebar's view of it. */
export function useWorkspaceNav() {
  const [view, setView] = useState<WorkspaceView>("editor");
  const [tableEntity, setTableEntity] = useState<EntityKind>("subjects");

  const navSelection: NavSelection | null =
    view === "editor" || view === "constraints"
      ? { kind: view }
      : view === "table"
        ? { kind: "entity", entity: tableEntity }
        : null;

  const onNav = (selection: NavSelection) => {
    if (selection.kind === "entity") {
      setTableEntity(selection.entity);
      setView("table");
    } else setView(selection.kind);
  };

  const goToTable = (entity: EntityKind) => onNav({ kind: "entity", entity });

  return { view, setView, tableEntity, navSelection, onNav, goToTable };
}
