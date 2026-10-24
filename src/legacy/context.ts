import { ancestorPath } from '../dom/tree.js';

export function eventRoot(element: Element): Element | undefined {
  return ancestorPath(element).find((node) => node.hasAttribute('data-gtm-event'));
}

/** The nearest marked scope wins; an explicit root is a hard upper bound. */
export function contextPath(element: Element, root?: Element): Element[] {
  const path = ancestorPath(element);
  const rootIndex = root ? path.indexOf(root) : path.length - 1;
  if (rootIndex < 0) return [];
  const bounded = path.slice(0, rootIndex + 1);
  const scopeIndex = bounded.findIndex((node) => node.hasAttribute('data-gtm-event'));
  return scopeIndex < 0 ? bounded : bounded.slice(0, scopeIndex + 1);
}

export function closestValue(path: Element[], attribute: string, fallback?: string): string | undefined {
  const element = path.find((node) => node.hasAttribute(attribute));
  return element ? element.getAttribute(attribute)! : fallback;
}
