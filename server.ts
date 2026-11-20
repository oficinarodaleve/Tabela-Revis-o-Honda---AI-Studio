import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import {
  db,
  getLastPriceSync,
  getSeoSettings,
  initDatabase,
  maskSecret,
  verifyPassword,
} from './src/server/db.ts';
import { startWeeklySyncScheduler, syncMicroWorkPrices } from './src/server/microwork.ts';

initDatabase();
startWeeklySyncScheduler();

const app = express();
const PORT = 3000;

const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const safeName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
});

app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      result[k] = v;
    }
  }
  return result;
}

interface AuthedRequest extends Request {
  adminUser?: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}

function getAuthenticatedAdmin(req: Request) {
  const cookies = parseCookies(req);
  const token = cookies.rodaleve_session;
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT a.id, a.email, a.name, a.role, s.expires_at
       FROM sessions s
       JOIN admins a ON a.id = s.admin_id
       WHERE s.token = ?`
    )
    .get(token) as
    | { id: number; email: string; name: string; role: string; expires_at: string }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }

  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    res.status(401).json({ error: 'Não autorizado. Faça login para continuar.' });
    return;
  }
  req.adminUser = admin;
  next();
}

function formatModelRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    name: String(row.name),
    segment_slug: String(row.segment_slug),
    image_url: String(row.image_url || ''),
    hidden: Boolean(row.hidden),
    sort_order: Number(row.sort_order),
  };
}

function formatPartRow(row: Record<string, unknown>) {
  return {
    code: String(row.code),
    description: String(row.description),
    unit: String(row.unit) === 'ML' ? 'ML' : 'UN',
    default_qty: Number(row.default_qty),
    price: Number(row.price),
    mode: String(row.mode) === 'manual' ? 'manual' : 'auto',
    is_optional: Boolean(row.is_optional),
    microwork_price: row.microwork_price !== null && row.microwork_price !== undefined ? Number(row.microwork_price) : null,
    sync_status: String(row.sync_status || ''),
    updated_at: String(row.updated_at || ''),
  };
}

function formatSegmentRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    visible: Boolean(row.visible),
    sort_order: Number(row.sort_order),
  };
}

function formatRevisionTabRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    revision_number: Number(row.revision_number),
    label: String(row.label),
    subtitle: String(row.subtitle || ''),
    visible: Boolean(row.visible),
    sort_order: Number(row.sort_order),
  };
}

// Dynamic SEO technical files
app.get('/robots.txt', (_req, res) => {
  const seo = getSeoSettings();
  res.type('text/plain').send(seo.robots_txt || 'User-agent: *\nAllow: /');
});

app.get('/sitemap.xml', (_req, res) => {
  const seo = getSeoSettings();
  res.type('application/xml').send(seo.sitemap_xml || '');
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Informe e-mail e senha.' });
    return;
  }

  const admin = db
    .prepare('SELECT id, email, password_hash, name, role FROM admins WHERE lower(email) = lower(?)')
    .get(email.trim()) as
    | { id: number; email: string; password_hash: string; name: string; role: string }
    | undefined;

  if (!admin || !verifyPassword(password, admin.password_hash)) {
    res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, admin_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    admin.id,
    expiresAt
  );

  res.setHeader(
    'Set-Cookie',
    `rodaleve_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  );
  res.json({
    user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  });
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.rodaleve_session) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(cookies.rodaleve_session);
  }
  res.setHeader('Set-Cookie', 'rodaleve_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  res.json({ user: admin });
});

