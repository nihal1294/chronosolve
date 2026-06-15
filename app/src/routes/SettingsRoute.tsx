import { RoutePlaceholder } from "../components/RoutePlaceholder";

export function SettingsRoute() {
  return (
    <RoutePlaceholder
      title="Settings"
      subtitle="Scheduler settings (time limit, strategy, auto-save), appearance, notifications, and About ChronoSolve."
      tour="settings"
    />
  );
}
