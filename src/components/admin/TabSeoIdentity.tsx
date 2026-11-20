import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, Download, Image as ImageIcon, Plus, Save, Trash2, Upload } from 'lucide-react';
import {
  FaqItem,
  SeoSettings,
  UnitLocation,
} from '../../types';
import { adminFetch } from '../../utils/adminAuth';
import { saveGestorDraftCache } from '../../utils/gestorBackup';
import { buildJsonLd } from '../SeoHeadSync';

interface TabSeoIdentityProps {
  seo: SeoSettings;
  faqs?: FaqItem[];
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
  autoSaveEnabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onAutoSaveStart?: () => void;
  onAutoSaveComplete?: () => void;
  onAutoSaveError?: (msg?: string) => void;
}

function normalizeSeoDraft(seo: SeoSettings): SeoSettings {
  return {
    favicon_url: seo.favicon_url || '',
    logo_url: seo.logo_url || '',
    logo_alt: seo.logo_alt || 'Rodaleve Honda – Concessionária Autorizada',
    short_name: seo.short_name || 'Rodaleve',
    gestor_logo_url: seo.gestor_logo_url ?? '/rodaleve-gestor-logo.svg',
    gestor_title: seo.gestor_title ?? 'Gestor Rodaleve',
    gestor_subtitle: seo.gestor_subtitle ?? 'Tabela de manutenção e revisões',
    meta_title: seo.meta_title || '',
    meta_description: seo.meta_description || '',
    meta_keywords: seo.meta_keywords || '',
    author_brand: seo.author_brand || 'Rodaleve Honda',
    canonical_url: seo.canonical_url || '',
    og_same_title: seo.og_same_title ?? true,
    og_title: seo.og_title || '',
    og_same_description: seo.og_same_description ?? true,
    og_description: seo.og_description || '',
    og_image: seo.og_image || '',
    og_type: seo.og_type || 'website',
    twitter_card: seo.twitter_card || 'summary_large_image',
    business_type: seo.business_type || 'MotorcycleDealer',
    company_name: seo.company_name || 'Rodaleve Honda',
    instagram_url: seo.instagram_url || '',
    youtube_url: seo.youtube_url || '',
    facebook_url: seo.facebook_url || 'https://www.facebook.com/concessionariarodaleve/',
    robots_policy: seo.robots_policy || 'index, follow',
    robots_txt: seo.robots_txt || '',
    sitemap_xml: seo.sitemap_xml || '',
    head_scripts: seo.head_scripts || '',
    body_scripts: seo.body_scripts || '',
    meta_pixel: {
      enabled: Boolean(seo.meta_pixel?.enabled),
      pixel_id: seo.meta_pixel?.pixel_id || '',
      events: {
        page_view: seo.meta_pixel?.events?.page_view ?? true,
        view_content: seo.meta_pixel?.events?.view_content ?? true,
        lead_contact: seo.meta_pixel?.events?.lead_contact ?? true,
      },
      custom_code: seo.meta_pixel?.custom_code || '',
    },
    google_tag: {
      enabled: Boolean(seo.google_tag?.enabled),
      ga4_id: seo.google_tag?.ga4_id || '',
      ads_id: seo.google_tag?.ads_id || '',
      conversion_label: seo.google_tag?.conversion_label || '',
      events: {
        page_view: seo.google_tag?.events?.page_view ?? true,
        view_content: seo.google_tag?.events?.view_content ?? true,
        lead_contact: seo.google_tag?.events?.lead_contact ?? true,
      },
      custom_code: seo.google_tag?.custom_code || '',
    },
    tiktok_pixel: {
      enabled: Boolean(seo.tiktok_pixel?.enabled),
      pixel_id: seo.tiktok_pixel?.pixel_id || '',
      events: {
        page_view: seo.tiktok_pixel?.events?.page_view ?? true,
        view_content: seo.tiktok_pixel?.events?.view_content ?? true,
        lead_contact: seo.tiktok_pixel?.events?.lead_contact ?? true,
      },
      custom_code: seo.tiktok_pixel?.custom_code || '',
    },
    units: (seo.units || []).map((u) => ({
      id: u.id || `unidade-${Date.now()}`,
      name: u.name || '',
      cnpj: u.cnpj || '',
      phone: u.phone || '',
      whatsapp: u.whatsapp || '',
      hours: u.hours || '',
      gmb_url: u.gmb_url || '',
      street: u.street || '',
      number: u.number || '',
      neighborhood: u.neighborhood || '',
      city: u.city || '',
      state: u.state || 'BA',
      zip: u.zip || '',
      rating: typeof u.rating === 'number' ? u.rating : 4.8,
      lat: typeof u.lat === 'number' ? u.lat : -14.8655,
      lng: typeof u.lng === 'number' ? u.lng : -40.8385,
    })),
  };
}

function downloadTextFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type SeoImageField = 'favicon' | 'logo' | 'gestor_logo' | 'og';

