import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Save, Trash2 } from 'lucide-react';
import { MotoModel, Part, RevisionPart, RevisionTab } from '../../types';
import { computeLineTotal, computeModelRevision, formatBRL } from '../../utils/pricing';

interface TabRevisionsProps {
  models: MotoModel[];
  revisionTabs: RevisionTab[];
  parts: Part[];
  revisionParts: RevisionPart[];
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
}

export function TabRevisions({
  models,
  revisionTabs,
  parts,
  revisionParts,
  onSaved,
  onToast,
}: TabRevisionsProps) {
  const [selectedRev, setSelectedRev] = useState<number>(
    revisionTabs[0]?.revision_number ?? 1
  );
  const [expandedModelId, setExpandedModelId] = useState<number | null>(
    models[0]?.id ?? null
  );
  const [draftItemsByModel, setDraftItemsByModel] = useState<
    Record<number, Array<{ part_code: string; quantity: number }>>
  >({});
  const [addPartCodeByModel, setAddPartCodeByModel] = useState<Record<number, string>>({});
  const [savingModelId, setSavingModelId] = useState<number | null>(null);

  const partsMap = useMemo(() => {
    const map: Record<string, Part> = {};
    for (const p of parts) map[p.code] = p;
    return map;
  }, [parts]);

  useEffect(() => {
    const next: Record<number, Array<{ part_code: string; quantity: number }>> = {};
    for (const m of models) {
      next[m.id] = revisionParts
        .filter((rp) => rp.model_id === m.id && rp.revision_number === selectedRev)
        .map((rp) => ({ part_code: rp.part_code, quantity: rp.quantity }));
    }
    setDraftItemsByModel(next);
  }, [models, revisionParts, selectedRev]);

  const handleQuantityChange = (modelId: number, idx: number, qty: number) => {
    setDraftItemsByModel((prev) => {
      const list = [...(prev[modelId] || [])];
      list[idx] = { ...list[idx], quantity: Math.max(0, qty) };
      return { ...prev, [modelId]: list };
    });
  };

  const handleRemoveItem = (modelId: number, idx: number) => {
    setDraftItemsByModel((prev) => {
      const list = [...(prev[modelId] || [])];
      list.splice(idx, 1);
      return { ...prev, [modelId]: list };
    });
  };

  const handleAddItem = (modelId: number) => {
    const chosenCode = addPartCodeByModel[modelId] || parts[0]?.code;
    if (!chosenCode) return;
    const partObj = partsMap[chosenCode];
    const defaultQty = partObj?.default_qty ?? (partObj?.unit === 'ML' ? 1000 : 1);

    setDraftItemsByModel((prev) => {
      const list = [...(prev[modelId] || [])];
      list.push({ part_code: chosenCode, quantity: defaultQty });
      return { ...prev, [modelId]: list };
    });
  };

  const handleSaveModelRevision = async (modelId: number) => {
    setSavingModelId(modelId);
    try {
      const items = draftItemsByModel[modelId] || [];
      const res = await fetch(`/api/admin/revisions/${modelId}/${selectedRev}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar revisão');
      }
      await onSaved();
      onToast('success', 'Peças da revisão salvas e atualizadas no site.');
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSavingModelId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + Revision Tabs */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-neutral-900">
            Peças de cada modelo por revisão
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Escolha a revisão e ajuste as peças e quantidades. Os preços vêm do MicroWork.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {revisionTabs.map((tab) => {
            const active = selectedRev === tab.revision_number;
            return (
              <button
                key={tab.revision_number}
                type="button"
                onClick={() => setSelectedRev(tab.revision_number)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
                  active
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {tab.revision_number}ª
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {models.map((model) => {
          const isExpanded = expandedModelId === model.id;
          const items = draftItemsByModel[model.id] || [];

          let totalWithOptionals = 0;
          let totalWithoutOptionals = 0;
          for (const item of items) {
            const p = partsMap[item.part_code];
            if (!p) continue;
            const line = computeLineTotal(p, item.quantity);
            totalWithOptionals += line;
            if (!p.is_optional) totalWithoutOptionals += line;
          }

          const savedSummary = computeModelRevision(
            model.id,
            selectedRev,
            revisionParts,
            partsMap
          );
          const displayCount = isExpanded ? items.length : savedSummary.items.length;
          const displayTotal = isExpanded
            ? totalWithOptionals
            : savedSummary.totalWithOptionals;

          return (
            <div
              key={model.id}
              className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
            >
              <button
                type="button"
                onClick={() => setExpandedModelId(isExpanded ? null : model.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-neutral-50/70"
              >
                <div>
                  <p className="text-sm font-bold text-neutral-900">{model.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">
                    {model.hidden && displayCount === 0
                      ? '0 peças · R$ 0,00 · oculto no site'
                      : `${displayCount} ${displayCount === 1 ? 'peça' : 'peças'} · ${formatBRL(displayTotal)}${model.hidden ? ' · oculto no site' : ''}`}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform ${
                    isExpanded ? 'rotate-180 text-neutral-900' : ''
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-neutral-100 bg-neutral-50/40 px-5 py-4">
                  {items.length === 0 ? (
                    <p className="py-3 text-xs text-neutral-500">
                      Nenhuma peça vinculada a este modelo na {selectedRev}ª revisão.
                    </p>
                  ) : (
                    <div className="divide-y divide-neutral-200/70 rounded-xl border border-neutral-200 bg-white">
                      {items.map((item, idx) => {
                        const part = partsMap[item.part_code];
                        const lineTotal = part ? computeLineTotal(part, item.quantity) : 0;

                        return (
                          <div
                            key={`${item.part_code}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-neutral-900">
                                {part?.description || item.part_code}
                                {part?.is_optional && (
                                  <span className="ml-1.5 text-[11px] font-normal text-neutral-500">
                                    (opcional)
                                  </span>
                                )}
                              </p>
                              <p className="font-mono text-[11px] text-neutral-400">
                                {item.part_code} · Unitário:{' '}
                                {part ? formatBRL(part.price) : 'R$ 0,00'}
                                {part?.unit === 'ML' ? ' / 100ml' : ''}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  step={part?.unit === 'ML' ? 100 : 1}
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleQuantityChange(model.id, idx, Number(e.target.value))
                                  }
                                  className="w-20 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-right text-xs font-semibold text-neutral-900 tabular-nums focus:border-[#E4002B] focus:outline-none"
                                />
                                <span className="w-7 text-[11px] font-semibold text-neutral-500">
                                  {part?.unit || 'UN'}
                                </span>
                              </div>

                              <span className="w-24 text-right text-xs font-bold text-neutral-900 tabular-nums">
                                {formatBRL(lineTotal)}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveItem(model.id, idx)}
                                aria-label="Remover peça"
                                className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-[#E4002B]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Part Row + Save */}
                  <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-2">
                      <select
                        value={addPartCodeByModel[model.id] || parts[0]?.code || ''}
                        onChange={(e) =>
                          setAddPartCodeByModel((prev) => ({
                            ...prev,
                            [model.id]: e.target.value,
                          }))
                        }
                        className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
                      >
                        {parts.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.code} — {p.description} ({formatBRL(p.price)}
                            {p.unit === 'ML' ? '/100ml' : ''})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleAddItem(model.id)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right text-xs tabular-nums">
                        <p className="font-bold text-neutral-900">
                          Total: {formatBRL(totalWithOptionals)}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          Sem opcionais: {formatBRL(totalWithoutOptionals)}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={savingModelId === model.id}
                        onClick={() => handleSaveModelRevision(model.id)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#E4002B] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#C80024] disabled:opacity-60"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {savingModelId === model.id ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
