import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { ThemeProvider } from "./providers/theme-provider";
import { ProblemDocProvider } from "./providers/problem-doc-provider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { router } from "./routes";
import "./styles/index.css";
import "driver.js/dist/driver.css";
import "./styles/onboarding.css";

// ProblemDocProvider sits OUTSIDE the router so the document + solve state
// survive route changes instead of being scoped to one window component.
createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ProblemDocProvider>
          <RouterProvider router={router} />
        </ProblemDocProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
