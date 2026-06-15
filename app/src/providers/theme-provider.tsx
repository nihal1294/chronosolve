import { ThemeProvider as NextThemes } from "next-themes";
import type { ReactNode } from "react";

/** App-wide theme controller. next-themes writes a `.dark` class on <html>
    (the variant theme.css keys off) and persists the choice; the brand chrome
    reads `resolvedTheme` instead of the old hardcoded isDark flag. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      storageKey="chronosolve-theme"
    >
      {children}
    </NextThemes>
  );
}
