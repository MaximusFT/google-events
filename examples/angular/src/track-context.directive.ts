import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { createTracker, createCallbackReceiver, type TrackEvent } from '@maximusft/google-events';
import { EventLog } from './event-log';

/** One delegated tracker per DOM root; dynamic children need only data-track markup. */
@Directive({ selector: '[trackContext]', standalone: true })
export class TrackContextDirective {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const log = inject(EventLog);
    let tracker: ReturnType<typeof createTracker> | undefined;
    // Render callbacks skip SSR; the directive's root and bindings exist before subscription.
    afterNextRender(() => {
      tracker = createTracker({
        root: element,
        schema: { product_id: { type: 'string', required: true }, price: 'number', available: 'boolean' },
        receivers: [createCallbackReceiver<TrackEvent>({ name: 'angular-example', send: event => log.record(event) })],
      });
      tracker.start();
    });
    inject(DestroyRef).onDestroy(() => tracker?.destroy());
  }
}
