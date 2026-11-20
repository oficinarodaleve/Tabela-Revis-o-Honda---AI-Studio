import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { and, asc, eq, max, sql } from 'drizzle-orm';
import express, { type Response } from 'express';
import JSZip from 'jszip';
import multer from 'multer';
import { db } from './src/db/index.ts';
import {
  DEFAULT_TRACKING_PIXELS_CONFIG,
  deleteSettingKey,
  ensureDatabaseSeeded,
  getAdminTrackingPixelsConfig,
  getIntegrationRow,
  getLastPriceSync,
  getPublicTrackingConfig,
  getSeoSettings,
  getVisualBuilderConfig,
  listAllModelsOrdered,
  listFaqsOrdered,
  listPartsOrdered,
  listRevisionPartsOrdered,
  listRevisionTabsOrdered,
  listSegmentsOrdered,
  listVisibleModelsOrdered,
  maskSecret,
  upsertSettingValue,
} from './src/db/repository.ts';
import {
  faqs,
  integrations,
  models,
  partPrices,
  parts,
  revisionParts,
  revisionTabs,
  segments,
  siteSettings,
} from './src/db/schema.ts';
import { type AuthRequest, requireAuth } from './src/middleware/auth.ts';
import { startWeeklySyncScheduler, syncMicroWorkPrices } from './src/server/microwork.ts';
import { INITIAL_SEO_SETTINGS } from './src/server/seedData.ts';

startWeeklySyncScheduler();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'image/gif': '.gif',
};

const ALLOWED_UPLOAD_EXTS = new Set(['.png', '.svg', '.webp', '.jpg', '.jpeg', '.ico', '.gif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname || '').toLowerCase();
    const ext = ALLOWED_UPLOAD_EXTS.has(rawExt)
      ? rawExt
      : MIME_TO_EXT[(file.mimetype || '').toLowerCase()] || '.png';
    const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const isImageMime = mime.startsWith('image/');
    if (ALLOWED_UPLOAD_EXTS.has(ext) || isImageMime) {
      cb(null, true);
      return;
    }
    cb(new Error('Formato inválido. Envie apenas imagens PNG, JPG, WEBP, SVG ou ICO.'));
  },
});

app.use(express.json({ limit: '25mb' }));
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1d' }));

function formatModelRow(row: typeof models.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    segment_slug: row.segmentSlug,
    image_url: row.imageUrl || '',
    hidden: Boolean(row.hidden),
    sort_order: row.sortOrder,
  };
}

function formatPartRow(row: typeof parts.$inferSelect) {
  return {
    code: row.code,
    description: row.description,
    unit: (row.unit || 'UN').trim() || 'UN',
    default_qty: Number(row.defaultQty),
    price: Number(row.price),
    mode: row.mode === 'manual' ? 'manual' : 'auto',
    is_optional: Boolean(row.isOptional),
    microwork_price:
      row.microworkPrice !== null && row.microworkPrice !== undefined
        ? Number(row.microworkPrice)
        : null,
    sync_status: row.syncStatus || '',
    updated_at: row.updatedAt || '',
  };
}

function formatSegmentRow(row: typeof segments.$inferSelect) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    visible: Boolean(row.visible),
    sort_order: row.sortOrder,
  };
}

function formatRevisionTabRow(row: typeof revisionTabs.$inferSelect) {
  return {
    id: row.id,
    revision_number: row.revisionNumber,
    label: row.label,
    subtitle: row.subtitle || '',
    visible: Boolean(row.visible),
    sort_order: row.sortOrder,
  };
}

function formatRevisionPartRow(row: typeof revisionParts.$inferSelect) {
  return {
    id: row.id,
    model_id: row.modelId,
    revision_number: row.revisionNumber,
    part_code: row.partCode,
    quantity: Number(row.quantity),
  };
}

function formatFaqRow(row: typeof faqs.$inferSelect) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sort_order: row.sortOrder,
  };
}

function extractGoogleSiteVerificationCode(raw: unknown): string {
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

// Dynamic SEO technical files
app.get('/robots.txt', async (_req, res) => {
  try {
    const seo = await getSeoSettings();
    res.type('text/plain').send(seo.robots_txt || INITIAL_SEO_SETTINGS.robots_txt);
  } catch {
    res.type('text/plain').send(INITIAL_SEO_SETTINGS.robots_txt);
  }
});

app.get('/sitemap.xml', async (_req, res) => {
  try {
    const seo = await getSeoSettings();
    res.type('application/xml').send(seo.sitemap_xml || INITIAL_SEO_SETTINGS.sitemap_xml);
  } catch {
    res.type('application/xml').send(INITIAL_SEO_SETTINGS.sitemap_xml);
  }
});

app.get('/googlefeed0c0c9ebc374e.html', (_req, res) => {
  res
    .status(200)
    .type('text/html; charset=utf-8')
    .send('google-site-verification: googlefeed0c0c9ebc374e.html');
});

// Auth endpoints (Firebase Authentication)
app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.adminUser });
});

// Public Bootstrap
app.get('/api/public/bootstrap', async (_req, res) => {
  try {
    const [
      modelRows,
      segmentRows,
      revisionTabRows,
      partRows,
      revisionPartRows,
      faqRows,
      seo,
      lastPriceSync,
      mapsRow,
      customRow,
      trackingConfig,
      visualBuilder,
    ] = await Promise.all([
      listVisibleModelsOrdered(),
      listSegmentsOrdered(true),
      listRevisionTabsOrdered(true),
      listPartsOrdered(false),
      listRevisionPartsOrdered(),
      listFaqsOrdered(),
      getSeoSettings(),
      getLastPriceSync(),
      getIntegrationRow('google_maps'),
      getIntegrationRow('custom_integrations'),
      getPublicTrackingConfig(),
      getVisualBuilderConfig(),
    ]);

    const mapsCfg = mapsRow ? JSON.parse(mapsRow.configJson) : { custom_api_key: '' };
    const envMapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    const resolvedMapsKey = (mapsCfg.custom_api_key || '').trim() || envMapsKey;

    const allCustom = customRow
      ? (JSON.parse(customRow.configJson) as Array<{
          id: string;
          name: string;
          value: string;
          active: boolean;
        }>)
      : [];
    const publicIntegrations = allCustom.filter(
      (item) =>
        item.active &&
        !item.name.toLowerCase().includes('webhook') &&
        !item.name.toLowerCase().includes('secret')
    );

    res.json({
      models: modelRows.map(formatModelRow),
      segments: segmentRows.map(formatSegmentRow),
      revision_tabs: revisionTabRows.map(formatRevisionTabRow),
      parts: partRows.map(formatPartRow),
      revision_parts: revisionPartRows.map(formatRevisionPartRow),
      faqs: faqRows.map(formatFaqRow),
      seo,
      last_price_sync: lastPriceSync,
      maps_config: {
        active: mapsRow ? Boolean(mapsRow.active) : true,
        api_key: resolvedMapsKey,
      },
      public_integrations: publicIntegrations,
      tracking_config: trackingConfig,
      visual_builder: visualBuilder,
    });
  } catch (err) {
    console.error('Error in /api/public/bootstrap:', err);
    res.status(500).json({ error: 'Falha ao carregar os dados públicos da tabela.' });
  }
});

