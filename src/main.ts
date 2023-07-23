interface ObjMap {
  [key: string]: any;
}

enum EventName {
  'add',
  'remove',
  'product_click',
  'place_order',
}

interface DataEcommerce {
  'event-name'?: EventName;
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
  'link-type'?: string;
  'link-label'?: string;
  'link-url'?: string;
  'link-place'?: string;
  cname?: string;
  restriction?: string;
  'document-type'?: string;
  'add-detail'?: string;
  'widget-position'?: string;
  'page-area'?: string;
  [key: string]: any;
}

interface gtmDataEvent {
  action: string;
  'data-gtm': DataGtm;
  'data-ecomm'?: DataEcommerce;
}

const inverseBoolean = (value: string): string => {
  if (value === 'true') {
    return 'false';
  }
  if (value === 'false') {
    return 'true';
  }
  return 'false';
};

const googleEvents = {
  elementsArray: ['A', 'BUTTON'],
  formElementsArray: ['INPUT', 'TEXTAREA', 'SELECT', 'OPTIONS'],
  inputTypeArray: ['checkbox', 'radio'],

  getElementTagName: function (element: HTMLElement) {
    return element.dataset.uetElement ? element.dataset.uetElement.toUpperCase() : element.tagName;
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
    element.dataset.uetOff = 'true';
  },
  gtmEcommDetail: function (element: HTMLElement, dataUet: DataGtm) {
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
      'product-position': this.findClosest(element, 'data-ecomm-product-position', dataUet['link-place']),
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
    if (element.dataset.uetOff !== undefined) {
      return false;
    }
    const urlRoot = document.location.protocol + '//' + document.location.host;
    const elementTagName = this.getElementTagName(element);
    const elementValue = element.value ? element.value.trim() : null;
    let linkType = null;
    let linkUrl = null;
    let action = null;

    const addDetails = [];
    if (element.dataset.uetAddDetails) {
      addDetails.push(element.dataset.uetAddDetails);
    }
    if (element.dataset.uetAddDetailsLabel) {
      // Example add-details case: Label + Value
      // total featured items: ${total number of featured items}
      addDetails.push(element.dataset.uetAddDetailsLabel + ': ' + element.dataset.uetAddDetailsValue);
    }

    const cname = this.findInParents(element, root, 'data-uet-cname') || 'no-cname';
    const linkHierarchy = this.findInParents(element, root, 'data-uet-link-hierarchy');

    const linkLabelPrefix = this.findClosest(element, 'data-uet-link-label-prefix');
    const restriction = this.findClosest(element, 'data-uet-restriction', 'public');
    const widgetPosition = this.findClosest(element, 'data-uet-widget-position');
    const pageArea = this.findClosest(element, 'data-uet-page-area', '2');

    const linkPlace = element.dataset.uetLinkPlace || '1';

    const linkLabelPure =
      element.dataset.uetLinkLabel || element?.textContent?.replace(/^\s+/, '')?.replace(/\s+$/, '');
    let linkLabel = linkLabelPrefix ? linkLabelPrefix + ': ' + linkLabelPure : linkLabelPure;

    switch (elementTagName) {
      case 'INPUT':
      case 'TEXTAREA':
        if (element.type === 'checkbox') {
          // except for Input-checkbox
          action = 'click';
          linkType = 'checkbox ' + (element.checked ? 'checked' : 'unchecked');
          linkUrl = '@check ' + linkLabelPure;
          this.disableElement(element);
          break;
        } else if (element.type === 'radio') {
          // except for Input-radio
          action = 'click';
          linkType = 'button';
          linkUrl = '@select ' + linkLabelPure;
          this.disableElement(element);
          break;
        }
        if (!elementValue) {
          // Fire only when input field value (after trimming) is NOT an empty string!
          return false;
        }
        action = 'focusout';
        linkType = 'field value populated';
        linkUrl = '@enter ' + (element.getAttribute('name') || element.getAttribute('id') || linkLabelPure);
        if (element.className.includes('search')) {
          action = customActionName || 'focusout';
          linkType = 'perform search';
          linkUrl = '@perform search';
          addDetails.push('search term: ' + elementValue);
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
        action = 'click';
        linkUrl =
          element.dataset.uetLinkUrl ||
          // @ts-ignore: Unreachable code error
          (elementTagName === this.elementsArray[0] ? element?.href : '@' + linkLabelPure);
        linkType = element.dataset.uetLinkType || (elementTagName === this.elementsArray[0] ? 'link' : 'button');
        // Rule for custom add-details in search case
        if (element.dataset.uetAddDetailsSearch) {
          const relative = document.querySelector('#' + element.dataset.uetAddDetailsSearch) as HTMLInputElement;
          const relativeValue = relative.value ? relative.value.trim() : null;
          if (!relativeValue) {
            // Fire only when input field value (after trimming) is NOT an empty string!
            return false;
          }
          addDetails.push('search term: ' + relativeValue);
          linkType = 'perform search';
          linkUrl = '@perform search';
        }
        break;
    }

    if (linkHierarchy) {
      addDetails.unshift('link-hierarchy: ' + linkHierarchy);
    }
    // Customize tagging in case drawer trigger
    if (element.dataset.uetDrawerInverseName) {
      if (element.dataset.uetDrawerInversed === 'true') {
        linkLabel = element.dataset.uetDrawerInverseName;
        linkUrl = '@' + element.dataset.uetDrawerInverseName;
      }
      element.dataset.uetDrawerInversed = inverseBoolean(element?.dataset?.uetDrawerInversed || 'false');
    }
    // Remove all `null` params in Object before triggered Event and LowerCase all String except link-url
    return this.removeEmptyAndLowerCase({
      action: action,
      event: action,
      'data-uet': {
        'link-type': linkType,
        'link-label': linkLabel,
        'link-url': linkUrl.startsWith(urlRoot) ? linkUrl.substr(urlRoot.length) : linkUrl.toLowerCase(),
        'link-place': linkPlace,
        restriction: restriction,
        'document-type': element.dataset.uetDocumentType || '',
        'add-detail': addDetails.join(' | '),
        cname: cname,
        'widget-position': widgetPosition,
        'page-area': pageArea,
      },
      'data-ecomm': this.gtmEcommDetail(element, { 'link-place': linkPlace }),
    });
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
    const data = this.gtmEventDetail(element, root, customActionName);
    if (data) {
      if (data['data-uet']['link-type'] === 'button') {
        setTimeout(function () {
          self.callEvent(root, data);
        }, 500);
      } else {
        this.callEvent(root, data);
      }
      this.debugConsole(data);
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
    window.sessionStorage.getItem('googleEventDebug') !== null &&
      (console.table || console.log)(
        Object.assign({}, data?.['data-uet'], { action: data?.action }, data?.['data-ecomm'])
      );
  },
  init: function () {
    const self = this;
    window.document.addEventListener('click', function (event) {
      const element = self.getEventTarget(event) as HTMLElement;
      const root = element?.closest?.('[data-uet-event]');
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
      const root = element.closest('[data-uet-event]');
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
      const root = element.closest('[data-uet-event]');
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

window.googleEvents = googleEvents;
window.googleEvents.init();