const MAX_SEO_IMAGE_BYTES = 8 * 1024 * 1024;

function validateSeoImageFile(field: SeoImageField, file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = (file.type || '').toLowerCase();

  const allowedExts =
    field === 'favicon'
      ? ['png', 'jpg', 'jpeg', 'webp', 'svg', 'ico']
      : ['png', 'jpg', 'jpeg', 'webp', 'svg'];
  const allowedMimes =
    field === 'favicon'
      ? [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
          'image/svg+xml',
          'image/x-icon',
          'image/vnd.microsoft.icon',
        ]
      : ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

  if (!allowedExts.includes(ext) && !allowedMimes.includes(mime)) {
    return field === 'favicon'
      ? 'Formato inválido. Use PNG, JPG, WEBP, SVG ou ICO.'
      : 'Formato inválido. Use PNG, JPG, WEBP ou SVG.';
  }

  if (file.size === 0) {
    return 'O arquivo selecionado está vazio.';
  }

  if (file.size > MAX_SEO_IMAGE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1).replace('.', ',');
    return `Arquivo muito grande (${sizeMb} MB). O limite máximo permitido é 8 MB.`;
  }

  return null;
}

function normalizeSeoImageInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('uploads/')) return `/${trimmed}`;
  if (trimmed.startsWith('src/assets/')) return `/${trimmed}`;
  return trimmed;
}

