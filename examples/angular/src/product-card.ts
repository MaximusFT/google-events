import { Component, signal } from '@angular/core';
import { TrackContextDirective } from './track-context.directive';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [TrackContextDirective],
  template: `
    <section id="product" trackContext data-track-root
      [attr.data-track-product-id]="second() ? 'SKU-B' : 'SKU-A'"
      [attr.data-track-price]="second() ? '0' : '12.5'"
      [attr.data-track-available]="second() ? 'false' : 'true'">
      <h2>{{ second() ? 'Товар B' : 'Товар A' }}</h2>
      <div data-track-placement="title">
        <button id="favorite" data-track-event="favorite_requested">В избранное</button>
      </div>
      @if (showExtra()) {
        <div data-track-placement="footer">
          <button id="extra" data-track-event="favorite_requested">Ещё одно действие</button>
        </div>
      }
      <button id="toggle-extra" (click)="showExtra.set(!showExtra())">Динамическая кнопка</button>
      <button id="change-product" (click)="second.set(!second())">Сменить товар</button>
    </section>
  `,
})
export class ProductCard {
  readonly showExtra = signal(false);
  readonly second = signal(false);
}
