import { db, getLastPriceSync } from './db.ts';

interface MicroWorkConfigRow {
  config_json: string;
  secret_value: string;
  active: number;
}

interface PartRow {
  code: string;
  price: number;
  mode: string;
}

export interface SyncResult {
  success: boolean;
  timestamp: string;
  updatedCount: number;
  preservedCount: number;
  message: string;
}

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').trim().toUpperCase();
}

export async function syncMicroWorkPrices(manualTrigger = false): Promise<SyncResult> {
  const nowIso = new Date().toISOString();
  const row = db
    .prepare('SELECT config_json, secret_value, active FROM integrations WHERE key = ?')
    .get('microwork') as MicroWorkConfigRow | undefined;

  const config = row
    ? JSON.parse(row.config_json)
    : {
        auto_sync_enabled: true,
        update_mode: 'auto_api',
        endpoint_url: '',
        frequency: 'weekly',
      };

  const token = (row?.secret_value || process.env.MICROWORK_TOKEN || '').trim();
  const endpointUrl = (config.endpoint_url || '').trim();

  const parts = db.prepare('SELECT code, price, mode FROM parts').all() as PartRow[];

  // If no endpoint URL is configured, preserve all last saved prices safely
  if (!endpointUrl) {
    const message = manualTrigger
      ? 'Endpoint MicroWork não configurado. Últimos preços salvos mantidos com segurança.'
      : 'Rotina semanal executada: sem endpoint MicroWork configurado, últimos preços salvos mantidos.';

    db.prepare(
      `UPDATE parts SET sync_status = CASE WHEN mode = 'manual' THEN 'Manual' ELSE 'Preservado (sem endpoint)' END`
    ).run();

    const updatedConfig = {
      ...config,
      last_sync_at: nowIso,
      last_sync_result: message,
    };
    db.prepare('UPDATE integrations SET config_json = ?, updated_at = ? WHERE key = ?').run(
      JSON.stringify(updatedConfig),
      nowIso,
      'microwork'
    );
    db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run(
      'last_price_sync',
      JSON.stringify({ timestamp: nowIso })
    );

    return {
      success: true,
      timestamp: nowIso,
      updatedCount: 0,
      preservedCount: parts.length,
      message,
    };
  }

  let remoteMap: Record<string, number> = {};
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(endpointUrl, { headers, signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ao consultar MicroWork`);
    }

    const payload: unknown = await res.json();
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { items?: unknown[] })?.items)
        ? (payload as { items: unknown[] }).items
        : Array.isArray((payload as { data?: unknown[] })?.data)
          ? (payload as { data: unknown[] }).data
          : [];

    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;
      const rawCode = String(obj.code || obj.codigo || obj.part_code || obj.sku || '');
      const rawPrice = Number(obj.price ?? obj.preco ?? obj.valor ?? obj.unit_price ?? 0);
      if (rawCode && Number.isFinite(rawPrice) && rawPrice > 0) {
        remoteMap[normalizeCode(rawCode)] = Number(rawPrice.toFixed(2));
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Falha na consulta';
    const message = `Falha ao consultar MicroWork (${errMsg}). Últimos preços salvos mantidos.`;
    db.prepare(
      `UPDATE parts SET sync_status = CASE WHEN mode = 'manual' THEN 'Manual' ELSE 'Erro MicroWork · preço mantido' END`
    ).run();

    const updatedConfig = {
      ...config,
      last_sync_at: nowIso,
      last_sync_result: message,
    };
    db.prepare('UPDATE integrations SET config_json = ?, updated_at = ? WHERE key = ?').run(
      JSON.stringify(updatedConfig),
      nowIso,
      'microwork'
    );

    return {
      success: false,
      timestamp: nowIso,
      updatedCount: 0,
      preservedCount: parts.length,
      message,
    };
  }

  let updatedCount = 0;
  let preservedCount = 0;

  const updatePartStmt = db.prepare(
    'UPDATE parts SET price = ?, microwork_price = ?, sync_status = ?, updated_at = ? WHERE code = ?'
  );
  const updateStatusStmt = db.prepare(
    'UPDATE parts SET microwork_price = ?, sync_status = ? WHERE code = ?'
  );
  const insertPriceHistory = db.prepare(
    'INSERT INTO part_prices (part_code, price, updated_at, source) VALUES (?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    for (const part of parts) {
      const mwPrice = remoteMap[normalizeCode(part.code)];
      if (part.mode === 'manual') {
        preservedCount += 1;
        updateStatusStmt.run(mwPrice ?? null, 'Manual (preservado)', part.code);
        continue;
      }

      if (mwPrice && Number.isFinite(mwPrice) && mwPrice > 0) {
        updatedCount += 1;
        updatePartStmt.run(mwPrice, mwPrice, 'Atualizado MicroWork', nowIso, part.code);
        insertPriceHistory.run(part.code, mwPrice, nowIso, 'microwork');
      } else {
        preservedCount += 1;
        updateStatusStmt.run(null, 'Não encontrado/zero · mantido', part.code);
      }
    }
  });
  tx();

  const message = `Sincronização concluída: ${updatedCount} atualizada(s), ${preservedCount} preservada(s).`;
  const updatedConfig = {
    ...config,
    last_sync_at: nowIso,
    last_sync_result: message,
  };
  db.prepare('UPDATE integrations SET config_json = ?, updated_at = ? WHERE key = ?').run(
    JSON.stringify(updatedConfig),
    nowIso,
    'microwork'
  );
  db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run(
    'last_price_sync',
    JSON.stringify({ timestamp: nowIso })
  );

  return {
    success: true,
    timestamp: nowIso,
    updatedCount,
    preservedCount,
    message,
  };
}

export function startWeeklySyncScheduler() {
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  const checkAndRun = async () => {
    try {
      const row = db
        .prepare('SELECT config_json FROM integrations WHERE key = ?')
        .get('microwork') as { config_json: string } | undefined;
      if (!row) return;
      const cfg = JSON.parse(row.config_json);
      if (!cfg.auto_sync_enabled || cfg.update_mode !== 'auto_api') return;

      const lastSync = new Date(cfg.last_sync_at || getLastPriceSync()).getTime();
      const intervalMs = cfg.frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - lastSync >= intervalMs) {
        await syncMicroWorkPrices(false);
      }
    } catch (e) {
      console.error('Erro na rotina periódica MicroWork:', e);
    }
  };

  setInterval(() => {
    void checkAndRun();
  }, SIX_HOURS_MS);
}
