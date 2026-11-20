import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  ensureDatabaseSeeded,
  getIntegrationRow,
  getLastPriceSync,
  upsertSettingValue,
} from '../db/repository.ts';
import { integrations, partPrices, parts } from '../db/schema.ts';

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
  await ensureDatabaseSeeded();

  const row = await getIntegrationRow('microwork');
  const config = row
    ? JSON.parse(row.configJson)
    : {
        auto_sync_enabled: true,
        update_mode: 'auto_api',
        endpoint_url: '',
        frequency: 'weekly',
      };

  const token = (row?.secretValue || process.env.MICROWORK_TOKEN || '').trim();
  const endpointUrl = (config.endpoint_url || '').trim();

  const allParts = await db
    .select({ code: parts.code, price: parts.price, mode: parts.mode })
    .from(parts);

  // If no endpoint URL is configured, preserve all last saved prices safely
  if (!endpointUrl) {
    const message = manualTrigger
      ? 'Endpoint MicroWork não configurado. Últimos preços salvos mantidos com segurança.'
      : 'Rotina semanal executada: sem endpoint MicroWork configurado, últimos preços salvos mantidos.';

    await db.transaction(async (tx) => {
      await tx
        .update(parts)
        .set({ syncStatus: 'Manual' })
        .where(eq(parts.mode, 'manual'));
      await tx
        .update(parts)
        .set({ syncStatus: 'Preservado (sem endpoint)' })
        .where(eq(parts.mode, 'auto'));

      const updatedConfig = {
        ...config,
        last_sync_at: nowIso,
        last_sync_result: message,
      };
      await tx
        .update(integrations)
        .set({ configJson: JSON.stringify(updatedConfig), updatedAt: nowIso })
        .where(eq(integrations.key, 'microwork'));
    });

    await upsertSettingValue('last_price_sync', JSON.stringify({ timestamp: nowIso }));

    return {
      success: true,
      timestamp: nowIso,
      updatedCount: 0,
      preservedCount: allParts.length,
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

    await db.transaction(async (tx) => {
      await tx
        .update(parts)
        .set({ syncStatus: 'Manual' })
        .where(eq(parts.mode, 'manual'));
      await tx
        .update(parts)
        .set({ syncStatus: 'Erro MicroWork · preço mantido' })
        .where(eq(parts.mode, 'auto'));

      const updatedConfig = {
        ...config,
        last_sync_at: nowIso,
        last_sync_result: message,
      };
      await tx
        .update(integrations)
        .set({ configJson: JSON.stringify(updatedConfig), updatedAt: nowIso })
        .where(eq(integrations.key, 'microwork'));
    });

    return {
      success: false,
      timestamp: nowIso,
      updatedCount: 0,
      preservedCount: allParts.length,
      message,
    };
  }

  let updatedCount = 0;
  let preservedCount = 0;

  await db.transaction(async (tx) => {
    for (const part of allParts) {
      const mwPrice = remoteMap[normalizeCode(part.code)];
      if (part.mode === 'manual') {
        preservedCount += 1;
        await tx
          .update(parts)
          .set({ microworkPrice: mwPrice ?? null, syncStatus: 'Manual (preservado)' })
          .where(eq(parts.code, part.code));
        continue;
      }

      if (mwPrice && Number.isFinite(mwPrice) && mwPrice > 0) {
        updatedCount += 1;
        await tx
          .update(parts)
          .set({
            price: mwPrice,
            microworkPrice: mwPrice,
            syncStatus: 'Atualizado MicroWork',
            updatedAt: nowIso,
          })
          .where(eq(parts.code, part.code));
        await tx.insert(partPrices).values({
          partCode: part.code,
          price: mwPrice,
          updatedAt: nowIso,
          source: 'microwork',
        });
      } else {
        preservedCount += 1;
        await tx
          .update(parts)
          .set({ microworkPrice: null, syncStatus: 'Não encontrado/zero · mantido' })
          .where(eq(parts.code, part.code));
      }
    }
  });

  const message = `Sincronização concluída: ${updatedCount} atualizada(s), ${preservedCount} preservada(s).`;
  const updatedConfig = {
    ...config,
    last_sync_at: nowIso,
    last_sync_result: message,
  };
  await db
    .update(integrations)
    .set({ configJson: JSON.stringify(updatedConfig), updatedAt: nowIso })
    .where(eq(integrations.key, 'microwork'));
  await upsertSettingValue('last_price_sync', JSON.stringify({ timestamp: nowIso }));

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
      const row = await getIntegrationRow('microwork');
      if (!row) return;
      const cfg = JSON.parse(row.configJson);
      if (!cfg.auto_sync_enabled || cfg.update_mode !== 'auto_api') return;

      const lastSync = new Date(cfg.last_sync_at || (await getLastPriceSync())).getTime();
      const intervalMs =
        cfg.frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
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
