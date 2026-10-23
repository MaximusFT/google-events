import { useEffect, useRef } from 'react';
import { createTracker, createCallbackReceiver, createDataLayerReceiver, type TrackEvent } from '../../src/index.js';

export interface Product {
  id: string;
  name: string;
  price: number;
  available: boolean;
}

/** No analytics props are passed through the placement blocks to their buttons. */
export function ProductCard({ product, showFooter, onEvent }: {
  product: Product;
  showFooter: boolean;
  onEvent: (event: TrackEvent) => void;
}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!root.current) return;
    const tracker = createTracker({
      root: root.current,
      schema: {
        product_id: { type: 'string', required: true },
        price: { type: 'number', required: true },
        available: 'boolean',
      },
      receivers: [
        createDataLayerReceiver<TrackEvent>({ transform: (event) => ({ event: event.name, ...event.properties }) }),
        createCallbackReceiver<TrackEvent>({ name: 'react-demo', send: onEvent }),
      ],
    });
    tracker.start();
    return () => tracker.destroy();
  }, [onEvent]);

  return (
    <section ref={root} data-track-root data-track-product-id={product.id} data-track-product-name={product.name}
      data-track-price={product.price} data-track-available={String(product.available)}>
      <h2>{product.name} — {product.price} EUR</h2>
      <div data-track-placement="title"><button data-track-event="favorite_add">У заголовка</button></div>
      <div data-track-placement="details"><button data-track-event="favorite_add">В описании</button></div>
      {showFooter && <div data-track-placement="footer"><button data-track-event="favorite_add">В конце карточки</button></div>}
    </section>
  );
}
