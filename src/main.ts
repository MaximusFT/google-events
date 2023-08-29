import { inverseBoolean, toCamelCase, upperCaseFirstLetter } from './utils';

interface ObjMap {
  [key: string]: any;
}

interface DataEcommerce {
  'event-name'?: string;
  'product-id'?: string;
  'product-name'?: string;
  'product-brand'?: string;
  'product-category'?: string;
  'product-sale-price'?: string;
  'product-quantity'?: string;
  'product-discount'?: string;
  'product-list-price'?: string;
  'product-variant'?: string;
  'product-position'?: string;
  'product-coupon-code'?: string;
  'checkout-step'?: string;
  'payment-type'?: string;
  'shipping-method'?: string;
  'shipping-coupon-code'?: string;
  'shipping-discount'?: string;
  'shipping-total'?: string;
  'order-coupon-code'?: string;
  'order-subtotal'?: string;
  'order-tax'?: string;
  'order-total'?: string;
  'order-discount'?: string;
}

interface DataGtm {
  'add-details'?: string | string[];
  'component-name'?: string;
  'component-type'?: string;
  'document-type'?: string;
  'link-label'?: string;
  'link-place'?: string;
  'link-type'?: string;
  'link-url'?: string;
  'page-area'?: string;
  restriction?: string;
  'widget-position'?: string;
  [key: string]: any;
}

interface gtmDataEvent {
  action?: string;
  event: string;
  data: DataGtm;
  ecommerce?: DataEcommerce;
  [key: string]: any;
}

