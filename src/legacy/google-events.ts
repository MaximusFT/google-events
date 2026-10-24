import { inverseBoolean } from './utils.js';
import { ancestorPath, eventElement, parentElement } from '../dom/tree.js';
import { closestValue, contextPath, eventRoot } from './context.js';
import { cleanData } from './data.js';
import type { AnalyticsEvent } from './events.js';
import { createDelivery } from '../delivery/dispatcher.js';
import type { DeliveryOptions } from '../delivery/types.js';
import { createDataLayerReceiver } from '../adapters/data-layer.js';

export type { AnalyticsEvent } from './events.js';

export interface GoogleEventsOptions extends DeliveryOptions<AnalyticsEvent> {
  /** Output field name -> source field name. */
  map?: Record<string, string>;
  /** Additional output field name -> data-gtm source field name. */
  tags?: Record<string, string>;
  root?: Document | Element;
  /** Disable listeners; dispatchEvent remains available. */
  automatic?: boolean;
}

const defaultMap: Record<string, string> = {
  'add-details': 'add-details',
  'component-name': 'component-name',
  'component-type': 'component-type',
  'document-type': 'document-type',
  'link-label': 'link-label',
  'link-place': 'link-place',
  'link-type': 'link-type',
  'link-url': 'link-url',
  'page-area': 'page-area',
  restriction: 'restriction',
  'widget-position': 'widget-position',
};

const ecommerceFields = [
  'product-id', 'product-name', 'product-brand', 'product-category', 'product-sale-price',
  'product-quantity', 'product-discount', 'product-list-price', 'product-variant',
  'product-position', 'product-coupon-code', 'checkout-step', 'payment-type',
  'shipping-method', 'shipping-coupon-code', 'shipping-discount', 'shipping-total',
  'order-coupon-code', 'order-subtotal', 'order-tax', 'order-total', 'order-discount',
];