// Admin Bootstrap
app.get('/api/admin/bootstrap', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      modelRows,
      segmentRows,
      revisionTabRows,
      partRows,
      revisionPartRows,
      faqRows,
      seo,
      lastPriceSync,
      mapsRow,
      mwRow,
      customRow,
      trackingPixels,
    ] = await Promise.all([
      listAllModelsOrdered(),
      listSegmentsOrdered(false),
      listRevisionTabsOrdered(false),
      listPartsOrdered(true),
      listRevisionPartsOrdered(),
      listFaqsOrdered(),
      getSeoSettings(),
      getLastPriceSync(),
      getIntegrationRow('google_maps'),
      getIntegrationRow('microwork'),
      getIntegrationRow('custom_integrations'),
      getAdminTrackingPixelsConfig(),
    ]);

    const mapsCfg = mapsRow ? JSON.parse(mapsRow.configJson) : { custom_api_key: '' };
    const mwCfg = mwRow ? JSON.parse(mwRow.configJson) : {};
    const effectiveToken = mwRow?.secretValue || process.env.MICROWORK_TOKEN || '';
    const customIntegrations = customRow ? JSON.parse(customRow.configJson) : [];

    res.json({
      models: modelRows.map(formatModelRow),
      segments: segmentRows.map(formatSegmentRow),
      revision_tabs: revisionTabRows.map(formatRevisionTabRow),
      parts: partRows.map(formatPartRow),
      revision_parts: revisionPartRows.map(formatRevisionPartRow),
      faqs: faqRows.map(formatFaqRow),
      seo,
      last_price_sync: lastPriceSync,
      integrations: {
        google_maps: {
          active: mapsRow ? Boolean(mapsRow.active) : true,
          custom_api_key: mapsCfg.custom_api_key || '',
        },
        microwork: {
          auto_sync_enabled: Boolean(mwCfg.auto_sync_enabled ?? true),
          update_mode: mwCfg.update_mode || 'auto_api',
          endpoint_url: mwCfg.endpoint_url || '',
          has_token: Boolean(effectiveToken),
          token_masked: maskSecret(effectiveToken),
          frequency: mwCfg.frequency || 'weekly',
          last_sync_at: mwCfg.last_sync_at || lastPriceSync,
          last_sync_result: mwCfg.last_sync_result || 'Pronto',
        },
        custom_integrations: customIntegrations,
        tracking_pixels: trackingPixels,
      },
    });
  } catch (err) {
    console.error('Error in /api/admin/bootstrap:', err);
    res.status(500).json({ error: 'Falha ao carregar os dados administrativos.' });
  }
});

// Aba 1: Revisões (update model + revision parts)
app.put(
  '/api/admin/revisions/:modelId/:revisionNumber',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const modelId = Number(req.params.modelId);
    const revisionNumber = Number(req.params.revisionNumber);
    const { items } = req.body as { items: Array<{ part_code: string; quantity: number }> };

    if (!Number.isFinite(modelId) || !Number.isFinite(revisionNumber) || !Array.isArray(items)) {
      res.status(400).json({ error: 'Dados inválidos.' });
      return;
    }

    try {
      await ensureDatabaseSeeded();
      await db.transaction(async (tx) => {
        await tx
          .delete(revisionParts)
          .where(
            and(
              eq(revisionParts.modelId, modelId),
              eq(revisionParts.revisionNumber, revisionNumber)
            )
          );
        const rows = items
          .filter((item) => item.part_code && Number(item.quantity) > 0)
          .map((item) => ({
            modelId,
            revisionNumber,
            partCode: item.part_code,
            quantity: Number(item.quantity),
          }));
        if (rows.length > 0) {
          await tx.insert(revisionParts).values(rows);
        }
      });

      const updated = await db
        .select()
        .from(revisionParts)
        .where(
          and(
            eq(revisionParts.modelId, modelId),
            eq(revisionParts.revisionNumber, revisionNumber)
          )
        )
        .orderBy(asc(revisionParts.id));

      res.json({ ok: true, items: updated.map(formatRevisionPartRow) });
    } catch (err) {
      console.error('Error updating revision parts:', err);
      res.status(500).json({ error: 'Falha ao salvar itens da revisão.' });
    }
  }
);

app.post('/api/admin/revisions/clone', requireAuth, async (req: AuthRequest, res: Response) => {
  const { source_revision, target_revision } = req.body as {
    source_revision?: number;
    target_revision?: number;
  };
  const src = Number(source_revision);
  const tgt = Number(target_revision);

  if (!Number.isFinite(src) || !Number.isFinite(tgt) || src === tgt) {
    res.status(400).json({ error: 'Selecione uma revisão de origem diferente da revisão atual.' });
    return;
  }

  try {
    await ensureDatabaseSeeded();
    const sourceItems = await db
      .select({
        modelId: revisionParts.modelId,
        partCode: revisionParts.partCode,
        quantity: revisionParts.quantity,
      })
      .from(revisionParts)
      .where(eq(revisionParts.revisionNumber, src))
      .orderBy(asc(revisionParts.id));

    await db.transaction(async (tx) => {
      await tx.delete(revisionParts).where(eq(revisionParts.revisionNumber, tgt));
      const rows = sourceItems.map((item) => ({
        modelId: item.modelId,
        revisionNumber: tgt,
        partCode: item.partCode,
        quantity: item.quantity,
      }));
      for (let i = 0; i < rows.length; i += 400) {
        await tx.insert(revisionParts).values(rows.slice(i, i + 400));
      }
    });

    res.json({
      ok: true,
      copied_count: sourceItems.length,
      source_revision: src,
      target_revision: tgt,
    });
  } catch (err) {
    console.error('Error cloning revision:', err);
    res.status(500).json({ error: 'Falha ao clonar revisão.' });
  }
});

// Aba 2: Preços e Peças
app.post('/api/admin/parts', requireAuth, async (req: AuthRequest, res: Response) => {
  const { code, description, unit, default_qty, price, mode, is_optional } = req.body as {
    code?: string;
    description?: string;
    unit?: string;
    default_qty?: number;
    price?: number;
    mode?: string;
    is_optional?: boolean;
  };

  if (!code?.trim() || !description?.trim()) {
    res.status(400).json({ error: 'Código Honda e Descrição são obrigatórios.' });
    return;
  }

  try {
    await ensureDatabaseSeeded();
    const nowIso = new Date().toISOString();
    const cleanCode = code.trim();
    const existing = await db.select({ code: parts.code }).from(parts).where(eq(parts.code, cleanCode));
    if (existing.length > 0) {
      res.status(409).json({ error: 'Já existe uma peça cadastrada com este código.' });
      return;
    }

    const numPrice = Number(price || 0);
    const partMode = mode === 'manual' ? 'manual' : 'auto';
    const status = partMode === 'manual' ? 'Manual' : 'Aguardando sync';
    const cleanUnit = (unit || 'UN').trim().toUpperCase().slice(0, 16) || 'UN';

    const [created] = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(parts)
        .values({
          code: cleanCode,
          description: description.trim(),
          unit: cleanUnit,
          defaultQty: Number(default_qty || (cleanUnit === 'ML' ? 1000 : 1)),
          price: numPrice,
          mode: partMode,
          isOptional: is_optional ? 1 : 0,
          microworkPrice: null,
          syncStatus: status,
          updatedAt: nowIso,
        })
        .returning();

      await tx.insert(partPrices).values({
        partCode: cleanCode,
        price: numPrice,
        updatedAt: nowIso,
        source: 'manual_create',
      });

      return inserted;
    });

    res.json({ part: formatPartRow(created) });
  } catch (err) {
    console.error('Error creating part:', err);
    res.status(500).json({ error: 'Falha ao cadastrar peça.' });
  }
});

