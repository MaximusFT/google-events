# Amplitude Browser SDK 2

Проверено: 24 октября 2026 года. Статус: исследовано; адаптер не реализован. Не смешивать API Browser SDK 2 с прежними поколениями.

## SDK, событие и экземпляры

Есть script loader и пакет @amplitude/analytics-browser. Init задаёт API key; createInstance создаёт отдельные клиенты с собственными настройками. Событие: `client.track(name, properties)`. SDK поддерживает autocapture и setOptOut. [Browser SDK 2](https://amplitude.com/docs/sdks/analytics/browser/browser-sdk-2).

## Результат и предлагаемый адаптер

Методы SDK возвращают wrapper с .promise: ожидать сам track недостаточно. Track.promise возвращает Result с code/message, flush.promise — завершение upload work, не результат отдельного события. [Callback и Promise](https://amplitude.com/docs/sdks/analytics/browser/browser-sdk-2#callback).

Наш вывод: асинхронный send должен ожидать .promise и интерпретировать Result; нельзя считать любой fulfilled Promise успешной доставкой. Передавать уже готовый instance, не менять user/device identity и не включать autocapture при создании получателя.

## Неподтверждённое и приёмка

Числовые лимиты и правила зарезервированных свойств проверить отдельно перед реализацией. Readiness ждать через согласованную интеграцию init, не через глобальный таймер ядра. Локальные тесты — mock wrapper и Result; приложение дополнительно управляет opt-out и автоматическими измерениями. [SDK lifecycle](https://amplitude.com/docs/sdks/analytics/browser/browser-sdk-2).

Проверить props, независимые instances, ошибочный Result/rejection, ожидание .promise и flush, отсутствие дублей; затем запрос и событие в тестовом проекте. Это кандидат для проверки async-контракта, не причина менять нейтральный формат события.
