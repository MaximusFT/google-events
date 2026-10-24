# Matomo

Проверено: 24 октября 2026 года. Статус: исследовано; адаптер не реализован.

## SDK и форма события

Подтверждённый путь — matomo.js с _paq либо отдельным Tracker. Вызов: `client.trackEvent(category, action, name, value)`, где последние два аргумента необязательны, value числовой. GetTracker создаёт экземпляр, getAsyncTracker получает настроенный. [API](https://developer.matomo.org/guides/tracking-javascript).

Category/action отсутствуют в нейтральном контракте: адаптеру нужен явный mapping. Остальные свойства можно сопоставлять с настроенными Custom Dimensions, ID которых создаются заранее. Per-action dimension-данные предпочтительнее постоянного setCustomDimension для контекста одного действия. [Интеграция](https://developer.matomo.org/guides/tracking-javascript-guide).

## Маршруты и дубли

AddTracker дублирует данные дополнительной цели; это не автоматическая изоляция получателя. [Несколько trackers](https://developer.matomo.org/guides/tracking-javascript-guide). Существуют requireConsent и link tracking. [API](https://developer.matomo.org/guides/tracking-javascript). Наш вывод: передавать конкретный Tracker и не включать link tracking параллельно тому же действию.

## Открытые вопросы и проверка

Официальный npm-путь, числовые лимиты и точный сигнал завершения отправки ещё не закреплены; их проверить до реализации. Для базового адаптера не обещать Promise или flush SDK. Filter приложения дополняет, а не заменяет SDK consent.

Приёмка: category/action/name/value, обязательный mapping, per-action dimensions без утечек, конкретный tracker, отсутствие второго addTracker-маршрута. Локально — mock, затем тестовый siteId/панель. Сложность mapping делает Matomo следующим набором, но его модель уже учтена в архитектуре.
