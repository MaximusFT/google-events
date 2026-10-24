# Сборка и проверка сайта документации

Сайт подготовлен локально на VitePress 1.6.4. Публичная публикация не выполнена. Руководства редактируются в docs; оформление и конфигурация — в website. Сгенерированное дерево не является источником контента.

## Локальный запуск

Из корня репозитория:

```sh
npm ci
npm run docs:build
npm run docs:preview
```

Откройте `http://127.0.0.1:5190/`. Сборка устанавливает зависимости генератора через отдельный website/package-lock.json, собирает JavaScript библиотеки для playground и создаёт `website/.vitepress/dist`. Ей не нужны SDK, аналитические аккаунты или Angular-зависимости. Обычный dist библиотеки и существующие демо сохраняются.

Для подпути перед сборкой задайте DOCS_BASE. PowerShell:

```powershell
$env:DOCS_BASE = '/my-project/'
npm run docs:build
npm run docs:preview
```

На POSIX: `DOCS_BASE=/my-project/ npm run docs:build`. После смены пути пересоберите HTML; preview читает base из build-info.json. Поддерживаются `/` и абсолютный подпуть из букв, цифр, `_`, `-` и `/` с завершающим слешем. Домен и GitHub-owner не зашиты в навигацию. URL содержат `.html`: статический хост должен обслуживать существующие файлы напрямую.

## Что проверяется

```sh
npm run docs:check
```

Команда собирает два варианта: `/` и `/relocated/project/`. Проверяются локальные ссылки, якоря и assets в HTML; отсутствующая цель или выход из base завершают проверку ошибкой. Для браузерных проверок нужен установленный Edge на Windows либо Chromium Playwright на Linux (`npx playwright install --with-deps chromium`). Проверяются прямое открытие/перезагрузка раздела, поиск, отображение версии, mobile menu и ширина страницы, сбор/inspect/валидация/маппинг playground. Внешние сервисы поиска и аналитики не нужны.

Отдельный workflow Documentation проверяет сайт на push в main и pull request. Он не запускает публикацию. Проверки SDK-контрактов библиотеки остаются в основном workflow; актуальность внешних URL не блокирует локальную сборку сайта.

## Структура и переносимость

- docs — канонические Markdown-страницы и исходные данные замеров; они остаются в npm tarball.
- website/.vitepress — конфигурация, тема и playground, отдельный lock-файл находится в website.
- website/content (включая content/public) — пересоздаваемые копии руководств, страниц репозитория и нужных примеров/готового JS; их нельзя править вручную.
- website/.vitepress/dist — готовый статический сайт; dist-subpath — вторая сборка только для проверки переноса.

Корневые README, ROADMAP и PROJECT_PLAN также преобразуются в страницы, поэтому исторические относительные ссылки сохраняют смысл. Ссылки на примеры Angular/React ведут на локальные текстовые исходники в assets. Сайт, кэш генератора и его зависимости не добавляются в npm-пакет библиотеки. Локальный поиск включён в сборку, сторонние fonts/CDN и аналитические SDK не подключены.

## Подготовка публикации

При выборе GitHub Pages задайте base по фактическому адресу: `/` для корня домена или `/<repository>/` для project site. Перенос репозитория требует нового base и пересборки, без правок исходных руководств. Содержимое website/.vitepress/dist можно разместить на другом статическом хосте с тем же base.

Публикацию выполняет отдельный workflow `Publish documentation` (pages.yml): push в main или ручной workflow_dispatch на default branch. Сначала проходят проверки библиотеки/пакета и документации, затем configure-pages получает base_path из настроек Pages и выполняется отдельная сборка для этого адреса. Права pages:write/id-token:write есть только у deploy job с environment github-pages; PR не запускает развёртывание. Параллельные публикации выполняются по очереди.

В настройках репозитория должен быть выбран Pages → Source → GitHub Actions; включение Pages требует прав владельца/администратора. Workflow не меняет источник публикации и custom domain самостоятельно. После загрузки артефакта deploy-pages возвращает фактический page_url; verify job проверяет прямые ссылки, поиск, mobile menu, исходники и playground именно на нём. Официальные инструкции: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [VitePress deploy и base](https://vitepress.dev/guide/deploy).

Повторная проверка опубликованного адреса в PowerShell:

```powershell
$env:DOCS_URL = 'https://your-host/your-project/'
npx playwright test --config playwright.docs.config.mjs
```

В этом режиме локальный сервер не запускается. До успешного deploy и проверки фактического публичного URL статус публикации не считается подтверждённым.
