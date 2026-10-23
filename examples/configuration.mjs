import { createTracker, createCallbackReceiver } from '../dist/index.js';

const schema = {
  product_id: { type: 'string', required: true },
  price: 'number',
  available: 'boolean',
};

/** One DOM collector and one injected destination; the caller owns start/destroy and permission state. */
export function createSingleReceiverTracker(root, send, isAllowed = () => true) {
  return createTracker({
    root,
    schema,
    receivers: [createCallbackReceiver({ name: 'analytics', filter: () => isAllowed(), send })],
  });
}

/**
 * Two independent mappings, with a shared live permission gate and a narrower primary route.
 * These payloads demonstrate configuration, not production GA4/other SDK adapters.
 */
export function createMultiReceiverTracker(root, { primary, secondary }, isAllowed = () => true) {
  return createTracker({
    root,
    schema,
    receivers: [
      createCallbackReceiver({
        name: 'primary',
        filter: event => isAllowed() && ['favorite_requested', 'favorite_added'].includes(event.name),
        transform: event => {
          const { product_id, ...properties } = event.properties;
          return {
            event: event.name === 'favorite_requested' ? 'wishlist_click' : event.name,
            // Explicit destination mapping wins over a pre-existing item_id property.
            params: { ...properties, item_id: product_id },
          };
        },
        send: primary,
      }),
      createCallbackReceiver({
        name: 'secondary',
        filter: () => isAllowed(),
        transform: event => ({ name: event.name, data: { ...event.properties } }),
        send: secondary,
      }),
    ],
  });
}

/** Separate non-overlapping roots have independent listeners and lifecycles. */
export function createIsolatedTrackers(leftRoot, rightRoot, { left, right }, isAllowed = () => true) {
  return {
    left: createSingleReceiverTracker(leftRoot, left, isAllowed),
    right: createSingleReceiverTracker(rightRoot, right, isAllowed),
  };
}
