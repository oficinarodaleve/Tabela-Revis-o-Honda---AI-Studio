import { Part, RevisionPart } from '../types';

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
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
 * For unit === 'UN', line total is quantity * part.price.
 */
export function computeLineTotal(part: Part, quantity: number): number {
  if (!part || quantity <= 0) return 0;
  if (part.unit === 'ML') {
    return Number(((quantity / 100) * part.price).toFixed(2));
  }
  return Number((quantity * part.price).toFixed(2));
}

export function formatPartQuantity(part: Part, quantity: number): string {
  if (part.unit === 'ML') {
    const liters = quantity / 1000;
    if (quantity >= 1000 && quantity % 100 === 0) {
      return `${liters.toLocaleString('pt-BR', { minimumFractionDigits: liters % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })}L (${quantity} ml)`;
    }
    return `${quantity} ml`;
  }
  return quantity === 1 ? '1 un' : `${quantity} un`;
}

export interface ComputedRevisionSummary {
  items: Array<{
    revisionPart: RevisionPart;
    part: Part;
    lineTotal: number;
  }>;
  totalWithOptionals: number;
  totalWithoutOptionals: number;
}

export function computeModelRevision(
  modelId: number,
  revisionNumber: number,
  revisionParts: RevisionPart[],
  partsMap: Record<string, Part>
): ComputedRevisionSummary {
  const matching = revisionParts.filter(
    (rp) => rp.model_id === modelId && rp.revision_number === revisionNumber
  );

  let totalWithOptionals = 0;
  let totalWithoutOptionals = 0;
  const items: ComputedRevisionSummary['items'] = [];

  for (const rp of matching) {
    const part = partsMap[rp.part_code];
    if (!part) continue;
    const lineTotal = computeLineTotal(part, rp.quantity);
    items.push({ revisionPart: rp, part, lineTotal });
    totalWithOptionals += lineTotal;
    if (!part.is_optional) {
      totalWithoutOptionals += lineTotal;
    }
  }

  return {
    items,
    totalWithOptionals: Number(totalWithOptionals.toFixed(2)),
    totalWithoutOptionals: Number(totalWithoutOptionals.toFixed(2)),
  };
}
