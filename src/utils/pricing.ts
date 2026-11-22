import { OilSaleMode, Part, RevisionPart } from '../types';

export function formatBRL(value: number): string {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return safeValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateTimeBR(isoOrText: string): string {
  if (!isoOrText) return '—';
  const d = new Date(isoOrText);
  if (Number.isNaN(d.getTime())) return isoOrText;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeOilLiters(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Number(num.toFixed(3));
}

export function normalizeOilSaleMode(raw: unknown): OilSaleMode {
  return raw === 'closed_bottle_1l' ? 'closed_bottle_1l' : 'exact';
}

export function formatLitersPT(liters: number): string {
  const clean = Number.isFinite(liters) ? Number(liters.toFixed(3)) : 0;
  return clean.toLocaleString('pt-BR', {
    minimumFractionDigits: clean % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 3,
  });
}

export function isEngineOilPart(part: Part | undefined | null): boolean {
  if (!part) return false;
  const normalized = (part.description || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!/\boleo\b/.test(normalized)) return false;
  if (/\b(filtro|anel|or[ -]?ring|arruela|vedacao|junta|bujao)\b/.test(normalized)) {
    return false;
  }
  return true;
}

function getMultiLiterPackVolume(part: Part): number | null {
  if (part.unit !== 'UN') return null;
  const match = /(\d+(?:[.,]\d+)?)\s*l\b/i.exec(part.description || '');
  if (!match) return null;
  const parsed = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 1.05) return null;
  return parsed;
}

export interface OilCalculationMeta {
  isEngineOil: boolean;
  saleMode: OilSaleMode;
  oilLiters: number;
  bottles: number;
  surplusMl: number;
  isPackItem: boolean;
}

export function calculateOilItemLine(
  part: Part,
  revisionQuantity: number,
  modelOilLiters?: number | null,
  modelOilSaleMode?: OilSaleMode | null
): { lineTotal: number; oilMeta?: OilCalculationMeta } {
  if (!isEngineOilPart(part)) {
    return { lineTotal: computeLineTotal(part, revisionQuantity) };
  }

  const configuredLiters = normalizeOilLiters(modelOilLiters);
  const saleMode = normalizeOilSaleMode(modelOilSaleMode);
  const packVolume = getMultiLiterPackVolume(part);

  let effectiveLiters = configuredLiters;
  if (effectiveLiters === null) {
    if (part.unit === 'ML') {
      effectiveLiters = Number((Number(revisionQuantity) / 1000).toFixed(3));
    } else if (packVolume !== null) {
      effectiveLiters = Number((packVolume * Number(revisionQuantity || 1)).toFixed(3));
    } else {
      effectiveLiters = Number(revisionQuantity) || 1;
    }
  }

  if (!Number.isFinite(effectiveLiters) || effectiveLiters <= 0) {
    return { lineTotal: computeLineTotal(part, revisionQuantity) };
  }

  if (packVolume !== null) {
    const baseLine = computeLineTotal(part, revisionQuantity);
    const bottles =
      saleMode === 'closed_bottle_1l'
        ? Math.max(1, Math.ceil(Number((effectiveLiters - 1e-9).toFixed(6))))
        : effectiveLiters;
    const surplusMl =
      saleMode === 'closed_bottle_1l'
        ? Math.max(0, Math.round((bottles - effectiveLiters) * 1000))
        : 0;
    return {
      lineTotal: baseLine,
      oilMeta: {
        isEngineOil: true,
        saleMode,
        oilLiters: effectiveLiters,
        bottles,
        surplusMl,
        isPackItem: true,
      },
    };
  }

  const price = Number(part.price);
  const literUnitPrice =
    part.unit === 'ML' ? (Number.isFinite(price) ? price * 10 : 0) : Number.isFinite(price) ? price : 0;

  if (saleMode === 'closed_bottle_1l') {
    const bottles = Math.max(1, Math.ceil(Number((effectiveLiters - 1e-9).toFixed(6))));
    const surplusMl = Math.max(0, Math.round((bottles - effectiveLiters) * 1000));
    return {
      lineTotal: Number((bottles * literUnitPrice).toFixed(2)),
      oilMeta: {
        isEngineOil: true,
        saleMode,
        oilLiters: effectiveLiters,
        bottles,
        surplusMl,
        isPackItem: false,
      },
    };
  }

  return {
    lineTotal: Number((effectiveLiters * literUnitPrice).toFixed(2)),
    oilMeta: {
      isEngineOil: true,
      saleMode: 'exact',
      oilLiters: effectiveLiters,
      bottles: effectiveLiters,
      surplusMl: 0,
      isPackItem: false,
    },
  };
}

export function formatExactOilQuantity(oilLiters: number): string {
  const ml = Math.round(oilLiters * 1000);
  if (ml < 1000) {
    return `${ml} ml`;
  }
  return `${formatLitersPT(oilLiters)}L (${ml} ml)`;
}

/**
 * Computes line item price.
 * For unit === 'ML' (e.g. 08233M99200 Óleo Motor), part.price is per 100 ml,
 * and quantity is stored in ml (e.g. 1000 ml -> (1000 / 100) * 7.00 = R$ 70,00).
 * For all other units (UN, L, JG, PAR, KIT, G, SRV, or custom), line total is quantity * part.price.
 */
export function computeLineTotal(part: Part, quantity: number): number {
  const qty = Number(quantity);
  const price = Number(part?.price);
  if (!part || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price)) return 0;
  if (part.unit === 'ML') {
    return Number(((qty / 100) * price).toFixed(2));
  }
  return Number((qty * price).toFixed(2));
}