// Public Bootstrap
app.get('/api/public/bootstrap', (_req, res) => {
  const models = db
    .prepare('SELECT * FROM models WHERE hidden = 0 ORDER BY sort_order ASC, id ASC')
    .all()
    .map((r) => formatModelRow(r as Record<string, unknown>));

  const segments = db
    .prepare('SELECT * FROM segments WHERE visible = 1 ORDER BY sort_order ASC, id ASC')
    .all()
    .map((r) => formatSegmentRow(r as Record<string, unknown>));

  const revisionTabs = db
    .prepare('SELECT * FROM revision_tabs WHERE visible = 1 ORDER BY sort_order ASC, revision_number ASC')
    .all()
    .map((r) => formatRevisionTabRow(r as Record<string, unknown>));

  const parts = db
    .prepare('SELECT * FROM parts ORDER BY code ASC')
    .all()
    .map((r) => formatPartRow(r as Record<string, unknown>));

  const revisionParts = db.prepare('SELECT * FROM revision_parts ORDER BY id ASC').all();
  const faqs = db.prepare('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC').all();
  const seo = getSeoSettings();
  const lastPriceSync = getLastPriceSync();

  const mapsRow = db
    .prepare('SELECT config_json, active FROM integrations WHERE key = ?')
    .get('google_maps') as { config_json: string; active: number } | undefined;
  const mapsCfg = mapsRow ? JSON.parse(mapsRow.config_json) : { custom_api_key: '' };
  const envMapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
  const resolvedMapsKey = (mapsCfg.custom_api_key || '').trim() || envMapsKey;

  const customRow = db
    .prepare('SELECT config_json FROM integrations WHERE key = ?')
    .get('custom_integrations') as { config_json: string } | undefined;
  const allCustom = customRow ? (JSON.parse(customRow.config_json) as Array<{ id: string; name: string; value: string; active: boolean }>) : [];
  const publicIntegrations = allCustom.filter(
    (item) => item.active && !item.name.toLowerCase().includes('webhook') && !item.name.toLowerCase().includes('secret')
  );

  res.json({
    models,
    segments,
    revision_tabs: revisionTabs,
    parts,
    revision_parts: revisionParts,
    faqs,
    seo,
    last_price_sync: lastPriceSync,
    maps_config: {
      active: mapsRow ? Boolean(mapsRow.active) : true,
      api_key: resolvedMapsKey,
    },
    public_integrations: publicIntegrations,
  });
});

// Admin Bootstrap
app.get('/api/admin/bootstrap', requireAdmin, (_req, res) => {
  const models = db
    .prepare('SELECT * FROM models ORDER BY sort_order ASC, id ASC')
    .all()
    .map((r) => formatModelRow(r as Record<string, unknown>));

  const segments = db
    .prepare('SELECT * FROM segments ORDER BY sort_order ASC, id ASC')
    .all()
    .map((r) => formatSegmentRow(r as Record<string, unknown>));

  const revisionTabs = db
    .prepare('SELECT * FROM revision_tabs ORDER BY sort_order ASC, revision_number ASC')
    .all()
    .map((r) => formatRevisionTabRow(r as Record<string, unknown>));

  const parts = db
    .prepare('SELECT * FROM parts ORDER BY description ASC, code ASC')
    .all()
    .map((r) => formatPartRow(r as Record<string, unknown>));

  const revisionParts = db.prepare('SELECT * FROM revision_parts ORDER BY id ASC').all();
  const faqs = db.prepare('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC').all();
  const seo = getSeoSettings();
  const lastPriceSync = getLastPriceSync();

  const mapsRow = db
    .prepare('SELECT config_json, active FROM integrations WHERE key = ?')
    .get('google_maps') as { config_json: string; active: number } | undefined;
  const mapsCfg = mapsRow ? JSON.parse(mapsRow.config_json) : { custom_api_key: '' };

  const mwRow = db
    .prepare('SELECT config_json, secret_value FROM integrations WHERE key = ?')
    .get('microwork') as { config_json: string; secret_value: string } | undefined;
  const mwCfg = mwRow ? JSON.parse(mwRow.config_json) : {};
  const effectiveToken = mwRow?.secret_value || process.env.MICROWORK_TOKEN || '';

  const customRow = db
    .prepare('SELECT config_json FROM integrations WHERE key = ?')
    .get('custom_integrations') as { config_json: string } | undefined;
  const customIntegrations = customRow ? JSON.parse(customRow.config_json) : [];

  res.json({
    models,
    segments,
    revision_tabs: revisionTabs,
    parts,
    revision_parts: revisionParts,
    faqs,
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
    },
  });
});

