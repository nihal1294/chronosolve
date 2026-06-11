import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryState {
  error: Error | null;
}

/** Last-resort fallback so a render crash never white-screens the app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="h-full flex items-center justify-center p-8 bg-white dark:bg-neutral-950">
        <section className="max-w-md p-6 rounded-2xl border shadow-sm space-y-4 bg-red-50 border-red-100 dark:bg-red-950/20 dark:border-red-900/50">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
              <AlertTriangle size={20} />
            </span>
            <h3 className="font-semibold text-red-800 dark:text-red-200">Something went wrong</h3>
          </div>
          <p className="text-sm font-mono break-words text-red-700 dark:text-red-300">
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white dark:bg-neutral-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 text-sm font-medium rounded-lg transition-colors"
          >
            Reload App
          </button>
        </section>
      </div>
    );
  }
}
