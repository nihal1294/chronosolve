/** Resolve when `selector` is in the DOM, or null once `timeoutMs` elapses.
 *
 *  Used by the tour engine after a cross-route navigation: the next route's
 *  target may mount a tick later, so we observe rather than guess with a fixed
 *  sleep. Returns null (never rejects) so the engine can skip a step whose
 *  target never appears instead of hanging. */
export function waitForElement(selector: string, timeoutMs = 2000): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeoutMs);
  });
}
