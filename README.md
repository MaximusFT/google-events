# DOM-события с наследованием контекста

Следующий цикл развития — [план универсальных интеграций и онлайн-документации](ROADMAP.md).

Правила нейтрального API: [контракт событий, наследование и точные примеры](docs/CONTRACT.md).

[Документация](docs/index.md) · [Первое событие](docs/getting-started.md) · [Исследование интеграций](docs/integrations/README.md).

Пакет `@maximusft/google-events`: контекст товара задаётся на карточке, расположение — на вложенном блоке, действие — на кнопке. Библиотека собирает типизированное событие и передаёт его подключённым получателям. Она работает с DOM и не зависит от React, Angular или Vue.

Версия 0.3.0 подготовлена локально; публикация и внешний пилот ещё не проводились. Историческое имя пакета сохранено. Старый API доступен отдельно: [legacy-режим](docs/LEGACY.md).

## Быстрый пример

```html
<section data-track-root
         data-track-product-id="SKU-AbC"
         data-track-price="129.90"
         data-track-available="false">
  <div data-track-placement="modal">
    <button data-track-event="favorite_add">В избранное</button>
  </div>
</section>
```

```ts
import {
  createTracker,
  createDataLayerReceiver,
  createCallbackReceiver,
  type TrackEvent,
} from '@maximusft/google-events';

const tracker = createTracker({
  schema: {
    product_id: { type: 'string', required: true },
    price: 'number',
    available: 'boolean',
  },
  receivers: [
    createDataLayerReceiver<TrackEvent>({
      transform: (event) => ({ event: event.name, ...event.properties }),
    }),
    createCallbackReceiver<TrackEvent>({
      name: 'custom-analytics',
      send: (event) => { console.log(event); }, // Здесь подключается ваш SDK.
    }),
  ],
});
tracker.start();
```

Callback получает:

```js
{
  name: 'favorite_add',
  trigger: 'click',
  properties: {
    product_id: 'SKU-AbC',
    price: 129.9,
    available: false,
    placement: 'modal'
  }
}
```

dataLayer в этом примере получает `{ event: 'favorite_add', product_id: 'SKU-AbC', ... }` благодаря transform. Далее GTM должен иметь соответствующие переменные, триггер и тег. Формат и поля GA4 задаются отдельным преобразованием; библиотека не выдаёт произвольные параметры за готовую ecommerce-схему GA4.

## Контракт разметки

| Атрибут | Значение |
| --- | --- |
| `data-track-event="name"` | Имя действия на самом действующем элементе. |
| `data-track-root` | Граница контекста; даже пустой атрибут ограничивает обход. |
| `data-track-trigger="change"` | Явный DOM-триггер: click, change, submit. По умолчанию click. `manual` отключает автоматическую отправку этого действия. |
| `data-track-off` | Подавляет действие на элементе или предке внутри текущей границы. |
| `data-track-product-id="..."` | Обычный параметр; по умолчанию становится `properties.product_id`. |

Для взаимодействия выбирается ближайшее действие в текущей области. Неразмеченные элементы сами события не создают; вложенное действие не создаёт дополнительно событие родителя. Клик по SVG или иконке внутри кнопки относится к кнопке.

Контекст собирается от действия к ближайшему `data-track-root`, включая его. Значение на кнопке перекрывает блок, значение блока — секцию. Вложенный root полностью изолирует внешние параметры. Без root сбор ограничен корнем экземпляра; по умолчанию это документ. Служебные атрибуты не становятся properties. Значения полей читаются в момент взаимодействия, поэтому динамические элементы и обновления DOM не требуют повторного start.

Строки сохраняют регистр и пустое значение. Пустая строка не означает отсутствие и не подменяется значением предка. При перекрытии неверное значение также не заменяется родительским: причина доступна через диагностику.

## Схема и валидация

`schema` задаёт общие поля, `events` — дополнения и переопределения для конкретного имени события:

```ts
const tracker = createTracker({
  schema: { placement: 'string' },
  events: {
    purchase: {
      amount: { type: 'number', required: true },
      productId: { type: 'string', attribute: 'data-track-product-id', required: true },
    },
  },
  onDiagnostic: (inspection) => { console.log(inspection.issues); },
});
```