/** Create an isolated compatibility tracker for historical GTM markup. */
export function createGoogleEvents(options: DeliveryOptions<AnalyticsEvent> = {}) {
  let removeListeners: (() => void) | undefined;
  const delivery = createDelivery<AnalyticsEvent>({
    ...options, receivers: options.receivers ?? [createDataLayerReceiver<AnalyticsEvent>()],
  });

  return {
    elementsArray: ['A', 'BUTTON'],
    formElementsArray: ['INPUT', 'TEXTAREA', 'SELECT'],
    inputTypeArray: ['checkbox', 'radio'],
    attrTags: {} as Record<string, string>,
    attrMap: { ...defaultMap },

    setAttrMapping(obj: Record<string, string> = {}) {
      this.attrMap = { ...this.attrMap, ...obj };
    },
    setAttrTags(obj: Record<string, string> = {}) {
      this.attrTags = { ...this.attrTags, ...obj };
      this.setAttrMapping(obj);
    },
    getElementTagName(element: Element) {
      return element.getAttribute('data-gtm-element')?.toUpperCase() || element.tagName.toUpperCase();
    },
    getEventTarget: eventElement,
    getParentElement: parentElement,
    dataToCamelCase(str: string) {
      return str.replace(/^data-/, '').replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    },
    findClosest(element: Element, attribute: string, fallback?: string, root?: Element) {
      return closestValue(contextPath(element, root), attribute, fallback);
    },
    /** @deprecated Historical name; values are now preserved without lowercasing. */
    removeEmptyAndLowerCase: cleanData,
    disableElement(element: Element) {
      element.setAttribute('data-gtm-off', 'true');
    },
    findInParents(element: Element, root: Element, attribute: string) {
      const values: string[] = [];
      for (const node of contextPath(element, root)) {
        const value = node.getAttribute(attribute);
        if (value) values.unshift(value);
        if (node.hasAttribute(attribute + '-root')) {
          const rootValue = node.getAttribute(attribute + '-root');
          if (rootValue) values.unshift(rootValue);
          break;
        }
      }
      return values.join(' > ');
    },
    gtmEcommDetail(element: Element, data: Record<string, string | undefined>, root?: Element) {
      const path = contextPath(element, root);
      const eventName = closestValue(path, 'data-ecomm-event-name');
      if (!eventName) return undefined;
      const result: Record<string, string | undefined> = { 'event-name': eventName };
      for (const field of ecommerceFields) {
        result[field] = closestValue(path, 'data-ecomm-' + field);
      }
      result['product-position'] ??= data['link-place'];
      return result;
    },
    gtmEventDetail(element: Element, root: Element, customActionName?: string): AnalyticsEvent | false {
      const path = contextPath(element, root);
      if (!path.length || path.some((node) => node.hasAttribute('data-gtm-off'))) return false;
      const read = (name: string, fallback?: string) => closestValue(path, 'data-gtm-' + name, fallback);
      const data: Record<string, string | undefined> = {};
      const details: string[] = [];
      const extra = read('add-details');
      if (extra) details.push(extra);
      const extraLabel = read('add-details-label');
      if (extraLabel) details.push(extraLabel + ': ' + (read('add-details-value') ?? ''));

      data['component-name'] = this.findInParents(element, root, 'data-gtm-component-name');
      data['component-type'] = this.findInParents(element, root, 'data-gtm-component-type');
      data['link-hierarchy'] = this.findInParents(element, root, 'data-gtm-link-hierarchy');
      data['page-area'] = read('page-area', '2');
      data.restriction = read('restriction', 'public');
      data['widget-position'] = read('widget-position');
      data['link-place'] = read('link-place', '1');
      data['document-type'] = read('document-type');

      const label = read('link-label') ?? element.textContent?.trim() ?? '';
      const prefix = read('link-label-prefix');
      data['link-label'] = prefix ? prefix + ': ' + label : label;
      const tag = this.getElementTagName(element);
      const input = element as HTMLInputElement;
      let action = 'click';
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (input.type === 'checkbox') {
          data['link-type'] = 'checkbox ' + (input.checked ? 'checked' : 'unchecked');
          data['link-url'] = '@check ' + label;
        } else if (input.type === 'radio') {
          data['link-type'] = 'button';
          data['link-url'] = '@select ' + label;
        } else {
          const value = input.value?.trim();
          if (!value) return false;
          action = 'focusout';
          data['link-type'] = 'field value populated';
          data['link-url'] = '@enter ' + (element.getAttribute('name') || element.id || label);
          if (element.getAttribute('class')?.includes('search')) {
            action = customActionName || 'focusout';
            data['link-type'] = 'perform search';
            data['link-url'] = '@perform search';
            details.push('search term: ' + value);
          }
        }
      } else if (tag === 'SELECT') {
        action = 'change';
        data['link-type'] = 'select';
        data['link-url'] = '@select ' + label;
      } else {
        data['link-url'] = read('link-url') || (tag === 'A' ? (element as HTMLAnchorElement).href : '@' + label);
        data['link-type'] = read('link-type') || (tag === 'A' ? 'link' : 'button');
        const searchId = element.getAttribute('data-gtm-add-details-search');
        if (searchId) {
          const relative = element.ownerDocument.getElementById(searchId);
          const value = relative && 'value' in relative && typeof relative.value === 'string'
            ? relative.value.trim() : '';
          if (!value) return false;
          details.push('search term: ' + value);
          data['link-type'] = 'perform search';
          data['link-url'] = '@perform search';
        }
      }
      if (data['link-hierarchy']) details.unshift('link-hierarchy: ' + data['link-hierarchy']);
      // Legacy drawer behavior is retained until the event contract is migrated.
      const inverseName = element.getAttribute('data-gtm-drawer-inverse-name');
      if (inverseName) {
        if (element.getAttribute('data-gtm-drawer-inversed') === 'true') {
          data['link-label'] = inverseName;
          data['link-url'] = '@' + inverseName;
        }
        element.setAttribute('data-gtm-drawer-inversed', inverseBoolean(element.getAttribute('data-gtm-drawer-inversed') || 'false'));
      }
      const url = data['link-url'];
      if (url && tag === 'A') {
        const location = element.ownerDocument.location;
        try {
          const parsed = new URL(url, location.href);
          if (parsed.origin === location.origin) data['link-url'] = parsed.pathname + parsed.search + parsed.hash;
        } catch {
          // Keep custom non-URL labels untouched.
        }
      }
      data['add-details'] = details.join(' | ');
      for (const source of Object.values(this.attrTags)) {
        data[source] = read(source);
      }
      const mapped: Record<string, string | undefined> = {};
      for (const [output, source] of Object.entries(this.attrMap)) {
        mapped[output] = data[source];
      }
      return cleanData({
        action,
        // data-gtm-event remains a scope marker for compatibility; data-event names the action.
        event: element.getAttribute('data-event') || action,
        data: mapped,
        ecommerce: this.gtmEcommDetail(element, data, root),
      });
    },
    callEvent(root: Element, data: AnalyticsEvent) {
      return delivery.dispatch(data, { document: root.ownerDocument });
    },
    /** Resolve after all currently pending receiver sends have settled. */
    flush() {
      return delivery.flush();
    },
    dispatchEvent(element: Element, root: Element, customActionName?: string) {
      const data = this.gtmEventDetail(element, root, customActionName);
      if (!data) return false;
      this.callEvent(root, data);
      this.debugConsole(data, element.ownerDocument);
      return data;
    },
    onClickEvent(element: Element, root: Element) {
      for (const node of contextPath(element, root)) {
        if (this.elementsArray.includes(this.getElementTagName(node)) ||
            this.inputTypeArray.includes((node as HTMLInputElement).type)) {
          return this.dispatchEvent(node, root);
        }
      }
      return false;
    },
    debugConsole(data: AnalyticsEvent, doc?: Document) {
      const view = (doc ?? (typeof document !== 'undefined' ? document : undefined))?.defaultView;
      try {
        if (view?.sessionStorage.getItem('googleEventDebug')) {
          console.table({ ...data.data, action: data.action, ...data.ecommerce });
        }
      } catch {
        // Storage may be unavailable; diagnostics must not break event delivery.
      }
    },
    destroy() {
      removeListeners?.();
      removeListeners = undefined;
    },
    init(options: GoogleEventsOptions = {}) {
      delivery.configure(options);
      this.destroy();
      this.setAttrMapping(options.map);
      this.setAttrTags(options.tags);
      const scope = options.root ?? (typeof document !== 'undefined' ? document : undefined);
      if (!scope) return false;
      if (options.automatic === false) return true;

      const resolve = (event: Event) => {
        const element = eventElement(event);
        if (!element) return undefined;
        const path = ancestorPath(element);
        // Bound all context to the configured element, even when the marked root is outside it.
        const boundIndex = scope.nodeType === 1 ? path.indexOf(scope as Element) : path.length - 1;
        if (boundIndex < 0 || (scope.nodeType === 9 && element.ownerDocument !== scope)) return undefined;
        const bounded = path.slice(0, boundIndex + 1);
        const root = bounded.find((node) => node.hasAttribute('data-gtm-event'));
        return root ? { element, root } : undefined;
      };
      const click = (event: Event) => {
        const found = resolve(event);
        if (found) this.onClickEvent(found.element, found.root);
      };
      const keydown = (event: Event) => {
        const found = resolve(event);
        if (found && (event as KeyboardEvent).key === 'Enter' && !(event as KeyboardEvent).repeat &&
            this.formElementsArray.includes(found.element.tagName) &&
            found.element.getAttribute('class')?.includes('search')) {
          this.dispatchEvent(found.element, found.root, 'keypress');
        }
      };
      const focusout = (event: Event) => {
        const found = resolve(event);
        if (found && ['INPUT', 'TEXTAREA'].includes(found.element.tagName) &&
            !this.inputTypeArray.includes((found.element as HTMLInputElement).type)) {
          this.dispatchEvent(found.element, found.root);
        }
      };
      const change = (event: Event) => {
        const found = resolve(event);
        if (found && found.element.tagName === 'SELECT') this.dispatchEvent(found.element, found.root);
      };
      const listeners: [string, EventListener][] = [['click', click], ['keydown', keydown], ['focusout', focusout], ['change', change]];
      for (const [type, handler] of listeners) scope.addEventListener(type, handler);
      removeListeners = () => {
        for (const [type, handler] of listeners) scope.removeEventListener(type, handler);
      };
      return true;
    },
    /** Convenience manual dispatch with automatic root lookup. */
    trackElement(element: Element, customActionName?: string) {
      const root = eventRoot(element);
      return root ? this.dispatchEvent(element, root, customActionName) : false;
    },
  };
}

export const googleEvents = createGoogleEvents();
