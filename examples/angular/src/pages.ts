import { Component, signal } from '@angular/core';
import { ProductCard } from './product-card';

@Component({
  selector: 'app-shop', standalone: true, imports: [ProductCard],
  template: `
    <h1>Магазин</h1>
    <button id="toggle-card" (click)="showCard.set(!showCard())">Показать / скрыть карточку</button>
    @if (showCard()) { <app-product-card /> }
  `,
})
export class ShopPage { readonly showCard = signal(true); }

@Component({ selector: 'app-about', standalone: true, template: '<h1>О примере</h1><p>Журнал событий переживает переходы между маршрутами.</p>' })
export class AboutPage {}
