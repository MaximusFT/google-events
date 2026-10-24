# GA4: прямой вызов Google tag

Проверено: 24 октября 2026 года. Статус: createGa4Receiver реализован, проверен с подставным gtag; реальный SDK/панель ещё не подтверждены.

## SDK и событие

Приложение подключает Google tag snippet и конфигурирует destination. Вызов: `gtag('event', name, params)`. Config/set задают более широкие параметры, event может их перекрыть. Для адресной доставки указывается send_to; без него действует default-группа настроенных целей. [API](https://developers.google.com/tag-platform/gtagjs/reference), [маршрутизация](https://developers.google.com/tag-platform/gtagjs/routing).

## Ограничения и дубли

Для стандартного GA4 указаны имя события до 40 символов и 25 event-параметров; ограничения 360 отличаются. Это не ограничения нейтрального ядра. [Лимиты](https://support.google.com/analytics/answer/9267744).

Google tag поддерживает consent-команды. Автоматический page_view можно отключить через send_page_view; этот вопрос решает владелец SDK. [API](https://developers.google.com/tag-platform/gtagjs/reference). Вывод для нашей интеграции: не отправлять то же действие одновременно напрямую и через GA4-тег GTM.

## Реализованный адаптер

API и примеры: [ADAPTERS.md](../ADAPTERS.md). Обязательны measurementId и getClient; доступны name/filter/transform/maxParameters. Адрес send_to защищён настройкой назначения. Boolean верхнего уровня преобразуется в строки только внутри этого адаптера; полной валидации всего GA4/ecommerce payload нет.

Получать готовый gtag и явный destination; name/properties переводить в event/params. Служебный send_to должен иметь определённый приоритет над одноимённым пользовательским полем. Не вызывать config и не загружать скрипт при создании получателя.

Snippet ставит команды в dataLayer; event_callback означает завершение обработки event-команды, а не появление в отчёте. [Callback](https://developers.google.com/tag-platform/gtagjs/reference/parameters). Наша политика: отсутствие клиента — диагностируемая ошибка, без скрытого ожидания и retries. Локально использовать mock/отдельный тестовый проект.

Приёмка: точные args и send_to, маппинг/лимиты, отсутствие второго GA4-маршрута, отказ одного из двух получателей. После SDK-теста подтвердить событие в панели; правила ecommerce и пользовательских отчётов исследовать отдельно перед их поддержкой.
