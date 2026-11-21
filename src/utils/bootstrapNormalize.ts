import {
  CustomIntegration,
  FaqItem,
  IntegrationsData,
  MotoModel,
  Part,
  PublicBootstrapData,
  RevisionPart,
  RevisionTab,
  Segment,
  SeoSettings,
  TrackingPixelsAdminConfig,
  UnitLocation,
} from '../types';

export const DEFAULT_SEO_FALLBACK: SeoSettings = {
  meta_title: 'Rodaleve Honda – Tabela de Manutenção e Revisões',
  meta_description:
    'Consulte peças genuínas e valores estimados por modelo de cada revisão programada Honda na concessionária autorizada Rodaleve.',
  meta_keywords: 'revisão honda, tabela revisão honda, rodaleve',
  canonical_url: '',
  robots_policy: 'index, follow',
  author_brand: 'Rodaleve Honda',
  favicon_url: '',
  logo_url: '',
  logo_alt: 'Rodaleve Honda',
  gestor_logo_url: '/rodaleve-gestor-logo.svg',
  gestor_title: 'Gestor Rodaleve',
  gestor_subtitle: 'Tabela de manutenção e revisões',
  og_type: 'website',
  og_same_title: true,
  og_title: '',
  og_same_description: true,
  og_description: '',
  og_image: '',
  twitter_card: 'summary_large_image',
  company_name: 'Rodaleve Honda',
  short_name: 'Rodaleve',
  business_type: 'MotorcycleDealer',
  instagram_url: '',
  facebook_url: '',
  youtube_url: '',
  robots_txt: '',
  sitemap_xml: '',
  head_scripts: '',
  body_scripts: '',
  units: [],
};

export const DEFAULT_TRACKING_PIXELS_FALLBACK: TrackingPixelsAdminConfig = {
  gtm: { enabled: false, container_id: '' },
  ga4: { enabled: false, measurement_id: '' },
  google_ads: { enabled: false, ads_id: '', conversion_label: '' },
  meta_pixel: {
    enabled: false,
    pixel_id: '',
    has_capi_token: false,
    capi_token_masked: '',
    domain_verification: '',
  },
  tiktok_pixel: {
    enabled: false,
    pixel_id: '',
    has_events_token: false,
    events_token_masked: '',
  },
  google_search_console: {
    verification_code: '',
  },
};

function asArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val.filter((item) => item && typeof item === 'object') as T[]) : [];
}

function normalizeUnits(rawUnits: unknown): UnitLocation[] {
  return asArray<Partial<UnitLocation>>(rawUnits).map((u, idx) => ({
    id: String(u.id || `unit-${idx}`),
    name: String(u.name || 'Rodaleve Honda'),
    cnpj: String(u.cnpj || ''),
    street: String(u.street || ''),
    number: String(u.number || ''),
    neighborhood: String(u.neighborhood || ''),
    city: String(u.city || ''),
    state: String(u.state || ''),
    zip: String(u.zip || ''),
    phone: String(u.phone || ''),
    whatsapp: String(u.whatsapp || ''),
    hours: String(u.hours || ''),
    lat: Number.isFinite(Number(u.lat)) ? Number(u.lat) : -14.8655,
    lng: Number.isFinite(Number(u.lng)) ? Number(u.lng) : -40.8385,
    rating: Number.isFinite(Number(u.rating)) ? Number(u.rating) : 4.8,
    gmb_url: String(u.gmb_url || ''),
  }));
}

function normalizeRobotsPolicy(raw: unknown): SeoSettings['robots_policy'] {
  if (
    raw === 'index, follow' ||
    raw === 'noindex, follow' ||
    raw === 'index, nofollow' ||
    raw === 'noindex, nofollow'
  ) {
    return raw;
  }
  return 'index, follow';
}

function normalizeOgType(raw: unknown): SeoSettings['og_type'] {
  if (raw === 'website' || raw === 'article' || raw === 'product') return raw;
  return 'website';
}

function normalizeTwitterCard(raw: unknown): SeoSettings['twitter_card'] {
  if (raw === 'summary' || raw === 'summary_large_image') return raw;
  return 'summary_large_image';
}

