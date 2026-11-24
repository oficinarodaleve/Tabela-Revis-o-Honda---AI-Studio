import { useEffect } from 'react';
import { FaqItem, SeoSettings } from '../types';

function resolveAbsoluteMediaUrl(rawUrl: string | undefined, canonicalBase?: string): string {
  const fallbackOrigin = 'https://oficinarodaleve.ai.studio';
  const origin =
    canonicalBase && /^https?:\/\//i.test(canonicalBase.trim())
      ? new URL(canonicalBase.trim()).origin
      : typeof window !== 'undefined' &&
          window.location?.origin &&
          !/^https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(window.location.origin)
        ? window.location.origin
        : fallbackOrigin;

  if (!rawUrl || !rawUrl.trim()) {
    return `${origin}/assets/aistudio/open-graph_0af5280d.webp`;
  }
  const trimmed = rawUrl.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (normalizedPath.includes('rodaleve_og_banner')) {
    return `${origin}/assets/aistudio/open-graph_0af5280d.webp`;
  }
  return `${origin}${normalizedPath}`;
}

export function buildJsonLd(seo: SeoSettings, faqs: FaqItem[] = []) {
  const sameAs = [seo.instagram_url, seo.facebook_url, seo.youtube_url].filter(Boolean);
  const canonical = seo.canonical_url || (typeof window !== 'undefined' ? window.location.origin : '');
  const dealerType = seo.business_type || 'MotorcycleDealer';
  const absoluteLogo = resolveAbsoluteMediaUrl(seo.logo_url, canonical);

  const schemas: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: seo.company_name || 'Rodaleve Honda',
      alternateName: seo.short_name || 'Rodaleve',
      url: canonical,
      logo: absoluteLogo || undefined,
      sameAs: sameAs.length > 0 ? sameAs : undefined,
    },
    ...(seo.units || []).map((u) => ({
      '@context': 'https://schema.org',
      '@type': dealerType,
      name: u.name,
      telephone: u.phone,
      url: canonical,
      hasMap: u.gmb_url || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: `${u.street}, ${u.number}${u.neighborhood ? ` - ${u.neighborhood}` : ''}`,
        addressLocality: u.city,
        addressRegion: u.state,
        postalCode: u.zip,
        addressCountry: 'BR',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: u.lat,
        longitude: u.lng,
      },
      openingHours: u.hours,
      aggregateRating: u.rating
        ? {
            '@type': 'AggregateRating',
            ratingValue: u.rating,
            bestRating: 5,
            reviewCount: 120,
          }
        : undefined,
    })),
  ];

  if (faqs && faqs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    });
  }

  return schemas;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMeta(attr: 'name' | 'property', key: string) {
  const el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (el) el.remove();
}

export function SeoHeadSync({ seo, faqs = [] }: { seo: SeoSettings | null; faqs?: FaqItem[] }) {
  useEffect(() => {
    if (!seo) return;

    // Espelhar no localStorage para consistência imediata
    try {
      window.localStorage?.setItem('rodaleve_seo_cache', JSON.stringify(seo));
    } catch {
      // Ignora bloqueio em sandbox/iframe
    }

    try {
      document.title = seo.meta_title || 'Rodaleve Honda – Tabela de Manutenção e Revisões';
      upsertMeta('name', 'description', seo.meta_description || '');
      upsertMeta('name', 'keywords', seo.meta_keywords || '');
      upsertMeta('name', 'author', seo.author_brand || seo.company_name || 'Rodaleve Honda');
      upsertMeta('name', 'robots', seo.robots_policy || 'index, follow');

      const canonicalUrl =
        seo.canonical_url?.trim() || `${window.location.origin}${window.location.pathname}`;
      const ogTitle = seo.og_same_title ? seo.meta_title : seo.og_title || seo.meta_title;
      const ogDesc = seo.og_same_description ? seo.meta_description : seo.og_description || seo.meta_description;
      const resolvedOgImage = resolveAbsoluteMediaUrl(seo.og_image, seo.canonical_url);

      upsertMeta('property', 'og:type', seo.og_type || 'website');
      upsertMeta('property', 'og:url', canonicalUrl);
      upsertMeta('property', 'og:title', ogTitle || '');
      upsertMeta('property', 'og:description', ogDesc || '');
      upsertMeta('property', 'og:site_name', seo.company_name || seo.short_name || 'Rodaleve Honda');
      if (resolvedOgImage) {
        upsertMeta('property', 'og:image', resolvedOgImage);
        upsertMeta('property', 'og:image:secure_url', resolvedOgImage);
        const cleanImgPath = resolvedOgImage.split('?')[0].toLowerCase();
        const ogMime = cleanImgPath.endsWith('.webp')
          ? 'image/webp'
          : cleanImgPath.endsWith('.png')
            ? 'image/png'
            : cleanImgPath.endsWith('.svg')
              ? 'image/svg+xml'
              : 'image/jpeg';
        upsertMeta('property', 'og:image:type', ogMime);
        if (cleanImgPath.includes('open-graph_0af5280d.webp')) {
          upsertMeta('property', 'og:image:width', '1678');
          upsertMeta('property', 'og:image:height', '937');
        } else if (cleanImgPath.endsWith('/og-image.jpg')) {
          upsertMeta('property', 'og:image:width', '1200');
          upsertMeta('property', 'og:image:height', '670');
        } else {
          removeMeta('property', 'og:image:width');
          removeMeta('property', 'og:image:height');
        }
      } else {
        removeMeta('property', 'og:image');
      }

      upsertMeta('name', 'twitter:card', seo.twitter_card || 'summary_large_image');
      upsertMeta('name', 'twitter:title', ogTitle || '');
      upsertMeta('name', 'twitter:description', ogDesc || '');
      if (resolvedOgImage) {
        upsertMeta('name', 'twitter:image', resolvedOgImage);
      } else {
        removeMeta('name', 'twitter:image');
      }

      // Canonical
      let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.rel = 'canonical';
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = canonicalUrl;

      // Favicon & Apple Touch Icon
      let iconLink = document.head.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      let appleIconLink = document.head.querySelector(
        'link[rel="apple-touch-icon"]'
      ) as HTMLLinkElement | null;
      const resolvedFavicon = seo.favicon_url?.trim()
        ? seo.favicon_url.trim().startsWith('uploads/')
          ? `/${seo.favicon_url.trim()}`
          : seo.favicon_url.trim()
        : '';
      if (resolvedFavicon) {
        if (!iconLink) {
          iconLink = document.createElement('link');
          iconLink.rel = 'icon';
          document.head.appendChild(iconLink);
        }
        iconLink.href = resolvedFavicon;

        if (!appleIconLink) {
          appleIconLink = document.createElement('link');
          appleIconLink.rel = 'apple-touch-icon';
          document.head.appendChild(appleIconLink);
        }
        appleIconLink.href = resolvedFavicon;
      } else {
        if (iconLink) iconLink.remove();
        if (appleIconLink) appleIconLink.remove();
      }

      // JSON-LD Schema.org (Organization + MotorcycleDealer + FAQPage)
      let ldScript = document.head.querySelector('script[data-rodaleve-jsonld="true"]') as HTMLScriptElement | null;
      if (!ldScript) {
        ldScript = document.createElement('script');
        ldScript.type = 'application/ld+json';
        ldScript.setAttribute('data-rodaleve-jsonld', 'true');
        document.head.appendChild(ldScript);
      }
      ldScript.textContent = JSON.stringify(buildJsonLd(seo, faqs));
    } catch {
      // Ignore transient DOM head update issues
    }
  }, [seo, faqs]);

  return null;
}
