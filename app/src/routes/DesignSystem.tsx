import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";

/** Standalone design-system showcase. Stub for Phase 1 (top-level route with
    its own chrome, outside ApplicationShell); the full 19-section styleguide
    incl. the About card is built in Phase 2. */
export function DesignSystemRoute() {
  return (
    <div className="h-screen w-full overflow-y-auto bg-neutral-950 text-neutral-100 font-sans">
      <header className="h-14 border-b border-neutral-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <BrandLogo variant="app-icon" size={22} animated={false} theme="dark" />
          <span className="font-semibold tracking-tight">ChronoSolve Design System</span>
        </div>
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-800 text-neutral-300 hover:bg-neutral-900 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to app
        </Link>
      </header>
      <main className="p-8">
        <h1 className="text-2xl font-bold tracking-tight">Design System</h1>
        <p className="mt-2 max-w-prose text-sm text-neutral-400">
          The exhaustive component showcase (logo, typography, colors, UI primitives, timelines, solver
          states, constraint builder, metrics, and the About card) is assembled in Phase 2.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-400">
          19 sections coming in M5 Phase 2
        </div>
      </main>
    </div>
  );
}
