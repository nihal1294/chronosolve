import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./env";

/** Open the OS print dialog for the current page.

    WKWebView silently ignores window.print() (confirmed live in the
    desktop shell), so the app routes printing through the print_page
    Rust command, which runs the native macOS print operation. The
    browser preview keeps the standard window.print() path. */
export async function printPage(): Promise<void> {
  if (isTauri()) {
    await invoke("print_page");
    return;
  }
  window.print();
}