- string сохраняется без изменения. Обязательная строка должна содержать непробельный текст.
- number принимает конечное число либо полностью корректную десятичную строку, в том числе с экспонентой. Пустые значения, NaN, Infinity, `12EUR` и hex-строки отвергаются.
- boolean принимает boolean либо строки `true`/`false` с возможными пробелами вокруг. `1`, `yes` и другой регистр не интерпретируются автоматически.
- Поля без схемы сохраняют строку из атрибута. Ручной API допускает также конечные числа и boolean. Объекты, массивы, null и undefined как значения properties не поддерживаются.
- Некорректное необязательное поле исключается с issue. Отсутствие или ошибка обязательного поля блокирует событие; методы отправки возвращают false.

При необходимости полного имени HTML-атрибута используется `attribute`. По умолчанию snake_case и camelCase преобразуются в `data-track-kebab-case`. Дублирующие атрибуты и попытки использовать служебные атрибуты в схеме отвергаются при создании трекера. Массивы, вложенные objects и пользовательские валидаторы оставлены после MVP.

## Inspect без отправки

```ts
const info = tracker.inspect(button);
console.log(info.event);                  // Нейтральный payload либо false.
console.log(info.boundary);               // DOM-граница.
console.log(info.fields.price.element);   // Откуда взято поле.
console.log(info.fields.price.raw);       // Исходное значение.
console.log(info.fields.price.value);     // Типизированное значение.
console.log(info.fields.price.overridden);// Значения, перекрытые ближайшим.
console.log(info.issues);                 // Причины пропуска/отклонения.
console.log(info.receivers);              // Выбор получателей и ошибки их фильтров.
```

Inspect не вызывает send, transform, onError или onDiagnostic. Для показа выбранных получателей он вызывает их filter на копии события; фильтры следует писать без побочных эффектов. Ошибка фильтра попадает в preview. Во время реальной отправки фильтр вычисляется заново. Inspect не является гарантией будущей доставки.

Источники содержат ссылки на DOM-узлы; для JSON их надо преобразовать в подписи, как сделано в демо. Типизированные свойства и список issues можно сериализовать непосредственно.

## Жизненный цикл и ручные события

```ts
const tracker = createTracker({ root: document.querySelector('#app')! });
tracker.start(); // Повторный start на том же корне не создаёт дубли.
tracker.stop();  // Снимает обработчики.
tracker.start(); // Возобновляет сбор.
tracker.destroy();
```

Для смены корня: `tracker.start(otherRoot)`. Конфигурация schema/receivers неизменна в течение жизни нейтрального экземпляра; для новой конфигурации создайте новый tracker. `automatic: false` оставляет ручной API. `destroy()` эквивалентен stop: снимает DOM-слушателей, сохраняя возможность ручных вызовов и завершения начатых отправок.

```ts
tracker.trackElement(button, {
  name: 'favorite_added', trigger: 'manual', properties: { price: 12.5 },
});
tracker.track('favorite_added', { product_id: 'SKU-AbC', price: 12.5 });
await tracker.flush();
```

Оба пути используют одну валидацию и доставку. `trackElement` требует размеченного действия и использует DOM-контекст; явные properties перекрывают его. `track` не требует DOM. Методы возвращают payload или false синхронно; flush ожидает текущие отправки, а не гарантирует их успешность.

Клик обозначает намерение, а не подтверждённое изменение на сервере. Для асинхронной операции заранее получите snapshot через inspect, затем после успеха передайте `snapshot.properties` в track. Это работает, даже если исходная кнопка уже удалена из DOM.

## Получатели

Готовы отдельные `createGa4Receiver`, `createGtmReceiver` и `createUmamiReceiver` с передаваемыми клиентами: [настройки, mapping и ограничения](docs/ADAPTERS.md). Локальные тесты используют подставные SDK; реальный приём в панелях ещё предстоит подтвердить.

Получатель реализует `EventReceiver<TrackEvent>`: `{ name, filter?, send(event, context) }`. Имена должны быть непустыми и уникальными. Filter синхронно возвращает boolean, send возвращает void либо Promise<void>. Callback-адаптер дополнительно поддерживает синхронный transform в любую схему:

```ts
const receiver = createCallbackReceiver({
  name: 'another-system',
  filter: (event: TrackEvent) => event.name === 'favorite_add',
  transform: (event: TrackEvent) => ({ action: event.name, item: event.properties.product_id }),
  send: (payload) => { console.log(payload.item); },
});
```