export const googleEvents = {
  elementsArray: ['A', 'BUTTON'],
  formElementsArray: ['INPUT', 'TEXTAREA', 'SELECT', 'OPTIONS'],
  inputTypeArray: ['checkbox', 'radio'],
  attrTags: {},
  attrMap: {
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
  } as DataGtm,

  setAttrMapping: function (obj: ObjMap = {}) {
    this.attrMap = { ...this.attrMap, ...obj };
  },
  setAttrTags: function (obj: ObjMap = {}) {
    this.attrTags = { ...this.attrTags, ...obj };
    this.setAttrMapping(this.attrTags);
  },
  getElementTagName: function (element: HTMLElement) {
    // try find data-gtm-element="button" or data-gtm-element="link"
    return element.dataset.gtmElement ? element.dataset.gtmElement.toUpperCase() : element.tagName;
  },
  getEventTarget: function (event: Event) {
    return event.composed ? event.composedPath()[0] : event.target;
  },
  getParentElement: function (element: HTMLElement) {
    if (element.parentElement) {
      return element.parentElement;
    }
    // return element.getRootNode().host;
    return element.getRootNode();
  },
  dataToCamelCase: function (str: string) {
    return str.replace(/^data-/g, '').replace(/-([a-z])/g, function (el) {
      return el[1].toUpperCase();
    });
  },
  findClosest: function (element: HTMLElement, dataAttr: string, byDefault?: string | undefined) {
    let ret = element.dataset[this.dataToCamelCase(dataAttr)];
    if (ret) {
      return ret;
    }
    const el = element.closest('[' + dataAttr + ']');
    if (el instanceof HTMLElement) {
      return el.dataset[this.dataToCamelCase(dataAttr)];
    }
    return byDefault;
  },
  removeEmptyAndLowerCase: function (obj: ObjMap) {
    const self = this;
    return Object.keys(obj)
      .filter(function (k) {
        return obj[k] != null;
      })
      .reduce(function (acc: ObjMap, k: string) {
        const value = obj[k];
        if (!value) {
          return acc;
        }
        if (typeof value === 'object') {
          acc[k] = self.removeEmptyAndLowerCase(value);
        } else {
          acc[k] = k === 'link-url' ? value : value.toLowerCase();
        }
        return acc;
      }, {});
  },
  disableElement: function (element: HTMLElement) {
    element.dataset.gtmOff = 'true';
  },
  gtmEcommDetail: function (element: HTMLElement, dataGtm: DataGtm) {
    const eventName = this.findClosest(element, 'data-ecomm-event-name');
    if (!eventName) {
      return null;
    }
    return {
      // event-name: ['add', 'remove', 'product_click', 'place_order']
      'event-name': eventName,
      'product-id': this.findClosest(element, 'data-ecomm-product-id'),
      'product-name': this.findClosest(element, 'data-ecomm-product-name'),
      'product-brand': this.findClosest(element, 'data-ecomm-product-brand'),
      'product-category': this.findClosest(element, 'data-ecomm-product-category'),
      'product-sale-price': this.findClosest(element, 'data-ecomm-product-sale-price'),
      'product-quantity': this.findClosest(element, 'data-ecomm-product-quantity'),
      'product-discount': this.findClosest(element, 'data-ecomm-product-discount'),
      'product-list-price': this.findClosest(element, 'data-ecomm-product-list-price'),
      'product-variant': this.findClosest(element, 'data-ecomm-product-variant'),
      'product-position': this.findClosest(element, 'data-ecomm-product-position', dataGtm['link-place']),
      // Checkout part, even-name = 'place_order'
      'product-coupon-code': this.findClosest(element, 'data-ecomm-product-coupon-code'),
      'checkout-step': this.findClosest(element, 'data-ecomm-checkout-step'),
      'payment-type': this.findClosest(element, 'data-ecomm-payment-type'),
      'shipping-method': this.findClosest(element, 'data-ecomm-shipping-method'),
      'shipping-coupon-code': this.findClosest(element, 'data-ecomm-shipping-coupon-code'),
      'shipping-discount': this.findClosest(element, 'data-ecomm-shipping-discount'),
      'shipping-total': this.findClosest(element, 'data-ecomm-shipping-total'),
      'order-coupon-code': this.findClosest(element, 'data-ecomm-order-coupon-code'),
      'order-subtotal': this.findClosest(element, 'data-ecomm-order-subtotal'),
      'order-tax': this.findClosest(element, 'data-ecomm-order-tax'),
      'order-total': this.findClosest(element, 'data-ecomm-order-total'),
      'order-discount': this.findClosest(element, 'data-ecomm-order-discount'),
    };
  },
  gtmEventDetail: function (element: HTMLInputElement, root: HTMLElement, customActionName?: string) {
    const dataObj = {} as DataGtm;
    if (element.dataset.gtmOff !== undefined) {
      return false;
    }
    const urlRoot = document.location.protocol + '//' + document.location.host;
    const elementTagName = this.getElementTagName(element);
    const elementValue = element.value ? element.value.trim() : null;
    dataObj['link-type'];
    dataObj['link-url'];
    dataObj['action'];
    dataObj['add-details'] = [];
    if (element.dataset.gtmAddDetails) {
      dataObj['add-details'].push(element.dataset.gtmAddDetails);
    }
    if (element.dataset.gtmAddDetailsLabel) {
      // Example add-details case: Label + Value
      // total featured items: ${total number of featured items}
      dataObj['add-details'].push(element.dataset.gtmAddDetailsLabel + ': ' + element.dataset.gtmAddDetailsValue);
    }

    dataObj['component-name'] = this.findInParents(element, root, 'data-gtm-component-name') || '';
    dataObj['component-type'] = this.findInParents(element, root, 'data-gtm-component-type') || '';
    dataObj['link-hierarchy'] = this.findInParents(element, root, 'data-gtm-link-hierarchy');
    dataObj['page-area'] = this.findClosest(element, 'data-gtm-page-area', '2');
    dataObj['restriction'] = this.findClosest(element, 'data-gtm-restriction', 'public');
    dataObj['widget-position'] = this.findClosest(element, 'data-gtm-widget-position');
    dataObj['link-place'] = element.dataset?.gtmLinkPlace || '1';
    dataObj['document-type'] = element.dataset?.gtmDocumentType;
    dataObj['event'] = element.dataset?.event;

    const linkLabelPrefix = this.findClosest(element, 'data-gtm-link-label-prefix');
    const linkLabelPure =
      element.dataset.gtmLinkLabel || element?.textContent?.replace(/^\s+/, '')?.replace(/\s+$/, '');
    dataObj['link-label'] = linkLabelPrefix ? linkLabelPrefix + ': ' + linkLabelPure : linkLabelPure;

    switch (elementTagName) {
      case 'INPUT':
      case 'TEXTAREA':
        if (element.type === 'checkbox') {
          // except for Input-checkbox
          dataObj.action = 'click';
          dataObj['link-type'] = 'checkbox ' + (element.checked ? 'checked' : 'unchecked');
          dataObj['link-url'] = '@check ' + linkLabelPure;
          this.disableElement(element);
          break;
        } else if (element.type === 'radio') {
          // except for Input-radio
          dataObj.action = 'click';
          dataObj['link-type'] = 'button';
          dataObj['link-url'] = '@select ' + linkLabelPure;
          this.disableElement(element);
          break;
        }
        if (!elementValue) {
          // Fire only when input field value (after trimming) is NOT an empty string!
          return false;
        }
        dataObj.action = 'focusout';
        dataObj['link-type'] = 'field value populated';
        dataObj['link-url'] = '@enter ' + (element.getAttribute('name') || element.getAttribute('id') || linkLabelPure);
        if (element.className.includes('search')) {
          dataObj.action = customActionName || 'focusout';
          dataObj['link-type'] = 'perform search';
          dataObj['link-url'] = '@perform search';
          dataObj['add-details'].push('search term: ' + elementValue);
        } else {
          // Disable all Inputs elements beside Search fields
          this.disableElement(element);
        }
        break;
      case 'SELECT':
      case 'OPTIONS':
        break;
      case 'A':
      case 'BUTTON':
      default:
        dataObj.action = 'click';
        dataObj['link-url'] =
          element.dataset.gtmLinkUrl ||
          // @ts-ignore: Unreachable code error
          (elementTagName === this.elementsArray[0] ? element?.href : '@' + linkLabelPure);
        dataObj['link-type'] =
          element.dataset.gtmLinkType || (elementTagName === this.elementsArray[0] ? 'link' : 'button');
        // Rule for custom add-details in search case
        if (element.dataset.gtmAddDetailsSearch) {
          const relative = document.querySelector('#' + element.dataset.gtmAddDetailsSearch) as HTMLInputElement;
          const relativeValue = relative.value ? relative.value.trim() : null;
          if (!relativeValue) {
            // Fire only when input field value (after trimming) is NOT an empty string!
            return false;
          }
          dataObj['add-details'].push('search term: ' + relativeValue);
          dataObj['link-type'] = 'perform search';
          dataObj['link-url'] = '@perform search';
        }
        break;
    }

    if (dataObj['link-hierarchy']) {
      dataObj['add-details'].unshift('link-hierarchy: ' + dataObj['link-hierarchy']);
    }
    // Customize tagging in case drawer trigger
    if (element.dataset.gtmDrawerInverseName) {
      if (element.dataset.gtmDrawerInversed === 'true') {
        dataObj['link-label'] = element.dataset.gtmDrawerInverseName;
        dataObj['link-url'] = '@' + element.dataset.gtmDrawerInverseName;
      }
      element.dataset.gtmDrawerInversed = inverseBoolean(element?.dataset?.gtmDrawerInversed || 'false');
    }

    dataObj['link-url'] = dataObj?.['link-url']?.startsWith(urlRoot)
      ? dataObj?.['link-url']?.substr(urlRoot.length)
      : dataObj?.['link-url']?.toLowerCase();
    dataObj['add-details'] = dataObj['add-details'].join(' | ');

    for (const key in this.attrTags) {
      dataObj[key] = element.dataset?.[`gtm${upperCaseFirstLetter(toCamelCase(key, '-'))}`];
    }

    const retData = {} as DataGtm;
    for (const key in this.attrMap) {
      retData[key] = dataObj[this.attrMap[key]];
    }

    // Remove all `null` params in Object before triggered Event and LowerCase all String except link-url
    return this.removeEmptyAndLowerCase({
      action: dataObj['action'],
      event: dataObj['event'] || dataObj['action'],
      data: retData,
      ecommerce: this.gtmEcommDetail(element, { 'link-place': dataObj['link-place'] }),
    } as gtmDataEvent);
  },
  // @ts-ignore: Unreachable code error
  callEvent: function (root: HTMLElement, data: any) {
    if (!window?.dataLayer) {
      window.dataLayer = [];
    }
    window.dataLayer.push(data);
    // Fire custom Event for GTM
    // window.document.dispatchEvent(
    //   new CustomEvent(root.dataset.gtmEvent || 'gtmevent', {
    //     bubbles: true,
    //     detail: data,
    //   })
    // );
  },
  dispatchEvent: function (element: HTMLElement, root: HTMLElement, customActionName?: string) {
    const self = this;
    // @ts-ignore: Unreachable code error
    const dataLayerObj = this.gtmEventDetail(element, root, customActionName);

    if (dataLayerObj) {
      if (dataLayerObj['data']?.['link-type'] === 'button') {
        setTimeout(function () {
          self.callEvent(root, dataLayerObj);
        }, 500);
      } else {
        this.callEvent(root, dataLayerObj);
      }
      this.debugConsole(dataLayerObj);
    }
  },
  onClickEvent: function (element: HTMLElement, root: HTMLElement) {
    while (element && element !== root) {
      if (
        this.elementsArray.includes(this.getElementTagName(element)) ||
        this.inputTypeArray.includes((element as HTMLInputElement).type)
      ) {
        this.dispatchEvent(element, root);
        break;
      }
      // @ts-ignore: Unreachable code error
      element = this.getParentElement(element);
    }
  },
  findInParents: function (element: HTMLElement, root: HTMLElement, attribute: string) {
    let elem = element;
    let rootReached = false;
    const ret = [];
    const rootAttribute = attribute + '-root';
    while (elem) {
      if (elem.getAttribute(attribute)) {
        ret.unshift(elem.getAttribute(attribute));
      }
      if (elem.getAttribute(rootAttribute)) {
        ret.unshift(elem.getAttribute(rootAttribute));
        break;
      }
      const parent = this.getParentElement(elem);
      if (!parent || rootReached) {
        break;
      }
      if (parent === root) {
        rootReached = true;
      }
      // @ts-ignore: Unreachable code error
      elem = parent;
    }
    return ret.length ? ret.join(' > ') : '';
  },
  debugConsole: function (data: any) {
    window.sessionStorage.getItem('googleEventDebug') &&
      (console.table || console.log)(Object.assign({}, data?.['data'], { action: data?.action }, data?.['ecommerce']));
  },
  init: function (options: ObjMap = {}) {
    this.setAttrMapping(options.map);
    this.setAttrTags(options.tags);
    const self = this;
    window.document.addEventListener('click', function (event) {
      const element = self.getEventTarget(event) as HTMLElement;
      const root = element?.closest?.('[data-gtm-event]');
      if (root instanceof HTMLElement) {
        self.onClickEvent(element, root);
      }
    });
    // In case when user press Enter key and triggered some redirection to other page then `keyup` can be not triggered
    window.document.addEventListener('keydown', function (event) {
      /**
       * To defined that input has Search functionality must use any combination word "search" in className
       * Example: 'search', 'header-search', 'any-class-with-word-search'
       */
      const element = self.getEventTarget(event) as HTMLElement;
      const root = element.closest('[data-gtm-event]');
      if (
        root instanceof HTMLElement &&
        self.formElementsArray.includes(element.tagName) &&
        element.className &&
        element.className.includes('search') &&
        event.key === 'Enter'
      ) {
        self.dispatchEvent(element, root, 'keypress');
      }
    });
    window.document.addEventListener('focusout', function (event) {
      const element = self.getEventTarget(event) as HTMLElement;
      const root = element.closest('[data-gtm-event]');
      if (
        root instanceof HTMLElement &&
        self.formElementsArray.includes(element.tagName) &&
        !self.inputTypeArray.includes((element as HTMLInputElement).type)
      ) {
        self.dispatchEvent(element, root);
      }
    });
    return true;
  },
};
