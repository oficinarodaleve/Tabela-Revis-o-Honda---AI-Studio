import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  INITIAL_FAQS,
  INITIAL_MODELS,
  INITIAL_PARTS,
  INITIAL_REVISION_TABS,
  INITIAL_SEGMENTS,
  INITIAL_SEO_SETTINGS,
  buildRevisionPartsForProfile,
} from './seedData.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'rodaleve.db');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      visible INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS revision_tabs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      revision_number INTEGER UNIQUE NOT NULL,
      label TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      visible INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      segment_slug TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      hidden INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS parts (
      code TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'UN',
      default_qty REAL NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'auto',
      is_optional INTEGER NOT NULL DEFAULT 0,
      microwork_price REAL,
      sync_status TEXT NOT NULL DEFAULT 'Manual',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS part_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_code TEXT NOT NULL,
      price REAL NOT NULL,
      updated_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'seed'
    );

    CREATE TABLE IF NOT EXISTS revision_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER NOT NULL,
      revision_number INTEGER NOT NULL,
      part_code TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE,
      FOREIGN KEY (part_code) REFERENCES parts(code) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integrations (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config_json TEXT NOT NULL,
      secret_value TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );
  `);

  const nowIso = new Date().toISOString();

  // Seed segments if empty
  const segCount = (db.prepare('SELECT COUNT(*) as c FROM segments').get() as { c: number }).c;
  if (segCount === 0) {
    const insertSeg = db.prepare(
      'INSERT INTO segments (slug, name, visible, sort_order) VALUES (?, ?, ?, ?)'
    );
    for (const s of INITIAL_SEGMENTS) {
      insertSeg.run(s.slug, s.name, s.visible, s.sort_order);
    }
  }

  // Seed revision_tabs if empty
  const revTabCount = (db.prepare('SELECT COUNT(*) as c FROM revision_tabs').get() as { c: number }).c;
  if (revTabCount === 0) {
    const insertTab = db.prepare(
      'INSERT INTO revision_tabs (revision_number, label, subtitle, visible, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    for (const t of INITIAL_REVISION_TABS) {
      insertTab.run(t.revision_number, t.label, t.subtitle, t.visible, t.sort_order);
    }
  }

  // Seed parts & part_prices if empty
  const partsCount = (db.prepare('SELECT COUNT(*) as c FROM parts').get() as { c: number }).c;
  if (partsCount === 0) {
    const insertPart = db.prepare(
      `INSERT INTO parts (code, description, unit, default_qty, price, mode, is_optional, microwork_price, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertHistory = db.prepare(
      'INSERT INTO part_prices (part_code, price, updated_at, source) VALUES (?, ?, ?, ?)'
    );
    for (const p of INITIAL_PARTS) {
      insertPart.run(
        p.code,
        p.description,
        p.unit,
        p.default_qty,
        p.price,
        p.mode,
        p.is_optional,
        p.microwork_price,
        p.sync_status,
        nowIso
      );
      insertHistory.run(p.code, p.price, nowIso, 'seed');
    }
  }

  // Seed models & revision_parts if empty
  const modelsCount = (db.prepare('SELECT COUNT(*) as c FROM models').get() as { c: number }).c;
  if (modelsCount === 0) {
    const insertModel = db.prepare(
      'INSERT INTO models (name, segment_slug, image_url, hidden, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    const insertRevPart = db.prepare(
      'INSERT INTO revision_parts (model_id, revision_number, part_code, quantity) VALUES (?, ?, ?, ?)'
    );
    for (const m of INITIAL_MODELS) {
      const result = insertModel.run(m.name, m.segment_slug, m.image_url, m.hidden, m.sort_order);
      const modelId = Number(result.lastInsertRowid);
      for (let rev = 1; rev <= 7; rev++) {
        const items = buildRevisionPartsForProfile(m.profile, rev);
        for (const item of items) {
          insertRevPart.run(modelId, rev, item.part_code, item.quantity);
        }
      }
    }
  }

  // Seed FAQs if empty
  const faqCount = (db.prepare('SELECT COUNT(*) as c FROM faqs').get() as { c: number }).c;
  if (faqCount === 0) {
    const insertFaq = db.prepare(
      'INSERT INTO faqs (question, answer, sort_order) VALUES (?, ?, ?)'
    );
    INITIAL_FAQS.forEach((f, idx) => {
      insertFaq.run(f.question, f.answer, idx + 1);
    });
  }

  // Seed site_settings if empty
  const seoRow = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('seo') as
    | { value: string }
    | undefined;
  if (!seoRow) {
    db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)').run(
      'seo',
      JSON.stringify(INITIAL_SEO_SETTINGS)
    );
  } else {
    try {
      const parsedSeo = JSON.parse(seoRow.value);
      let changed = false;
      if (!parsedSeo.short_name) {
        parsedSeo.short_name = 'Rodaleve';
        changed = true;
      }
      if (!parsedSeo.business_type || parsedSeo.business_type === 'MotorcycleRepair') {
        parsedSeo.business_type = 'MotorcycleDealer';
        changed = true;
      }
      if (!parsedSeo.facebook_url || parsedSeo.facebook_url === 'https://facebook.com/rodalevehonda') {
        parsedSeo.facebook_url = 'https://www.facebook.com/concessionariarodaleve/';
        changed = true;
      }
      if (!parsedSeo.meta_pixel) {
        parsedSeo.meta_pixel = INITIAL_SEO_SETTINGS.meta_pixel;
        changed = true;
      }
      if (!parsedSeo.google_tag) {
        parsedSeo.google_tag = INITIAL_SEO_SETTINGS.google_tag;
        changed = true;
      }
      if (!parsedSeo.tiktok_pixel) {
        parsedSeo.tiktok_pixel = INITIAL_SEO_SETTINGS.tiktok_pixel;
        changed = true;
      }
      if (Array.isArray(parsedSeo?.units)) {
        parsedSeo.units = parsedSeo.units.map((u: Record<string, unknown>) => {
          if (
            u.id === 'vitoria-da-conquista' &&
            (u.name === 'Rodaleve Vitória da Conquista' ||
              u.zip === '45005-075' ||
              u.street === 'Av. Presidente Dutra' ||
              !String(u.gmb_url || '').includes('Rodaleve'))
          ) {
            changed = true;
            return {
              ...u,
              name: 'Rodaleve Honda – Vitória da Conquista',
              street: 'Av. Pres. Dutra',
              number: '2879',
              neighborhood: 'Centro',
              city: 'Vitória da Conquista',
              state: 'BA',
              zip: '45065-075',
              lat: -14.8655,
              lng: -40.8385,
              gmb_url:
                'https://www.google.com/maps/search/?api=1&query=Rodaleve%20Honda%2C%20Av.%20Pres.%20Dutra%2C%202879%20-%20Centro%2C%20Vit%C3%B3ria%20da%20Conquista%20-%20BA%2C%2045065-075',
            };
          }
          if (
            u.id === 'guanambi' &&
            (u.number === '1427' || u.neighborhood === 'Lot Municipal')
          ) {
            changed = true;
            return {
              ...u,
              street: 'Av. Santos Dumont',
              number: '1837',
              neighborhood: 'Aeroporto Velho',
              city: 'Guanambi',
              state: 'BA',
              zip: '46430-000',
              gmb_url:
                'https://www.google.com/maps/search/?api=1&query=Av.+Santos+Dumont,+1837+-+Aeroporto+Velho,+Guanambi+-+BA,+46430-000',
            };
          }
          return u;
        });
      }
      if (changed) {
        db.prepare('UPDATE site_settings SET value = ? WHERE key = ?').run(
          JSON.stringify(parsedSeo),
          'seo'
        );
      }
    } catch {
      // Ignore malformed JSON
    }
  }
  const syncRow = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('last_price_sync');
  if (!syncRow) {
    db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)').run(
      'last_price_sync',
      JSON.stringify({ timestamp: nowIso })
    );
  }

  // Seed integrations if empty
  const mapsInt = db.prepare('SELECT key FROM integrations WHERE key = ?').get('google_maps');
  if (!mapsInt) {
    db.prepare(
      'INSERT INTO integrations (key, name, config_json, secret_value, active, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      'google_maps',
      'Google Maps Platform',
      JSON.stringify({ custom_api_key: '' }),
      '',
      1,
      nowIso
    );
  }

  const mwInt = db.prepare('SELECT key FROM integrations WHERE key = ?').get('microwork');
  if (!mwInt) {
    db.prepare(
      'INSERT INTO integrations (key, name, config_json, secret_value, active, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      'microwork',
      'ERP MicroWork',
      JSON.stringify({
        auto_sync_enabled: true,
        update_mode: 'auto_api',
        endpoint_url: '',
        frequency: 'weekly',
        last_sync_at: nowIso,
        last_sync_result: 'Catálogo inicial carregado (aguardando endpoint ERP para atualização remota)',
      }),
      process.env.MICROWORK_TOKEN || '',
      1,
      nowIso
    );
  }

  const customInt = db.prepare('SELECT key FROM integrations WHERE key = ?').get('custom_integrations');
  if (!customInt) {
    db.prepare(
      'INSERT INTO integrations (key, name, config_json, secret_value, active, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      'custom_integrations',
      'Outras chaves e webhooks',
      JSON.stringify([]),
      '',
      1,
      nowIso
    );
  }

  // Seed authorized admins if empty
  const adminCount = (db.prepare('SELECT COUNT(*) as c FROM admins').get() as { c: number }).c;
  if (adminCount === 0) {
    const insertAdmin = db.prepare(
      'INSERT INTO admins (email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    insertAdmin.run(
      'lazarovictor.rodaleve@gmail.com',
      hashPassword('Rodaleve@2026'),
      'Gestor Rodaleve',
      'superadmin',
      nowIso
    );
    insertAdmin.run(
      'admin@rodaleve.com.br',
      hashPassword('Rodaleve@2026'),
      'Administração Rodaleve',
      'admin',
      nowIso
    );
  }
}