app.put('/api/admin/parts/batch', requireAuth, async (req: AuthRequest, res: Response) => {
  const { changes } = req.body as {
    changes: Array<{
      original_code: string;
      code: string;
      description: string;
      unit: string;
      price: number;
      mode: 'auto' | 'manual';
      is_optional: boolean;
    }>;
  };

  if (!Array.isArray(changes)) {
    res.status(400).json({ error: 'Lista de alterações inválida.' });
    return;
  }

  try {
    await ensureDatabaseSeeded();
    const nowIso = new Date().toISOString();

    await db.transaction(async (tx) => {
      for (const c of changes) {
        const nextCode = c.code.trim();
        const origCode = c.original_code.trim();
        if (!nextCode || !origCode) continue;

        const nextStatus = c.mode === 'manual' ? 'Manual' : 'Atualizado no Gestor';
        const cleanUnit = (c.unit || 'UN').trim().toUpperCase().slice(0, 16) || 'UN';

        if (nextCode !== origCode) {
          const linkedRevParts = await tx
            .select()
            .from(revisionParts)
            .where(eq(revisionParts.partCode, origCode));
          const [oldPart] = await tx.select().from(parts).where(eq(parts.code, origCode));
          if (oldPart) {
            await tx.insert(parts).values({
              code: nextCode,
              description: c.description.trim(),
              unit: cleanUnit,
              defaultQty: oldPart.defaultQty,
              price: Number(c.price || 0),
              mode: c.mode === 'manual' ? 'manual' : 'auto',
              isOptional: c.is_optional ? 1 : 0,
              microworkPrice: oldPart.microworkPrice,
              syncStatus: nextStatus,
              updatedAt: nowIso,
            });
            for (const rp of linkedRevParts) {
              await tx
                .update(revisionParts)
                .set({ partCode: nextCode })
                .where(eq(revisionParts.id, rp.id));
            }
            await tx.delete(parts).where(eq(parts.code, origCode));
          }
        } else {
          await tx
            .update(parts)
            .set({
              description: c.description.trim(),
              unit: cleanUnit,
              price: Number(c.price || 0),
              mode: c.mode === 'manual' ? 'manual' : 'auto',
              isOptional: c.is_optional ? 1 : 0,
              syncStatus: nextStatus,
              updatedAt: nowIso,
            })
            .where(eq(parts.code, origCode));
        }

        await tx.insert(partPrices).values({
          partCode: nextCode,
          price: Number(c.price || 0),
          updatedAt: nowIso,
          source: 'gestor_edit',
        });
      }
    });

    const partRows = await listPartsOrdered(true);
    res.json({ ok: true, parts: partRows.map(formatPartRow) });
  } catch (err) {
    console.error('Error updating parts batch:', err);
    res.status(500).json({ error: 'Falha ao atualizar peças em lote.' });
  }
});

app.delete('/api/admin/parts/:code', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureDatabaseSeeded();
    const code = decodeURIComponent(req.params.code);
    await db.delete(parts).where(eq(parts.code, code));
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting part:', err);
    res.status(500).json({ error: 'Falha ao remover peça.' });
  }
});

app.post('/api/admin/prices/sync', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await syncMicroWorkPrices(true);
    const partRows = await listPartsOrdered(true);
    res.json({ result, parts: partRows.map(formatPartRow) });
  } catch (err) {
    console.error('Error syncing prices:', err);
    res.status(500).json({ error: 'Falha ao sincronizar preços com o ERP.' });
  }
});

// Aba 3: Modelos e Fotos
app.post('/api/admin/models', requireAuth, async (req: AuthRequest, res: Response) => {
  const { name, segment_slug, image_url, hidden } = req.body as {
    name?: string;
    segment_slug?: string;
    image_url?: string;
    hidden?: boolean;
  };
  if (!name?.trim()) {
    res.status(400).json({ error: 'Nome do modelo é obrigatório.' });
    return;
  }

  try {
    await ensureDatabaseSeeded();
    const [{ maxSort }] = await db
      .select({ maxSort: max(models.sortOrder) })
      .from(models);

    const [created] = await db
      .insert(models)
      .values({
        name: name.trim(),
        segmentSlug: segment_slug || 'cub_scooter',
        imageUrl: image_url || '',
        hidden: hidden ? 1 : 0,
        sortOrder: Number(maxSort ?? 0) + 1,
      })
      .returning();

    res.json({ model: formatModelRow(created) });
  } catch (err) {
    console.error('Error creating model:', err);
    res.status(500).json({ error: 'Falha ao criar modelo.' });
  }
});

app.put('/api/admin/models/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { name, segment_slug, image_url, hidden } = req.body as {
    name: string;
    segment_slug: string;
    image_url: string;
    hidden: boolean;
  };
  if (!name?.trim()) {
    res.status(400).json({ error: 'Nome do modelo é obrigatório.' });
    return;
  }

  try {
    await ensureDatabaseSeeded();
    const [updated] = await db
      .update(models)
      .set({
        name: name.trim(),
        segmentSlug: segment_slug,
        imageUrl: image_url || '',
        hidden: hidden ? 1 : 0,
      })
      .where(eq(models.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Modelo não encontrado.' });
      return;
    }

    res.json({ model: formatModelRow(updated) });
  } catch (err) {
    console.error('Error updating model:', err);
    res.status(500).json({ error: 'Falha ao atualizar modelo.' });
  }
});

app.delete('/api/admin/models/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ensureDatabaseSeeded();
    const id = Number(req.params.id);
    await db.delete(models).where(eq(models.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting model:', err);
    res.status(500).json({ error: 'Falha ao excluir modelo.' });
  }
});

// Aba 4: Perguntas Frequentes
app.put('/api/admin/faqs', requireAuth, async (req: AuthRequest, res: Response) => {
  const { faqs: incomingFaqs } = req.body as {
    faqs: Array<{ id?: number; question: string; answer: string }>;
  };
  if (!Array.isArray(incomingFaqs)) {
    res.status(400).json({ error: 'Formato inválido.' });
    return;
  }

  try {
    await ensureDatabaseSeeded();
    await db.transaction(async (tx) => {
      await tx.delete(faqs);
      const rows = incomingFaqs
        .filter((f) => f.question.trim() || f.answer.trim())
        .map((f, idx) => ({
          question: f.question.trim(),
          answer: f.answer.trim(),
          sortOrder: idx + 1,
        }));
      if (rows.length > 0) {
        await tx.insert(faqs).values(rows);
      }
    });

    const updated = await listFaqsOrdered();
    res.json({ ok: true, faqs: updated.map(formatFaqRow) });
  } catch (err) {
    console.error('Error updating FAQs:', err);
    res.status(500).json({ error: 'Falha ao salvar perguntas frequentes.' });
  }
});