export function formatPartQuantity(part: Part, quantity: number): string {
  const qty = Number.isFinite(Number(quantity)) ? Number(quantity) : 0;
  if (part?.unit === 'ML') {
    const liters = qty / 1000;
    if (qty >= 1000 && qty % 100 === 0) {
      return `${liters.toLocaleString('pt-BR', { minimumFractionDigits: liters % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })}L (${qty} ml)`;
    }
    return `${qty} ml`;
  }
  const unitLabel = (part?.unit || 'UN').toLowerCase();
  return `${qty} ${unitLabel}`;
}

export const FREE_LABOR_MAX_REVISION = 2;

export const LABOR_POLICY_TEXTS = {
  pt: {
    freeBadge: 'Mão de obra gratuita: 1.ª e 2.ª revisão (conforme manual)',
    paidBadge: 'Mão de obra cobrada conforme tabela / manual',
    laborItemLabel: 'Mão de obra (a partir da 3.ª revisão)',
    laborShortLabel: 'Mão de obra',
  },
  en: {
    freeBadge: 'Free labor: 1st & 2nd service (per manual)',
    paidBadge: 'Labor charged per price table / manual',
    laborItemLabel: 'Labor (3rd service onward)',
    laborShortLabel: 'Labor',
  },
  es: {
    freeBadge: 'Mano de obra gratuita: 1.ª y 2.ª revisión (según manual)',
    paidBadge: 'Mano de obra cobrada según tabla / manual',
    laborItemLabel: 'Mano de obra (a partir de la 3.ª revisión)',
    laborShortLabel: 'Mano de obra',
  },
} as const;

export function isFreeLaborRevision(revisionNumber: number): boolean {
  return !Number.isFinite(revisionNumber) || revisionNumber <= FREE_LABOR_MAX_REVISION;
}

export function normalizeLaborPrice(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) return null;
  return Number(num.toFixed(2));
}

export function getLaborBadgeText(
  revisionNumber: number,
  lang: 'pt' | 'en' | 'es' = 'pt'
): string {
  const texts = LABOR_POLICY_TEXTS[lang] || LABOR_POLICY_TEXTS.pt;
  return isFreeLaborRevision(revisionNumber) ? texts.freeBadge : texts.paidBadge;
}

export function comparePartNamesPT(a: string, b: string): number {
  return (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' });
}

export interface ComputedRevisionSummary {
  items: Array<{
    revisionPart: RevisionPart;
    part: Part;
    lineTotal: number;
    oilMeta?: OilCalculationMeta;
  }>;
  partsTotalWithOptionals: number;
  partsTotalWithoutOptionals: number;
  laborCost: number;
  hasDefinedLabor: boolean;
  totalWithOptionals: number;
  totalWithoutOptionals: number;
  oilSurplusNotice: {
    bottles: number;
    oilLiters: number;
    surplusMl: number;
  } | null;
}

export function computeModelRevision(
  modelId: number,
  revisionNumber: number,
  revisionParts: RevisionPart[],
  partsMap: Record<string, Part>,
  laborPrice?: number | null,
  oilConfig?: {
    oilLiters?: number | null;
    oilSaleMode?: OilSaleMode | null;
  }
): ComputedRevisionSummary {
  const safeRevisionParts = Array.isArray(revisionParts) ? revisionParts : [];
  const safePartsMap = partsMap && typeof partsMap === 'object' ? partsMap : {};
  const matching = safeRevisionParts.filter(
    (rp) => rp && rp.model_id === modelId && rp.revision_number === revisionNumber
  );

  let partsTotalWithOptionals = 0;
  let partsTotalWithoutOptionals = 0;
  const items: ComputedRevisionSummary['items'] = [];
  let oilSurplusNotice: ComputedRevisionSummary['oilSurplusNotice'] = null;

  for (const rp of matching) {
    const part = safePartsMap[rp.part_code];
    if (!part) continue;
    const { lineTotal, oilMeta } = calculateOilItemLine(
      part,
      rp.quantity,
      oilConfig?.oilLiters,
      oilConfig?.oilSaleMode
    );
    items.push({ revisionPart: rp, part, lineTotal, oilMeta });
    if (oilMeta && oilMeta.saleMode === 'closed_bottle_1l' && oilMeta.surplusMl > 0) {
      oilSurplusNotice = {
        bottles: oilMeta.bottles,
        oilLiters: oilMeta.oilLiters,
        surplusMl: oilMeta.surplusMl,
      };
    }
    partsTotalWithOptionals += lineTotal;
    if (!part.is_optional) {
      partsTotalWithoutOptionals += lineTotal;
    }
  }

  items.sort((a, b) => {
    const byName = comparePartNamesPT(a.part.description, b.part.description);
    if (byName !== 0) return byName;
    return comparePartNamesPT(a.part.code, b.part.code);
  });

  const normalizedLabor = normalizeLaborPrice(laborPrice);
  const freeLabor = isFreeLaborRevision(revisionNumber);
  const laborCost = !freeLabor && normalizedLabor !== null ? normalizedLabor : 0;

  return {
    items,
    partsTotalWithOptionals: Number(partsTotalWithOptionals.toFixed(2)),
    partsTotalWithoutOptionals: Number(partsTotalWithoutOptionals.toFixed(2)),
    laborCost,
    hasDefinedLabor: normalizedLabor !== null,
    totalWithOptionals: Number((partsTotalWithOptionals + laborCost).toFixed(2)),
    totalWithoutOptionals: Number((partsTotalWithoutOptionals + laborCost).toFixed(2)),
    oilSurplusNotice,
  };
}
