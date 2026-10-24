<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { withBase } from 'vitepress';

const root = ref(null), price = ref('0'), available = ref(false), disabled = ref(false);
const ready = ref(false), failure = ref(''), inspection = ref(null), deliveries = ref([]);
let tracker;
const describeSource = source => ({ element: source.element?.id || source.element?.tagName || null, attribute: source.attribute, raw: source.raw });
function explain(element) {
  if (!tracker) return;
  const result = tracker.inspect(element);
  inspection.value = { event: result.event, boundary: result.boundary?.id, issues: result.issues, receivers: result.receivers,
    fields: Object.fromEntries(Object.entries(result.fields).map(([key, field]) => [key, {
      ...describeSource(field), value: field.value, overridden: field.overridden.map(describeSource),
    }])) };
}
onMounted(async () => {
  try {
    const api = await import(/* @vite-ignore */ withBase('/dist/index.js'));
    // A navigation can destroy this component while the module request is still pending.
    if (!root.value) return;
    tracker = api.createTracker({ root: root.value,
      schema: { product_id: { type: 'string', required: true }, price: { type: 'number', required: true }, available: 'boolean' },
      receivers: [
        api.createCallbackReceiver({ name: 'neutral', send: payload => { deliveries.value.push({ receiver: 'neutral', payload }); } }),
        api.createCallbackReceiver({ name: 'mapped', transform: event => ({ event: event.name, ...event.properties }), send: payload => { deliveries.value.push({ receiver: 'mapped', payload }); } }),
      ],
    });
    tracker.start(); ready.value = true;
  } catch (error) { failure.value = error.message; }
});
onBeforeUnmount(() => tracker?.destroy());
</script>

<template>
  <div class="playground">
    <p v-if="failure" role="alert">{{ failure }}</p>
    <p v-if="!ready && !failure">Загрузка примера…</p>
    <label>Цена <input id="demo-price" v-model="price" type="text" inputmode="decimal"></label>
    <label><input id="demo-available" v-model="available" type="checkbox"> Товар доступен</label>
    <label><input id="demo-off" v-model="disabled" type="checkbox"> Отключить сбор в карточке</label>
    <section id="demo-root" ref="root" data-track-root data-track-product-id="SKU-Demo" data-track-placement="page"
      :data-track-price="price" :data-track-available="String(available)" :data-track-off="disabled ? '' : null">
      <strong>Карточка товара</strong>
      <div data-track-placement="card">
        <button id="demo-action" :disabled="!ready" data-track-event="favorite_requested">В избранное</button>
        <button id="demo-inspect" :disabled="!ready" @click="explain(root.querySelector('#demo-action'))">Объяснить без отправки</button>
      </div>
      <section id="nested-root" data-track-root data-track-product-id="SKU-Nested" data-track-price="7.5">
        <strong>Вложенный root</strong>
        <button id="nested-action" :disabled="!ready" data-track-event="favorite_requested">Действие внутри</button>
        <button id="nested-inspect" :disabled="!ready" @click="explain(root.querySelector('#nested-action'))">Объяснить вложенный root</button>
      </section>
    </section>
    <h3>Inspect: событие, граница, источники и получатели</h3>
    <pre id="demo-inspection">{{ JSON.stringify(inspection, null, 2) }}</pre>
    <h3>Вызовы двух локальных получателей</h3>
    <button id="demo-clear" @click="deliveries = []">Очистить журнал</button>
    <pre id="demo-deliveries">{{ JSON.stringify(deliveries, null, 2) }}</pre>
  </div>
</template>
