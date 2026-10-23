import { StrictMode, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { createTracker, createCallbackReceiver, createDataLayerReceiver, type TrackEvent } from '../../src/index.js';
import { updateFavorite } from './operations.js';

interface Product { id: string; name: string; category: string; price: number; currency: string; available: boolean }
const catalog: Product[] = [
  { id: 'SKU-City', name: 'Кроссовки City', category: 'Shoes', price: 129.9, currency: 'EUR', available: true },
  { id: 'SKU-Sample', name: 'Пробник ухода', category: 'Care', price: 0, currency: 'EUR', available: false },
];

function ProductContext({ product, favorite, id, children }: { product: Product; favorite: boolean; id: string; children: ReactNode }) {
  return <section id={id} data-track-root data-track-product-id={product.id} data-track-product-name={product.name}
    data-track-category={product.category} data-track-price={product.price} data-track-currency={product.currency}
    data-track-available={String(product.available)} data-track-favorite={String(favorite)}>{children}</section>;
}

/** This button knows the action and business handler; all analytics context is on its ancestors. */
function FavoriteButton({ onRequest, busy }: { onRequest: (element: HTMLButtonElement) => void; busy: boolean }) {
  return <button data-track-event="favorite_requested" disabled={busy} onClick={(event) => onRequest(event.currentTarget)}>Изменить избранное</button>;
}

function Pilot() {
  const [selected, setSelected] = useState(0);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [status, setStatus] = useState('Операций пока нет.');
  const [events, setEvents] = useState<TrackEvent[]>([]);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [inspection, setInspection] = useState('Проверьте контекст кнопки.');
  const analyticsAllowed = useRef(true);
  const tracker = useRef<ReturnType<typeof createTracker> | null>(null);
  const pending = useRef<AbortController | null>(null);
  const base = catalog[selected];
  const rawPrice = prices[base.id] ?? String(base.price);
  const product = { ...base, price: rawPrice.trim() ? Number(rawPrice) : NaN };
  const favorite = favorites[base.id] ?? false;

  useEffect(() => {
    const instance = createTracker({
      root: document,
      schema: {
        product_id: { type: 'string', required: true },
        price: { type: 'number', required: true },
        available: 'boolean', favorite: 'boolean',
      },
      receivers: [
        createDataLayerReceiver<TrackEvent>({ filter: () => analyticsAllowed.current, transform: (event) => ({ event: event.name, ...event.properties }) }),
        createCallbackReceiver<TrackEvent>({ name: 'pilot-log', filter: () => analyticsAllowed.current, send: (event) => { setEvents((previous) => [...previous, event]); } }),
      ],
      onDiagnostic: (info) => { setDiagnostics((previous) => [...previous, ...info.issues.map((issue) => issue.message)]); },
      onError: (failure) => { setDiagnostics((previous) => [...previous, `${failure.receiver}: ${String(failure.error)}`]); },
    });
    tracker.current = instance;
    instance.start();
    return () => {
      pending.current?.abort();
      pending.current = null;
      tracker.current = null;
      instance.destroy();
    };
  }, []);

  const request = useCallback(async (element: HTMLButtonElement) => {
    if (pending.current) return;
    const instance = tracker.current;
    // Snapshot before awaiting: the original element may be removed or its context may change.
    const snapshot = instance?.inspect(element).event ?? false;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setStatus(`Операция для ${product.id} выполняется…`);
    try {
      // Business behavior never depends on successful analytics validation or delivery.
      const nextFavorite = await updateFavorite(!favorite, { fail, signal: controller.signal });
      setFavorites((previous) => ({ ...previous, [product.id]: nextFavorite }));
      setStatus(`${product.id}: ${nextFavorite ? 'добавлен в избранное' : 'удалён из избранного'}.`);
      if (snapshot) instance?.track(nextFavorite ? 'favorite_added' : 'favorite_removed', { ...snapshot.properties, favorite: nextFavorite });
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus(`${product.id}: операция не выполнена.`);
      if (snapshot) instance?.track('favorite_failed', snapshot.properties);
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }, [product, favorite, fail]);

  const inspectCard = () => {
    const button = document.querySelector('#card-context [data-track-event]');
    if (!button || !tracker.current) return;
    const info = tracker.current.inspect(button);
    setInspection(JSON.stringify({ event: info.event, issues: info.issues, boundary: (info.boundary as Element)?.id,
      fields: Object.fromEntries(Object.entries(info.fields).map(([key, field]) => [key, { raw: field.raw, value: field.value, source: field.element?.id || field.element?.tagName }])) }, null, 2));
  };

  return <>
    <p><a href="/neutral.html">Базовое демо</a></p>
    <h1>Локальный пилот: карточка товара и избранное</h1>
    <p>Операции выполняет локальная имитация сервера. Внешние SDK не подключены. Событие запроса и результат операции показываются отдельно.</p>
    <div className="controls">
      <label>Товар <select id="product-picker" value={selected} onChange={(event) => setSelected(Number(event.target.value))}>{catalog.map((item, index) => <option key={item.id} value={index}>{item.name}</option>)}</select></label>
      <label>Текущая цена <input id="pilot-price" value={rawPrice} onChange={(event) => setPrices((previous) => ({ ...previous, [base.id]: event.target.value }))} /></label>
      <label><input id="operation-failure" type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} /> Имитация ошибки операции</label>
      <label><input id="analytics-allowed" type="checkbox" checked={allowed} onChange={(event) => { analyticsAllowed.current = event.target.checked; setAllowed(event.target.checked); }} /> Разрешить отправку аналитики</label>
    </div>
    <ProductContext product={product} favorite={favorite} id="card-context">
      <h2>{product.name}</h2>
      <p id="favorite-state">В избранном: {favorite ? 'да' : 'нет'}</p>
      <div data-track-placement="title"><FavoriteButton onRequest={request} busy={busy} /></div>
      <p>Общий контекст товара находится на карточке. Вложенные кнопки его не получают через props.</p>
      <div data-track-placement="description"><FavoriteButton onRequest={request} busy={busy} /></div>
      <button id="open-modal" onClick={() => setModal(true)}>Открыть модальное окно</button>
    </ProductContext>
    {modal && createPortal(<div role="dialog" aria-modal="true" aria-label="Избранное товара" className="overlay">
      <ProductContext product={product} favorite={favorite} id="modal-context">
        <h2>{product.name}</h2>
        <p>Это React portal в body. Корень модального окна явно получает тот же контекст товара.</p>
        <div data-track-placement="modal"><FavoriteButton onRequest={request} busy={busy} /></div>
        <button id="close-modal" onClick={() => setModal(false)}>Закрыть окно</button>
      </ProductContext>
    </div>, document.body)}
    <p id="operation-status" role="status">{status}</p>
    <button id="inspect-pilot" onClick={inspectCard}>Проверить контекст карточки</button>
    <button id="clear-pilot" onClick={() => { setEvents([]); setDiagnostics([]); window.dataLayer = []; }}>Очистить журналы</button>
    <div className="outputs">
      <div><h2>События callback</h2><pre id="pilot-events">{JSON.stringify(events, null, 2)}</pre></div>
      <div><h2>Контекст и диагностика</h2><pre id="pilot-inspection">{inspection}</pre><pre id="pilot-diagnostics">{JSON.stringify(diagnostics, null, 2)}</pre></div>
    </div>
  </>;
}

const root = document.getElementById('pilot-root');
if (root) createRoot(root).render(<StrictMode><Pilot /></StrictMode>);
