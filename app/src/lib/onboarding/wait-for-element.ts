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

    // One settle path for both outcomes (target appeared / timed out): tear down
    // the observer AND the timer, so the loser of the race can't leak. Hoisted so
    // the observer and timeout callbacks below can both call it.
    function finish(result: Element | null) {
      observer.disconnect();
      clearTimeout(timer);
      resolve(result);
    }

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) finish(found);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => finish(document.querySelector(selector)), timeoutMs);
  });
}
