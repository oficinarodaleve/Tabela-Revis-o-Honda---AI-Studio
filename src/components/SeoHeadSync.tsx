import { useEffect } from 'react';
import { SeoSettings } from '../types';

export function buildJsonLd(seo: SeoSettings) {
  const sameAs = [seo.instagram_url, seo.facebook_url, seo.youtube_url].filter(Boolean);
  const canonical = seo.canonical_url || (typeof window !== 'undefined' ? window.location.origin : '');

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: seo.company_name || 'Rodaleve Honda',
      url: canonical,
      logo: seo.logo_url || undefined,
      sameAs: sameAs.length > 0 ? sameAs : undefined,
    },
    ...(seo.units || []).map((u) => ({
      '@context': 'https://schema.org',
      '@type': seo.business_type || 'MotorcycleRepair',
      name: u.name,
      telephone: u.phone,
      url: canonical,
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

export function SeoHeadSync({ seo }: { seo: SeoSettings | null }) {
  useEffect(() => {
    if (!seo) return;

    document.title = seo.meta_title || 'Rodaleve Honda – Tabela de Manutenção e Revisões';
    upsertMeta('name', 'description', seo.meta_description || '');
    upsertMeta('name', 'keywords', seo.meta_keywords || '');
    upsertMeta('name', 'author', seo.author_brand || 'Rodaleve Honda');
    upsertMeta('name', 'robots', seo.robots_policy || 'index, follow');

    const ogTitle = seo.og_same_title ? seo.meta_title : seo.og_title || seo.meta_title;
    const ogDesc = seo.og_same_description ? seo.meta_description : seo.og_description || seo.meta_description;

    upsertMeta('property', 'og:type', seo.og_type || 'website');
    upsertMeta('property', 'og:title', ogTitle || '');
    upsertMeta('property', 'og:description', ogDesc || '');
    upsertMeta('property', 'og:site_name', seo.company_name || 'Rodaleve Honda');
    if (seo.og_image) upsertMeta('property', 'og:image', seo.og_image);

    upsertMeta('name', 'twitter:card', seo.twitter_card || 'summary_large_image');
    upsertMeta('name', 'twitter:title', ogTitle || '');
    upsertMeta('name', 'twitter:description', ogDesc || '');
    if (seo.og_image) upsertMeta('name', 'twitter:image', seo.og_image);

    // Canonical
    const canonicalUrl = seo.canonical_url || `${window.location.origin}${window.location.pathname}`;
    let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;

    // Favicon
    if (seo.favicon_url) {
      let iconLink = document.head.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!iconLink) {
        iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        document.head.appendChild(iconLink);
      }
      iconLink.href = seo.favicon_url;
    }

    // JSON-LD Schema.org
    let ldScript = document.head.querySelector('script[data-rodaleve-jsonld="true"]') as HTMLScriptElement | null;
    if (!ldScript) {
      ldScript = document.createElement('script');
      ldScript.type = 'application/ld+json';
      ldScript.setAttribute('data-rodaleve-jsonld', 'true');
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify(buildJsonLd(seo));
  }, [seo]);

  return null;
}
