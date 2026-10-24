import { eventElement } from './tree.js';

/** Attach one delegated listener per explicit DOM trigger and return symmetric cleanup. */
export function subscribeInteractions(root: Document | Element, onInteraction: (element: Element, event: Event) => void, capture: boolean) {
  const handler = (event: Event) => {
    const element = eventElement(event);
    if (element) onInteraction(element, event);
  };
  for (const type of ['click', 'change', 'submit']) root.addEventListener(type, handler, capture);
  return () => {
    for (const type of ['click', 'change', 'submit']) root.removeEventListener(type, handler, capture);
  };
}