export function getSeoSettings() {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('seo') as
    | { value: string }
    | undefined;
  if (!row) return INITIAL_SEO_SETTINGS;
  try {
    const parsed = JSON.parse(row.value) as Partial<typeof INITIAL_SEO_SETTINGS>;
    const units =
      Array.isArray(parsed.units) && parsed.units.length > 0
        ? parsed.units.map((u, idx) => ({
            ...(INITIAL_SEO_SETTINGS.units[idx] || INITIAL_SEO_SETTINGS.units[0]),
            ...u,
          }))
        : INITIAL_SEO_SETTINGS.units;
    return {
      ...INITIAL_SEO_SETTINGS,
      ...parsed,
      meta_pixel: {
        ...INITIAL_SEO_SETTINGS.meta_pixel,
        ...(parsed.meta_pixel || {}),
        events: {
          ...INITIAL_SEO_SETTINGS.meta_pixel.events,
          ...(parsed.meta_pixel?.events || {}),
        },
      },
      google_tag: {
        ...INITIAL_SEO_SETTINGS.google_tag,
        ...(parsed.google_tag || {}),
        events: {
          ...INITIAL_SEO_SETTINGS.google_tag.events,
          ...(parsed.google_tag?.events || {}),
        },
      },
      tiktok_pixel: {
        ...INITIAL_SEO_SETTINGS.tiktok_pixel,
        ...(parsed.tiktok_pixel || {}),
        events: {
          ...INITIAL_SEO_SETTINGS.tiktok_pixel.events,
          ...(parsed.tiktok_pixel?.events || {}),
        },
      },
      units,
    };
  } catch {
    return INITIAL_SEO_SETTINGS;
  }
}

export function getVisualBuilderConfig() {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('visual_builder') as
    | { value: string }
    | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export function getLastPriceSync(): string {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('last_price_sync') as { value: string } | undefined;
  if (!row) return new Date().toISOString();
  try {
    return JSON.parse(row.value).timestamp || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(12, secret.length - 4))}${secret.slice(-4)}`;
}
