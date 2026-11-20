import { GoogleTagConfig, MetaPixelConfig, SeoSettings, TikTokPixelConfig } from '../types';

interface TikTokQueue {
  methods?: string[];
  setAndDefer?: (target: Record<string, unknown>, method: string) => void;
  instance?: (id: string) => Record<string, unknown>;
  load?: (id: string, opts?: Record<string, unknown>) => void;
  page?: () => void;
  track?: (event: string, params?: Record<string, unknown>) => void;
  _i?: Record<string, unknown[]>;
  _t?: Record<string, number>;
  _o?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      push?: (...args: unknown[]) => void;
      loaded?: boolean;
      version?: string;
    };
    _fbq?: unknown;
    _rodalevePixelInitId?: string;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    _rodaleveGtagInitKey?: string;
    TiktokAnalyticsObject?: string;
    ttq?: TikTokQueue & unknown[];
    _rodaleveTikTokInitId?: string;
  }
}

export function sanitizePixelId(raw?: string): string {
  return (raw || '').replace(/\s+/g, '').replace(/\D/g, '');
}

export function sanitizeGoogleTagId(raw?: string): string {
  return (raw || '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
}

export function sanitizeGoogleConversionLabel(raw?: string): string {
  return (raw || '').replace(/\s+/g, '').replace(/[^A-Za-z0-9_-]/g, '');
}

export function sanitizeTikTokPixelId(raw?: string): string {
  return (raw || '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
}

export function initMetaPixel(config?: MetaPixelConfig): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!config?.enabled) return;

  const pixelId = sanitizePixelId(config.pixel_id);
  if (!pixelId) return;

  // Prevent re-initializing or duplicating PageView when tabs/filters change
  if (window._rodalevePixelInitId === pixelId) {
    return;
  }

  if (!window.fbq) {
    const n: NonNullable<Window['fbq']> = function (...args: unknown[]) {
      if (n.callMethod) {
        n.callMethod(...args);
      } else {
        n.queue?.push(args);
      }
    };
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    window.fbq = n;
    if (!window._fbq) window._fbq = n;

    if (!document.querySelector('script[data-rodaleve-pixel="true"]')) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      script.setAttribute('data-rodaleve-pixel', 'true');
      document.head.appendChild(script);
    }
  }

  window.fbq('init', pixelId);
  window._rodalevePixelInitId = pixelId;

  if (config.events?.page_view !== false) {
    window.fbq('track', 'PageView');
  }

  // Optional complementary snippet if entered by admin
  if (config.custom_code && config.custom_code.trim()) {
    const existing = document.querySelector('script[data-rodaleve-pixel-custom="true"]');
    if (!existing) {
      const customEl = document.createElement('script');
      customEl.setAttribute('data-rodaleve-pixel-custom', 'true');
      customEl.text = config.custom_code.replace(/<\/?script[^>]*>/gi, '');
      document.head.appendChild(customEl);
    }
  }
}

export function initGoogleTag(config?: GoogleTagConfig): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!config?.enabled) return;

  const ga4Id = sanitizeGoogleTagId(config.ga4_id);
  const adsId = sanitizeGoogleTagId(config.ads_id);
  const primaryId = ga4Id || adsId;
  if (!primaryId) return;

  const initKey = `${ga4Id}|${adsId}`;
  if (window._rodaleveGtagInitKey === initKey) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtagProxy() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
  }

  if (!document.querySelector('script[data-rodaleve-gtag="true"]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryId)}`;
    script.setAttribute('data-rodaleve-gtag', 'true');
    document.head.appendChild(script);
  }

  window.gtag('js', new Date());
  const sendPageView = config.events?.page_view !== false;
  if (ga4Id) {
    window.gtag('config', ga4Id, { send_page_view: sendPageView });
  }
  if (adsId && adsId !== ga4Id) {
    window.gtag('config', adsId, { send_page_view: sendPageView });
  }

  window._rodaleveGtagInitKey = initKey;

  if (config.custom_code && config.custom_code.trim()) {
    const existing = document.querySelector('script[data-rodaleve-gtag-custom="true"]');
    if (!existing) {
      const customEl = document.createElement('script');
      customEl.setAttribute('data-rodaleve-gtag-custom', 'true');
      customEl.text = config.custom_code.replace(/<\/?script[^>]*>/gi, '');
      document.head.appendChild(customEl);
    }
  }
}

