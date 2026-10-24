# Mixpanel

Проверено: 24 октября 2026 года. Статус: исследовано; адаптер не реализован.

## Подключение и событие

Есть snippet и пакет mixpanel-browser; project token, региональный host и opt_out_tracking принадлежат конфигурации приложения. Autocapture можно включать/отключать; он не должен повторять наше действие. [Browser SDK](https://docs.mixpanel.com/docs/tracking-methods/sdks/javascript).

Вызов: `client.track(name, properties)`. Init поддерживает имя экземпляра; track возвращает объект/boolean и принимает callback/options, а не универсальный Promise. Возвращённый payload означает инициированную/поставленную в очередь отправку. [API производителя](https://github.com/mixpanel/mixpanel-js/blob/master/doc/readme.io/javascript-full-api-reference.md).

## Предлагаемый адаптер

Получать готовый клиент конкретного проекта; передавать только свойства события. Не регистрировать DOM-контекст как постоянные super properties и не менять identity. Для async-send понадобится явная политика callback, ошибок/таймаута и batching, если мы будем ждать результата. Эти детали проверяются на закреплённой версии до реализации.

## Ограничения и проверка

Числовые лимиты и зарезервированные имена не объявлены проверенными этим обзором. Автоматические измерения, отключение SDK и региональный endpoint нужно настроить отдельно от нашего filter. [SDK](https://docs.mixpanel.com/docs/tracking-methods/sdks/javascript).

Приёмка: точные args, два именованных клиента, отказ/false, callback-путь, отсутствие native/autocapture-дублей и утечек свойств между событиями. Локально использовать mock, реальную доставку проверять в отдельном проекте и его панели, а не по наличию window.mixpanel.