// Aba 5: Categorias e Abas
app.put('/api/admin/categories', requireAuth, async (req: AuthRequest, res: Response) => {
  const { segments: incomingSegs, revision_tabs: incomingTabs } = req.body as {
    segments: Array<{ slug: string; name: string; visible: boolean }>;
    revision_tabs: Array<{
      revision_number: number;
      label: string;
      subtitle: string;
      visible: boolean;
    }>;
  };

  if (!Array.isArray(incomingSegs) || !Array.isArray(incomingTabs)) {
    res.status(400).json({ error: 'Dados inválidos.' });
    return;
  }

  try {
    await ensureDatabaseSeeded();
    await db.transaction(async (tx) => {
      await tx.delete(segments);
      const segRows = incomingSegs
        .filter((s) => s.slug.trim() && s.name.trim())
        .map((s, idx) => ({
          slug: s.slug.trim(),
          name: s.name.trim(),
          visible: s.visible ? 1 : 0,
          sortOrder: idx + 1,
        }));
      if (segRows.length > 0) {
        await tx.insert(segments).values(segRows);
      }

      await tx.delete(revisionTabs);
      const tabRows = incomingTabs.map((t, idx) => ({
        revisionNumber: Number(t.revision_number),
        label: t.label.trim() || `${t.revision_number}ª Revisão`,
        subtitle: t.subtitle || '',
        visible: t.visible ? 1 : 0,
        sortOrder: idx + 1,
      }));
      if (tabRows.length > 0) {
        await tx.insert(revisionTabs).values(tabRows);
      }
    });

    const [updatedSegments, updatedTabs] = await Promise.all([
      listSegmentsOrdered(false),
      listRevisionTabsOrdered(false),
    ]);

    res.json({
      ok: true,
      segments: updatedSegments.map(formatSegmentRow),
      revision_tabs: updatedTabs.map(formatRevisionTabRow),
    });
  } catch (err) {
    console.error('Error updating categories:', err);
    res.status(500).json({ error: 'Falha ao salvar categorias e abas.' });
  }
});

// Aba 6: SEO & Identidade
app.put('/api/admin/seo', requireAuth, async (req: AuthRequest, res: Response) => {
  const seoPayload = req.body;
  if (!seoPayload || typeof seoPayload !== 'object') {
    res.status(400).json({ error: 'Configurações de SEO inválidas.' });
    return;
  }

  try {
    const incomingPixel = (seoPayload as { meta_pixel?: Record<string, unknown> }).meta_pixel;
    const incomingGoogleTag = (seoPayload as { google_tag?: Record<string, unknown> }).google_tag;
    const incomingTikTok = (seoPayload as { tiktok_pixel?: Record<string, unknown> }).tiktok_pixel;
    const mergedSeo = {
      ...INITIAL_SEO_SETTINGS,
      ...seoPayload,
      meta_pixel: {
        ...INITIAL_SEO_SETTINGS.meta_pixel,
        ...(incomingPixel || {}),
        events: {
          ...INITIAL_SEO_SETTINGS.meta_pixel.events,
          ...((incomingPixel?.events as Record<string, boolean>) || {}),
        },
      },
      google_tag: {
        ...INITIAL_SEO_SETTINGS.google_tag,
        ...(incomingGoogleTag || {}),
        events: {
          ...INITIAL_SEO_SETTINGS.google_tag.events,
          ...((incomingGoogleTag?.events as Record<string, boolean>) || {}),
        },
      },
      tiktok_pixel: {
        ...INITIAL_SEO_SETTINGS.tiktok_pixel,
        ...(incomingTikTok || {}),
        events: {
          ...INITIAL_SEO_SETTINGS.tiktok_pixel.events,
          ...((incomingTikTok?.events as Record<string, boolean>) || {}),
        },
      },
      units: Array.isArray((seoPayload as { units?: unknown[] }).units)
        ? (seoPayload as { units: unknown[] }).units
        : INITIAL_SEO_SETTINGS.units,
    };

    await upsertSettingValue('seo', JSON.stringify(mergedSeo));
    res.json({ ok: true, seo: mergedSeo });
  } catch (err) {
    console.error('Error saving SEO settings:', err);
    res.status(500).json({ error: 'Falha ao salvar configurações de SEO.' });
  }
});

// Cabeçalho e Logo do Gestor (atualização direta pelo topo do painel ou SEO)
app.put('/api/admin/gestor-branding', requireAuth, async (req: AuthRequest, res: Response) => {
  const { gestor_logo_url, gestor_title, gestor_subtitle } = req.body as {
    gestor_logo_url?: string;
    gestor_title?: string;
    gestor_subtitle?: string;
  };
  try {
    const currentSeo = await getSeoSettings();
    const nextSeo = {
      ...currentSeo,
      gestor_logo_url:
        typeof gestor_logo_url === 'string'
          ? gestor_logo_url.trim()
          : currentSeo.gestor_logo_url || INITIAL_SEO_SETTINGS.gestor_logo_url,
      gestor_title:
        typeof gestor_title === 'string' && gestor_title.trim()
          ? gestor_title.trim()
          : INITIAL_SEO_SETTINGS.gestor_title,
      gestor_subtitle:
        typeof gestor_subtitle === 'string' && gestor_subtitle.trim()
          ? gestor_subtitle.trim()
          : INITIAL_SEO_SETTINGS.gestor_subtitle,
    };
    await upsertSettingValue('seo', JSON.stringify(nextSeo));
    res.json({ ok: true, seo: nextSeo });
  } catch (err) {
    console.error('Error updating gestor branding:', err);
    res.status(500).json({ error: 'Falha ao salvar identificação do Gestor.' });
  }
});