export function initTikTokPixel(config?: TikTokPixelConfig): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!config?.enabled) return;

  const pixelId = sanitizeTikTokPixelId(config.pixel_id);
  if (!pixelId) return;

  if (window._rodaleveTikTokInitId === pixelId) {
    return;
  }

  window.TiktokAnalyticsObject = 'ttq';
  const ttq = (window.ttq || []) as TikTokQueue & unknown[];
  window.ttq = ttq;

  if (!ttq.methods) {
    ttq.methods = [
      'page',
      'track',
      'identify',
      'instances',
      'debug',
      'on',
      'off',
      'once',
      'ready',
      'alias',
      'group',
      'enableCookie',
      'disableCookie',
      'holdConsent',
      'revokeConsent',
      'grantConsent',
    ];
    ttq.setAndDefer = (target: Record<string, unknown>, method: string) => {
      target[method] = function (...args: unknown[]) {
        (target as unknown as unknown[]).push([method, ...args]);
      };
    };
    for (let i = 0; i < ttq.methods.length; i += 1) {
      ttq.setAndDefer(ttq as unknown as Record<string, unknown>, ttq.methods[i]);
    }
    ttq.instance = (id: string) => {
      const inst = ((ttq._i && ttq._i[id]) || []) as unknown as Record<string, unknown>;
      for (let i = 0; i < (ttq.methods?.length || 0); i += 1) {
        ttq.setAndDefer?.(inst, ttq.methods![i]);
      }
      return inst;
    };
    ttq.load = (id: string, opts?: Record<string, unknown>) => {
      const src = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {};
      ttq._i[id] = [];
      (ttq._i[id] as unknown as { _u?: string })._u = src;
      ttq._t = ttq._t || {};
      ttq._t[id] = Date.now();
      ttq._o = ttq._o || {};
      ttq._o[id] = opts || {};
      if (!document.querySelector('script[data-rodaleve-tiktok="true"]')) {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.src = `${src}?sdkid=${encodeURIComponent(id)}&lib=ttq`;
        script.setAttribute('data-rodaleve-tiktok', 'true');
        document.head.appendChild(script);
      }
    };
  }

  ttq.load?.(pixelId);
  window._rodaleveTikTokInitId = pixelId;

  if (config.events?.page_view !== false) {
    ttq.page?.();
  }

  if (config.custom_code && config.custom_code.trim()) {
    const existing = document.querySelector('script[data-rodaleve-tiktok-custom="true"]');
    if (!existing) {
      const customEl = document.createElement('script');
      customEl.setAttribute('data-rodaleve-tiktok-custom', 'true');
      customEl.text = config.custom_code.replace(/<\/?script[^>]*>/gi, '');
      document.head.appendChild(customEl);
    }
  }
}

export function initAllTrackingPixels(seo?: SeoSettings | null): void {
  if (!seo) return;
  initMetaPixel(seo.meta_pixel);
  initGoogleTag(seo.google_tag);
  initTikTokPixel(seo.tiktok_pixel);
}

export function trackPixelViewContent(
  config: MetaPixelConfig | undefined,
  params: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;
  if (!config?.enabled || !config.events?.view_content) return;
  const pixelId = sanitizePixelId(config.pixel_id);
  if (!pixelId || !window.fbq) return;
  window.fbq('track', 'ViewContent', params);
}

export function trackPixelLeadContact(
  config: MetaPixelConfig | undefined,
  params: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;
  if (!config?.enabled || !config.events?.lead_contact) return;
  const pixelId = sanitizePixelId(config.pixel_id);
  if (!pixelId || !window.fbq) return;
  window.fbq('track', 'Lead', params);
  window.fbq('track', 'Contact', params);
}

export function trackAllPixelsViewContent(
  seo: SeoSettings | undefined,
  params: Record<string, unknown>
): void {
  if (!seo || typeof window === 'undefined') return;
  trackPixelViewContent(seo.meta_pixel, params);

  const gtagCfg = seo.google_tag;
  if (
    gtagCfg?.enabled &&
    gtagCfg.events?.view_content &&
    (sanitizeGoogleTagId(gtagCfg.ga4_id) || sanitizeGoogleTagId(gtagCfg.ads_id)) &&
    window.gtag
  ) {
    window.gtag('event', 'view_item', {
      item_name: params.content_name,
      item_category: params.content_category,
      ...params,
    });
  }

  const ttCfg = seo.tiktok_pixel;
  if (ttCfg?.enabled && ttCfg.events?.view_content && sanitizeTikTokPixelId(ttCfg.pixel_id) && window.ttq?.track) {
    window.ttq.track('ViewContent', params);
  }
}

export function trackAllPixelsLeadContact(
  seo: SeoSettings | undefined,
  params: Record<string, unknown>
): void {
  if (!seo || typeof window === 'undefined') return;
  trackPixelLeadContact(seo.meta_pixel, params);

  const gtagCfg = seo.google_tag;
  const ga4Id = sanitizeGoogleTagId(gtagCfg?.ga4_id);
  const adsId = sanitizeGoogleTagId(gtagCfg?.ads_id);
  if (gtagCfg?.enabled && gtagCfg.events?.lead_contact && (ga4Id || adsId) && window.gtag) {
    window.gtag('event', 'generate_lead', {
      event_category: 'WhatsApp',
      event_label: params.content_name,
      ...params,
    });
    window.gtag('event', 'contact', {
      event_category: 'WhatsApp',
      event_label: params.content_name,
      ...params,
    });
    const convLabel = sanitizeGoogleConversionLabel(gtagCfg.conversion_label);
    if (adsId && convLabel) {
      window.gtag('event', 'conversion', {
        send_to: `${adsId}/${convLabel}`,
      });
    }
  }

  const ttCfg = seo.tiktok_pixel;
  if (ttCfg?.enabled && ttCfg.events?.lead_contact && sanitizeTikTokPixelId(ttCfg.pixel_id) && window.ttq?.track) {
    window.ttq.track('SubmitForm', params);
    window.ttq.track('Contact', params);
  }
}
