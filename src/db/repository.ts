import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { asc, count, eq, sql } from 'drizzle-orm';
import {
  INITIAL_FAQS,
  INITIAL_MODELS,
  INITIAL_PARTS,
  INITIAL_REVISION_TABS,
  INITIAL_SEGMENTS,
  INITIAL_SEO_SETTINGS,
  buildRevisionPartsForProfile,
} from '../server/seedData.ts';
import { db } from './index.ts';
import {
  admins,
  faqs,
  integrations,
  models,
  partPrices,
  parts,
  revisionParts,
  revisionTabs,
  segments,
  siteSettings,
  users,
} from './schema.ts';

export const DEFAULT_TRACKING_PIXELS_CONFIG = {
  gtm: { enabled: false, container_id: '' },
  ga4: { enabled: false, measurement_id: '' },
  google_ads: { enabled: false, ads_id: '', conversion_label: '' },
  meta_pixel: { enabled: false, pixel_id: '', domain_verification: '' },
  tiktok_pixel: { enabled: false, pixel_id: '' },
  google_search_console: { verification_code: '' },
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(12, secret.length - 4))}${secret.slice(-4)}`;
}

function chunkArray<T>(items: T[], size = 400): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

let seedPromise: Promise<void> | null = null;
let seededDone = false;

async function runInitialSeedIfEmpty(): Promise<void> {
  const [{ total: segTotal }] = await db.select({ total: count() }).from(segments);
  const [{ total: adminTotal }] = await db.select({ total: count() }).from(admins);
  if (Number(segTotal) > 0 && Number(adminTotal) > 0) {
    seededDone = true;
    return;
  }

  const nowIso = new Date().toISOString();
  const sqlitePath = path.resolve(process.cwd(), 'data', 'rodaleve.db');

  // If a local SQLite database exists from prior usage and Cloud SQL is empty, migrate its data once in batches
  if (Number(segTotal) === 0 && fs.existsSync(sqlitePath)) {
    try {
      const { default: Database } = await import('better-sqlite3');
      const sqlite = new Database(sqlitePath, { readonly: true });
      const sqliteSegs = sqlite
        .prepare('SELECT slug, name, visible, sort_order FROM segments ORDER BY sort_order ASC, id ASC')
        .all() as Array<Record<string, unknown>>;
      const sqliteTabs = sqlite
        .prepare(
          'SELECT revision_number, label, subtitle, visible, sort_order FROM revision_tabs ORDER BY sort_order ASC, revision_number ASC'
        )
        .all() as Array<Record<string, unknown>>;
      const sqliteParts = sqlite
        .prepare(
          'SELECT code, description, unit, default_qty, price, mode, is_optional, microwork_price, sync_status, updated_at FROM parts'
        )
        .all() as Array<Record<string, unknown>>;
      const sqliteModels = sqlite
        .prepare('SELECT id, name, segment_slug, image_url, hidden, sort_order FROM models ORDER BY id ASC')
        .all() as Array<Record<string, unknown>>;
      const sqliteRevParts = sqlite
        .prepare('SELECT model_id, revision_number, part_code, quantity FROM revision_parts ORDER BY id ASC')
        .all() as Array<Record<string, unknown>>;
      const sqliteFaqs = sqlite
        .prepare('SELECT question, answer, sort_order FROM faqs ORDER BY sort_order ASC, id ASC')
        .all() as Array<Record<string, unknown>>;
      const sqliteSettings = sqlite
        .prepare('SELECT key, value FROM site_settings')
        .all() as Array<{ key: string; value: string }>;
      const sqliteInts = sqlite
        .prepare('SELECT key, name, config_json, secret_value, active, updated_at FROM integrations')
        .all() as Array<Record<string, unknown>>;
      const sqliteAdmins = sqlite
        .prepare('SELECT email, password_hash, name, role, created_at FROM admins')
        .all() as Array<Record<string, unknown>>;
      sqlite.close();

      if (sqliteSegs.length > 0) {
        await db.transaction(async (tx) => {
          await tx
            .insert(segments)
            .values(
              sqliteSegs.map((s) => ({
                slug: String(s.slug),
                name: String(s.name),
                visible: Number(s.visible ?? 1),
                sortOrder: Number(s.sort_order ?? 0),
              }))
            )
            .onConflictDoNothing();

          if (sqliteTabs.length > 0) {
            await tx
              .insert(revisionTabs)
              .values(
                sqliteTabs.map((t) => ({
                  revisionNumber: Number(t.revision_number),
                  label: String(t.label),
                  subtitle: String(t.subtitle || ''),
                  visible: Number(t.visible ?? 1),
                  sortOrder: Number(t.sort_order ?? 0),
                }))
              )
              .onConflictDoNothing();
          }

          if (sqliteParts.length > 0) {
            await tx
              .insert(parts)
              .values(
                sqliteParts.map((p) => ({
                  code: String(p.code),
                  description: String(p.description),
                  unit: String(p.unit || 'UN'),
                  defaultQty: Number(p.default_qty ?? 1),
                  price: Number(p.price ?? 0),
                  mode: String(p.mode || 'auto'),
                  isOptional: Number(p.is_optional ?? 0),
                  microworkPrice: p.microwork_price != null ? Number(p.microwork_price) : null,
                  syncStatus: String(p.sync_status || 'Manual'),
                  updatedAt: String(p.updated_at || nowIso),
                }))
              )
              .onConflictDoNothing();
          }

          if (sqliteModels.length > 0) {
            await tx
              .insert(models)
              .values(
                sqliteModels.map((m) => ({
                  id: Number(m.id),
                  name: String(m.name),
                  segmentSlug: String(m.segment_slug),
                  imageUrl: String(m.image_url || ''),
                  hidden: Number(m.hidden ?? 0),
                  sortOrder: Number(m.sort_order ?? 0),
                }))
              )
              .onConflictDoNothing();
          }

          if (sqliteRevParts.length > 0) {
            const revValues = sqliteRevParts.map((rp) => ({
              modelId: Number(rp.model_id),
              revisionNumber: Number(rp.revision_number),
              partCode: String(rp.part_code),
              quantity: Number(rp.quantity ?? 1),
            }));
            for (const batch of chunkArray(revValues, 400)) {
              await tx.insert(revisionParts).values(batch);
            }
          }

          if (sqliteFaqs.length > 0) {
            await tx.insert(faqs).values(
              sqliteFaqs.map((f) => ({
                question: String(f.question),
                answer: String(f.answer),
                sortOrder: Number(f.sort_order ?? 0),
              }))
            );
          }

          if (sqliteSettings.length > 0) {
            await tx
              .insert(siteSettings)
              .values(sqliteSettings.map((st) => ({ key: st.key, value: st.value })))
              .onConflictDoNothing();
          }

          if (sqliteInts.length > 0) {
            await tx
              .insert(integrations)
              .values(
                sqliteInts.map((it) => ({
                  key: String(it.key),
                  name: String(it.name),
                  configJson: String(it.config_json),
                  secretValue: String(it.secret_value || ''),
                  active: Number(it.active ?? 1),
                  updatedAt: String(it.updated_at || nowIso),
                }))
              )
              .onConflictDoNothing();
          }

          if (sqliteAdmins.length > 0) {
            await tx
              .insert(admins)
              .values(
                sqliteAdmins.map((a) => ({
                  email: String(a.email).toLowerCase(),
                  passwordHash: String(a.password_hash || hashPassword('Rodaleve@2026')),
                  name: String(a.name || 'Gestor Rodaleve'),
                  role: String(a.role || 'admin'),
                  createdAt: String(a.created_at || nowIso),
                }))
              )
              .onConflictDoNothing();
          }
        });
        await db.execute(
          sql`SELECT setval(pg_get_serial_sequence('models', 'id'), COALESCE((SELECT MAX(id) FROM models), 1), true)`
        );
        seededDone = true;
        return;
      }
    } catch (sqliteErr) {
      console.warn('Skipping optional SQLite seed import, using default seed:', sqliteErr);
    }
  }

  await db.transaction(async (tx) => {
    if (Number(segTotal) === 0) {
      await tx
        .insert(segments)
        .values(
          INITIAL_SEGMENTS.map((s) => ({
            slug: s.slug,
            name: s.name,
            visible: s.visible,
            sortOrder: s.sort_order,
          }))
        )
        .onConflictDoNothing();

      await tx
        .insert(revisionTabs)
        .values(
          INITIAL_REVISION_TABS.map((t) => ({
            revisionNumber: t.revision_number,
            label: t.label,
            subtitle: t.subtitle,
            visible: t.visible,
            sortOrder: t.sort_order,
          }))
        )
        .onConflictDoNothing();

      await tx
        .insert(parts)
        .values(
          INITIAL_PARTS.map((p) => ({
            code: p.code,
            description: p.description,
            unit: p.unit,
            defaultQty: p.default_qty,
            price: p.price,
            mode: p.mode,
            isOptional: p.is_optional,
            microworkPrice: p.microwork_price,
            syncStatus: p.sync_status,
            updatedAt: nowIso,
          }))
        )
        .onConflictDoNothing();

      await tx.insert(partPrices).values(
        INITIAL_PARTS.map((p) => ({
          partCode: p.code,
          price: p.price,
          updatedAt: nowIso,
          source: 'seed',
        }))
      );

      const insertedModels = await tx
        .insert(models)
        .values(
          INITIAL_MODELS.map((m) => ({
            name: m.name,
            segmentSlug: m.segment_slug,
            imageUrl: m.image_url,
            hidden: m.hidden,
            sortOrder: m.sort_order,
          }))
        )
        .returning({ id: models.id });

      const revRows: Array<{
        modelId: number;
        revisionNumber: number;
        partCode: string;
        quantity: number;
      }> = [];
      insertedModels.forEach((row, idx) => {
        const profile = INITIAL_MODELS[idx].profile;
        for (let rev = 1; rev <= 7; rev++) {
          const items = buildRevisionPartsForProfile(profile, rev);
          for (const item of items) {
            revRows.push({
              modelId: row.id,
              revisionNumber: rev,
              partCode: item.part_code,
              quantity: item.quantity,
            });
          }
        }
      });
      for (const batch of chunkArray(revRows, 400)) {
        await tx.insert(revisionParts).values(batch);
      }

      await tx.insert(faqs).values(
        INITIAL_FAQS.map((f, idx) => ({
          question: f.question,
          answer: f.answer,
          sortOrder: idx + 1,
        }))
      );

      await tx
        .insert(siteSettings)
        .values([
          { key: 'seo', value: JSON.stringify(INITIAL_SEO_SETTINGS) },
          { key: 'last_price_sync', value: JSON.stringify({ timestamp: nowIso }) },
        ])
        .onConflictDoNothing();

      await tx
        .insert(integrations)
        .values([
          {
            key: 'google_maps',
            name: 'Google Maps Platform',
            configJson: JSON.stringify({ custom_api_key: '' }),
            secretValue: '',
            active: 1,
            updatedAt: nowIso,
          },
          {
            key: 'microwork',
            name: 'ERP MicroWork',
            configJson: JSON.stringify({
              auto_sync_enabled: true,
              update_mode: 'auto_api',
              endpoint_url: '',
              frequency: 'weekly',
              last_sync_at: nowIso,
              last_sync_result:
                'Catálogo inicial carregado (aguardando endpoint ERP para atualização remota)',
            }),
            secretValue: process.env.MICROWORK_TOKEN || '',
            active: 1,
            updatedAt: nowIso,
          },
          {
            key: 'custom_integrations',
            name: 'Outras chaves e webhooks',
            configJson: JSON.stringify([]),
            secretValue: '',
            active: 1,
            updatedAt: nowIso,
          },
          {
            key: 'tracking_pixels',
            name: 'Pixels, Tags & Rastreamento',
            configJson: JSON.stringify(DEFAULT_TRACKING_PIXELS_CONFIG),
            secretValue: JSON.stringify({ meta_capi_token: '', tiktok_events_token: '' }),
            active: 1,
            updatedAt: nowIso,
          },
        ])
        .onConflictDoNothing();
    }

    if (Number(adminTotal) === 0) {
      await tx
        .insert(admins)
        .values([
          {
            email: 'lazarovictor.rodaleve@gmail.com',
            passwordHash: hashPassword('Rodaleve@2026'),
            name: 'Gestor Rodaleve',
            role: 'superadmin',
            createdAt: nowIso,
          },
          {
            email: 'admin@rodaleve.com.br',
            passwordHash: hashPassword('Rodaleve@2026'),
            name: 'Administração Rodaleve',
            role: 'admin',
            createdAt: nowIso,
          },
        ])
        .onConflictDoNothing();
    }
  });

  seededDone = true;
}

export async function ensureDatabaseSeeded(): Promise<void> {
  if (seededDone) return;
  if (!seedPromise) {
    seedPromise = runInitialSeedIfEmpty().catch((err) => {
      seedPromise = null;
      console.error('Database seed failed:', err);
      throw new Error('Falha ao inicializar dados do banco de dados.', { cause: err });
    });
  }
  await seedPromise;
}

export async function getOrCreateUser(uid: string, email: string, name = '') {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const result = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        name: name.trim(),
        role: 'admin',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: cleanEmail,
          name: name.trim(),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Falha ao registrar sessão do usuário.', { cause: error });
  }
}

export async function findAuthorizedAdminByEmail(email: string) {
  try {
    await ensureDatabaseSeeded();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;
    const rows = await db
      .select()
      .from(admins)
      .where(eq(admins.email, cleanEmail));
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in findAuthorizedAdminByEmail:', error);
    throw new Error('Falha ao verificar permissões administrativas.', { cause: error });
  }
}

export async function getSettingValue(key: string): Promise<string | null> {
  try {
    await ensureDatabaseSeeded();
    const rows = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, key));
    return rows[0]?.value ?? null;
  } catch (error) {
    console.error(`Database query failed in getSettingValue(${key}):`, error);
    throw new Error('Falha ao consultar configurações do site.', { cause: error });
  }
}

export async function upsertSettingValue(key: string, value: string): Promise<void> {
  try {
    await ensureDatabaseSeeded();
    await db
      .insert(siteSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value },
      });
  } catch (error) {
    console.error(`Database query failed in upsertSettingValue(${key}):`, error);
    throw new Error('Falha ao salvar configurações do site.', { cause: error });
  }
}

export async function deleteSettingKey(key: string): Promise<void> {
  try {
    await ensureDatabaseSeeded();
    await db.delete(siteSettings).where(eq(siteSettings.key, key));
  } catch (error) {
    console.error(`Database query failed in deleteSettingKey(${key}):`, error);
    throw new Error('Falha ao remover configuração do site.', { cause: error });
  }
}

export async function getSeoSettings() {
  const raw = await getSettingValue('seo');
  if (!raw) return INITIAL_SEO_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<typeof INITIAL_SEO_SETTINGS>;
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

export async function getVisualBuilderConfig() {
  const raw = await getSettingValue('visual_builder');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function getLastPriceSync(): Promise<string> {
  const raw = await getSettingValue('last_price_sync');
  if (!raw) return new Date().toISOString();
  try {
    return JSON.parse(raw).timestamp || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export async function getIntegrationRow(key: string) {
  try {
    await ensureDatabaseSeeded();
    const rows = await db
      .select()
      .from(integrations)
      .where(eq(integrations.key, key));
    return rows[0] ?? null;
  } catch (error) {
    console.error(`Database query failed in getIntegrationRow(${key}):`, error);
    throw new Error('Falha ao consultar integrações.', { cause: error });
  }
}

async function readRawTrackingPixelsRow() {
  const row = await getIntegrationRow('tracking_pixels');

  let cfg = DEFAULT_TRACKING_PIXELS_CONFIG;
  if (row?.configJson) {
    try {
      const parsed = JSON.parse(row.configJson) as Partial<typeof DEFAULT_TRACKING_PIXELS_CONFIG>;
      cfg = {
        gtm: { ...DEFAULT_TRACKING_PIXELS_CONFIG.gtm, ...(parsed.gtm || {}) },
        ga4: { ...DEFAULT_TRACKING_PIXELS_CONFIG.ga4, ...(parsed.ga4 || {}) },
        google_ads: { ...DEFAULT_TRACKING_PIXELS_CONFIG.google_ads, ...(parsed.google_ads || {}) },
        meta_pixel: { ...DEFAULT_TRACKING_PIXELS_CONFIG.meta_pixel, ...(parsed.meta_pixel || {}) },
        tiktok_pixel: {
          ...DEFAULT_TRACKING_PIXELS_CONFIG.tiktok_pixel,
          ...(parsed.tiktok_pixel || {}),
        },
        google_search_console: {
          ...DEFAULT_TRACKING_PIXELS_CONFIG.google_search_console,
          ...(parsed.google_search_console || {}),
        },
      };
    } catch {
      cfg = DEFAULT_TRACKING_PIXELS_CONFIG;
    }
  }

  let secrets = { meta_capi_token: '', tiktok_events_token: '' };
  if (row?.secretValue) {
    try {
      const parsedSecrets = JSON.parse(row.secretValue) as {
        meta_capi_token?: string;
        tiktok_events_token?: string;
      };
      secrets = {
        meta_capi_token: parsedSecrets.meta_capi_token || '',
        tiktok_events_token: parsedSecrets.tiktok_events_token || '',
      };
    } catch {
      // ignore malformed secret JSON
    }
  }

  return { cfg, secrets };
}

export async function getPublicTrackingConfig() {
  const { cfg } = await readRawTrackingPixelsRow();
  return {
    gtm: {
      enabled: Boolean(cfg.gtm.enabled),
      container_id: String(cfg.gtm.container_id || '').trim(),
    },
    ga4: {
      enabled: Boolean(cfg.ga4.enabled),
      measurement_id: String(cfg.ga4.measurement_id || '').trim(),
    },
    google_ads: {
      enabled: Boolean(cfg.google_ads.enabled),
      ads_id: String(cfg.google_ads.ads_id || '').trim(),
      conversion_label: String(cfg.google_ads.conversion_label || '').trim(),
    },
    meta_pixel: {
      enabled: Boolean(cfg.meta_pixel.enabled),
      pixel_id: String(cfg.meta_pixel.pixel_id || '').trim(),
      domain_verification: String(cfg.meta_pixel.domain_verification || '').trim(),
    },
    tiktok_pixel: {
      enabled: Boolean(cfg.tiktok_pixel.enabled),
      pixel_id: String(cfg.tiktok_pixel.pixel_id || '').trim(),
    },
    google_search_console: {
      verification_code: String(cfg.google_search_console?.verification_code || '').trim(),
    },
  };
}

export async function getAdminTrackingPixelsConfig() {
  const { secrets } = await readRawTrackingPixelsRow();
  const pub = await getPublicTrackingConfig();
  return {
    gtm: pub.gtm,
    ga4: pub.ga4,
    google_ads: pub.google_ads,
    meta_pixel: {
      ...pub.meta_pixel,
      has_capi_token: Boolean(secrets.meta_capi_token),
      capi_token_masked: maskSecret(secrets.meta_capi_token),
    },
    tiktok_pixel: {
      ...pub.tiktok_pixel,
      has_events_token: Boolean(secrets.tiktok_events_token),
      events_token_masked: maskSecret(secrets.tiktok_events_token),
    },
    google_search_console: pub.google_search_console,
  };
}

export async function listAllModelsOrdered() {
  try {
    await ensureDatabaseSeeded();
    return await db
      .select()
      .from(models)
      .orderBy(asc(models.sortOrder), asc(models.id));
  } catch (error) {
    console.error('Database query failed in listAllModelsOrdered:', error);
    throw new Error('Falha ao consultar modelos.', { cause: error });
  }
}

export async function listVisibleModelsOrdered() {
  try {
    await ensureDatabaseSeeded();
    return await db
      .select()
      .from(models)
      .where(eq(models.hidden, 0))
      .orderBy(asc(models.sortOrder), asc(models.id));
  } catch (error) {
    console.error('Database query failed in listVisibleModelsOrdered:', error);
    throw new Error('Falha ao consultar modelos públicos.', { cause: error });
  }
}

export async function listSegmentsOrdered(visibleOnly: boolean) {
  try {
    await ensureDatabaseSeeded();
    if (visibleOnly) {
      return await db
        .select()
        .from(segments)
        .where(eq(segments.visible, 1))
        .orderBy(asc(segments.sortOrder), asc(segments.id));
    }
    return await db
      .select()
      .from(segments)
      .orderBy(asc(segments.sortOrder), asc(segments.id));
  } catch (error) {
    console.error('Database query failed in listSegmentsOrdered:', error);
    throw new Error('Falha ao consultar categorias.', { cause: error });
  }
}

export async function listRevisionTabsOrdered(visibleOnly: boolean) {
  try {
    await ensureDatabaseSeeded();
    if (visibleOnly) {
      return await db
        .select()
        .from(revisionTabs)
        .where(eq(revisionTabs.visible, 1))
        .orderBy(asc(revisionTabs.sortOrder), asc(revisionTabs.revisionNumber));
    }
    return await db
      .select()
      .from(revisionTabs)
      .orderBy(asc(revisionTabs.sortOrder), asc(revisionTabs.revisionNumber));
  } catch (error) {
    console.error('Database query failed in listRevisionTabsOrdered:', error);
    throw new Error('Falha ao consultar abas de revisão.', { cause: error });
  }
}

export async function listPartsOrdered(byDescriptionFirst: boolean) {
  try {
    await ensureDatabaseSeeded();
    if (byDescriptionFirst) {
      return await db
        .select()
        .from(parts)
        .orderBy(asc(parts.description), asc(parts.code));
    }
    return await db.select().from(parts).orderBy(asc(parts.code));
  } catch (error) {
    console.error('Database query failed in listPartsOrdered:', error);
    throw new Error('Falha ao consultar peças.', { cause: error });
  }
}

export async function listRevisionPartsOrdered() {
  try {
    await ensureDatabaseSeeded();
    return await db.select().from(revisionParts).orderBy(asc(revisionParts.id));
  } catch (error) {
    console.error('Database query failed in listRevisionPartsOrdered:', error);
    throw new Error('Falha ao consultar itens de revisão.', { cause: error });
  }
}

export async function listFaqsOrdered() {
  try {
    await ensureDatabaseSeeded();
    return await db
      .select()
      .from(faqs)
      .orderBy(asc(faqs.sortOrder), asc(faqs.id));
  } catch (error) {
    console.error('Database query failed in listFaqsOrdered:', error);
    throw new Error('Falha ao consultar perguntas frequentes.', { cause: error });
  }
}
