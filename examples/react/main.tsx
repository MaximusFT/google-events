import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { TrackEvent } from '../../src/index.js';
import { ProductCard } from './ProductCard.js';

function Demo() {
  const [events, setEvents] = useState<TrackEvent[]>([]);
  const [showFooter, setShowFooter] = useState(false);
  const receive = useCallback((event: TrackEvent) => setEvents((previous) => [...previous, event]), []);
  return <>
    <p><a href="/neutral.html">Пример на обычном HTML</a></p>
    <h1>React: контекст из DOM без props на кнопках</h1>
    <p>Пример работает в StrictMode. Повторный запуск effect не создаёт дубли обработчиков.</p>
    <label><input id="show-footer" type="checkbox" checked={showFooter} onChange={(event) => setShowFooter(event.target.checked)} /> Добавить кнопку динамически</label>
    <ProductCard product={{ id: 'SKU-React', name: 'Кроссовки City', price: 129.9, available: true }} showFooter={showFooter} onEvent={receive} />
    <h2>Собранные события</h2>
    <pre id="react-events">{JSON.stringify(events, null, 2)}</pre>
  </>;
}

const root = document.getElementById('react-root');
if (root) createRoot(root).render(<StrictMode><Demo /></StrictMode>);
