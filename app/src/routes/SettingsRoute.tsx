import { RoutePlaceholder } from "../components/RoutePlaceholder";

export function SettingsRoute() {
  return (
    <RoutePlaceholder
      title="Settings"
      subtitle="Solver configuration (time limit, strategy, auto-save), appearance, notifications, and About ChronoSolve."
      tour="settings"
    />
  );
}
