import type JSZipType from 'jszip';
import {
  FaqItem,
  IntegrationsData,
  MotoModel,
  Part,
  RevisionPart,
  RevisionTab,
  Segment,
  SeoSettings,
  VisualBuilderConfig,
} from '../types';
import { adminFetch } from './adminAuth';
import { computeModelRevision } from './pricing';
import { createDefaultVisualConfig, loadLocalVisualConfig } from './visualBuilder';

const AUTOSAVE_PREF_KEY = 'rodaleve_gestor_autosave';
const DRAFT_CACHE_PREFIX = 'rodaleve_gestor_draft_';
let memoryAutoSavePref: boolean | null = null;
const memoryDraftCache: Record<string, string> = {};

export function getAutoSavePreference(): boolean {
  if (memoryAutoSavePref !== null) return memoryAutoSavePref;
  try {
    const val = window.localStorage?.getItem(AUTOSAVE_PREF_KEY);
    if (val === 'false') {
      memoryAutoSavePref = false;
      return false;
    }
  } catch {
    // Fallback em memória
  }
  memoryAutoSavePref = true;
  return true;
}

export function setAutoSavePreference(enabled: boolean): void {
  memoryAutoSavePref = enabled;
  try {
    window.localStorage?.setItem(AUTOSAVE_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // Fallback em memória
  }
}

export function saveGestorDraftCache(sectionKey: string, payload: unknown): void {
  const json = JSON.stringify({ updated_at: new Date().toISOString(), payload });
  memoryDraftCache[sectionKey] = json;
  try {
    window.localStorage?.setItem(`${DRAFT_CACHE_PREFIX}${sectionKey}`, json);
  } catch {
    // Fallback em memória
  }
}

export interface GestorExportSource {
  models: MotoModel[];
  segments: Segment[];
  revision_tabs: RevisionTab[];
  parts: Part[];
  revision_parts: RevisionPart[];
  faqs: FaqItem[];
  seo: SeoSettings;
  last_price_sync: string;
  integrations: IntegrationsData;
  visual_builder?: Partial<VisualBuilderConfig> | null;
  embedded_uploads?: Record<string, string>;
}

export interface BackupRestorePayload {
  models?: MotoModel[];
  segments?: Segment[];
  revision_tabs?: RevisionTab[];
  parts?: Part[];
  revision_parts?: RevisionPart[];
  faqs?: FaqItem[];
  seo?: SeoSettings;
  gestor_branding?: {
    gestor_logo_url?: string;
    gestor_title?: string;
    gestor_subtitle?: string;
  };
  integrations?: Partial<IntegrationsData>;
  visual_builder?: Partial<VisualBuilderConfig> | null;
  embedded_uploads?: Record<string, string>;
}

function extractUploadFilename(url: string | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;
  const match = /(?:^|\/)uploads\/([^/?#]+)/i.exec(trimmed);
  return match?.[1] || null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao converter imagem para backup.'));
    reader.readAsDataURL(blob);
  });
}

export async function collectEmbeddedUploads(
  source: GestorExportSource
): Promise<Record<string, string>> {
  const urls = new Set<string>();
  const addUrl = (u?: string) => {
    if (u && /(?:^|\/)uploads\//i.test(u.trim())) {
      urls.add(u.trim());
    }
  };

  addUrl(source.seo?.favicon_url);
  addUrl(source.seo?.logo_url);
  addUrl(source.seo?.gestor_logo_url);
  addUrl(source.seo?.og_image);

  for (const m of source.models || []) {
    addUrl(m.image_url);
  }
  if (source.visual_builder?.imageOverrides) {
    for (const v of Object.values(source.visual_builder.imageOverrides)) {
      addUrl(v);
    }
  }
  for (const s of source.visual_builder?.sections || []) {
    addUrl(s.customData?.image_url);
  }

  const embedded: Record<string, string> = {};
  await Promise.all(
    Array.from(urls).map(async (rawUrl) => {
      const filename = extractUploadFilename(rawUrl);
      if (!filename) return;
      const fetchPath = rawUrl.startsWith('http')
        ? rawUrl
        : rawUrl.startsWith('/')
          ? rawUrl
          : `/${rawUrl}`;
      try {
        const res = await fetch(fetchPath);
        if (!res.ok) return;
        const blob = await res.blob();
        if (blob.size > 8 * 1024 * 1024) return;
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl.startsWith('data:')) {
          embedded[filename] = dataUrl;
        }
      } catch {
        // Ignora silenciosamente se URL externa ou bloqueada
      }
    })
  );

  return embedded;
}

