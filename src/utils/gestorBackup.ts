import JSZip from 'jszip';
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
import { loadLocalVisualConfig } from './visualBuilder';

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
}

export interface BackupRestorePayload {
  models?: MotoModel[];
  segments?: Segment[];
  revision_tabs?: RevisionTab[];
  parts?: Part[];
  revision_parts?: RevisionPart[];
  faqs?: FaqItem[];
  seo?: SeoSettings;
  integrations?: Partial<IntegrationsData>;
  visual_builder?: Partial<VisualBuilderConfig> | null;
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
  };

  const visualBuilderData = source.visual_builder || loadLocalVisualConfig() || null;
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

  return {
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

export async function exportGestorBackupZip(source: GestorExportSource): Promise<string> {
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

export async function parseBackupFile(file: File): Promise<BackupRestorePayload> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.json')) {
    const text = await file.text();
    const parsed = JSON.parse(text) as BackupRestorePayload & {
      seo?: SeoSettings;
      visual_builder?: VisualBuilderConfig | null;
    };
    return {
      segments: parsed.segments,
      revision_tabs: parsed.revision_tabs,
      parts: parsed.parts,
      models: parsed.models,
      revision_parts: parsed.revision_parts,
      faqs: parsed.faqs,
      seo: parsed.seo,
      integrations: parsed.integrations,
      visual_builder: parsed.visual_builder,
    };
  }

  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);

    const readJson = async <T,>(name: string): Promise<T | null> => {
      const entry = zip.file(name) || zip.file(`backup-gestor/${name}`);
      if (!entry) return null;
      const content = await entry.async('string');
      return JSON.parse(content) as T;
    };

    const resumo = await readJson<BackupRestorePayload>('resumo-geral.json');
    if (resumo && (resumo.models || resumo.parts || resumo.seo || resumo.faqs)) {
      return resumo;
    }

    const rev = await readJson<{ revision_parts?: RevisionPart[] }>('revisoes.json');
    const pecas = await readJson<{ parts?: Part[] }>('precos-e-pecas.json');
    const mods = await readJson<{ models?: MotoModel[] }>('modelos-e-fotos.json');
    const faqs = await readJson<{ faqs?: FaqItem[] }>('perguntas-frequentes.json');
    const cats = await readJson<{ segments?: Segment[]; revision_tabs?: RevisionTab[] }>(
      'categorias-e-abas.json'
    );
    const seo = await readJson<{ seo?: SeoSettings }>('seo-e-identidade.json');
    const ints = await readJson<Partial<IntegrationsData>>('integracoes-e-apis.json');
    const layout = await readJson<{ visual_builder?: VisualBuilderConfig | null }>(
      'site-conteudo-e-layout.json'
    );

    return {
      segments: cats?.segments,
      revision_tabs: cats?.revision_tabs,
      parts: pecas?.parts,
      models: mods?.models,
      revision_parts: rev?.revision_parts,
      faqs: faqs?.faqs,
      seo: seo?.seo,
      integrations: ints || undefined,
      visual_builder: layout?.visual_builder,
    };
  }

  throw new Error('Formato não suportado. Selecione um arquivo .zip ou .json de backup.');
}
