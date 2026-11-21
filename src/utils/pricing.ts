import { Part, RevisionPart } from '../types';

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

export interface ComputedRevisionSummary {
  items: Array<{
    revisionPart: RevisionPart;
    part: Part;
    lineTotal: number;
  }>;
  partsTotalWithOptionals: number;
  partsTotalWithoutOptionals: number;
  laborCost: number;
  hasDefinedLabor: boolean;
  totalWithOptionals: number;
  totalWithoutOptionals: number;
}

export function computeModelRevision(
  modelId: number,
  revisionNumber: number,
  revisionParts: RevisionPart[],
  partsMap: Record<string, Part>,
  laborPrice?: number | null
): ComputedRevisionSummary {
  const safeRevisionParts = Array.isArray(revisionParts) ? revisionParts : [];
  const safePartsMap = partsMap && typeof partsMap === 'object' ? partsMap : {};
  const matching = safeRevisionParts.filter(
    (rp) => rp && rp.model_id === modelId && rp.revision_number === revisionNumber
  );

  let partsTotalWithOptionals = 0;
  let partsTotalWithoutOptionals = 0;
  const items: ComputedRevisionSummary['items'] = [];

  for (const rp of matching) {
    const part = safePartsMap[rp.part_code];
    if (!part) continue;
    const lineTotal = computeLineTotal(part, rp.quantity);
    items.push({ revisionPart: rp, part, lineTotal });
    partsTotalWithOptionals += lineTotal;
    if (!part.is_optional) {
      partsTotalWithoutOptionals += lineTotal;
    }
  }

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
  };
}