// Aba 1: Revisões (update model + revision parts)
app.put('/api/admin/revisions/:modelId/:revisionNumber', requireAdmin, (req, res) => {
  const modelId = Number(req.params.modelId);
  const revisionNumber = Number(req.params.revisionNumber);
  const { items } = req.body as { items: Array<{ part_code: string; quantity: number }> };

  if (!Number.isFinite(modelId) || !Number.isFinite(revisionNumber) || !Array.isArray(items)) {
    res.status(400).json({ error: 'Dados inválidos.' });
    return;
  }

  const delStmt = db.prepare('DELETE FROM revision_parts WHERE model_id = ? AND revision_number = ?');
  const insStmt = db.prepare(
    'INSERT INTO revision_parts (model_id, revision_number, part_code, quantity) VALUES (?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    delStmt.run(modelId, revisionNumber);
    for (const item of items) {
      if (!item.part_code || Number(item.quantity) <= 0) continue;
      insStmt.run(modelId, revisionNumber, item.part_code, Number(item.quantity));
    }
  });
  tx();

  const updated = db
    .prepare('SELECT * FROM revision_parts WHERE model_id = ? AND revision_number = ? ORDER BY id ASC')
    .all(modelId, revisionNumber);

  res.json({ ok: true, items: updated });
});

