# DOM-события с наследованием контекста

[Онлайн-документация](https://maximusft.github.io/google-events/) · [Playground](https://maximusft.github.io/google-events/docs/PLAYGROUND.html) · [План развития](ROADMAP.md)

Разметьте контекст на контейнере, действие — на кнопке. Библиотека собирает типизированное событие до ближайшего root и передаёт его независимым получателям. Один сборщик может обслуживать несколько аналитических сервисов.

Кандидат API **0.3.0**. Сайт документации опубликован, npm-пакет ещё не выпущен. Историческое имя `@maximusft/google-events` сохранено; получите локальный tarball по [инструкции](docs/getting-started.md).

## Пример

```html
<section data-track-root data-track-product-id="SKU-AbC" data-track-price="0">
  <button data-track-event="favorite_requested">В избранное</button>
</section>
```

```js
import { createTracker, createCallbackReceiver } from '@maximusft/google-events';

const tracker = createTracker({
  schema: { price: 'number' },
  receivers: [createCallbackReceiver({
    name: 'example',
    send: event => { console.log(event); },
  })],
});
tracker.start(); // После появления DOM; при размонтировании — tracker.destroy().
```

Клик передаст `{ name: 'favorite_requested', trigger: 'click', properties: { product_id: 'SKU-AbC', price: 0 } }`. Произвольные значения формы и текст кнопки не собираются.

## Руководства

- [Script без сборщика, браузерный ESM и npm](docs/CONNECTIONS.md).
- [Контракт: вложенные root, наследование, off и типы](docs/CONTRACT.md).
- [Конфигурация, маппинг и несколько получателей](docs/CONFIGURATION.md).
- [Адаптеры GA4, GTM и Umami](docs/ADAPTERS.md) и [каталог исследованных сервисов](docs/integrations/README.md).
- [API и жизненный цикл](docs/API.md), [Angular AOT/Router](docs/ANGULAR.md), [React и обычный JS](docs/CONNECTIONS.md).
- [Архитектура](docs/ARCHITECTURE.md), [размер и производительность](docs/PERFORMANCE.md).
- [Legacy API](docs/LEGACY.md), [миграция](docs/MIGRATION.md), [подготовка выпуска](docs/RELEASE.md).

У библиотеки нет runtime dependencies и привязки к UI-фреймворку. SDK загружает приложение. Локальные контракты адаптеров проверены с подставными клиентами; поступление событий в реальные панели остаётся отдельной приёмкой.

## Разработка

Node.js 22 или 24 актуального patch-релиза:

```sh
npm ci
npm run check:all
npm run docs:check
```

`check:all` проверяет типы, DOM, установленный tarball, браузерные сценарии и отдельное Angular-приложение. Для Linux установите Chromium: `npx playwright install --with-deps chromium`; на Windows по умолчанию используется установленный Edge.

`npm run dev` запускает демо `/neutral.html`, `/react.html`, `/pilot.html` и legacy `/`. `npm run docs:build` и `npm run docs:preview` открывают сайт локально; [публикация и проверка публичного URL](docs/WEBSITE.md) используют отдельный workflow GitHub Pages.

`npm run test:site` проверяет внешний Next.js-пилот при наличии актуального static export; [условия запуска](docs/SITE_PILOT.md). Этот сайт не нужен для обычных проверок.

Публикация npm и подтверждение реальных аналитических панелей не входят в публикацию документации. Полный план — [ROADMAP.md](ROADMAP.md), исходный аудит и история MVP — [PROJECT_PLAN.md](PROJECT_PLAN.md).
