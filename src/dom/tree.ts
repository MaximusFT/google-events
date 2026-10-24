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