export function normalizeSeoSettings(raw: unknown): SeoSettings {
  const s = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Partial<SeoSettings>;
  return {
    ...DEFAULT_SEO_FALLBACK,
    ...s,
    meta_title: String(s.meta_title || DEFAULT_SEO_FALLBACK.meta_title),
    meta_description: String(s.meta_description ?? DEFAULT_SEO_FALLBACK.meta_description),
    meta_keywords: String(s.meta_keywords ?? DEFAULT_SEO_FALLBACK.meta_keywords),
    canonical_url: String(s.canonical_url ?? ''),
    robots_policy: normalizeRobotsPolicy(s.robots_policy),
    author_brand: String(s.author_brand || DEFAULT_SEO_FALLBACK.author_brand),
    favicon_url: String(s.favicon_url ?? ''),
    logo_url: String(s.logo_url ?? ''),
    logo_alt: String(s.logo_alt || 'Rodaleve Honda'),
    gestor_logo_url:
      s.gestor_logo_url !== undefined
        ? String(s.gestor_logo_url)
        : DEFAULT_SEO_FALLBACK.gestor_logo_url,
    gestor_title: String(s.gestor_title || DEFAULT_SEO_FALLBACK.gestor_title),
    gestor_subtitle: String(s.gestor_subtitle || DEFAULT_SEO_FALLBACK.gestor_subtitle),
    og_type: normalizeOgType(s.og_type),
    og_same_title: s.og_same_title !== false,
    og_title: String(s.og_title ?? ''),
    og_same_description: s.og_same_description !== false,
    og_description: String(s.og_description ?? ''),
    og_image: String(s.og_image ?? ''),
    twitter_card: normalizeTwitterCard(s.twitter_card),
    company_name: String(s.company_name || 'Rodaleve Honda'),
    short_name: String(s.short_name || 'Rodaleve'),
    business_type: String(s.business_type || 'MotorcycleDealer'),
    instagram_url: String(s.instagram_url ?? ''),
    facebook_url: String(s.facebook_url ?? ''),
    youtube_url: String(s.youtube_url ?? ''),
    robots_txt: String(s.robots_txt ?? ''),
    sitemap_xml: String(s.sitemap_xml ?? ''),
    head_scripts: String(s.head_scripts ?? ''),
    body_scripts: String(s.body_scripts ?? ''),
    units: normalizeUnits(s.units),
  };
}

export function normalizePublicBootstrapData(raw: unknown): PublicBootstrapData {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw
    : {}) as Partial<PublicBootstrapData>;

  const rawMaps = (r.maps_config && typeof r.maps_config === 'object'
    ? r.maps_config
    : {}) as Partial<PublicBootstrapData['maps_config']>;

  const rawTracking = (r.tracking_config && typeof r.tracking_config === 'object'
    ? r.tracking_config
    : {}) as Partial<NonNullable<PublicBootstrapData['tracking_config']>>;

  return {
    models: asArray<Partial<MotoModel>>(r.models).map((m) => ({
      id: Number(m.id) || 0,
      name: String(m.name || ''),
      segment_slug: String(m.segment_slug || ''),
      image_url: String(m.image_url || ''),
      hidden: Boolean(m.hidden),
      sort_order: Number(m.sort_order) || 0,
      labor_price:
        m.labor_price !== null &&
        m.labor_price !== undefined &&
        Number.isFinite(Number(m.labor_price)) &&
        Number(m.labor_price) >= 0
          ? Number(Number(m.labor_price).toFixed(2))
          : null,
    })),
    segments: asArray<Partial<Segment>>(r.segments).map((s) => ({
      id: Number(s.id) || 0,
      slug: String(s.slug || ''),
      name: String(s.name || ''),
      visible: s.visible !== false,
      sort_order: Number(s.sort_order) || 0,
    })),
    revision_tabs: asArray<Partial<RevisionTab>>(r.revision_tabs).map((t) => ({
      id: Number(t.id) || 0,
      revision_number: Number(t.revision_number) || 1,
      label: String(t.label || ''),
      subtitle: String(t.subtitle || ''),
      visible: t.visible !== false,
      sort_order: Number(t.sort_order) || 0,
    })),
    parts: asArray<Partial<Part>>(r.parts).map((p) => ({
      code: String(p.code || ''),
      description: String(p.description || ''),
      unit: String(p.unit || 'UN'),
      default_qty: Number.isFinite(Number(p.default_qty)) ? Number(p.default_qty) : 1,
      price: Number.isFinite(Number(p.price)) ? Number(p.price) : 0,
      mode: p.mode === 'manual' ? 'manual' : 'auto',
      is_optional: Boolean(p.is_optional),
      microwork_price:
        p.microwork_price !== null &&
        p.microwork_price !== undefined &&
        Number.isFinite(Number(p.microwork_price))
          ? Number(p.microwork_price)
          : null,
      sync_status: String(p.sync_status || ''),
      updated_at: String(p.updated_at || ''),
    })),
    revision_parts: asArray<Partial<RevisionPart>>(r.revision_parts).map((rp) => ({
      id: Number(rp.id) || 0,
      model_id: Number(rp.model_id) || 0,
      revision_number: Number(rp.revision_number) || 1,
      part_code: String(rp.part_code || ''),
      quantity: Number.isFinite(Number(rp.quantity)) ? Number(rp.quantity) : 1,
    })),
    faqs: asArray<Partial<FaqItem>>(r.faqs).map((f) => ({
      id: Number(f.id) || 0,
      question: String(f.question || ''),
      answer: String(f.answer || ''),
      sort_order: Number(f.sort_order) || 0,
    })),
    seo: normalizeSeoSettings(r.seo),
    last_price_sync: String(r.last_price_sync || ''),
    maps_config: {
      active: rawMaps.active !== false,
      api_key: String(rawMaps.api_key || ''),
    },
    public_integrations: asArray<CustomIntegration>(r.public_integrations).map((c, idx) => ({
      id: String(c.id || `pub-int-${idx}`),
      name: String(c.name || ''),
      value: String(c.value || ''),
      active: c.active !== false,
    })),
    tracking_config: {
      gtm: {
        enabled: Boolean(rawTracking.gtm?.enabled),
        container_id: String(rawTracking.gtm?.container_id || ''),
      },
      ga4: {
        enabled: Boolean(rawTracking.ga4?.enabled),
        measurement_id: String(rawTracking.ga4?.measurement_id || ''),
      },
      google_ads: {
        enabled: Boolean(rawTracking.google_ads?.enabled),
        ads_id: String(rawTracking.google_ads?.ads_id || ''),
        conversion_label: String(rawTracking.google_ads?.conversion_label || ''),
      },
      meta_pixel: {
        enabled: Boolean(rawTracking.meta_pixel?.enabled),
        pixel_id: String(rawTracking.meta_pixel?.pixel_id || ''),
        domain_verification: String(rawTracking.meta_pixel?.domain_verification || ''),
      },
      tiktok_pixel: {
        enabled: Boolean(rawTracking.tiktok_pixel?.enabled),
        pixel_id: String(rawTracking.tiktok_pixel?.pixel_id || ''),
      },
      google_search_console: {
        verification_code: String(rawTracking.google_search_console?.verification_code || ''),
      },
    },
    visual_builder:
      r.visual_builder && typeof r.visual_builder === 'object' ? r.visual_builder : null,
  };
}