// Aba 2: Preços e Peças
app.post('/api/admin/parts', requireAdmin, (req, res) => {
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

  const nowIso = new Date().toISOString();
  const cleanCode = code.trim();
  const existing = db.prepare('SELECT code FROM parts WHERE code = ?').get(cleanCode);
  if (existing) {
    res.status(409).json({ error: 'Já existe uma peça cadastrada com este código.' });
    return;
  }

  const numPrice = Number(price || 0);
  const partMode = mode === 'manual' ? 'manual' : 'auto';
  const status = partMode === 'manual' ? 'Manual' : 'Aguardando sync';

  db.prepare(
    `INSERT INTO parts (code, description, unit, default_qty, price, mode, is_optional, microwork_price, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
  ).run(
    cleanCode,
    description.trim(),
    unit === 'ML' ? 'ML' : 'UN',
    Number(default_qty || (unit === 'ML' ? 1000 : 1)),
    numPrice,
    partMode,
    is_optional ? 1 : 0,
    status,
    nowIso
  );

  db.prepare('INSERT INTO part_prices (part_code, price, updated_at, source) VALUES (?, ?, ?, ?)').run(
    cleanCode,
    numPrice,
    nowIso,
    'manual_create'
  );

  const created = db.prepare('SELECT * FROM parts WHERE code = ?').get(cleanCode) as Record<string, unknown>;
  res.json({ part: formatPartRow(created) });
});

app.put('/api/admin/parts/batch', requireAdmin, (req, res) => {
  const { changes } = req.body as {
    changes: Array<{
      original_code: string;
      code: string;
      description: string;
      unit: 'UN' | 'ML';
      price: number;
      mode: 'auto' | 'manual';
      is_optional: boolean;
    }>;
  };

  if (!Array.isArray(changes)) {
    res.status(400).json({ error: 'Lista de alterações inválida.' });
    return;
  }

  const nowIso = new Date().toISOString();
  const updatePart = db.prepare(
    `UPDATE parts SET code = ?, description = ?, unit = ?, price = ?, mode = ?, is_optional = ?, sync_status = ?, updated_at = ?
     WHERE code = ?`
  );
  const updateRevCode = db.prepare('UPDATE revision_parts SET part_code = ? WHERE part_code = ?');
  const insertHist = db.prepare(
    'INSERT INTO part_prices (part_code, price, updated_at, source) VALUES (?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    for (const c of changes) {
      const nextCode = c.code.trim();
      const origCode = c.original_code.trim();
      if (!nextCode || !origCode) continue;

      if (nextCode !== origCode) {
        updateRevCode.run(nextCode, origCode);
      }
      const nextStatus = c.mode === 'manual' ? 'Manual' : 'Atualizado no Gestor';
      updatePart.run(
        nextCode,
        c.description.trim(),
        c.unit === 'ML' ? 'ML' : 'UN',
        Number(c.price || 0),
        c.mode === 'manual' ? 'manual' : 'auto',
        c.is_optional ? 1 : 0,
        nextStatus,
        nowIso,
        origCode
      );
      insertHist.run(nextCode, Number(c.price || 0), nowIso, 'gestor_edit');
    }
  });
  tx();

  const parts = db
    .prepare('SELECT * FROM parts ORDER BY description ASC, code ASC')
    .all()
    .map((r) => formatPartRow(r as Record<string, unknown>));
  res.json({ ok: true, parts });
});

app.delete('/api/admin/parts/:code', requireAdmin, (req, res) => {
  const code = decodeURIComponent(req.params.code);
  db.prepare('DELETE FROM parts WHERE code = ?').run(code);
  res.json({ ok: true });
});

app.post('/api/admin/prices/sync', requireAdmin, async (_req, res) => {
  const result = await syncMicroWorkPrices(true);
  const parts = db
    .prepare('SELECT * FROM parts ORDER BY description ASC, code ASC')
    .all()
    .map((r) => formatPartRow(r as Record<string, unknown>));
  res.json({ result, parts });
});

// Aba 3: Modelos e Fotos
app.post('/api/admin/models', requireAdmin, (req, res) => {
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

  const maxSort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM models').get() as { m: number }).m;
  const result = db
    .prepare('INSERT INTO models (name, segment_slug, image_url, hidden, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), segment_slug || 'cub_scooter', image_url || '', hidden ? 1 : 0, maxSort + 1);

  const created = db
    .prepare('SELECT * FROM models WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as Record<string, unknown>;
  res.json({ model: formatModelRow(created) });
});

app.put('/api/admin/models/:id', requireAdmin, (req, res) => {
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

  db.prepare('UPDATE models SET name = ?, segment_slug = ?, image_url = ?, hidden = ? WHERE id = ?').run(
    name.trim(),
    segment_slug,
    image_url || '',
    hidden ? 1 : 0,
    id
  );
  const updated = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as Record<string, unknown>;
  res.json({ model: formatModelRow(updated) });
});

app.delete('/api/admin/models/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM models WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Aba 4: Perguntas Frequentes
app.put('/api/admin/faqs', requireAdmin, (req, res) => {
  const { faqs } = req.body as { faqs: Array<{ id?: number; question: string; answer: string }> };
  if (!Array.isArray(faqs)) {
    res.status(400).json({ error: 'Formato inválido.' });
    return;
  }

  const delStmt = db.prepare('DELETE FROM faqs');
  const insStmt = db.prepare('INSERT INTO faqs (question, answer, sort_order) VALUES (?, ?, ?)');

  const tx = db.transaction(() => {
    delStmt.run();
    faqs.forEach((f, idx) => {
      if (!f.question.trim() && !f.answer.trim()) return;
      insStmt.run(f.question.trim(), f.answer.trim(), idx + 1);
    });
  });
  tx();

  const updated = db.prepare('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC').all();
  res.json({ ok: true, faqs: updated });
});

// Aba 5: Categorias e Abas
app.put('/api/admin/categories', requireAdmin, (req, res) => {
  const { segments, revision_tabs } = req.body as {
    segments: Array<{ slug: string; name: string; visible: boolean }>;
    revision_tabs: Array<{ revision_number: number; label: string; subtitle: string; visible: boolean }>;
  };

  if (!Array.isArray(segments) || !Array.isArray(revision_tabs)) {
    res.status(400).json({ error: 'Dados inválidos.' });
    return;
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM segments').run();
    const insSeg = db.prepare('INSERT INTO segments (slug, name, visible, sort_order) VALUES (?, ?, ?, ?)');
    segments.forEach((s, idx) => {
      if (!s.slug.trim() || !s.name.trim()) return;
      insSeg.run(s.slug.trim(), s.name.trim(), s.visible ? 1 : 0, idx + 1);
    });

    db.prepare('DELETE FROM revision_tabs').run();
    const insTab = db.prepare(
      'INSERT INTO revision_tabs (revision_number, label, subtitle, visible, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    revision_tabs.forEach((t, idx) => {
      insTab.run(
        Number(t.revision_number),
        t.label.trim() || `${t.revision_number}ª Revisão`,
        t.subtitle || '',
        t.visible ? 1 : 0,
        idx + 1
      );
    });
  });
  tx();

  const updatedSegments = db
    .prepare('SELECT * FROM segments ORDER BY sort_order ASC, id ASC')
    .all()
    .map((r) => formatSegmentRow(r as Record<string, unknown>));
  const updatedTabs = db
    .prepare('SELECT * FROM revision_tabs ORDER BY sort_order ASC, revision_number ASC')
    .all()
    .map((r) => formatRevisionTabRow(r as Record<string, unknown>));

  res.json({ ok: true, segments: updatedSegments, revision_tabs: updatedTabs });
});

// Aba 6: SEO & Identidade
app.put('/api/admin/seo', requireAdmin, (req, res) => {
  const seoPayload = req.body;
  if (!seoPayload || typeof seoPayload !== 'object') {
    res.status(400).json({ error: 'Configurações de SEO inválidas.' });
    return;
  }

  db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run(
    'seo',
    JSON.stringify(seoPayload)
  );
  res.json({ ok: true, seo: seoPayload });
});

// Aba 7: Integrações & APIs
app.put('/api/admin/integrations', requireAdmin, (req, res) => {
  const { google_maps, microwork, custom_integrations } = req.body as {
    google_maps: { active: boolean; custom_api_key: string };
    microwork: {
      auto_sync_enabled: boolean;
      update_mode: 'manual' | 'auto_api';
      endpoint_url: string;
      new_token?: string;
      frequency: 'daily' | 'weekly';
    };
    custom_integrations: Array<{ id: string; name: string; value: string; active: boolean }>;
  };

  const nowIso = new Date().toISOString();

  db.prepare(
    'INSERT OR REPLACE INTO integrations (key, name, config_json, secret_value, active, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    'google_maps',
    'Google Maps Platform',
    JSON.stringify({ custom_api_key: google_maps?.custom_api_key || '' }),
    '',
    google_maps?.active ? 1 : 0,
    nowIso
  );

  const existingMw = db
    .prepare('SELECT config_json, secret_value FROM integrations WHERE key = ?')
    .get('microwork') as { config_json: string; secret_value: string } | undefined;
  const oldMwCfg = existingMw ? JSON.parse(existingMw.config_json) : {};
  const nextSecret =
    microwork?.new_token && microwork.new_token.trim().length > 0
      ? microwork.new_token.trim()
      : existingMw?.secret_value || '';

  const nextMwCfg = {
    ...oldMwCfg,
    auto_sync_enabled: Boolean(microwork?.auto_sync_enabled),
    update_mode: microwork?.update_mode === 'manual' ? 'manual' : 'auto_api',
    endpoint_url: microwork?.endpoint_url?.trim() || '',
    frequency: microwork?.frequency === 'daily' ? 'daily' : 'weekly',
  };

  db.prepare(
    'INSERT OR REPLACE INTO integrations (key, name, config_json, secret_value, active, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('microwork', 'ERP MicroWork', JSON.stringify(nextMwCfg), nextSecret, 1, nowIso);

  db.prepare(
    'INSERT OR REPLACE INTO integrations (key, name, config_json, secret_value, active, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    'custom_integrations',
    'Outras chaves e webhooks',
    JSON.stringify(Array.isArray(custom_integrations) ? custom_integrations : []),
    '',
    1,
    nowIso
  );

  res.json({
    ok: true,
    has_token: Boolean(nextSecret || process.env.MICROWORK_TOKEN),
    token_masked: maskSecret(nextSecret || process.env.MICROWORK_TOKEN || ''),
  });
});

app.post('/api/admin/integrations/test', requireAdmin, async (req, res) => {
  const { endpoint_url, new_token } = req.body as { endpoint_url?: string; new_token?: string };
  const existingMw = db
    .prepare('SELECT config_json, secret_value FROM integrations WHERE key = ?')
    .get('microwork') as { config_json: string; secret_value: string } | undefined;
  const oldCfg = existingMw ? JSON.parse(existingMw.config_json) : {};

  const targetUrl = (endpoint_url || oldCfg.endpoint_url || '').trim();
  const token = (new_token || existingMw?.secret_value || process.env.MICROWORK_TOKEN || '').trim();

  if (!targetUrl) {
    res.json({
      ok: false,
      message: 'Informe uma URL de endpoint do MicroWork para testar a conexão.',
    });
    return;
  }

  try {
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

// File upload for model photos, favicon, logo, og:image
app.post('/api/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}` });
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
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rodaleve Honda server running on http://localhost:${PORT}`);
  });
}

void startServer();
