# Адаптеры GA4, GTM и Umami

Кандидат 0.3.0, 24 октября 2026 года. Реализованы отдельные получатели; их контракты проверены с подставными клиентами в Node/jsdom и браузере. Реальные SDK и поступление в панели этой версией пока не подтверждены. SDK-зависимости в пакет не добавлены.

## Два сервиса, один коллектор

После подключения и настройки SDK самим приложением:

```js
import { createTracker, createGa4Receiver, createUmamiReceiver } from '@maximusft/google-events';

const tracker = createTracker({
  schema: { price: 'number', available: 'boolean' },
  receivers: [
    createGa4Receiver({
      name: 'ga4-main',
      measurementId: 'G-YOURID',
      getClient: () => window.gtag,
      filter: () => analyticsAllowed,
    }),
    createUmamiReceiver({
      name: 'umami-main',
      getClient: () => window.umami,
      filter: () => analyticsAllowed,
    }),
  ],
  onError: failure => { console.warn(failure.receiver, failure.phase, failure.error); },
});
tracker.start();
```

Переменная analyticsAllowed принадлежит приложению; встроенной системы согласий нет. GetClient выполняется только для выбранного получателя при отправке: создание экземпляра и inspect не обращаются к SDK. Каждый SDK сам управляет своим сайтом/проектом, init, identity, регионом и автоматическим сбором.

Для события `open` с `{ price: 0, available: false }` GA4 получает команду event с params `{ price: 0, available: 'false', send_to: 'G-YOURID' }`, Umami — имя open и data `{ price: 0, available: false }`. Общий нейтральный объект не изменяется.

## Настройки GA4

`createGa4Receiver(options)` → `EventReceiver<TrackEvent>`.

| Настройка | Правило |
| --- | --- |
| measurementId | Обязательное явное назначение; копируйте G-ID из настроек GA4. Проверяется непустая строка без пробелов, не существование свойства/аккаунта |
| getClient | Обязательная функция, возвращающая настроенный gtag либо undefined |
| name | Уникальное имя получателя; default ga4 |
| filter | Синхронный фильтр нейтрального события |
| transform | Синхронное преобразование в `{ name, params }`; default берёт нейтральные name/properties |
| maxParameters | Положительное целое, default 25; число параметров без send_to. Это локальная проверка, не изменение квоты аккаунта |

Явный measurementId всегда перекрывает send_to из properties/transform. Для двух целей создайте два именованных получателя с нужными ID/клиентами; не используйте одинаковое default-имя дважды в одном трекере. Маршрутизация Google tag описана в [официальной документации](https://developers.google.com/tag-platform/gtagjs/routing).

Адаптер проверяет непустое имя длиной до 40 с латинской буквой в начале, латинскими буквами/цифрами/underscore далее; объект params, лимит числа параметров и конечность числовых значений верхнего уровня. Не выполняется полная проверка зарезервированных GA4-имён, вложенных ecommerce-структур и всех квот/длин параметров. Сложный params формируется явным transform и требует проверки на реальном SDK.

Политика данного адаптера: boolean верхнего уровня преобразуется в строку true/false. Это не меняет типы остальных получателей; числа 0 сохраняются, вложенные значения не нормализуются автоматически. Params копируются, включая вложенные объекты/массивы, затем добавляется защищённый send_to. Нет команд config, consent, set или автоматических pageviews. Вызов соответствует [Google tag event API](https://developers.google.com/tag-platform/gtagjs/reference).

```js
createGa4Receiver({
  measurementId: 'G-YOURID',
  getClient: () => window.gtag,
  transform: event => ({
    name: event.name === 'favorite_added' ? 'add_to_wishlist' : event.name,
    params: { items: [{ item_id: event.properties.product_id }] },
  }),
});
```

Это иллюстрация mapping, не универсальный ecommerce-контракт для всех событий: требуемые поля и правильность рекомендованного события проверяет приложение/его интеграция.

## Настройки Umami

`createUmamiReceiver({ name?, getClient, filter?, transform? })` → `EventReceiver<TrackEvent>`. Default-имя umami; transform возвращает `{ name, data }`, по умолчанию используются нейтральные name/properties. Клиент предоставляет метод track(name, data), и его this сохраняется.

Первый адаптер поддерживает плоские data со string/number/boolean, конечные числа, до 50 свойств, строки до 500 символов и имя до 50 символов. Неверное поле отклоняет эту отправку; тихого усечения/округления нет. JSON-возможности самого Umami шире: для иных структур остаётся callback. Дополнительная обработка чисел самим сервисом и его ограничения не подменяются локальной валидацией. [Функции и данные](https://docs.umami.is/docs/tracker-functions), [имена событий](https://docs.umami.is/docs/track-events).

Website ID и домены принадлежат подключённому SDK, не названию получателя. Два receiver вокруг одного window.umami не объявляются двумя независимыми website-клиентами. Домен ma-x.im, переименование contact-click и ожидание скрипта из личного пилота не зашиты в библиотеку.

## Маршрут через GTM

Если приложение использует GTM, выбирайте отдельный `createGtmReceiver`:

```js
import { createTracker, createGtmReceiver } from '@maximusft/google-events';

const tracker = createTracker({
  receivers: [createGtmReceiver({ layerName: 'dataLayer' })],
});
tracker.start();
```

Настройки: name (default gtm), layerName (default dataLayer), window, filter, transform. Default-payload — `{ ...event.properties, event: event.name }`: служебный event перекрывает одноимённое пользовательское свойство. Transform может вернуть свой объект с непустым строковым event и вложенными данными. Вложенный payload копируется перед push.

Существующий метод push и выбранное окно/очередь сохраняются. Без window используется окно документа события, затем доступное глобальное окно. Контейнер, Custom Event trigger, переменные и тег настраивает приложение. Успешный push означает только передачу в очередь. [Data layer Google](https://developers.google.com/tag-platform/tag-manager/datalayer).

Generic `createDataLayerReceiver` сохранён: без transform он передаёт `{ name, trigger, properties }`, а не GTM-envelope. Изменять это умолчание ради GTM не нужно. Для одной GA4-цели выбирайте один маршрут одного действия — прямой gtag или GTM-тег. Native click-trigger GTM тоже может продублировать наш Custom Event.

## Готовность, ошибки и flush

- GetClient не является загрузчиком. Если при отправке он возвращает undefined/неподходящий клиент, отправка завершается ошибкой через onError с именем получателя и phase=send. Другие получатели продолжают работу.
- Накопления событий и повторов нет. Если клиент появился позже, **следующее** событие использует его; пропущенное событие не воспроизводится. Если нужен иной порядок, приложение может запустить tracker после готовности SDK либо реализовать собственный ограниченный callback-получатель.
- Исключение transform/getClient/SDK и rejection возвращённого Promise относятся к ошибке send. Filter=false не вызывает ни transform, ни getClient. Ошибки базовых настроек конструктора — TypeError до запуска трекера.
- Реально возвращённый SDK Promise ожидается. Произвольные объекты/wrappers/boolean не интерпретируются как серверные квитанции; callback Google event_callback автоматически не добавляется. Flush ждёт работу send, а не внутренние очереди SDK или подтверждение панели.
- Filter нашего маршрута не отключает SDK pageviews, native-теги или autocapture. Управляйте ими в приложении и проверяйте отсутствие второго пути для одного действия.

Локальные автоматические проверки используют только подставные клиенты; браузерные сценарии подтверждают оболочки вызовов без подключения сервисов. Для подтверждения выпуска отдельно проверить реальные версии SDK и событие в тестовых панелях — это часть пилота/этапа 8.
