import DefaultTheme from 'vitepress/theme';
import AnalyticsPlayground from './Playground.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) { app.component('AnalyticsPlayground', AnalyticsPlayground); },
};
