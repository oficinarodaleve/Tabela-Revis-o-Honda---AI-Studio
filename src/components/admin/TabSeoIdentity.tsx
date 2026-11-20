import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { SeoSettings, UnitLocation } from '../../types';
import { buildJsonLd } from '../SeoHeadSync';

interface TabSeoIdentityProps {
  seo: SeoSettings;
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
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

export function TabSeoIdentity({ seo, onSaved, onToast }: TabSeoIdentityProps) {
  const [draft, setDraft] = useState<SeoSettings>(seo);
  const [saving, setSaving] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [uploadingField, setUploadingField] = useState<'favicon' | 'logo' | 'og' | null>(null);

  const faviconInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const ogInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(seo);
  }, [seo]);

  const update = (patch: Partial<SeoSettings>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const handleUpload = async (field: 'favicon' | 'logo' | 'og', file: File) => {
    setUploadingField(field);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar arquivo.');
      if (field === 'favicon') update({ favicon_url: data.url });
      if (field === 'logo') update({ logo_url: data.url });
      if (field === 'og') update({ og_image: data.url });
      onToast('success', 'Arquivo enviado com sucesso.');
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro no upload.');
    } finally {
      setUploadingField(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error('Erro ao salvar SEO & Identidade.');
      await onSaved();
      onToast('success', 'Configurações de SEO e Identidade salvas e publicadas.');
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const effectiveOgTitle = draft.og_same_title
    ? draft.meta_title
    : draft.og_title || draft.meta_title;
  const effectiveOgDesc = draft.og_same_description
    ? draft.meta_description
    : draft.og_description || draft.meta_description;

  const jsonLdString = useMemo(() => JSON.stringify(buildJsonLd(draft), null, 2), [draft]);

  // Auditoria rápida checklist
  const auditItems = useMemo(() => {
    const titleOk = draft.meta_title.trim().length > 0 && draft.meta_title.trim().length <= 60;
    const descLen = draft.meta_description.trim().length;
    const descOk = descLen >= 50 && descLen <= 155;
    const faviconOk = Boolean(draft.favicon_url.trim());
    const logoOk = Boolean(draft.logo_url.trim());
    const ogImageOk = Boolean(draft.og_image.trim());
    const altOk = Boolean(draft.logo_alt.trim());
    const unitsOk =
      draft.units.length > 0 &&
      draft.units.every((u) => u.name.trim() && u.phone.trim() && u.city.trim());

    return [
      { label: 'Meta Title até 60 caracteres', ok: titleOk },
      { label: 'Meta Description entre 50 e 155', ok: descOk },
      { label: 'Favicon configurado', ok: faviconOk },
      { label: 'Logo principal enviada', ok: logoOk },
      { label: 'Imagem og:image (1200x630)', ok: ogImageOk },
      { label: 'Alt text da logo preenchido', ok: altOk },
      { label: 'Unidades com nome, telefone e cidade', ok: unitsOk },
    ];
  }, [draft]);

  const auditScore = useMemo(() => {
    const passed = auditItems.filter((i) => i.ok).length;
    return Math.round((passed / auditItems.length) * 100);
  }, [auditItems]);

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
          <h1 className="font-display text-2xl font-bold text-neutral-900">
            SEO & Identidade
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Identidade visual, metadados de busca, compartilhamento social e dados estruturados locais.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-[#E4002B] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#C80024] disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
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
                    {draft.favicon_url ? (
                      <img src={draft.favicon_url} alt="Favicon" className="h-8 w-8 object-contain" />
                    ) : (
                      <span className="font-display text-xs font-extrabold text-[#E4002B]">R</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-800">Favicon</p>
                    <p className="text-[11px] text-neutral-500">PNG/ICO/SVG 512x512 recomendado</p>
                  </div>
                </div>

                {/* Prévia da aba do navegador */}
                <div className="flex items-center gap-2 rounded-t-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs shadow-xs">
                  {draft.favicon_url ? (
                    <img src={draft.favicon_url} alt="" className="h-3.5 w-3.5 object-contain" />
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
                  onChange={(e) => update({ favicon_url: e.target.value })}
                  placeholder="URL do favicon..."
                  className="min-w-[200px] flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-800"
                />
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/*,.ico,.svg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload('favicon', f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => faviconInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingField === 'favicon' ? 'Enviando...' : 'Enviar arquivo'}
                </button>
                <button
                  type="button"
                  onClick={() => update({ favicon_url: '' })}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-[#E4002B]"
                >
                  Remover
                </button>
              </div>
            </div>

            {/* Logo Principal */}
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-28 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white px-2">
                  {draft.logo_url ? (
                    <img src={draft.logo_url} alt={draft.logo_alt} className="max-h-9 w-auto object-contain" />
                  ) : (
                    <span className="font-display text-sm font-extrabold text-[#E4002B]">RODALEVE</span>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-800">Logo principal</p>
                  <p className="text-[11px] text-neutral-500">Exibida no cabeçalho e rodapé do site</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={draft.logo_url}
                  onChange={(e) => update({ logo_url: e.target.value })}
                  placeholder="Caminho ou URL da logo..."
                  className="min-w-[200px] flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-800"
                />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*,.svg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload('logo', f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingField === 'logo' ? 'Enviando...' : 'Enviar arquivo'}
                </button>
                <button
                  type="button"
                  onClick={() => update({ logo_url: '' })}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-[#E4002B]"
                >
                  Remover
                </button>
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
                <div className="mt-2.5 flex flex-wrap items-center gap-3">
                  <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    {draft.og_image ? (
                      <img src={draft.og_image} alt="OG" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-neutral-300" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={draft.og_image}
                      onChange={(e) => update({ og_image: e.target.value })}
                      className="min-w-[180px] flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs"
                    />
                    <input
                      ref={ogInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUpload('og', f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => ogInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingField === 'og' ? 'Enviando...' : 'Enviar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ og_image: '' })}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:text-[#E4002B]"
                    >
                      Remover
                    </button>
                  </div>
                </div>
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
                      value={unit.hours}
                      onChange={(e) => handleUpdateUnit(idx, { hours: e.target.value })}
                      placeholder="Horário (Mo-Fr 07:30-18:00)"
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-2"
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
                    <input
                      type="url"
                      value={unit.gmb_url}
                      onChange={(e) => handleUpdateUnit(idx, { gmb_url: e.target.value })}
                      placeholder="Link do Google Meu Negócio"
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs sm:col-span-3"
                    />
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
                  placeholder="Pixel da Meta, GTM noscript..."
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Painel Lateral Direito: Auditoria & Prévias */}
        <div className="space-y-5 lg:col-span-4">
          {/* Auditoria rápida */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">Auditoria rápida</h3>
              <span className="font-mono text-sm font-extrabold text-emerald-600 tabular-nums">
                {auditScore}/100
              </span>
            </div>

            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${auditScore}%` }}
              />
            </div>

            <ul className="mt-4 space-y-2 text-xs">
              {auditItems.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  {item.ok ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <span className={item.ok ? 'text-neutral-700' : 'text-amber-800'}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

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
              <p className="truncate text-[11px] text-neutral-600">
                {draft.canonical_url || 'https://revisoes.rodaleve.com.br'}
              </p>
              <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-[#1a0dab]">
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
                {draft.og_image ? (
                  <img
                    src={draft.og_image}
                    alt="OG Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                    Sem imagem og:image
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
