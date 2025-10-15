import { getElementFingerprint } from "./fingerprint";

export function startDomObservation(onNewElement: (el: HTMLElement, fp: string) => void) {
  // Fingerprint existing elements in the document at startup
  try {
    const existing = Array.from(document.body.querySelectorAll<HTMLElement>("*"));
    for (const el of existing) {
      try {
        const fp = getElementFingerprint(el);
        el.dataset.fp = fp;
        onNewElement(el, fp);
      } catch (err) {
        // ignore individual element errors
      }
    }
  } catch (err) {
    // if document.body isn't ready, ignore
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        // If an element is added, fingerprint it and its subtree
        if (node instanceof HTMLElement) {
          const toProcess: HTMLElement[] = [node];
          toProcess.push(...Array.from(node.querySelectorAll<HTMLElement>("*")));
          for (const el of toProcess) {
            try {
              const fp = getElementFingerprint(el);
              el.dataset.fp = fp; // attach the fingerprint to the DOM
              onNewElement(el, fp);
            } catch (err) {
              // ignore per-element errors
            }
          }
        }
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log("DOM fingerprint observer started.");
}
