import { beforeEach, describe, expect, it, vi } from "vitest";
import { printPage } from "./print-page";

const mocks = vi.hoisted(() => ({ isTauri: vi.fn(), invoke: vi.fn() }));
vi.mock("./env", () => ({ isTauri: mocks.isTauri }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

describe("printPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints through the Rust command in the desktop shell (WKWebView ignores window.print)", async () => {
    mocks.isTauri.mockReturnValue(true);
    mocks.invoke.mockResolvedValue(undefined);
    const browserPrint = vi.fn<() => void>();
    window.print = browserPrint;

    await printPage();

    expect(mocks.invoke).toHaveBeenCalledWith("print_page");
    expect(browserPrint).not.toHaveBeenCalled();
  });

  it("falls back to window.print in the browser", async () => {
    mocks.isTauri.mockReturnValue(false);
    const browserPrint = vi.fn<() => void>();
    window.print = browserPrint;

    await printPage();

    expect(browserPrint).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