export function normalizeIntegrationsData(raw: unknown): IntegrationsData {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw
    : {}) as Partial<IntegrationsData>;
  const tp = (r.tracking_pixels && typeof r.tracking_pixels === 'object'
    ? r.tracking_pixels
    : {}) as Partial<TrackingPixelsAdminConfig>;

  return {
    google_maps: {
      active: r.google_maps?.active !== false,
      custom_api_key: String(r.google_maps?.custom_api_key || ''),
    },
    microwork: {
      auto_sync_enabled: r.microwork?.auto_sync_enabled !== false,
      update_mode: r.microwork?.update_mode === 'manual' ? 'manual' : 'auto_api',
      endpoint_url: String(r.microwork?.endpoint_url || ''),
      has_token: Boolean(r.microwork?.has_token),
      token_masked: String(r.microwork?.token_masked || ''),
      frequency: r.microwork?.frequency === 'daily' ? 'daily' : 'weekly',
      last_sync_at: String(r.microwork?.last_sync_at || ''),
      last_sync_result: String(r.microwork?.last_sync_result || 'Pronto'),
    },
    custom_integrations: asArray<Partial<CustomIntegration>>(r.custom_integrations).map((c, idx) => ({
      id: String(c.id || `custom-${idx}`),
      name: String(c.name || ''),
      value: String(c.value || ''),
      active: c.active !== false,
    })),
    tracking_pixels: {
      gtm: {
        enabled: Boolean(tp.gtm?.enabled),
        container_id: String(tp.gtm?.container_id || ''),
      },
      ga4: {
        enabled: Boolean(tp.ga4?.enabled),
        measurement_id: String(tp.ga4?.measurement_id || ''),
      },
      google_ads: {
        enabled: Boolean(tp.google_ads?.enabled),
        ads_id: String(tp.google_ads?.ads_id || ''),
        conversion_label: String(tp.google_ads?.conversion_label || ''),
      },
      meta_pixel: {
        enabled: Boolean(tp.meta_pixel?.enabled),
        pixel_id: String(tp.meta_pixel?.pixel_id || ''),
        has_capi_token: Boolean(tp.meta_pixel?.has_capi_token),
        capi_token_masked: String(tp.meta_pixel?.capi_token_masked || ''),
        domain_verification: String(tp.meta_pixel?.domain_verification || ''),
      },
      tiktok_pixel: {
        enabled: Boolean(tp.tiktok_pixel?.enabled),
        pixel_id: String(tp.tiktok_pixel?.pixel_id || ''),
        has_events_token: Boolean(tp.tiktok_pixel?.has_events_token),
        events_token_masked: String(tp.tiktok_pixel?.events_token_masked || ''),
      },
      google_search_console: {
        verification_code: String(
          tp.google_search_console?.verification_code ||
            DEFAULT_TRACKING_PIXELS_FALLBACK.google_search_console?.verification_code ||
            ''
        ),
      },
    },
  };
}

export async function fetchWithRetry(
  fetcher: () => Promise<Response>,
  maxRetries = 2,
  baseDelayMs = 400
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetcher();
      // Retry only on transient server/gateway errors (5xx) or rate limit (429)
      if ((res.status >= 500 || res.status === 429) && attempt < maxRetries) {
        console.warn(
          `[fetchWithRetry] Tentativa ${attempt + 1} retornou HTTP ${res.status}. Tentando novamente...`
        );
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        console.warn(
          `[fetchWithRetry] Falha transitória de rede na tentativa ${attempt + 1}:`,
          err
        );
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Falha de rede ao buscar dados.');
}
