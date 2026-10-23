# Архитектура библиотеки

Дата: 24 октября 2026 года. Этап 3 ROADMAP. Это реорганизация существующего кода, без добавления новых SDK или изменения контракта событий.

## Модули и границы

| Модуль | Ответственность | Допустимые зависимости |
| --- | --- | --- |
| core | Нейтральное событие, копирование данных, schema, валидация, per-event конфигурация | Только core |
| dom | Путь узлов, bounded-сбор, источники полей и делегированные слушатели | core, dom |
| delivery | Контракт получателя, filter, изолированные копии, ошибки, pending/flush | core, delivery |
| adapters | Отдельные callback и dataLayer реализации | core, delivery, adapters |
| debug | Inspect-контракт, копирование диагностики и безопасный вызов hook | core, dom, delivery, debug |
| legacy | Старый payload, GTM-разметка, ecommerce/hierarchy и исторические string helpers | Общие модули и legacy; нейтральный tracker не используется |

`src/tracker.ts` — точка сборки нейтрального экземпляра: создаёт resolver и доставку, соединяет DOM-события с коллекцией, добавляет preview получателей и управляет start/stop. Он не содержит обход атрибутов, SDK-отправку или реализацию копирования диагностики.

Конкретные файлы:

```text
core/events.ts             TrackEvent и копирование plain data
core/schema.ts             определения, преобразование и проверка полей
core/configuration.ts      общая/per-event схема
dom/tree.ts                общий путь Element/Shadow DOM/slots
dom/collector.ts           action, границы, nearest-wins, off, overrides
dom/types.ts               источники/результат DOM-сбора
dom/listeners.ts           регистрация и симметричное снятие слушателей
delivery/types.ts          контракты доставки и preview
delivery/dispatcher.ts     маршрутизация, ошибки и flush
adapters/callback.ts       transform/send переданного callback
adapters/data-layer.ts     окно документа и существующая очередь
debug/inspection.ts        публичный inspect и изоляция onDiagnostic
legacy/google-events.ts    совместимая фабрика и singleton
legacy/context.ts          исторические границы GTM
legacy/events.ts           AnalyticsEvent старого API
legacy/data.ts             историческая очистка значений
legacy/utils.ts            исторические string helpers
```

DOM-модуль возвращает collection без receivers. Публичный inspect добавляет к ней selection preview; реальная отправка preview не вычисляет. Core не содержит DOM-узлов и не знает названия SDK. Delivery не создаёт адаптеров и не сканирует дерево.

## Умолчания и совместимость

Нейтральная и legacy-фабрики явно добавляют dataLayer, если receivers не передан. Явный пустой список оставляет сбор без отправки. Сам внутренний dispatcher работает только с переданным списком; в нём нет импорта dataLayer или Google SDK.

Корневые `main.ts`, `events.ts`, `schema.ts`, `context.ts`, `utils.ts`, `receivers.ts` остаются совместимыми входами к перемещённым частям. `index.ts` сохраняет публичные exports. Фасад receivers сохраняет исторические generic-defaults на AnalyticsEvent; универсальные внутренние контракты требуют явного типа события и не зависят от legacy.

Общими для legacy и нового режима остаются общий путь DOM и доставка. Правила data-gtm, ecommerce и цепочки hierarchy изолированы в legacy, а не скопированы в core или адаптеры. Неподключённые SDK не добавлены в зависимости и не загружаются при импорте.

## Проверки и дальнейшие изменения

`test/architecture.test.mjs` проверяет import/export-зависимости доменов, отсутствие внешних SDK, циклов и известных DOM-идентификаторов в core. Поведение подтверждают существующие unit/jsdom, исполняемые HTML-примеры контракта и реальные браузерные сценарии. Проверка tarball подтверждает импорты ESM/CommonJS и типы NodeNext.

JSDoc/TSDoc объясняет публичные lifecycle-методы, filter/transform/send, границы ошибок и значение flush. Комментарии не заменяют [контракт](CONTRACT.md).

Новые сервисы добавляются отдельными модулями adapters после этапа конфигурации. Их SDK-клиенты передаёт приложение; ради нового сервиса не нужно менять DOM-коллектор или dispatcher. [Правила конфигурации и mapping](CONFIGURATION.md) используют schema/filter/transform. Поддержка allowlist, SDK readiness и отмены отправок остаётся отдельной работой.