export function buildGestorBackupFiles(source: GestorExportSource): Record<string, string> {
  const exportedAt = new Date().toISOString();

  const partsMap: Record<string, Part> = {};
  for (const p of source.parts) partsMap[p.code] = p;

  const revisoesDetalhadas = source.models.map((m) => ({
    model_id: m.id,
    model_name: m.name,
    segment_slug: m.segment_slug,
    revisions: source.revision_tabs.map((tab) => {
      const calc = computeModelRevision(
        m.id,
        tab.revision_number,
        source.revision_parts,
        partsMap
      );
      return {
        revision_number: tab.revision_number,
        label: tab.label,
        subtitle: tab.subtitle,
        total_without_optionals: calc.totalWithoutOptionals,
        total_with_optionals: calc.totalWithOptionals,
        items: calc.items.map((it) => ({
          part_code: it.part.code,
          description: it.part.description,
          unit: it.part.unit,
          quantity: it.revisionPart.quantity,
          unit_price: it.part.price,
          is_optional: it.part.is_optional,
          line_total: it.lineTotal,
        })),
      };
    }),
  }));

  const revisoesJson = {
    exported_at: exportedAt,
    revision_parts: source.revision_parts,
    calculated_by_model: revisoesDetalhadas,
  };

  const precosEPecasJson = {
    exported_at: exportedAt,
    last_price_sync: source.last_price_sync,
    parts: source.parts,
  };

  const modelosEFotosJson = {
    exported_at: exportedAt,
    models: source.models,
  };

  const faqsJson = {
    exported_at: exportedAt,
    faqs: source.faqs,
  };

  const categoriasEAbasJson = {
    exported_at: exportedAt,
    segments: source.segments,
    revision_tabs: source.revision_tabs,
  };

  const seoEIdentidadeJson = {
    exported_at: exportedAt,
    seo: source.seo,
  };

  // Export integration config without raw secret tokens (preserving masked representation)
  const integracoesSeguras = {
    exported_at: exportedAt,
    google_maps: {
      active: source.integrations.google_maps.active,
      custom_api_key_configured: Boolean(source.integrations.google_maps.custom_api_key),
      custom_api_key: source.integrations.google_maps.custom_api_key,
    },
    microwork: {
      auto_sync_enabled: source.integrations.microwork.auto_sync_enabled,
      update_mode: source.integrations.microwork.update_mode,
      endpoint_url: source.integrations.microwork.endpoint_url,
      has_token: source.integrations.microwork.has_token,
      token_masked: source.integrations.microwork.token_masked,
      frequency: source.integrations.microwork.frequency,
      last_sync_at: source.integrations.microwork.last_sync_at,
      last_sync_result: source.integrations.microwork.last_sync_result,
    },
    custom_integrations: source.integrations.custom_integrations.map((c) => ({
      ...c,
      value: /secret|token|webhook/i.test(c.name) ? '•••• (protegido)' : c.value,
    })),
    tracking_pixels: source.integrations.tracking_pixels,
  };

  const visualBuilderData =
    source.visual_builder ||
    loadLocalVisualConfig() ||
    createDefaultVisualConfig(source.models.map((m) => m.id));
  const siteConteudoELayoutJson = {
    exported_at: exportedAt,
    visual_builder: visualBuilderData,
  };

  const resumoGeralJson = {
    backup_version: '1.0',
    exported_at: exportedAt,
    brand: source.seo.company_name || 'Rodaleve Honda',
    counts: {
      models: source.models.length,
      parts: source.parts.length,
      revision_parts: source.revision_parts.length,
      faqs: source.faqs.length,
      segments: source.segments.length,
      revision_tabs: source.revision_tabs.length,
    },
    segments: source.segments,
    revision_tabs: source.revision_tabs,
    parts: source.parts,
    models: source.models,
    revision_parts: source.revision_parts,
    faqs: source.faqs,
    seo: source.seo,
    integrations: integracoesSeguras,
    visual_builder: visualBuilderData,
  };

  const configGestorJson = {
    backup_version: '1.0',
    exported_at: exportedAt,
    gestor_branding: {
      gestor_logo_url: source.seo.gestor_logo_url || '/rodaleve-gestor-logo.svg',
      gestor_title: source.seo.gestor_title || 'Gestor Rodaleve',
      gestor_subtitle: source.seo.gestor_subtitle || 'Tabela de manutenção e revisões',
    },
    seo: source.seo,
    integrations: integracoesSeguras,
    segments: source.segments,
    revision_tabs: source.revision_tabs,
    parts: source.parts,
    models: source.models,
    revision_parts: source.revision_parts,
    faqs: source.faqs,
    visual_builder: visualBuilderData,
    embedded_uploads:
      source.embedded_uploads && Object.keys(source.embedded_uploads).length > 0
        ? source.embedded_uploads
        : undefined,
  };

  const siteConfigJson = {
    backup_version: '1.0',
    exported_at: exportedAt,
    brand: source.seo.company_name || 'Rodaleve Honda',
    seo: source.seo,
    units: source.seo.units,
    tracking_pixels: integracoesSeguras.tracking_pixels,
    visual_builder: visualBuilderData,
    faqs: source.faqs,
    segments: source.segments,
    revision_tabs: source.revision_tabs,
    models: source.models,
  };

  return {
    'config-gestor.json': JSON.stringify(configGestorJson, null, 2),
    'site-config.json': JSON.stringify(siteConfigJson, null, 2),
    'revisoes.json': JSON.stringify(revisoesJson, null, 2),
    'precos-e-pecas.json': JSON.stringify(precosEPecasJson, null, 2),
    'modelos-e-fotos.json': JSON.stringify(modelosEFotosJson, null, 2),
    'perguntas-frequentes.json': JSON.stringify(faqsJson, null, 2),
    'categorias-e-abas.json': JSON.stringify(categoriasEAbasJson, null, 2),
    'seo-e-identidade.json': JSON.stringify(seoEIdentidadeJson, null, 2),
    'integracoes-e-apis.json': JSON.stringify(integracoesSeguras, null, 2),
    'site-conteudo-e-layout.json': JSON.stringify(siteConteudoELayoutJson, null, 2),
    'resumo-geral.json': JSON.stringify(resumoGeralJson, null, 2),
  };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportGestorConfigJson(source: GestorExportSource): string {
  const files = buildGestorBackupFiles(source);
  const jsonContent = files['config-gestor.json'];
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const filename = 'configuracoes-gestor.json';
  triggerBlobDownload(blob, filename);
  return filename;
}

export async function exportGestorBackupZip(source: GestorExportSource): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const dateSlug = new Date().toISOString().slice(0, 10);
  const files = buildGestorBackupFiles(source);

  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const filename = `rodaleve-gestor-backup-${dateSlug}.zip`;
  triggerBlobDownload(blob, filename);

  return filename;
}

