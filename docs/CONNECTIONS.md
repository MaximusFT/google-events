# Подключение готового JavaScript

Локальный кандидат 0.3.0 ещё не опубликован. Получение tarball описано в [quick start](getting-started.md). Во всех вариантах SDK сервиса загружает приложение; библиотека начинает слушать DOM только после `start()`.

## Обычный script без сборщика

Из собранного `dist` скопируйте `track-events.global.js` в свои статические assets. Путь ниже — пример вашей структуры сайта:

```html
<section id="shop" data-track-root data-track-product-id="SKU-AbC">
  <button data-track-event="favorite_requested">В избранное</button>
</section>
<script src="/assets/analytics/0.3.0/track-events.global.js"></script>
<script>
  const tracker = TrackEvents.createTracker({
    root: document.querySelector('#shop'),
    receivers: [TrackEvents.createCallbackReceiver({
      name: 'console', send: event => console.log(event),
    })],
  });
  tracker.start();
</script>
```

Оба script идут после разметки. Для внешних файлов в `<head>` задайте `defer` обоим и сохраните порядок: библиотека, затем файл инициализации. `async` не гарантирует этот порядок. При CSP перенесите inline-код в разрешённый внешний файл либо используйте настроенный приложением nonce.

Глобальный объект `window.TrackEvents` содержит ровно шесть функций:

| Функция | Назначение |
| --- | --- |
| `createTracker` | Нейтральный трекер и его lifecycle/inspect/flush |
| `createCallbackReceiver` | Произвольный обработчик или SDK |
| `createDataLayerReceiver` | Очередь с нейтральным событием по умолчанию |
| `createGa4Receiver` | GA4 с явным measurementId и getClient |
| `createGtmReceiver` | GTM с полем event |
| `createUmamiReceiver` | Umami с getClient |

Контракты настроек совпадают с npm API, см. [конфигурацию](CONFIGURATION.md) и [адаптеры](ADAPTERS.md). Legacy singleton в глобальную сборку не включён. Загрузка файла сама не запускает трекер, не загружает SDK и не создаёт очередь. Если `receivers` не задан, при отправке действует обычный default dataLayer; для отключения доставки передайте `receivers: []`.

Загружайте одну версию файла один раз на страницу. При повторном подключении script глобальный объект будет заменён, но ранее запущенные трекеры останутся активны. Управление экземплярами и их `destroy()` остаётся у приложения.

## Нативный браузерный ESM

Скопируйте `dist/index.js` в assets и импортируйте URL из внешнего JS-модуля:

```js
import { createTracker, createCallbackReceiver } from './assets/analytics/0.3.0/index.js';

const tracker = createTracker({
  receivers: [createCallbackReceiver({ name: 'console', send: event => console.log(event) })],
});
tracker.start();
```

Подключите этот файл через `<script type="module" src="./app.js"></script>`. Браузер не разрешает bare import имени npm-пакета без import map/сборщика. Раздавайте файлы по HTTP(S) с JavaScript MIME; запуск через `file://` не является проверенным способом. ESM не создаёт `TrackEvents` в window. Legacy доступен через npm/ESM exports.

## npm и UI-фреймворки

ESM import и CommonJS require выбираются через exports пакета; поставляются отдельные `.d.ts` и `.d.cts`. Чистая установка tarball, оба runtime-формата и NodeNext-типы проверяются `npm run test:package`. CJS не предназначен для прямого `<script>` в браузере.

В React создавайте экземпляр после mount и вызывайте `destroy()` в cleanup эффекта. Существующий пример `examples/react` проходит браузерную проверку StrictMode. Если root переживает смену маршрута, повторный запуск не нужен: делегированные слушатели видят новые дочерние элементы. Если root заменён, уничтожьте прежний экземпляр и создайте новый с новым root. Разметка портала должна иметь собственный DOM-контекст.

Angular-пример ещё предстоит запустить и проверить; на этом шаге он не заявлен подтверждённой интеграцией.

## Проверенные самостоятельные примеры

После `npm run build` откройте через любой статический HTTP-сервер `examples/browser/classic.html` или `examples/browser/module.html` в корне репозитория/распакованного tarball. Сохраняйте относительное расположение `examples` и `dist`. Это обычные HTML/JS-файлы без Vite и компиляции TypeScript. Они показывают наследование, динамические кнопки, остановку и повторный запуск. Браузерные тесты раздают эти файлы напрямую отдельным HTTP-сервером.

## Версии и переносимость

Путь `/assets/analytics/0.3.0/` принадлежит вашему сайту; при размещении в подпути используйте соответствующий base path или относительные URL. Он не зависит от GitHub-owner или расположения исходного репозитория. Копируйте файлы одной сборки в каталог конкретной версии и обновляйте ссылку явно. Не заменяйте содержимое уже закэшированного versioned URL; промежуточные сборки кандидата требуют собственного номера/хеша каталога. Публичного CDN/`latest` URL пока нет.

Source maps необязательны для runtime. При их публикации сохраняйте имя и соседнее расположение `.map` из dist; они содержат исходники. Файлы пока не минифицированы. Размер и условия замера — в [отчёте](PERFORMANCE.md).