Каждый получатель получает собственную копию события. Ошибки filter, transform и send не мешают остальным. `onError` получает receiver, error, исходный event и phase (`filter` либо `send`, включая transform). Ошибка самого обработчика ошибок выводится в консоль. Асинхронный onError/onDiagnostic обрабатывается отдельно и не ожидается flush.

Без receivers трекер использует dataLayer, сохраняя нейтральный объект без transform. Явный список заменяет этот default. `receivers: []` означает сбор без отправки. DataLayer-адаптер поддерживает window, layerName, filter и transform, использует окно исходного документа и сохраняет существующий метод push. Реальные SDK подключает приложение. Очередей повторной доставки и собственного сервера аналитики нет.

## Среды и ограничения

Импорт и ручные callback-события безопасны при SSR. Без DOM `start()` возвращает false. React/Angular/Vue не требуются библиотеке: подключение происходит после появления DOM, снятие обработчиков — при размонтировании.

Открытые Shadow DOM и slots проверены. Закрытые roots скрывают внутренние действия; нужна интеграция на host либо внутри компонента. Portals получают контекст фактического DOM-размещения: разметьте корень портала либо передайте snapshot вручную. Для iframe нужен экземпляр в его документе, междокументного моста нет.

По умолчанию слушатели работают в фазе всплытия: остановленное до корня событие не доходит до трекера. `createTracker({ capture: true })` собирает контекст в фазе захвата, до обработчиков интерфейса. Это полезно, когда React закрывает меню или удаляет кнопку при клике. В этом режиме событие может быть учтено до последующих stopPropagation/preventDefault; оно означает намерение, а подтверждённый результат операции отправляется ручным API.

Значения input, текст кнопок, URL и пользовательские данные автоматически не извлекаются: в нейтральном режиме собираются только явные `data-track-*`. При пересечении корней два экземпляра могут намеренно отправить два события. Требования браузера: современные Element/Shadow DOM API, Map/Set, Promise, Object.fromEntries; полифиллы не включены.

## Демо и разработка

Для разработки: Node.js 22 или 24 актуального patch-релиза. Здесь проверки выполнены на Node.js 20.19.5 и установленном Edge. React и Playwright находятся только в devDependencies; у библиотеки нет runtime dependencies.

```sh
npm ci
npm run dev
```

Откройте `/neutral.html` для типов, двух получателей и Inspect, `/react.html` для React StrictMode и динамических кнопок, `/pilot.html` для асинхронных операций магазина, `/` для legacy-примера. В пилоте можно переключить товар, закрыть portal-модалку во время запроса, вызвать ошибку и отключить аналитику. Исходник React: [ProductCard.tsx](examples/react/ProductCard.tsx). При копировании в своё приложение замените импорт `../../src/index.js` на имя установленного пакета.

```sh
npm run check        # Типы, алгоритм/DOM, установленный пакет.
npm run test:browser # Реальный браузер и демо.
npm run check:all    # Всё вместе.
```

На Windows браузерные проверки по умолчанию используют установленный Edge. На Linux: `npx playwright install --with-deps chromium`. Можно установить Chromium и выбрать его через `PLAYWRIGHT_CHANNEL=chromium`, либо проверять Chrome через `PLAYWRIGHT_CHANNEL=chrome`. CI проверяет Chromium на Node.js 22 и 24.

Сборка и локальный tarball:

```sh
npm run build
npm pack
```

Поддерживаются ESM и CommonJS с отдельными объявлениями типов, включая NodeNext. Перед упаковкой запускаются базовые проверки. Реестр остаётся GitHub Packages; этот репозиторий ничего автоматически не публикует. Инструкции миграции и проверки выпуска: [MIGRATION.md](docs/MIGRATION.md), [RELEASE.md](docs/RELEASE.md). Полный план: [PROJECT_PLAN.md](PROJECT_PLAN.md).

Интеграционный пилот на статическом Next.js-сайте описан в [SITE_PILOT.md](docs/SITE_PILOT.md). Его проверки запускаются отдельно: `npm run test:site`, когда рядом доступен экспорт `../ma-x.im-v3/out`; другой каталог задаётся переменной `SITE_PILOT_DIR`. Этот сайт не требуется для обычных проверок пакета и CI.