export async function exportFullSiteZip(source: GestorExportSource): Promise<string> {
  const backupFiles = buildGestorBackupFiles(source);
  const res = await adminFetch('/api/admin/export-site-zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backup_files: backupFiles }),
  });

  if (!res.ok) {
    let message = 'Erro ao gerar arquivo ZIP completo do site.';
    try {
      const errJson = (await res.json()) as { error?: string };
      if (errJson?.error) message = errJson.error;
    } catch {
      // Ignora corpo não JSON
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const dateSlug = new Date().toISOString().slice(0, 10);
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] || `rodaleve-site-completo-${dateSlug}.zip`;

  triggerBlobDownload(blob, filename);
  return filename;
}

export interface ParsedBackupSummary {
  fileName: string;
  format: 'json' | 'zip';
  backupVersion: string;
  exportedAt: string | null;
  sections: string[];
  counts: {
    models: number;
    parts: number;
    revision_parts: number;
    faqs: number;
    segments: number;
    revision_tabs: number;
    units: number;
  };
}

export interface ParsedBackupResult {
  payload: BackupRestorePayload;
  summary: ParsedBackupSummary;
}

function validateAndSummarizePayload(
  raw: BackupRestorePayload & { backup_version?: string; exported_at?: string },
  fileName: string,
  format: 'json' | 'zip'
): ParsedBackupResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Estrutura de backup inválida: o arquivo não contém um objeto JSON válido.');
  }

  const payload: BackupRestorePayload = {
    segments: Array.isArray(raw.segments) ? raw.segments : undefined,
    revision_tabs: Array.isArray(raw.revision_tabs) ? raw.revision_tabs : undefined,
    parts: Array.isArray(raw.parts) ? raw.parts : undefined,
    models: Array.isArray(raw.models) ? raw.models : undefined,
    revision_parts: Array.isArray(raw.revision_parts) ? raw.revision_parts : undefined,
    faqs: Array.isArray(raw.faqs) ? raw.faqs : undefined,
    seo: raw.seo && typeof raw.seo === 'object' ? raw.seo : undefined,
    gestor_branding:
      raw.gestor_branding && typeof raw.gestor_branding === 'object'
        ? raw.gestor_branding
        : undefined,
    integrations:
      raw.integrations && typeof raw.integrations === 'object' ? raw.integrations : undefined,
    visual_builder:
      raw.visual_builder && typeof raw.visual_builder === 'object'
        ? raw.visual_builder
        : undefined,
    embedded_uploads:
      raw.embedded_uploads && typeof raw.embedded_uploads === 'object'
        ? raw.embedded_uploads
        : undefined,
  };

  const sections: string[] = [];
  if (payload.models?.length) sections.push(`Modelos (${payload.models.length})`);
  if (payload.parts?.length) sections.push(`Peças (${payload.parts.length})`);
  if (payload.revision_parts?.length) sections.push(`Itens de Revisão (${payload.revision_parts.length})`);
  if (payload.segments?.length) sections.push(`Segmentos (${payload.segments.length})`);
  if (payload.revision_tabs?.length) sections.push(`Abas de Revisão (${payload.revision_tabs.length})`);
  if (payload.faqs?.length) sections.push(`Perguntas Frequentes (${payload.faqs.length})`);
  if (payload.seo) sections.push('SEO, Logo & Unidades');
  if (payload.integrations) sections.push('Integrações, APIs & Pixels');
  if (payload.visual_builder) sections.push('Ordem dos Blocos e Layout Visual');
  const embeddedCount = payload.embedded_uploads
    ? Object.keys(payload.embedded_uploads).length
    : 0;
  if (embeddedCount > 0) sections.push(`Imagens Anexas (${embeddedCount})`);

  if (sections.length === 0) {
    throw new Error(
      'Arquivo reconhecido, mas nenhuma seção válida do Gestor Rodaleve (modelos, peças, SEO, integrações ou FAQs) foi encontrada.'
    );
  }

  return {
    payload,
    summary: {
      fileName,
      format,
      backupVersion: String(raw.backup_version || '1.0'),
      exportedAt: typeof raw.exported_at === 'string' ? raw.exported_at : null,
      sections,
      counts: {
        models: payload.models?.length || 0,
        parts: payload.parts?.length || 0,
        revision_parts: payload.revision_parts?.length || 0,
        faqs: payload.faqs?.length || 0,
        segments: payload.segments?.length || 0,
        revision_tabs: payload.revision_tabs?.length || 0,
        units: Array.isArray(payload.seo?.units) ? payload.seo.units.length : 0,
      },
    },
  };
}

