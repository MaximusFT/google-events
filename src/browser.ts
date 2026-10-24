/** Framework-independent API for classic scripts; legacy exports stay in the npm entry. */
export { createTracker } from './tracker.js';
export { createCallbackReceiver } from './adapters/callback.js';
export { createDataLayerReceiver } from './adapters/data-layer.js';
export { createGa4Receiver } from './adapters/ga4.js';
export { createGtmReceiver } from './adapters/gtm.js';
export { createUmamiReceiver } from './adapters/umami.js';
