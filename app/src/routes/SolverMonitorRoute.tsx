import { RoutePlaceholder } from "../components/RoutePlaceholder";

export function SolverMonitorRoute() {
  return (
    <RoutePlaceholder
      title="Solver Monitor"
      subtitle="Live solve lifecycle over SSE (ready, optimizing, optimal, infeasible) plus the post-solve results and analytics."
      tour="solver"
    />
  );
}