export async function parseAndValidateBackupFile(file: File): Promise<ParsedBackupResult> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.json')) {
    let parsed: BackupRestorePayload & { backup_version?: string; exported_at?: string };
    try {
      const text = await file.text();
      parsed = JSON.parse(text) as BackupRestorePayload & {
        backup_version?: string;
        exported_at?: string;
      };
    } catch {
      throw new Error('O arquivo JSON está corrompido ou com sintaxe inválida.');
    }
    return validateAndSummarizePayload(parsed, file.name, 'json');
  }

  if (lower.endsWith('.zip')) {
    let zip: JSZipType;
    try {
      const { default: JSZip } = await import('jszip');
      zip = await JSZip.loadAsync(file);
    } catch {
      throw new Error('Não foi possível abrir o arquivo .zip. Verifique se o pacote não está corrompido.');
    }

    const readJson = async <T,>(name: string): Promise<T | null> => {
      const entry = zip.file(name) || zip.file(`backup-gestor/${name}`);
      if (!entry) return null;
      try {
        const content = await entry.async('string');
        return JSON.parse(content) as T;
      } catch {
        throw new Error(`O arquivo interno "${name}" dentro do ZIP está inválido ou corrompido.`);
      }
    };

    const extractZipUploads = async (): Promise<Record<string, string>> => {
      const uploadsMap: Record<string, string> = {};
      const extMime: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        gif: 'image/gif',
      };
      const entries = Object.values(zip.files).filter(
        (f) => !f.dir && /^(?:data\/)?uploads\/[^/]+$/i.test(f.name)
      );
      for (const entry of entries) {
        const filename = entry.name.split('/').pop() || '';
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const mime = extMime[ext];
        if (!filename || !mime) continue;
        try {
          const b64 = await entry.async('base64');
          uploadsMap[filename] = `data:${mime};base64,${b64}`;
        } catch {
          // Ignora arquivo corrompido individualmente
        }
      }
      return uploadsMap;
    };

    const zipEmbeddedUploads = await extractZipUploads();

    const configGestor = await readJson<
      BackupRestorePayload & { backup_version?: string; exported_at?: string }
    >('config-gestor.json');
    if (
      configGestor &&
      (configGestor.models || configGestor.parts || configGestor.seo || configGestor.faqs)
    ) {
      return validateAndSummarizePayload(
        {
          ...configGestor,
          embedded_uploads: {
            ...zipEmbeddedUploads,
            ...(configGestor.embedded_uploads || {}),
          },
        },
        file.name,
        'zip'
      );
    }

    const resumo = await readJson<
      BackupRestorePayload & { backup_version?: string; exported_at?: string }
    >('resumo-geral.json');
    if (resumo && (resumo.models || resumo.parts || resumo.seo || resumo.faqs)) {
      return validateAndSummarizePayload(
        {
          ...resumo,
          embedded_uploads: {
            ...zipEmbeddedUploads,
            ...(resumo.embedded_uploads || {}),
          },
        },
        file.name,
        'zip'
      );
    }

    const rev = await readJson<{ revision_parts?: RevisionPart[] }>('revisoes.json');
    const pecas = await readJson<{ parts?: Part[] }>('precos-e-pecas.json');
    const mods = await readJson<{ models?: MotoModel[] }>('modelos-e-fotos.json');
    const faqs = await readJson<{ faqs?: FaqItem[] }>('perguntas-frequentes.json');
    const cats = await readJson<{ segments?: Segment[]; revision_tabs?: RevisionTab[] }>(
      'categorias-e-abas.json'
    );
    const seo = await readJson<{ seo?: SeoSettings; exported_at?: string }>('seo-e-identidade.json');
    const ints = await readJson<Partial<IntegrationsData>>('integracoes-e-apis.json');
    const layout = await readJson<{ visual_builder?: VisualBuilderConfig | null }>(
      'site-conteudo-e-layout.json'
    );

    return validateAndSummarizePayload(
      {
        exported_at: seo?.exported_at,
        segments: cats?.segments,
        revision_tabs: cats?.revision_tabs,
        parts: pecas?.parts,
        models: mods?.models,
        revision_parts: rev?.revision_parts,
        faqs: faqs?.faqs,
        seo: seo?.seo,
        integrations: ints || undefined,
        visual_builder: layout?.visual_builder,
        embedded_uploads:
          Object.keys(zipEmbeddedUploads).length > 0 ? zipEmbeddedUploads : undefined,
      },
      file.name,
      'zip'
    );
  }

  throw new Error('Formato não suportado. Selecione um arquivo .zip ou .json de backup do Gestor.');
}

export async function parseBackupFile(file: File): Promise<BackupRestorePayload> {
  const { payload } = await parseAndValidateBackupFile(file);
  return payload;
}
