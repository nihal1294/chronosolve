import { RoutePlaceholder } from "../components/RoutePlaceholder";

export function ConstraintEngineRoute() {
  return (
    <RoutePlaceholder
      title="Constraints"
      subtitle="The rules every timetable must satisfy, plus weighted preferences it should try to honor - with presets and post-run impact."
      tour="constraints"
    />
  );
}
