import { Component, computed, inject, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, RouterLink, RouterOutlet, type Routes } from '@angular/router';
import { EventLog } from './event-log';
import { AboutPage, ShopPage } from './pages';

const routes: Routes = [
  { path: 'shop', component: ShopPage },
  { path: 'about', component: AboutPage },
  { path: '', pathMatch: 'full', redirectTo: 'shop' },
];

@Component({
  selector: 'app-root', standalone: true, imports: [RouterLink, RouterOutlet],
  template: `
    <nav><a routerLink="/shop">Магазин</a> · <a routerLink="/about">О примере</a></nav>
    <main><router-outlet /></main>
    <h2>Собранные события</h2><pre id="events" aria-live="polite">{{ json() }}</pre>
  `,
})
class App {
  private readonly log = inject(EventLog);
  readonly json = computed(() => JSON.stringify(this.log.events(), null, 2));
}

bootstrapApplication(App, { providers: [provideZonelessChangeDetection(), provideRouter(routes)] })
  .catch(error => { console.error(error); });
