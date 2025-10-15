import { createFingerprint } from "../../utils/hash";

/**
 * Create a stable string that represents a DOM element.
 */
function getElementSignature(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const classes = el.classList.length ? `.${Array.from(el.classList).join('.')}` : "";
  const nth = getElementIndex(el); // position among siblings

  // Parent chain: the path from <html> down to this node
  const path = getDomPath(el);

  return `${tag}${id}${classes}${nth}|${path}`;
}

/**
 * Returns the element’s index among siblings of the same tag type.
 */
function getElementIndex(el: HTMLElement): number {
  const siblings = Array.from(el.parentNode?.children || []);
  const sameTagSiblings = siblings.filter(s => s.tagName === el.tagName);
  return sameTagSiblings.indexOf(el);
}

/**
 * Returns a simplified DOM path like html>body>div#root>main>button
 */
function getDomPath(el: Element): string {
  const path: string[] = [];
  let current: Element | null = el;
  while (current && current.tagName.toLowerCase() !== "html") {
    const tag = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : "";
    path.unshift(`${tag}${id}`);
    current = current.parentElement;
  }
  return path.join(">");
}

/**
 * Compute fingerprint for a given element.
 */
export function getElementFingerprint(el: HTMLElement): string {
  const signature = getElementSignature(el);
  return createFingerprint(signature);
}
