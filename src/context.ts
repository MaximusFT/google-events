/** Traverse DOM elements without ever returning Document or ShadowRoot as an element. */
export function parentElement(element: Element): Element | null {
  if (element.assignedSlot) return element.assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return 'host' in root ? (root as ShadowRoot).host : null;
}

export function ancestorPath(element: Element): Element[] {
  const path: Element[] = [];
  const visited = new Set<Element>();
  let current: Element | null = element;
  while (current && !visited.has(current)) {
    visited.add(current);
    path.push(current);
    current = parentElement(current);
  }
  return path;
}

export function eventElement(event: Event): Element | null {
  const target = event.composedPath?.()[0] || event.target;
  if (!target || !('nodeType' in target)) return null;
  const node = target as Node;
  return node.nodeType === 1 ? node as Element : node.parentElement;
}

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

/** Drop absent/empty values while preserving types, array structure and string case. */
export function cleanData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((item) => item != null && item !== '').map((item) => cleanData(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item != null && item !== '')
        .map(([key, item]) => [key, cleanData(item)])
    ) as T;
  }
  return value;
}