export function TabSeoIdentity({
  seo,
  faqs = [],
  onSaved,
  onToast,
  autoSaveEnabled = true,
  onDirtyChange,
  onAutoSaveStart,
  onAutoSaveComplete,
  onAutoSaveError,
}: TabSeoIdentityProps) {
  const normalizedIncoming = useMemo(() => normalizeSeoDraft(seo), [seo]);
  const incomingSerialized = useMemo(() => JSON.stringify(normalizedIncoming), [normalizedIncoming]);

  const [draft, setDraft] = useState<SeoSettings>(() => normalizeSeoDraft(seo));
  const [saving, setSaving] = useState(false);
  const [justSavedMsg, setJustSavedMsg] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [uploadingField, setUploadingField] = useState<SeoImageField | null>(null);
  const [localPreviews, setLocalPreviews] = useState<Partial<Record<SeoImageField, string>>>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SeoImageField, string>>>({});

  const faviconInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const gestorLogoInputRef = useRef<HTMLInputElement | null>(null);
  const ogInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutoSavedRef = useRef<string>(incomingSerialized);
  const lastPropSerializedRef = useRef<string>(incomingSerialized);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasPendingChanges = useMemo(
    () => JSON.stringify(draft) !== incomingSerialized,
    [draft, incomingSerialized]
  );

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const localPreviewsRef = useRef(localPreviews);
  localPreviewsRef.current = localPreviews;
  const hasPendingChangesRef = useRef(hasPendingChanges);
  hasPendingChangesRef.current = hasPendingChanges;
  const uploadingFieldRef = useRef(uploadingField);
  uploadingFieldRef.current = uploadingField;

  // Só sincroniza props externas se não houver upload ativo nem edições locais não salvas
  useEffect(() => {
    if (incomingSerialized === lastPropSerializedRef.current) return;
    lastPropSerializedRef.current = incomingSerialized;
    if (!hasPendingChangesRef.current && !uploadingFieldRef.current) {
      setDraft(normalizedIncoming);
      lastAutoSavedRef.current = incomingSerialized;
    }
  }, [incomingSerialized, normalizedIncoming]);

  // Limpa object URLs ao desmontar
  useEffect(() => {
    return () => {
      Object.values(localPreviewsRef.current).forEach((u) => {
        if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
      });
    };
  }, []);

  useEffect(() => {
    onDirtyChange?.(hasPendingChanges);
  }, [hasPendingChanges, onDirtyChange]);

  const persistSeoNow = useCallback(
    async (nextDraft: SeoSettings, isAuto: boolean) => {
      const serialized = JSON.stringify(nextDraft);
      if (isAuto) onAutoSaveStart?.();
      saveGestorDraftCache('seo', nextDraft);
      const res = await adminFetch('/api/admin/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: serialized,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let errMsg = 'Erro ao salvar SEO & Identidade.';
        try {
          const parsed = JSON.parse(errText) as { error?: string };
          if (parsed.error) errMsg = parsed.error;
        } catch {
          // Mantém mensagem padrão
        }
        throw new Error(errMsg);
      }
      lastAutoSavedRef.current = serialized;
      lastPropSerializedRef.current = serialized;
      try {
        window.localStorage?.setItem('rodaleve_seo_cache', serialized);
      } catch {
        // Ignora sandbox
      }
      await onSaved();
      if (isAuto) onAutoSaveComplete?.();
    },
    [onAutoSaveComplete, onAutoSaveStart, onSaved]
  );

  // Auto-save com debounce quando ativado
  useEffect(() => {
    if (!autoSaveEnabled || !hasPendingChanges || saving || uploadingField) return;
    const serialized = JSON.stringify(draft);
    if (serialized === lastAutoSavedRef.current) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await persistSeoNow(draft, true);
      } catch {
        onAutoSaveError?.('Erro ao salvar — tente novamente');
      }
    }, 850);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    autoSaveEnabled,
    hasPendingChanges,
    saving,
    uploadingField,
    draft,
    persistSeoNow,
    onAutoSaveError,
  ]);

  const update = (patch: Partial<SeoSettings>) => {
    setJustSavedMsg(null);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const clearFieldPreviewAndError = (field: SeoImageField) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
    setLocalPreviews((prev) => {
      const old = prev[field];
      if (old && old.startsWith('blob:')) URL.revokeObjectURL(old);
      if (!old) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  const handleUpload = async (field: SeoImageField, file: File) => {
    const validationError = validateSeoImageFile(field, file);
    if (validationError) {
      setFieldErrors((prev) => ({ ...prev, [field]: validationError }));
      onToast('error', validationError);
      return;
    }

    const tempObjectUrl = URL.createObjectURL(file);
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
    setLocalPreviews((prev) => {
      const old = prev[field];
      if (old && old.startsWith('blob:')) URL.revokeObjectURL(old);
      return { ...prev, [field]: tempObjectUrl };
    });

    setUploadingField(field);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await adminFetch('/api/upload', { method: 'POST', body: formData });
      const rawText = await res.text();
      let data: { url?: string; error?: string } = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        data = {};
      }
      if (!res.ok || !data.url) {
        throw new Error(
          data.error ||
            (res.status === 413
              ? 'Arquivo muito grande para envio. Reduza a imagem para até 8 MB.'
              : `Falha ao enviar arquivo (HTTP ${res.status}).`)
        );
      }

      const uploadedUrl = data.url;
      const patch: Partial<SeoSettings> =
        field === 'favicon'
          ? { favicon_url: uploadedUrl }
          : field === 'logo'
            ? { logo_url: uploadedUrl }
            : field === 'gestor_logo'
              ? { gestor_logo_url: uploadedUrl }
              : { og_image: uploadedUrl };
      const nextDraftSnapshot: SeoSettings = { ...draftRef.current, ...patch };
      setJustSavedMsg(null);
      setDraft(nextDraftSnapshot);

      // Libera preview temporário e usa a URL persistente salva no servidor
      setLocalPreviews((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
      URL.revokeObjectURL(tempObjectUrl);

      if (autoSaveEnabled) {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        await persistSeoNow(nextDraftSnapshot, true);
        onToast('success', 'Imagem enviada e salva automaticamente!');
      } else {
        onToast('success', 'Imagem enviada! Clique em "Salvar Configurações" para publicar.');
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Erro ao enviar imagem.';
      setLocalPreviews((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
      URL.revokeObjectURL(tempObjectUrl);
      setFieldErrors((prev) => ({ ...prev, [field]: errMsg }));
      onToast('error', errMsg);
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaving(true);
    setJustSavedMsg(null);
    try {
      await persistSeoNow(draft, false);
      const msg = 'Configurações de SEO e Identidade salvas e publicadas!';
      setJustSavedMsg(msg);
      onToast('success', msg);
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const faviconPreviewSrc = localPreviews.favicon || normalizeSeoImageInput(draft.favicon_url);
  const logoPreviewSrc = localPreviews.logo || normalizeSeoImageInput(draft.logo_url);
  const gestorLogoPreviewSrc =
    localPreviews.gestor_logo || normalizeSeoImageInput(draft.gestor_logo_url || '');
  const ogPreviewSrc = localPreviews.og || normalizeSeoImageInput(draft.og_image);

  const effectiveOgTitle = draft.og_same_title
    ? draft.meta_title
    : draft.og_title || draft.meta_title;
  const effectiveOgDesc = draft.og_same_description
    ? draft.meta_description
    : draft.og_description || draft.meta_description;

  const jsonLdString = useMemo(
    () => JSON.stringify(buildJsonLd(draft, faqs), null, 2),
    [draft, faqs]
  );

  const handleUpdateUnit = (idx: number, patch: Partial<UnitLocation>) => {
    const next = draft.units.map((u, i) => (i === idx ? { ...u, ...patch } : u));
    update({ units: next });
  };

  const handleAddUnit = () => {
    update({
      units: [
        ...draft.units,
        {
          id: `unidade-${Date.now()}`,
          name: 'Nova Unidade Rodaleve',
          cnpj: '',
          phone: '',
          whatsapp: '(77) 2888-0003',
          hours: 'Mo-Fr 07:30-18:00, Sa 07:30-12:00',
          gmb_url: '',
          street: '',
          number: '',
          neighborhood: '',
          city: '',
          state: 'BA',
          zip: '',
          rating: 4.8,
          lat: -14.8596,
          lng: -40.8442,
        },
      ],
    });
  };

  const handleRemoveUnit = (idx: number) => {
    update({ units: draft.units.filter((_, i) => i !== idx) });
  };

  const handleGenerateRobots = () => {
    const base = (draft.canonical_url || 'https://revisoes.rodaleve.com.br').replace(/\/$/, '');
    update({
      robots_txt: `User-agent: *\nAllow: /\nDisallow: /gestor\n\nSitemap: ${base}/sitemap.xml`,
    });
  };

  const handleGenerateSitemap = () => {
    const base = (draft.canonical_url || 'https://revisoes.rodaleve.com.br').replace(/\/$/, '');
    update({
      sitemap_xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${base}/</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold text-neutral-900">
              SEO & Identidade
            </h1>
            {hasPendingChanges && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                Alterações pendentes
              </span>
            )}
            {justSavedMsg && !hasPendingChanges && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {justSavedMsg}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Identidade visual, metadados de busca, compartilhamento social e dados estruturados locais.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className={`inline-flex items-center gap-2 self-start rounded-xl px-5 py-2.5 text-xs font-bold text-white transition-all disabled:opacity-60 ${
            hasPendingChanges
              ? 'bg-[#E4002B] shadow-md ring-2 ring-[#E4002B]/30 hover:bg-[#C80024]'
              : 'bg-[#E4002B] hover:bg-[#C80024]'
          }`}
        >
          <Save className="h-4 w-4" />
          {saving
            ? 'Salvando...'
            : hasPendingChanges
              ? 'Salvar Configurações *'
              : 'Salvar Configurações'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Coluna Esquerda: Formulários */}
        <div className="space-y-6 lg:col-span-8">
          {/* Card 1: Identidade visual, SEO on-page e compartilhamento */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
            <h2 className="text-base font-bold text-neutral-900">
              Identidade visual, SEO on-page e compartilhamento
            </h2>

            {/* Favicon */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    {faviconPreviewSrc ? (
                      <img
                        src={faviconPreviewSrc}
                        alt="Favicon"
                        referrerPolicy="no-referrer"
                        onLoad={() =>
                          setFieldErrors((prev) =>
                            prev.favicon ? { ...prev, favicon: undefined } : prev
                          )
                        }
                        onError={() =>
                          setFieldErrors((prev) => ({
                            ...prev,
                            favicon:
                              'Não foi possível carregar este favicon. Verifique a URL ou envie outra imagem.',
                          }))
                        }
                        className="h-8 w-8 object-contain"
                      />
                    ) : (
                      <span className="font-display text-xs font-extrabold text-[#E4002B]">R</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-800">Favicon</p>
                    <p className="text-[11px] text-neutral-500">
                      PNG, JPG, WEBP, SVG ou ICO (até 8 MB · 512x512 recomendado)
                    </p>
                  </div>
                </div>

                {/* Prévia da aba do navegador */}
                <div className="flex items-center gap-2 rounded-t-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs shadow-xs">
                  {faviconPreviewSrc ? (
                    <img
                      src={faviconPreviewSrc}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-3.5 w-3.5 object-contain"
                    />
                  ) : (
                    <span className="inline-block h-3 w-3 rounded-sm bg-[#E4002B]" />
                  )}
                  <span className="max-w-[160px] truncate text-[11px] font-medium text-neutral-700">
                    {draft.meta_title || 'Rodaleve Honda'}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={draft.favicon_url}
                  onChange={(e) => {
                    clearFieldPreviewAndError('favicon');
                    update({ favicon_url: normalizeSeoImageInput(e.target.value) });
                  }}
                  placeholder="URL do favicon..."
                  className="min-w-[200px] flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-800"
                />
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg,.ico,image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void handleUpload('favicon', f);
                  }}
                />
                <button
                  type="button"
                  disabled={uploadingField === 'favicon'}
                  onClick={() => faviconInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingField === 'favicon' ? 'Enviando...' : 'Enviar arquivo'}
                </button>
                <button
                  type="button"
                  disabled={uploadingField === 'favicon'}
                  onClick={() => {
                    clearFieldPreviewAndError('favicon');
                    update({ favicon_url: '' });
                  }}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-[#E4002B] disabled:opacity-50"
                >
                  Remover
                </button>
              </div>
              {fieldErrors.favicon && (
                <p className="mt-2 text-[11px] font-medium text-[#E4002B]">{fieldErrors.favicon}</p>
              )}
            </div>

            {/* Logo Principal */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-28 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white px-2">
                  {logoPreviewSrc ? (
                    <img
                      src={logoPreviewSrc}
                      alt={draft.logo_alt}
                      referrerPolicy="no-referrer"
                      onLoad={() =>
                        setFieldErrors((prev) =>
                          prev.logo ? { ...prev, logo: undefined } : prev
                        )
                      }
                      onError={() =>
                        setFieldErrors((prev) => ({
                          ...prev,
                          logo: 'Não foi possível carregar esta logo. Verifique a URL ou envie outra imagem.',
                        }))
                      }
                      className="max-h-9 w-auto object-contain"
                    />
                  ) : (
                    <span className="font-display text-sm font-extrabold text-[#E4002B]">RODALEVE</span>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-800">Logo principal</p>
                  <p className="text-[11px] text-neutral-500">
                    Exibida no cabeçalho e rodapé do site (PNG, JPG, WEBP ou SVG até 8 MB)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={draft.logo_url}
                  onChange={(e) => {
                    clearFieldPreviewAndError('logo');
                    update({ logo_url: normalizeSeoImageInput(e.target.value) });
                  }}
                  placeholder="Caminho ou URL da logo..."
                  className="min-w-[200px] flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-800"
                />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void handleUpload('logo', f);
                  }}
                />
                <button
                  type="button"
                  disabled={uploadingField === 'logo'}
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingField === 'logo' ? 'Enviando...' : 'Enviar arquivo'}
                </button>
                <button
                  type="button"
                  disabled={uploadingField === 'logo'}
                  onClick={() => {
                    clearFieldPreviewAndError('logo');
                    update({ logo_url: '' });
                  }}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-[#E4002B] disabled:opacity-50"
                >
                  Remover
                </button>
              </div>
              {fieldErrors.logo && (
                <p className="text-[11px] font-medium text-[#E4002B]">{fieldErrors.logo}</p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600">
                    Nome curto da marca
                  </label>
                  <input
                    type="text"
                    value={draft.short_name || ''}
                    onChange={(e) => update({ short_name: e.target.value })}
                    placeholder="Ex.: Rodaleve"
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600">
                    Texto alternativo (Alt Text) da logo
                  </label>
                  <input
                    type="text"
                    value={draft.logo_alt}
                    onChange={(e) => update({ logo_alt: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900"
                  />
                </div>
              </div>
            </div>

            {/* Logo e Cabeçalho do Gestor */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5">
                  {gestorLogoPreviewSrc ? (
                    <img
                      src={gestorLogoPreviewSrc}
                      alt={draft.gestor_title || 'Gestor Rodaleve'}
                      referrerPolicy="no-referrer"
                      onLoad={() =>
                        setFieldErrors((prev) =>
                          prev.gestor_logo ? { ...prev, gestor_logo: undefined } : prev
                        )
                      }
                      onError={() =>
                        setFieldErrors((prev) => ({
                          ...prev,
                          gestor_logo:
                            'Não foi possível carregar a logo do Gestor. Verifique a URL ou envie outra imagem.',
                        }))
                      }
                      className="max-h-[46px] w-auto max-w-[160px] object-contain"
                    />
                  ) : (
                    <span className="font-display text-sm font-extrabold text-[#E4002B]">RODALEVE</span>
                  )}
                  <div className="border-l border-neutral-200 pl-3.5">
                    <p className="text-sm font-bold leading-tight text-neutral-900">
                      {draft.gestor_title || 'Gestor Rodaleve'}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {draft.gestor_subtitle || 'Tabela de manutenção e revisões'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearFieldPreviewAndError('gestor_logo');
                      update({
                        gestor_logo_url: '/rodaleve-gestor-logo.svg',
                        gestor_title: 'Gestor Rodaleve',
                        gestor_subtitle: 'Tabela de manutenção e revisões',
                      });
                    }}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                  >
                    Restaurar padrão
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#E4002B] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#C80024] disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Salvar
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-neutral-800">
                  Logo e identificação no topo do Gestor
                </p>
                <p className="text-[11px] text-neutral-500">
                  Aceita PNG, SVG, WEBP ou JPG até 8 MB (preferencialmente com fundo transparente).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={draft.gestor_logo_url || ''}
                  onChange={(e) => {
                    clearFieldPreviewAndError('gestor_logo');
                    update({ gestor_logo_url: normalizeSeoImageInput(e.target.value) });
                  }}
                  placeholder="URL da logo do Gestor (ex.: /rodaleve-gestor-logo.svg ou https://...)"
                  className="min-w-[200px] flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-800"
                />
                <input
                  ref={gestorLogoInputRef}
                  type="file"
                  accept=".png,.svg,.webp,.jpg,.jpeg,image/png,image/svg+xml,image/webp,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void handleUpload('gestor_logo', f);
                  }}
                />
                <button
                  type="button"
                  disabled={uploadingField === 'gestor_logo'}
                  onClick={() => gestorLogoInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingField === 'gestor_logo' ? 'Enviando...' : 'Enviar arquivo'}
                </button>
              </div>
              {fieldErrors.gestor_logo && (
                <p className="text-[11px] font-medium text-[#E4002B]">{fieldErrors.gestor_logo}</p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600">
                    Título do cabeçalho do Gestor
                  </label>
                  <input
                    type="text"
                    value={draft.gestor_title || ''}
                    onChange={(e) => update({ gestor_title: e.target.value })}
                    placeholder="Gestor Rodaleve"
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600">
                    Subtítulo do cabeçalho do Gestor
                  </label>
                  <input
                    type="text"
                    value={draft.gestor_subtitle || ''}
                    onChange={(e) => update({ gestor_subtitle: e.target.value })}
                    placeholder="Tabela de manutenção e revisões"
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900"
                  />
                </div>
              </div>
            </div>

            {/* Meta Title, Description, Keywords, Author, Canonical */}
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs font-semibold text-neutral-700">
                  <span>Título do site (Meta Title)</span>
                  <span className="font-mono text-[11px] text-neutral-500 tabular-nums">
                    {draft.meta_title.length}/60
                  </span>
                </div>
                <input
                  type="text"
                  value={draft.meta_title}
                  onChange={(e) => update({ meta_title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-neutral-700">
                  <span>Descrição (Meta Description)</span>
                  <span className="font-mono text-[11px] text-neutral-500 tabular-nums">
                    {draft.meta_description.length}/155
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={draft.meta_description}
                  onChange={(e) => update({ meta_description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700">
                    Palavras-chave (Meta Keywords)
                  </label>
                  <input
                    type="text"
                    value={draft.meta_keywords}
                    onChange={(e) => update({ meta_keywords: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700">
                    Autor / Nome da marca
                  </label>
                  <input
                    type="text"
                    value={draft.author_brand}
                    onChange={(e) => update({ author_brand: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700">
                  URL Canônica
                </label>
                <input
                  type="url"
                  value={draft.canonical_url}
                  onChange={(e) => update({ canonical_url: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs text-neutral-900"
                />
              </div>
            </div>

            {/* Open Graph */}
            <div className="space-y-3 border-t border-neutral-100 pt-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-neutral-700">
                    <input
                      type="checkbox"
                      checked={draft.og_same_title}
                      onChange={(e) => update({ og_same_title: e.target.checked })}
                      className="h-4 w-4 rounded accent-[#E4002B]"
                    />
                    Usar o mesmo título do Meta Title
                  </label>
                  <span className="font-mono text-[11px] text-neutral-500 tabular-nums">
                    {effectiveOgTitle.length}/70
                  </span>
                </div>
                {!draft.og_same_title && (
                  <input
                    type="text"
                    value={draft.og_title}
                    onChange={(e) => update({ og_title: e.target.value })}
                    placeholder="Título Open Graph..."
                    className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900"
                  />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-neutral-700">
                    <input
                      type="checkbox"
                      checked={draft.og_same_description}
                      onChange={(e) => update({ og_same_description: e.target.checked })}
                      className="h-4 w-4 rounded accent-[#E4002B]"
                    />
                    Usar a mesma Meta Description
                  </label>
                  <span className="font-mono text-[11px] text-neutral-500 tabular-nums">
                    {effectiveOgDesc.length}/200
                  </span>
                </div>
                {!draft.og_same_description && (
                  <textarea
                    rows={2}
                    value={draft.og_description}
                    onChange={(e) => update({ og_description: e.target.value })}
                    placeholder="Descrição Open Graph..."
                    className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900"
                  />
                )}
              </div>

              {/* og:image */}
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-3.5">
                <p className="text-xs font-bold text-neutral-800">
                  Imagem de compartilhamento (og:image, 1200x630)
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  PNG, JPG, WEBP ou SVG (até 8 MB · ideal 1200x630 para WhatsApp e Facebook)
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-3">
                  <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    {ogPreviewSrc ? (
                      <img
                        src={ogPreviewSrc}
                        alt="OG"
                        referrerPolicy="no-referrer"
                        onLoad={() =>
                          setFieldErrors((prev) => (prev.og ? { ...prev, og: undefined } : prev))
                        }
                        onError={() =>
                          setFieldErrors((prev) => ({
                            ...prev,
                            og: 'Não foi possível carregar a imagem Open Graph. Verifique a URL ou envie outro arquivo.',
                          }))
                        }
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-neutral-300" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={draft.og_image}
                      onChange={(e) => {
                        clearFieldPreviewAndError('og');
                        update({ og_image: normalizeSeoImageInput(e.target.value) });
                      }}
                      placeholder="URL da imagem de compartilhamento..."
                      className="min-w-[180px] flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs"
                    />
                    <input
                      ref={ogInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) void handleUpload('og', f);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingField === 'og'}
                      onClick={() => ogInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingField === 'og' ? 'Enviando...' : 'Enviar'}
                    </button>
                    <button
                      type="button"
                      disabled={uploadingField === 'og'}
                      onClick={() => {
                        clearFieldPreviewAndError('og');
                        update({ og_image: '' });
                      }}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-[#E4002B] disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </div>
                </div>
                {fieldErrors.og && (
                  <p className="mt-2 text-[11px] font-medium text-[#E4002B]">{fieldErrors.og}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700">
                    Tipo de conteúdo (og:type)
                  </label>
                  <select
                    value={draft.og_type}
                    onChange={(e) => update({ og_type: e.target.value as SeoSettings['og_type'] })}
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs"
                  >
                    <option value="website">website</option>
                    <option value="article">article</option>
                    <option value="product">product</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700">
                    Twitter Card
                  </label>
                  <select
                    value={draft.twitter_card}
                    onChange={(e) =>
                      update({ twitter_card: e.target.value as SeoSettings['twitter_card'] })
                    }
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs"
                  >
                    <option value="summary_large_image">summary_large_image</option>
                    <option value="summary">summary</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: SEO local e dados estruturados */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
            <h2 className="text-base font-bold text-neutral-900">
              SEO local e dados estruturados
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-700">
                  Tipo de negócio (Schema.org)
                </label>
                <input
                  type="text"
                  value={draft.business_type}
                  onChange={(e) => update({ business_type: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700">
                  Nome da empresa / marca principal
                </label>
                <input
                  type="text"
                  value={draft.company_name}
                  onChange={(e) => update({ company_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700">Instagram</label>
                <input
                  type="url"
                  value={draft.instagram_url}
                  onChange={(e) => update({ instagram_url: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700">Facebook</label>
                <input
                  type="url"
                  value={draft.facebook_url}
                  onChange={(e) => update({ facebook_url: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700">YouTube</label>
                <input
                  type="url"
                  value={draft.youtube_url}
                  onChange={(e) => update({ youtube_url: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs"
                />
              </div>
            </div>

            {/* Unidades / Lojas */}
            <div className="space-y-3 border-t border-neutral-100 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-neutral-800">
                  Unidades / Lojas ({draft.units.length})
                </p>
                <button
                  type="button"
                  onClick={handleAddUnit}
                  className="inline-flex items-center gap-1 rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar Unidade
                </button>
              </div>

              {draft.units.map((unit, idx) => (
                <div
                  key={unit.id}
                  className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-900">{unit.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUnit(idx)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-500 hover:bg-neutral-200/70 hover:text-[#E4002B]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <input
                      type="text"
                      value={unit.name}
                      onChange={(e) => handleUpdateUnit(idx, { name: e.target.value })}
                      placeholder="Nome da unidade"
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-2"
                    />
                    <input
                      type="text"
                      value={unit.cnpj}
                      onChange={(e) => handleUpdateUnit(idx, { cnpj: e.target.value })}
                      placeholder="CNPJ"
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                    />
                    <input
                      type="text"
                      value={unit.phone}
                      onChange={(e) => handleUpdateUnit(idx, { phone: e.target.value })}
                      placeholder="Telefone"
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={unit.whatsapp}
                      onChange={(e) => handleUpdateUnit(idx, { whatsapp: e.target.value })}
                      placeholder="WhatsApp (ex: (77) 2888-0003)"
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={unit.hours}
                      onChange={(e) => handleUpdateUnit(idx, { hours: e.target.value })}
                      placeholder="Horário (Mo-Fr 07:30-18:00)"
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={unit.street}
                      onChange={(e) => handleUpdateUnit(idx, { street: e.target.value })}
                      placeholder="Rua / Av."
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-2"
                    />
                    <input
                      type="text"
                      value={unit.number}
                      onChange={(e) => handleUpdateUnit(idx, { number: e.target.value })}
                      placeholder="Número"
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={unit.neighborhood}
                      onChange={(e) => handleUpdateUnit(idx, { neighborhood: e.target.value })}
                      placeholder="Bairro"
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={unit.city}
                      onChange={(e) => handleUpdateUnit(idx, { city: e.target.value })}
                      placeholder="Cidade"
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={unit.state}
                        onChange={(e) => handleUpdateUnit(idx, { state: e.target.value })}
                        placeholder="UF"
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={unit.zip}
                        onChange={(e) => handleUpdateUnit(idx, { zip: e.target.value })}
                        placeholder="CEP"
                        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                      <input
                        type="url"
                        value={unit.gmb_url}
                        onChange={(e) => handleUpdateUnit(idx, { gmb_url: e.target.value })}
                        placeholder="Link do Google Maps / Google Meu Negócio"
                        className="min-w-[200px] flex-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const streetPart = unit.number ? `${unit.street}, ${unit.number}` : unit.street;
                          const neighborhoodPart = unit.neighborhood ? ` - ${unit.neighborhood}` : '';
                          const brandPrefix = unit.name?.toLowerCase().includes('rodaleve')
                            ? 'Rodaleve Honda'
                            : unit.name || 'Rodaleve Honda';
                          const fullQuery = `${brandPrefix}, ${streetPart}${neighborhoodPart}, ${unit.city} - ${unit.state}, ${unit.zip}`;
                          handleUpdateUnit(idx, {
                            gmb_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`,
                          });
                        }}
                        className="whitespace-nowrap rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-neutral-700 hover:border-[#E4002B] hover:text-[#E4002B]"
                      >
                        Atualizar link pelo endereço
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bloco preto JSON-LD */}
            <div>
              <p className="mb-1.5 text-xs font-bold text-neutral-800">
                JSON-LD (schema.org) gerado automaticamente (injetado no &lt;head&gt;)
              </p>
              <pre className="max-h-60 overflow-auto rounded-xl bg-neutral-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-300">
                {jsonLdString}
              </pre>
            </div>
          </div>

          {/* Card 3: SEO técnico e indexação */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
            <h2 className="text-base font-bold text-neutral-900">
              SEO técnico e indexação
            </h2>

            <div>
              <label className="block text-xs font-semibold text-neutral-700">
                Indexação nos buscadores
              </label>
              <select
                value={draft.robots_policy}
                onChange={(e) =>
                  update({ robots_policy: e.target.value as SeoSettings['robots_policy'] })
                }
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs"
              >
                <option value="index, follow">Indexar e seguir links (index, follow)</option>
                <option value="noindex, follow">Não indexar, seguir links (noindex, follow)</option>
                <option value="index, nofollow">Indexar, não seguir links (index, nofollow)</option>
                <option value="noindex, nofollow">Bloquear indexação (noindex, nofollow)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-700">robots.txt</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateRobots}
                    className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Gerar padrão
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadTextFile('robots.txt', draft.robots_txt)}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    <Download className="h-3 w-3" />
                    Baixar
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                value={draft.robots_txt}
                onChange={(e) => update({ robots_txt: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-700">sitemap.xml</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateSitemap}
                    className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Gerar sitemap
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(draft.sitemap_xml);
                      onToast('success', 'Sitemap copiado para a área de transferência.');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile('sitemap.xml', draft.sitemap_xml, 'application/xml')
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    <Download className="h-3 w-3" />
                    Baixar
                  </button>
                </div>
              </div>
              <textarea
                rows={5}
                value={draft.sitemap_xml}
                onChange={(e) => update({ sitemap_xml: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-neutral-700">
                  Scripts de rastreamento (&lt;head&gt;)
                </label>
                <textarea
                  rows={3}
                  value={draft.head_scripts}
                  onChange={(e) => update({ head_scripts: e.target.value })}
                  placeholder="GA4, Search Console meta tag, GTM head..."
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700">
                  Scripts do &lt;body&gt;
                </label>
                <textarea
                  rows={3}
                  value={draft.body_scripts}
                  onChange={(e) => update({ body_scripts: e.target.value })}
                  placeholder="GTM noscript ou tags personalizadas..."
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Painel Lateral Direito: Prévias */}
        <div className="space-y-5 lg:col-span-4">
          {/* Pré-visualização no Google */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Prévia no Google</h3>
              <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`rounded-md px-2 py-1 font-semibold ${
                    previewDevice === 'desktop' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500'
                  }`}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`rounded-md px-2 py-1 font-semibold ${
                    previewDevice === 'mobile' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500'
                  }`}
                >
                  Celular
                </button>
              </div>
            </div>

            <div
              className={`mt-3 rounded-xl border border-neutral-100 bg-white p-3.5 ${
                previewDevice === 'mobile' ? 'max-w-[290px]' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
                  {faviconPreviewSrc ? (
                    <img
                      src={faviconPreviewSrc}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-4 w-4 object-contain"
                    />
                  ) : (
                    <span className="font-display text-[10px] font-extrabold text-[#E4002B]">R</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium leading-tight text-neutral-900">
                    {draft.short_name || draft.company_name || 'Rodaleve Honda'}
                  </p>
                  <p className="truncate text-[10px] leading-tight text-neutral-500">
                    {draft.canonical_url || 'https://revisoes.rodaleve.com.br'}
                  </p>
                </div>
              </div>
              <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-[#1a0dab]">
                {draft.meta_title || 'Título do site'}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-neutral-600">
                {draft.meta_description || 'Descrição do site exibida nos resultados do Google.'}
              </p>
            </div>
          </div>

          {/* Prévia de Compartilhamento (WhatsApp/Facebook) */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h3 className="text-sm font-bold text-neutral-900">
              Compartilhamento (WhatsApp / Facebook)
            </h3>
            <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
              <div className="aspect-[1200/630] w-full bg-neutral-200">
                {ogPreviewSrc && !fieldErrors.og ? (
                  <img
                    src={ogPreviewSrc}
                    alt="OG Preview"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-xs text-neutral-500">
                    {fieldErrors.og
                      ? 'Falha ao carregar imagem og:image'
                      : 'Sem imagem og:image'}
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                  {(draft.canonical_url || 'revisoes.rodaleve.com.br').replace(/^https?:\/\//, '')}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs font-bold text-neutral-900">
                  {effectiveOgTitle}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-600">
                  {effectiveOgDesc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
