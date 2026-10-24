import { defineConfig } from 'vitepress';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = process.env.DOCS_BASE ?? '/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('DOCS_BASE must be / or /path/to/site/');
const output = process.env.DOCS_OUTPUT ?? 'dist';
if (!['dist', 'dist-subpath'].includes(output)) throw new Error('DOCS_OUTPUT must be dist or dist-subpath');
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const page = (text, file) => ({ text, link: `/docs/${file}` });
export default defineConfig({
  srcDir: 'content',
  outDir: resolve(fileURLToPath(new URL('.', import.meta.url)), output),
  base,
  lang: 'ru-RU',
  title: 'DOM analytics',
  description: 'Контекст из DOM. Один сборщик, независимые получатели аналитики.',
  cleanUrls: false,
  head: [['meta', { name: 'robots', content: 'noindex' }]],
  themeConfig: {
    siteTitle: `DOM analytics · ${version}`,
    nav: [page('Начать', 'getting-started'), page('API', 'API'), page('Playground', 'PLAYGROUND')],
    sidebar: [
      { text: 'Начать работу', items: [page('Обзор', 'index'), page('Первое событие', 'getting-started'), page('Script, ESM и npm', 'CONNECTIONS'), page('Angular', 'ANGULAR')] },
      { text: 'Модель событий', items: [page('Контракт и наследование', 'CONTRACT'), page('Конфигурация и несколько сервисов', 'CONFIGURATION'), page('API', 'API'), page('Playground и inspect', 'PLAYGROUND')] },
      { text: 'Аналитические сервисы', items: [page('Каталог и статусы', 'integrations/README'), page('Адаптеры: подключение', 'ADAPTERS'), ...['ga4', 'gtm', 'umami', 'plausible', 'posthog', 'mixpanel', 'amplitude', 'matomo'].map(name => page(name === 'ga4' ? 'Google Analytics 4' : name === 'gtm' ? 'Google Tag Manager' : name === 'posthog' ? 'PostHog' : name[0].toUpperCase() + name.slice(1), `integrations/${name}`))] },
      { text: 'Разработка', collapsed: true, items: [page('Архитектура', 'ARCHITECTURE'), page('Производительность', 'PERFORMANCE'), page('Пилот на сайте', 'SITE_PILOT'), page('Миграция', 'MIGRATION'), page('Legacy', 'LEGACY'), page('Выпуск', 'RELEASE'), page('Сборка документации', 'WEBSITE'), page('План документации', 'DOCUMENTATION_PLAN')] },
    ],
    search: { provider: 'local', options: { locales: { root: { translations: { button: { buttonText: 'Поиск', buttonAriaLabel: 'Поиск по документации' }, modal: { noResultsText: 'Ничего не найдено', resetButtonTitle: 'Очистить поиск', footer: { selectText: 'выбрать', navigateText: 'перейти', closeText: 'закрыть' } } } } } } },
    outline: { level: [2, 3], label: 'На этой странице' },
    docFooter: { prev: 'Предыдущая', next: 'Следующая' },
    sidebarMenuLabel: 'Разделы', returnToTopLabel: 'Наверх', darkModeSwitchLabel: 'Тема',
    footer: { message: 'Кандидат API 0.3.0 · Пакет и сайт ещё не опубликованы. SDK-контракты проверены локально; доставка в реальные панели — отдельный этап.' },
  },
});
