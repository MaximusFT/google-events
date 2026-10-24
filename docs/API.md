# API нейтрального трекера

Кандидат 0.3.0. Доступен через npm/ESM и глобальный `TrackEvents` в script-сборке. Формат события и правила полей описаны в [контракте](CONTRACT.md); public types поставляются с пакетом.

## Создание и настройки

`createTracker(options?)` создаёт независимый экземпляр. Импорт и конструктор не устанавливают DOM-слушатели. Ошибки конфигурации (неверная schema, пустые/повторяющиеся имена receivers) выбрасывают TypeError.

| Настройка | Смысл |
| --- | --- |
| root | Document или Element: цель делегированных слушателей и верхняя граница обхода; по умолчанию document при запуске |
| automatic | По умолчанию true; false оставляет ручной API без подписки |
| capture | По умолчанию false; true собирает до bubble-обработчиков интерфейса |
| schema / events | Общие и per-event определения полей; [приоритеты](CONFIGURATION.md) |
| receivers | Именованные получатели; не задано — generic dataLayer, пустой массив — доставка отключена |
| onError | Ошибка filter/send с receiver, phase, error и копией event |
| onDiagnostic | Результат сбора с issues; ошибка callback не прерывает доставку |

`onError` и `onDiagnostic` могут вернуть Promise; их ошибки изолируются. Обработчики `filter` и `transform` получателя синхронны. Несколько сервисов на одной области получают событие от одного экземпляра; пересекающиеся самостоятельные трекеры автоматически не дедуплицируются.

## Жизненный цикл

| Метод | Результат и действие |
| --- | --- |
| start(root?) | boolean: подписаться на click/change/submit; false без доступного DOM. Повторный запуск с тем же root не добавляет слушателей. Другой root снимает прежнюю подписку |
| stop() | void: снять слушатели |
| destroy() | void: совместимый alias stop; допускает новый start и ручные вызовы |
| flush() | Promise&lt;void&gt;: дождаться отправок, начатых до вызова; не является SDK flush или подтверждением сервера |

Снятие слушателей не отменяет уже начатые отправки. При замене DOM-root уничтожьте прежнюю подписку. Рабочие варианты: [React и обычный JS](CONNECTIONS.md), [Angular](ANGULAR.md).

## Сбор, объяснение и ручные события

`inspect(element, overrides?)` возвращает `TrackInspection`: event или false, action, boundary, fields, issues и receivers. Доставка и transform не выполняются; filters выполняются на копиях для предпросмотра. DOM-ссылки есть только в диагностике. Поэтому результат целиком не предназначен для JSON.stringify: для вывода преобразуйте ссылки в id/tagName, как в [playground](PLAYGROUND.md).

`trackElement(element, overrides?)` собирает и отправляет событие по DOM-контракту. Возвращает TrackEvent или false при блокирующей проблеме. Overrides: name, trigger, properties; свойства используют итоговые ключи schema. Метод учитывает root/off, schema и onDiagnostic.

`track(name, properties?, { trigger?, document? }?)` отправляет явные свойства через ту же schema/receivers; DOM-root/off при этом не проверяются. Trigger по умолчанию manual. Document задаёт окно для window-based получателей. Метод работает без DOM, если получатели его не требуют.

Возврат события из track/trackElement означает успешный сбор/валидацию, а не успешную доставку. Ошибка одного получателя не блокирует другие; асинхронный send участвует в flush. Для подтверждённых бизнес-операций вызывайте track после успеха операции, а не выдавайте клик за завершение покупки.

## Получатели и исторический API

`createCallbackReceiver`, `createDataLayerReceiver`, `createGa4Receiver`, `createGtmReceiver`, `createUmamiReceiver` создают получателей без собственных DOM-слушателей. Настройки, типы SDK-клиентов, mapping и ограничения — в [адаптерах](ADAPTERS.md) и [конфигурации](CONFIGURATION.md).

Default export npm-пакета остаётся историческим googleEvents; для нового кода импортируйте createTracker по имени. Legacy-фабрика и события описаны в [LEGACY](LEGACY.md), отличия — в [миграции](MIGRATION.md).