// Backup & Restore (Gestor)
app.post('/api/admin/backup/restore', requireAuth, async (req: AuthRequest, res: Response) => {
  const payload = req.body as Record<string, unknown>;
  if (!payload || typeof payload !== 'object') {
    res.status(400).json({ error: 'Arquivo de backup inválido.' });
    return;
  }

  const nowIso = new Date().toISOString();

  const restoredUploadNames = new Set<string>();
  if (payload.embedded_uploads && typeof payload.embedded_uploads === 'object') {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    for (const [rawName, dataUrl] of Object.entries(
      payload.embedded_uploads as Record<string, unknown>
    )) {
      if (typeof dataUrl !== 'string') continue;
      const safeFile = path.basename(String(rawName || '')).replace(/[^a-zA-Z0-9._-]/g, '_');
      const ext = path.extname(safeFile).toLowerCase();
      if (!safeFile || !ALLOWED_UPLOAD_EXTS.has(ext)) continue;

      const b64Match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
      const utf8Match = /^data:([^,]+),(.+)$/i.exec(dataUrl.trim());
      try {
        if (b64Match) {
          fs.writeFileSync(path.join(UPLOADS_DIR, safeFile), Buffer.from(b64Match[2], 'base64'));
          restoredUploadNames.add(safeFile);
        } else if (utf8Match) {
          fs.writeFileSync(
            path.join(UPLOADS_DIR, safeFile),
            Buffer.from(decodeURIComponent(utf8Match[2]), 'utf8')
          );
          restoredUploadNames.add(safeFile);
        }
      } catch {
        // Ignora entrada de upload corrompida individualmente
      }
    }
  }

  const normalizeRestoredMediaUrl = (rawUrl: unknown): string => {
    if (typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:image/')) return trimmed;
    if (trimmed.startsWith('uploads/')) return `/${trimmed}`;
    if (trimmed.startsWith('src/assets/')) return `/${trimmed}`;
    const uploadsMatch = /\/uploads\/([^/?#]+)/i.exec(trimmed);
    if (uploadsMatch?.[1]) {
      const filename = path.basename(uploadsMatch[1]);
      if (
        restoredUploadNames.has(filename) ||
        fs.existsSync(path.join(UPLOADS_DIR, filename))
      ) {
        return `/uploads/${filename}`;
      }
    }
    return trimmed;
  };

  try {
    await ensureDatabaseSeeded();
    await db.transaction(async (tx) => {
      if (Array.isArray(payload.segments) && payload.segments.length > 0) {
        await tx.delete(segments);
        const segRows = (payload.segments as Array<Record<string, unknown>>)
          .filter((s) => s.slug && s.name)
          .map((s, idx) => ({
            slug: String(s.slug),
            name: String(s.name),
            visible: s.visible === false || s.visible === 0 ? 0 : 1,
            sortOrder: Number(s.sort_order ?? idx + 1),
          }));
        if (segRows.length > 0) {
          await tx.insert(segments).values(segRows);
        }
      }

      if (Array.isArray(payload.revision_tabs) && payload.revision_tabs.length > 0) {
        await tx.delete(revisionTabs);
        const tabRows = (payload.revision_tabs as Array<Record<string, unknown>>)
          .filter((t) => Number(t.revision_number))
          .map((t, idx) => {
            const revNum = Number(t.revision_number);
            return {
              revisionNumber: revNum,
              label: String(t.label || `${revNum}ª Revisão`),
              subtitle: String(t.subtitle || ''),
              visible: t.visible === false || t.visible === 0 ? 0 : 1,
              sortOrder: Number(t.sort_order ?? idx + 1),
            };
          });
        if (tabRows.length > 0) {
          await tx.insert(revisionTabs).values(tabRows);
        }
      }

      if (Array.isArray(payload.parts) && payload.parts.length > 0) {
        for (const p of payload.parts as Array<Record<string, unknown>>) {
          if (!p.code || !p.description) continue;
          const partCode = String(p.code).trim();
          const rowValues = {
            code: partCode,
            description: String(p.description).trim(),
            unit: String(p.unit || 'UN').trim().toUpperCase().slice(0, 16) || 'UN',
            defaultQty: Number(p.default_qty ?? 1),
            price: Number(p.price ?? 0),
            mode: p.mode === 'manual' ? 'manual' : 'auto',
            isOptional: p.is_optional ? 1 : 0,
            microworkPrice: p.microwork_price != null ? Number(p.microwork_price) : null,
            syncStatus: String(p.sync_status || 'Restaurado'),
            updatedAt: String(p.updated_at || nowIso),
          };
          await tx
            .insert(parts)
            .values(rowValues)
            .onConflictDoUpdate({
              target: parts.code,
              set: {
                description: rowValues.description,
                unit: rowValues.unit,
                defaultQty: rowValues.defaultQty,
                price: rowValues.price,
                mode: rowValues.mode,
                isOptional: rowValues.isOptional,
                microworkPrice: rowValues.microworkPrice,
                syncStatus: rowValues.syncStatus,
                updatedAt: rowValues.updatedAt,
              },
            });
        }
      }

      if (Array.isArray(payload.models) && payload.models.length > 0) {
        await tx.delete(revisionParts);
        await tx.delete(models);
        const modelRows = (payload.models as Array<Record<string, unknown>>)
          .filter((m) => Boolean(m.name))
          .map((m) => ({
            id: Number(m.id),
            name: String(m.name).trim(),
            segmentSlug: String(m.segment_slug || 'cub_scooter'),
            imageUrl: normalizeRestoredMediaUrl(m.image_url),
            hidden: m.hidden ? 1 : 0,
            sortOrder: Number(m.sort_order ?? 0),
          }));
        if (modelRows.length > 0) {
          await tx.insert(models).values(modelRows);
        }
        await tx.execute(
          sql`SELECT setval(pg_get_serial_sequence('models', 'id'), COALESCE((SELECT MAX(id) FROM models), 1), true)`
        );
      }

      if (Array.isArray(payload.revision_parts)) {
        await tx.delete(revisionParts);
        const existingModels = await tx.select({ id: models.id }).from(models);
        const existingParts = await tx.select({ code: parts.code }).from(parts);
        const modelSet = new Set(existingModels.map((m) => m.id));
        const partSet = new Set(existingParts.map((p) => p.code));

        const rpRows = (payload.revision_parts as Array<Record<string, unknown>>)
          .filter((rp) => modelSet.has(Number(rp.model_id)) && partSet.has(String(rp.part_code)))
          .map((rp) => ({
            modelId: Number(rp.model_id),
            revisionNumber: Number(rp.revision_number),
            partCode: String(rp.part_code),
            quantity: Number(rp.quantity ?? 1),
          }));
        for (let i = 0; i < rpRows.length; i += 400) {
          await tx.insert(revisionParts).values(rpRows.slice(i, i + 400));
        }
      }

      if (Array.isArray(payload.faqs)) {
        await tx.delete(faqs);
        const faqRows = (payload.faqs as Array<Record<string, unknown>>)
          .filter((f) => Boolean(f.question))
          .map((f, idx) => ({
            question: String(f.question),
            answer: String(f.answer || ''),
            sortOrder: Number(f.sort_order ?? idx + 1),
          }));
        if (faqRows.length > 0) {
          await tx.insert(faqs).values(faqRows);
        }
      }

      if (payload.seo && typeof payload.seo === 'object') {
        const incomingSeo = payload.seo as Record<string, unknown>;
        const brandingOverride =
          payload.gestor_branding && typeof payload.gestor_branding === 'object'
            ? (payload.gestor_branding as Record<string, unknown>)
            : {};
        const mergedSeo = {
          ...INITIAL_SEO_SETTINGS,
          ...incomingSeo,
          favicon_url: normalizeRestoredMediaUrl(incomingSeo.favicon_url),
          logo_url: normalizeRestoredMediaUrl(incomingSeo.logo_url),
          gestor_logo_url: normalizeRestoredMediaUrl(
            incomingSeo.gestor_logo_url ??
              brandingOverride.gestor_logo_url ??
              INITIAL_SEO_SETTINGS.gestor_logo_url
          ),
          gestor_title: String(
            incomingSeo.gestor_title ||
              brandingOverride.gestor_title ||
              INITIAL_SEO_SETTINGS.gestor_title
          ),
          gestor_subtitle: String(
            incomingSeo.gestor_subtitle ||
              brandingOverride.gestor_subtitle ||
              INITIAL_SEO_SETTINGS.gestor_subtitle
          ),
          og_image: normalizeRestoredMediaUrl(incomingSeo.og_image),
        };
        await tx
          .insert(siteSettings)
          .values({ key: 'seo', value: JSON.stringify(mergedSeo) })
          .onConflictDoUpdate({
            target: siteSettings.key,
            set: { value: JSON.stringify(mergedSeo) },
          });
      }

      if (payload.visual_builder && typeof payload.visual_builder === 'object') {
        const vb = { ...(payload.visual_builder as Record<string, unknown>) };
        if (vb.imageOverrides && typeof vb.imageOverrides === 'object') {
          const nextOverrides: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(vb.imageOverrides as Record<string, unknown>)) {
            nextOverrides[k] = typeof v === 'string' ? normalizeRestoredMediaUrl(v) : v;
          }
          vb.imageOverrides = nextOverrides;
        }
        await tx
          .insert(siteSettings)
          .values({ key: 'visual_builder', value: JSON.stringify(vb) })
          .onConflictDoUpdate({
            target: siteSettings.key,
            set: { value: JSON.stringify(vb) },
          });
      }

      if (payload.integrations && typeof payload.integrations === 'object') {
        const ints = payload.integrations as Record<string, Record<string, unknown>>;
        if (ints.google_maps) {
          const cfg = JSON.stringify({
            custom_api_key: String(ints.google_maps.custom_api_key || ''),
          });
          const activeVal = ints.google_maps.active ? 1 : 0;
          await tx
            .insert(integrations)
            .values({
              key: 'google_maps',
              name: 'Google Maps Platform',
              configJson: cfg,
              secretValue: '',
              active: activeVal,
              updatedAt: nowIso,
            })
            .onConflictDoUpdate({
              target: integrations.key,
              set: { configJson: cfg, active: activeVal, updatedAt: nowIso },
            });
        }
        if (ints.microwork) {
          const existingMw = await tx
            .select({ secretValue: integrations.secretValue })
            .from(integrations)
            .where(eq(integrations.key, 'microwork'));
          const cfg = JSON.stringify({
            auto_sync_enabled: Boolean(ints.microwork.auto_sync_enabled),
            update_mode: ints.microwork.update_mode === 'manual' ? 'manual' : 'auto_api',
            endpoint_url: String(ints.microwork.endpoint_url || ''),
            frequency: ints.microwork.frequency === 'daily' ? 'daily' : 'weekly',
            last_sync_at: String(ints.microwork.last_sync_at || nowIso),
            last_sync_result: String(ints.microwork.last_sync_result || 'Restaurado via backup'),
          });
          await tx
            .insert(integrations)
            .values({
              key: 'microwork',
              name: 'ERP MicroWork',
              configJson: cfg,
              secretValue: existingMw[0]?.secretValue || '',
              active: 1,
              updatedAt: nowIso,
            })
            .onConflictDoUpdate({
              target: integrations.key,
              set: { configJson: cfg, updatedAt: nowIso },
            });
        }
        if (Array.isArray(ints.custom_integrations)) {
          const existingCustomRows = await tx
            .select({ configJson: integrations.configJson })
            .from(integrations)
            .where(eq(integrations.key, 'custom_integrations'));
          let existingCustomList: Array<{ id?: string; name?: string; value?: string }> = [];
          try {
            existingCustomList = existingCustomRows[0]
              ? JSON.parse(existingCustomRows[0].configJson)
              : [];
          } catch {
            existingCustomList = [];
          }
          const sanitizedCustom = (
            ints.custom_integrations as Array<{
              id?: string;
              name?: string;
              value?: string;
              active?: boolean;
            }>
          ).map((item) => {
            if (item.value === '•••• (protegido)') {
              const match = existingCustomList.find(
                (ex) => (item.id && ex.id === item.id) || (item.name && ex.name === item.name)
              );
              return { ...item, value: match?.value ?? '' };
            }
            return item;
          });
          const cfg = JSON.stringify(sanitizedCustom);
          await tx
            .insert(integrations)
            .values({
              key: 'custom_integrations',
              name: 'Outras chaves e webhooks',
              configJson: cfg,
              secretValue: '',
              active: 1,
              updatedAt: nowIso,
            })
            .onConflictDoUpdate({
              target: integrations.key,
              set: { configJson: cfg, updatedAt: nowIso },
            });
        }
        if (ints.tracking_pixels && typeof ints.tracking_pixels === 'object') {
          const tp = ints.tracking_pixels as Record<string, Record<string, unknown>>;
          const existingTp = await tx
            .select({ secretValue: integrations.secretValue })
            .from(integrations)
            .where(eq(integrations.key, 'tracking_pixels'));
          const nextTpCfg = {
            gtm: {
              enabled: Boolean(tp.gtm?.enabled),
              container_id: String(tp.gtm?.container_id || '').trim().toUpperCase(),
            },
            ga4: {
              enabled: Boolean(tp.ga4?.enabled),
              measurement_id: String(tp.ga4?.measurement_id || '').trim().toUpperCase(),
            },
            google_ads: {
              enabled: Boolean(tp.google_ads?.enabled),
              ads_id: String(tp.google_ads?.ads_id || '').trim().toUpperCase(),
              conversion_label: String(tp.google_ads?.conversion_label || '').trim(),
            },
            meta_pixel: {
              enabled: Boolean(tp.meta_pixel?.enabled),
              pixel_id: String(tp.meta_pixel?.pixel_id || '').replace(/\D/g, ''),
              domain_verification: String(tp.meta_pixel?.domain_verification || '').trim(),
            },
            tiktok_pixel: {
              enabled: Boolean(tp.tiktok_pixel?.enabled),
              pixel_id: String(tp.tiktok_pixel?.pixel_id || '').trim().toUpperCase(),
            },
            google_search_console: {
              verification_code: extractGoogleSiteVerificationCode(
                (tp.google_search_console as { verification_code?: unknown } | undefined)
                  ?.verification_code
              ),
            },
          };
          const cfg = JSON.stringify(nextTpCfg);
          await tx
            .insert(integrations)
            .values({
              key: 'tracking_pixels',
              name: 'Pixels, Tags & Rastreamento',
              configJson: cfg,
              secretValue:
                existingTp[0]?.secretValue ||
                JSON.stringify({ meta_capi_token: '', tiktok_events_token: '' }),
              active: 1,
              updatedAt: nowIso,
            })
            .onConflictDoUpdate({
              target: integrations.key,
              set: { configJson: cfg, updatedAt: nowIso },
            });
        }
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Error restoring backup:', err);
    res.status(500).json({ error: 'Falha ao restaurar backup no banco de dados.' });
  }
});

// Exportar Estrutura Completa do Site + Snapshot Cloud SQL + Assets + Backup Gestor (.zip)
const ZIP_IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.gmp_cache',
  '.aistudio',
  '.next',
  '.turbo',
]);

function shouldSkipZipEntry(relPath: string, isDir: boolean): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  const baseName = path.posix.basename(normalized);

  if (isDir) {
    return ZIP_IGNORED_DIRS.has(baseName);
  }

  if (baseName === '.DS_Store' || baseName.endsWith('.log')) return true;
  if (baseName === '.env' || (baseName.startsWith('.env.') && baseName !== '.env.example')) {
    return true;
  }
  if (
    normalized === 'data/rodaleve.db' ||
    normalized === 'data/rodaleve.db-wal' ||
    normalized === 'data/rodaleve.db-shm'
  ) {
    return true;
  }
  return false;
}

function addWorkspaceDirToZip(zip: JSZip, rootDir: string, currentDir: string): void {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    if (!relPath) continue;

    if (entry.isDirectory()) {
      if (shouldSkipZipEntry(relPath, true)) continue;
      addWorkspaceDirToZip(zip, rootDir, fullPath);
    } else if (entry.isFile()) {
      if (shouldSkipZipEntry(relPath, false)) continue;
      zip.file(relPath, fs.readFileSync(fullPath));
    }
  }
}

app.post('/api/admin/export-site-zip', requireAuth, async (req: AuthRequest, res: Response) => {
  const rootDir = process.cwd();
  const zip = new JSZip();

  try {
    addWorkspaceDirToZip(zip, rootDir, rootDir);

    // Snapshot consistente dos dados atuais do Cloud SQL (PostgreSQL)
    const [
      modelRows,
      segmentRows,
      revisionTabRows,
      partRows,
      revisionPartRows,
      faqRows,
      seo,
      visualBuilder,
    ] = await Promise.all([
      listAllModelsOrdered(),
      listSegmentsOrdered(false),
      listRevisionTabsOrdered(false),
      listPartsOrdered(false),
      listRevisionPartsOrdered(),
      listFaqsOrdered(),
      getSeoSettings(),
      getVisualBuilderConfig(),
    ]);

    zip.file(
      'backup-gestor/cloudsql-snapshot.json',
      JSON.stringify(
        {
          exported_at: new Date().toISOString(),
          models: modelRows.map(formatModelRow),
          segments: segmentRows.map(formatSegmentRow),
          revision_tabs: revisionTabRows.map(formatRevisionTabRow),
          parts: partRows.map(formatPartRow),
          revision_parts: revisionPartRows.map(formatRevisionPartRow),
          faqs: faqRows.map(formatFaqRow),
          seo,
          visual_builder: visualBuilder,
        },
        null,
        2
      )
    );

    const backupFiles = (req.body as { backup_files?: Record<string, unknown> })?.backup_files;
    if (backupFiles && typeof backupFiles === 'object') {
      for (const [name, content] of Object.entries(backupFiles)) {
        if (typeof content === 'string' && /^[a-z0-9._-]+\.json$/i.test(name)) {
          zip.file(`backup-gestor/${name}`, content);
        }
      }
    }

    if (!zip.file('README.md')) {
      zip.file(
        'README.md',
        `# Rodaleve Honda — Tabela de Manutenção e Revisões + Rodaleve Gestor

Pacote completo exportado com toda a estrutura do site (frontend React + Vite + Tailwind, backend Express + PostgreSQL/Drizzle, imagens enviadas e backup do Gestor).

## Como executar em outra plataforma

1. Instale as dependências:
   \`\`\`bash
   npm install
   \`\`\`
2. Configure as variáveis de ambiente copiando \`.env.example\` para \`.env\` (incluindo \`SQL_HOST\`, \`SQL_DB_NAME\`, \`SQL_USER\`, \`SQL_PASSWORD\`, \`SQL_ADMIN_USER\`, \`SQL_ADMIN_PASSWORD\`).
3. Ambiente de desenvolvimento:
   \`\`\`bash
   npm run dev
   \`\`\`
4. Build e execução em produção:
   \`\`\`bash
   npm run build
   npm start
   \`\`\`
`
      );
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `rodaleve-site-completo-${dateSlug}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(zipBuffer.length));
    res.send(zipBuffer);
  } catch (err) {
    console.error('Erro ao exportar ZIP completo do site:', err);
    res.status(500).json({
      error:
        err instanceof Error
          ? `Falha ao gerar ZIP completo: ${err.message}`
          : 'Falha ao gerar ZIP completo do site.',
    });
  }
});

// Visual Builder config persistence
app.put('/api/admin/visual-builder', requireAuth, async (req: AuthRequest, res: Response) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    res.status(400).json({ error: 'Configuração do editor visual inválida.' });
    return;
  }
  try {
    await upsertSettingValue('visual_builder', JSON.stringify(payload));
    res.json({ ok: true, visual_builder: payload });
  } catch (err) {
    console.error('Error saving visual builder:', err);
    res.status(500).json({ error: 'Falha ao salvar alterações do editor visual.' });
  }
});

app.delete('/api/admin/visual-builder', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    await deleteSettingKey('visual_builder');
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting visual builder:', err);
    res.status(500).json({ error: 'Falha ao restaurar editor visual.' });
  }
});

// Aba 7: Integrações & APIs
app.put('/api/admin/integrations', requireAuth, async (req: AuthRequest, res: Response) => {
  const { google_maps, microwork, custom_integrations, tracking_pixels } = req.body as {
    google_maps: { active: boolean; custom_api_key: string };
    microwork: {
      auto_sync_enabled: boolean;
      update_mode: 'manual' | 'auto_api';
      endpoint_url: string;
      new_token?: string;
      frequency: 'daily' | 'weekly';
    };
    custom_integrations: Array<{ id: string; name: string; value: string; active: boolean }>;
    tracking_pixels?: {
      gtm?: { enabled: boolean; container_id: string };
      ga4?: { enabled: boolean; measurement_id: string };
      google_ads?: { enabled: boolean; ads_id: string; conversion_label?: string };
      meta_pixel?: {
        enabled: boolean;
        pixel_id: string;
        domain_verification?: string;
        new_capi_token?: string;
        clear_capi_token?: boolean;
      };
      tiktok_pixel?: {
        enabled: boolean;
        pixel_id: string;
        new_events_token?: string;
        clear_events_token?: boolean;
      };
      google_search_console?: {
        verification_code?: string;
      };
    };
  };

  if (tracking_pixels) {
    const gtmId = (tracking_pixels.gtm?.container_id || '').trim().toUpperCase();
    const ga4Id = (tracking_pixels.ga4?.measurement_id || '').trim().toUpperCase();
    const adsId = (tracking_pixels.google_ads?.ads_id || '').trim().toUpperCase();
    const metaId = (tracking_pixels.meta_pixel?.pixel_id || '').trim();
    const ttId = (tracking_pixels.tiktok_pixel?.pixel_id || '').trim().toUpperCase();
    const rawGsc = String(tracking_pixels.google_search_console?.verification_code || '').trim();
    const extractedGsc = extractGoogleSiteVerificationCode(rawGsc);

    if (gtmId && !/^GTM-[A-Z0-9]{4,16}$/.test(gtmId)) {
      res.status(400).json({ error: 'ID do Contêiner GTM inválido. Use o formato GTM-XXXXXXX.' });
      return;
    }
    if (ga4Id && !/^G-[A-Z0-9]{4,20}$/.test(ga4Id)) {
      res.status(400).json({ error: 'ID da Métrica GA4 inválido. Use o formato G-XXXXXXXXXX.' });
      return;
    }
    if (adsId && !/^AW-[A-Z0-9]{5,20}$/.test(adsId)) {
      res
        .status(400)
        .json({ error: 'ID da Tag do Google Ads inválido. Use o formato AW-123456789.' });
      return;
    }
    if (metaId && !/^\d{5,25}$/.test(metaId)) {
      res
        .status(400)
        .json({ error: 'ID do Pixel da Meta inválido. Informe apenas dígitos numéricos.' });
      return;
    }
    if (ttId && !/^[A-Z0-9_-]{6,32}$/.test(ttId)) {
      res
        .status(400)
        .json({ error: 'ID do Pixel do TikTok inválido. Use letras e números (mín. 6 caracteres).' });
      return;
    }
    if (rawGsc && !extractedGsc) {
      res.status(400).json({
        error:
          'Código ou tag do Google Search Console inválido. Cole a tag completa com content="..." ou apenas o código de verificação.',
      });
      return;
    }
  }

  try {
    await ensureDatabaseSeeded();
    const nowIso = new Date().toISOString();

    const mapsCfg = JSON.stringify({ custom_api_key: google_maps?.custom_api_key || '' });
    const mapsActive = google_maps?.active ? 1 : 0;
    await db
      .insert(integrations)
      .values({
        key: 'google_maps',
        name: 'Google Maps Platform',
        configJson: mapsCfg,
        secretValue: '',
        active: mapsActive,
        updatedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: integrations.key,
        set: { configJson: mapsCfg, active: mapsActive, updatedAt: nowIso },
      });

    const existingMw = await getIntegrationRow('microwork');
    const oldMwCfg = existingMw ? JSON.parse(existingMw.configJson) : {};
    const nextSecret =
      microwork?.new_token && microwork.new_token.trim().length > 0
        ? microwork.new_token.trim()
        : existingMw?.secretValue || '';

    const nextMwCfg = JSON.stringify({
      ...oldMwCfg,
      auto_sync_enabled: Boolean(microwork?.auto_sync_enabled),
      update_mode: microwork?.update_mode === 'manual' ? 'manual' : 'auto_api',
      endpoint_url: microwork?.endpoint_url?.trim() || '',
      frequency: microwork?.frequency === 'daily' ? 'daily' : 'weekly',
    });

    await db
      .insert(integrations)
      .values({
        key: 'microwork',
        name: 'ERP MicroWork',
        configJson: nextMwCfg,
        secretValue: nextSecret,
        active: 1,
        updatedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: integrations.key,
        set: { configJson: nextMwCfg, secretValue: nextSecret, updatedAt: nowIso },
      });

    const customCfg = JSON.stringify(Array.isArray(custom_integrations) ? custom_integrations : []);
    await db
      .insert(integrations)
      .values({
        key: 'custom_integrations',
        name: 'Outras chaves e webhooks',
        configJson: customCfg,
        secretValue: '',
        active: 1,
        updatedAt: nowIso,
      })
      .onConflictDoUpdate({
        target: integrations.key,
        set: { configJson: customCfg, updatedAt: nowIso },
      });

    if (tracking_pixels) {
      const existingTp = await getIntegrationRow('tracking_pixels');

      let prevSecrets = { meta_capi_token: '', tiktok_events_token: '' };
      if (existingTp?.secretValue) {
        try {
          const parsed = JSON.parse(existingTp.secretValue) as {
            meta_capi_token?: string;
            tiktok_events_token?: string;
          };
          prevSecrets = {
            meta_capi_token: parsed.meta_capi_token || '',
            tiktok_events_token: parsed.tiktok_events_token || '',
          };
        } catch {
          // ignore malformed JSON
        }
      }

      const nextCapiToken = tracking_pixels.meta_pixel?.clear_capi_token
        ? ''
        : tracking_pixels.meta_pixel?.new_capi_token?.trim()
          ? tracking_pixels.meta_pixel.new_capi_token.trim()
          : prevSecrets.meta_capi_token;

      const nextTikTokToken = tracking_pixels.tiktok_pixel?.clear_events_token
        ? ''
        : tracking_pixels.tiktok_pixel?.new_events_token?.trim()
          ? tracking_pixels.tiktok_pixel.new_events_token.trim()
          : prevSecrets.tiktok_events_token;

      const nextTpConfig = {
        gtm: {
          enabled: Boolean(tracking_pixels.gtm?.enabled),
          container_id: (tracking_pixels.gtm?.container_id || '').trim().toUpperCase(),
        },
        ga4: {
          enabled: Boolean(tracking_pixels.ga4?.enabled),
          measurement_id: (tracking_pixels.ga4?.measurement_id || '').trim().toUpperCase(),
        },
        google_ads: {
          enabled: Boolean(tracking_pixels.google_ads?.enabled),
          ads_id: (tracking_pixels.google_ads?.ads_id || '').trim().toUpperCase(),
          conversion_label: (tracking_pixels.google_ads?.conversion_label || '').trim(),
        },
        meta_pixel: {
          enabled: Boolean(tracking_pixels.meta_pixel?.enabled),
          pixel_id: (tracking_pixels.meta_pixel?.pixel_id || '')
            .replace(/\s+/g, '')
            .replace(/\D/g, ''),
          domain_verification: (tracking_pixels.meta_pixel?.domain_verification || '').trim(),
        },
        tiktok_pixel: {
          enabled: Boolean(tracking_pixels.tiktok_pixel?.enabled),
          pixel_id: (tracking_pixels.tiktok_pixel?.pixel_id || '').trim().toUpperCase(),
        },
        google_search_console: {
          verification_code: extractGoogleSiteVerificationCode(
            tracking_pixels.google_search_console?.verification_code
          ),
        },
      };

      const tpCfgStr = JSON.stringify(nextTpConfig || DEFAULT_TRACKING_PIXELS_CONFIG);
      const tpSecretsStr = JSON.stringify({
        meta_capi_token: nextCapiToken,
        tiktok_events_token: nextTikTokToken,
      });

      await db
        .insert(integrations)
        .values({
          key: 'tracking_pixels',
          name: 'Pixels, Tags & Rastreamento',
          configJson: tpCfgStr,
          secretValue: tpSecretsStr,
          active: 1,
          updatedAt: nowIso,
        })
        .onConflictDoUpdate({
          target: integrations.key,
          set: { configJson: tpCfgStr, secretValue: tpSecretsStr, updatedAt: nowIso },
        });
    }

    res.json({
      ok: true,
      has_token: Boolean(nextSecret || process.env.MICROWORK_TOKEN),
      token_masked: maskSecret(nextSecret || process.env.MICROWORK_TOKEN || ''),
      tracking_pixels: await getAdminTrackingPixelsConfig(),
    });
  } catch (err) {
    console.error('Error saving integrations:', err);
    res.status(500).json({ error: 'Falha ao salvar integrações.' });
  }
});

app.post('/api/admin/integrations/test', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint_url, new_token } = req.body as { endpoint_url?: string; new_token?: string };
    const existingMw = await getIntegrationRow('microwork');
    const oldCfg = existingMw ? JSON.parse(existingMw.configJson) : {};

    const targetUrl = (endpoint_url || oldCfg.endpoint_url || '').trim();
    const token = (new_token || existingMw?.secretValue || process.env.MICROWORK_TOKEN || '').trim();

    if (!targetUrl) {
      res.json({
        ok: false,
        message: 'Informe uma URL de endpoint do MicroWork para testar a conexão.',
      });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await fetch(targetUrl, { headers, signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) {
      res.json({ ok: false, message: `Endpoint respondeu com HTTP ${resp.status}.` });
      return;
    }
    res.json({ ok: true, message: `Conexão OK (HTTP ${resp.status}) com o endpoint MicroWork.` });
  } catch (err) {
    res.json({
      ok: false,
      message: `Não foi possível conectar ao endpoint (${err instanceof Error ? err.message : 'erro de rede'}).`,
    });
  }
});

// File upload for model photos, favicon, logo, og:image, gestor logo
app.post('/api/upload', requireAuth, (req: AuthRequest, res: Response) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            error: 'Arquivo muito grande. O limite máximo permitido é de 8 MB.',
          });
          return;
        }
        res.status(400).json({
          error: `Falha no envio do arquivo (${err.code}).`,
        });
        return;
      }
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Erro ao processar arquivo de imagem.',
      });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo de imagem foi recebido.' });
      return;
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', async (req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      try {
        let html = fs.readFileSync(indexPath, 'utf8');
        if (!req.path.startsWith('/gestor')) {
          const tracking = await getPublicTrackingConfig().catch(() => null);
          const gscCode = extractGoogleSiteVerificationCode(
            tracking?.google_search_console?.verification_code
          );
          if (gscCode) {
            const metaTag = `<meta name="google-site-verification" content="${gscCode}" />`;
            if (/<meta\s+[^>]*name=["']google-site-verification["'][^>]*>/i.test(html)) {
              html = html.replace(
                /<meta\s+[^>]*name=["']google-site-verification["'][^>]*>/i,
                metaTag
              );
            } else {
              html = html.replace(/<head([^>]*)>/i, `<head$1>\n    ${metaTag}`);
            }
          }
        }
        res.type('html').send(html);
      } catch {
        res.sendFile(indexPath);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rodaleve Honda server running on http://localhost:${PORT}`);
  });
}

void startServer();
