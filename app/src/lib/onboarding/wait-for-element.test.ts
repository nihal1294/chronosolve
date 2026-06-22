import { afterEach, describe, expect, test } from "vitest";

import { waitForElement } from "./wait-for-element";

afterEach(() => {
  document.body.replaceChildren();
});

describe("waitForElement", () => {
  test("resolves immediately when the element is already present", async () => {
    const el = document.createElement("div");
    el.setAttribute("data-tour", "now");
    document.body.appendChild(el);
    expect(await waitForElement('[data-tour="now"]', 1000)).toBe(el);
  });

  test("resolves once the element is inserted asynchronously", async () => {
    const pending = waitForElement('[data-tour="later"]', 1000);
    setTimeout(() => {
      const el = document.createElement("div");
      el.setAttribute("data-tour", "later");
      document.body.appendChild(el);
    }, 10);
    const found = await pending;
    expect(found?.getAttribute("data-tour")).toBe("later");
  });

  test("resolves null when the element never appears before the timeout", async () => {
    expect(await waitForElement('[data-tour="never"]', 30)).toBeNull();
  });
});
