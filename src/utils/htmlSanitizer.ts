import DOMPurify from 'dompurify';

const FORBIDDEN_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'meta',
  'link',
  'base',
  'svg',
  'math',
];

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_DATA_IMAGE_RE = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

let hooksRegistered = false;

function ensurePurifyHooks() {
  if (hooksRegistered || typeof window === 'undefined') return;
  hooksRegistered = true;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = (node.getAttribute('href') || '').trim();
      if (!isSafeHtmlUrl(href, false)) {
        node.removeAttribute('href');
      } else if (node.getAttribute('target') === '_blank') {
        const currentRel = (node.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
        if (!currentRel.includes('noopener')) currentRel.push('noopener');
        if (!currentRel.includes('noreferrer')) currentRel.push('noreferrer');
        node.setAttribute('rel', currentRel.join(' '));
      }
    }

    if (node.tagName === 'IMG') {
      const src = (node.getAttribute('src') || '').trim();
      if (!isSafeHtmlUrl(src, true)) {
        node.removeAttribute('src');
      }
    }
  });
}

export function isSafeHtmlUrl(rawUrl: string, allowDataImage: boolean): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  if (allowDataImage && SAFE_DATA_IMAGE_RE.test(trimmed)) return true;

  try {
    const parsed = new URL(trimmed, 'https://oficinarodaleve.ai.studio');
    return SAFE_URL_PROTOCOLS.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  if (typeof window === 'undefined') {
    return rawHtml
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '');
  }
  ensurePurifyHooks();
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: [
      'onerror',
      'onload',
      'onclick',
      'onmouseover',
      'onfocus',
      'onblur',
      'onchange',
      'onsubmit',
      'onkeydown',
      'onkeyup',
      'oninput',
      'srcdoc',
    ],
    ADD_ATTR: ['target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

export function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
