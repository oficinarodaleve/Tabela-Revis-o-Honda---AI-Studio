import {
  GoogleTagConfig,
  MetaPixelConfig,
  PublicTrackingConfig,
  SeoSettings,
  TikTokPixelConfig,
} from '../types';

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
    _rodaleveGtmInitId?: string;
    TiktokAnalyticsObject?: string;
    ttq?: TikTokQueue & unknown[];
    _rodaleveTikTokInitId?: string;
  }
}

export function sanitizePixelId(raw?: string): string {
  return (raw || '').replace(/\s+/g, '').replace(/\D/g, '');
}

export function sanitizeGtmId(raw?: string): string {
  return (raw || '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
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

export function initGtm(containerIdRaw?: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const cleanId = sanitizeGtmId(containerIdRaw);
  if (!cleanId || !/^GTM-[A-Z0-9]{4,16}$/.test(cleanId)) return;
  if (window._rodaleveGtmInitId === cleanId) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

  if (
    !document.querySelector('script[data-rodaleve-gtm="true"]') &&
    !document.querySelector(`script[src*="googletagmanager.com/gtm.js?id=${cleanId}"]`)
  ) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(cleanId)}`;
    script.setAttribute('data-rodaleve-gtm', 'true');
    document.head.appendChild(script);
  }

  if (document.body && !document.querySelector('noscript[data-rodaleve-gtm-noscript="true"]')) {
    const noscript = document.createElement('noscript');
    noscript.setAttribute('data-rodaleve-gtm-noscript', 'true');
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(cleanId)}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);
    document.body.prepend(noscript);
  }

  window._rodaleveGtmInitId = cleanId;
}

export function extractGoogleSiteVerificationCode(raw?: string): string {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return '';
  let candidate = trimmed;
  if (/<meta\b/i.test(trimmed) || /\bcontent\s*=/i.test(trimmed)) {
    const match = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'/>]+))/i.exec(trimmed);
    if (!match) return '';
    candidate = (match[1] ?? match[2] ?? match[3] ?? '').trim();
  }
  return candidate.replace(/[^A-Za-z0-9_-]/g, '');
}

export function syncGoogleSearchConsoleVerification(rawCode?: string): void {
  if (typeof document === 'undefined') return;
  const cleanCode = extractGoogleSiteVerificationCode(rawCode);
  const existing = document.head.querySelector(
    'meta[name="google-site-verification"]'
  ) as HTMLMetaElement | null;

  if (!cleanCode) {
    if (existing) {
      const staticFallback = existing.getAttribute('data-static-content');
      if (staticFallback !== null) {
        existing.content = staticFallback;
        existing.removeAttribute('data-static-content');
        existing.removeAttribute('data-rodaleve-gsc');
      } else if (existing.getAttribute('data-rodaleve-gsc') === 'true') {
        existing.remove();
      }
    }
    return;
  }

  if (existing) {
    if (
      existing.getAttribute('data-rodaleve-gsc') !== 'true' &&
      !existing.hasAttribute('data-static-content')
    ) {
      existing.setAttribute('data-static-content', existing.content || '');
    }
    existing.content = cleanCode;
    existing.setAttribute('data-rodaleve-gsc', 'true');
  } else {
    const meta = document.createElement('meta');
    meta.name = 'google-site-verification';
    meta.content = cleanCode;
    meta.setAttribute('data-rodaleve-gsc', 'true');
    document.head.appendChild(meta);
  }
}

export function syncMetaDomainVerification(code?: string): void {
  if (typeof document === 'undefined') return;
  const cleanCode = (code || '').trim();
  const existing = document.head.querySelector(
    'meta[name="facebook-domain-verification"]'
  ) as HTMLMetaElement | null;
  if (!cleanCode) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    existing.content = cleanCode;
  } else {
    const meta = document.createElement('meta');
    meta.name = 'facebook-domain-verification';
    meta.content = cleanCode;
    document.head.appendChild(meta);
  }
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

function resolveEffectiveMetaConfig(
  seo?: SeoSettings | null,
  trackingConfig?: PublicTrackingConfig | null
): MetaPixelConfig | undefined {
  if (trackingConfig?.meta_pixel?.enabled && sanitizePixelId(trackingConfig.meta_pixel.pixel_id)) {
    return {
      enabled: true,
      pixel_id: trackingConfig.meta_pixel.pixel_id,
      events: {
        page_view: seo?.meta_pixel?.events?.page_view ?? true,
        view_content: seo?.meta_pixel?.events?.view_content ?? true,
        lead_contact: seo?.meta_pixel?.events?.lead_contact ?? true,
      },
      custom_code: seo?.meta_pixel?.custom_code,
    };
  }
  return seo?.meta_pixel;
}

function resolveEffectiveGoogleTagConfig(
  seo?: SeoSettings | null,
  trackingConfig?: PublicTrackingConfig | null
): GoogleTagConfig | undefined {
  const ga4FromIntegrations =
    trackingConfig?.ga4?.enabled && sanitizeGoogleTagId(trackingConfig.ga4.measurement_id)
      ? sanitizeGoogleTagId(trackingConfig.ga4.measurement_id)
      : '';
  const adsFromIntegrations =
    trackingConfig?.google_ads?.enabled && sanitizeGoogleTagId(trackingConfig.google_ads.ads_id)
      ? sanitizeGoogleTagId(trackingConfig.google_ads.ads_id)
      : '';
  const labelFromIntegrations = trackingConfig?.google_ads?.enabled
    ? sanitizeGoogleConversionLabel(trackingConfig.google_ads.conversion_label)
    : '';

  const ga4FromSeo = seo?.google_tag?.enabled ? sanitizeGoogleTagId(seo.google_tag.ga4_id) : '';
  const adsFromSeo = seo?.google_tag?.enabled ? sanitizeGoogleTagId(seo.google_tag.ads_id) : '';
  const labelFromSeo = seo?.google_tag?.enabled
    ? sanitizeGoogleConversionLabel(seo.google_tag.conversion_label)
    : '';

  const ga4Id = ga4FromIntegrations || ga4FromSeo;
  const adsId = adsFromIntegrations || adsFromSeo;
  const convLabel = labelFromIntegrations || labelFromSeo;

  if (!ga4Id && !adsId) return undefined;

  return {
    enabled: true,
    ga4_id: ga4Id,
    ads_id: adsId,
    conversion_label: convLabel,
    events: {
      page_view: seo?.google_tag?.events?.page_view ?? true,
      view_content: seo?.google_tag?.events?.view_content ?? true,
      lead_contact: seo?.google_tag?.events?.lead_contact ?? true,
    },
    custom_code: seo?.google_tag?.custom_code,
  };
}

function resolveEffectiveTikTokConfig(
  seo?: SeoSettings | null,
  trackingConfig?: PublicTrackingConfig | null
): TikTokPixelConfig | undefined {
  if (
    trackingConfig?.tiktok_pixel?.enabled &&
    sanitizeTikTokPixelId(trackingConfig.tiktok_pixel.pixel_id)
  ) {
    return {
      enabled: true,
      pixel_id: trackingConfig.tiktok_pixel.pixel_id,
      events: {
        page_view: seo?.tiktok_pixel?.events?.page_view ?? true,
        view_content: seo?.tiktok_pixel?.events?.view_content ?? true,
        lead_contact: seo?.tiktok_pixel?.events?.lead_contact ?? true,
      },
      custom_code: seo?.tiktok_pixel?.custom_code,
    };
  }
  return seo?.tiktok_pixel;
}

export function initAllTrackingPixels(
  seo?: SeoSettings | null,
  trackingConfig?: PublicTrackingConfig | null
): void {
  if (!seo && !trackingConfig) return;

  if (trackingConfig?.gtm?.enabled && trackingConfig.gtm.container_id) {
    initGtm(trackingConfig.gtm.container_id);
  }

  if (trackingConfig?.meta_pixel?.enabled && trackingConfig.meta_pixel.domain_verification) {
    syncMetaDomainVerification(trackingConfig.meta_pixel.domain_verification);
  } else {
    syncMetaDomainVerification('');
  }

  syncGoogleSearchConsoleVerification(
    trackingConfig?.google_search_console?.verification_code || ''
  );

  initMetaPixel(resolveEffectiveMetaConfig(seo, trackingConfig));
  initGoogleTag(resolveEffectiveGoogleTagConfig(seo, trackingConfig));
  initTikTokPixel(resolveEffectiveTikTokConfig(seo, trackingConfig));
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
  params: Record<string, unknown>,
  trackingConfig?: PublicTrackingConfig | null
): void {
  if (typeof window === 'undefined') return;
  const metaCfg = resolveEffectiveMetaConfig(seo, trackingConfig);
  trackPixelViewContent(metaCfg, params);

  const gtagCfg = resolveEffectiveGoogleTagConfig(seo, trackingConfig);
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

  const ttCfg = resolveEffectiveTikTokConfig(seo, trackingConfig);
  if (
    ttCfg?.enabled &&
    ttCfg.events?.view_content &&
    sanitizeTikTokPixelId(ttCfg.pixel_id) &&
    window.ttq?.track
  ) {
    window.ttq.track('ViewContent', params);
  }
}

export function trackAllPixelsLeadContact(
  seo: SeoSettings | undefined,
  params: Record<string, unknown>,
  trackingConfig?: PublicTrackingConfig | null
): void {
  if (typeof window === 'undefined') return;
  const metaCfg = resolveEffectiveMetaConfig(seo, trackingConfig);
  trackPixelLeadContact(metaCfg, params);

  const gtagCfg = resolveEffectiveGoogleTagConfig(seo, trackingConfig);
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

  const ttCfg = resolveEffectiveTikTokConfig(seo, trackingConfig);
  if (
    ttCfg?.enabled &&
    ttCfg.events?.lead_contact &&
    sanitizeTikTokPixelId(ttCfg.pixel_id) &&
    window.ttq?.track
  ) {
    window.ttq.track('SubmitForm', params);
    window.ttq.track('Contact', params);
  }
}
