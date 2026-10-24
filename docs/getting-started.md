# Первое событие без привязки к аналитическому сервису

Это пример существующего API 0.3.0 для проекта с JavaScript-сборщиком. Пакет ещё не опубликован: не считайте `npm install @maximusft/google-events` доступной инструкцией получения этой версии.

## 1. Получить локальный пакет

В репозитории библиотеки:

```sh
npm ci
npm run build
npm pack
```

Перенесите созданный `maximusft-google-events-0.3.0.tgz` в своё приложение и установите его:

```sh
npm install ./maximusft-google-events-0.3.0.tgz
```

## 2. Разметить контекст и действие

```html
<section data-track-root data-track-product-id="SKU-AbC" data-track-price="0">
  <div data-track-placement="card">
    <button data-track-event="favorite_requested">В избранное</button>
  </div>
</section>
```

## 3. Запустить после появления DOM

```js
import { createTracker, createCallbackReceiver } from '@maximusft/google-events';

const tracker = createTracker({
  schema: { price: 'number' },
  receivers: [createCallbackReceiver({
    name: 'console',
    send: event => { console.log(event); },
  })],
});
tracker.start();
```

Результат клика:

```json
{"name":"favorite_requested","trigger":"click","properties":{"product_id":"SKU-AbC","price":0,"placement":"card"}}
```

В консоль не попадают произвольные значения полей формы или текст кнопки. Данные читаются с действия и его предков до root включительно. Вложенный root изолирует внешние данные; детали — в [контракте](CONTRACT.md).

При размонтировании вызывайте `tracker.destroy()`. Для объяснения результата без отправки используйте `tracker.inspect(button)`. Для второго сервиса добавьте ещё одного получателя тому же трекеру; не создавайте второй DOM-слушатель только ради второго SDK.

## 4. Подключить реальную доставку

Выберите путь из [каталога интеграций](integrations/README.md): доступны callback/dataLayer и отдельные [адаптеры GA4/GTM/Umami](ADAPTERS.md). Клиенты SDK предоставляет приложение. Их загрузка, согласие на отправку и подтверждение приёма — отдельные части интеграции.

Для сайта без сборщика доступны [обычный script с TrackEvents и нативный ESM](CONNECTIONS.md), включая самостоятельные HTML/JS-примеры. React проверен в StrictMode; Angular-пример ещё предстоит проверить.
