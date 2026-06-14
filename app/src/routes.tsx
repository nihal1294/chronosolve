import { createHashRouter, type RouteObject } from "react-router";
import { ApplicationShell } from "./routes/ApplicationShell";
import { DashboardRoute } from "./routes/DashboardRoute";
import { TimetableRoute } from "./routes/TimetableRoute";
import { DataETLRoute } from "./routes/DataETLRoute";
import { ConstraintEngineRoute } from "./routes/ConstraintEngineRoute";
import { SolverMonitorRoute } from "./routes/SolverMonitorRoute";
import { SettingsRoute } from "./routes/SettingsRoute";
import { DesignSystemRoute } from "./routes/DesignSystem";

// Hash routing: a Tauri webview has no history server, so createBrowserRouter
// blank-screens on reload. createHashRouter is the proven desktop pattern.
// Children follow the user journey: data in -> rules -> solve -> output.
const routes: RouteObject[] = [
  {
    path: "/",
    Component: ApplicationShell,
    children: [
      { index: true, Component: DashboardRoute },
      { path: "data", Component: DataETLRoute },
      { path: "constraints", Component: ConstraintEngineRoute },
      { path: "solver", Component: SolverMonitorRoute },
      { path: "timetable", Component: TimetableRoute },
      { path: "settings", Component: SettingsRoute },
    ],
  },
];

// The component styleguide is an internal dev reference, not a user-facing
// screen - registered only in dev builds, never shipped in the packaged app.
if (import.meta.env.DEV) {
  routes.push({ path: "/design-system", Component: DesignSystemRoute });
}

export const router = createHashRouter(routes);
