import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Copy, Plus, Save, Trash2 } from 'lucide-react';
import { MotoModel, Part, RevisionPart, RevisionTab } from '../../types';
import { adminFetch } from '../../utils/adminAuth';
import { computeLineTotal, computeModelRevision, formatBRL } from '../../utils/pricing';

import { saveGestorDraftCache } from '../../utils/gestorBackup';

interface TabRevisionsProps {
  models: MotoModel[];
  revisionTabs: RevisionTab[];
  parts: Part[];
  revisionParts: RevisionPart[];
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
  autoSaveEnabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onAutoSaveStart?: () => void;
  onAutoSaveComplete?: () => void;
  onAutoSaveError?: (msg?: string) => void;
}

export function TabRevisions({
  models,
  revisionTabs,
  parts,
  revisionParts,
  onSaved,
  onToast,
  autoSaveEnabled = true,
  onDirtyChange,
  onAutoSaveStart,
  onAutoSaveComplete,
  onAutoSaveError,
}: TabRevisionsProps) {
  const [selectedRev, setSelectedRev] = useState<number>(
    revisionTabs[0]?.revision_number ?? 1
  );
  const [cloneSourceRev, setCloneSourceRev] = useState<number>(
    revisionTabs.find((t) => t.revision_number !== (revisionTabs[0]?.revision_number ?? 1))
      ?.revision_number ?? 1
  );
  const [cloningAll, setCloningAll] = useState(false);

  const [expandedModelId, setExpandedModelId] = useState<number | null>(
    models[0]?.id ?? null
  );
  const [draftItemsByModel, setDraftItemsByModel] = useState<
    Record<number, Array<{ part_code: string; quantity: number }>>
  >({});
  const [addPartCodeByModel, setAddPartCodeByModel] = useState<Record<number, string>>({});
  const [modelCloneSourceByModel, setModelCloneSourceByModel] = useState<Record<number, number>>({});
  const [savingModelId, setSavingModelId] = useState<number | null>(null);

  const partsMap = useMemo(() => {
    const map: Record<string, Part> = {};
    for (const p of parts) map[p.code] = p;
    return map;
  }, [parts]);

  const availableSourceTabs = useMemo(
    () => revisionTabs.filter((t) => t.revision_number !== selectedRev),
    [revisionTabs, selectedRev]
  );

  // Keep a valid default source revision whenever selectedRev changes
  useEffect(() => {
    if (availableSourceTabs.length === 0) return;
    if (!availableSourceTabs.some((t) => t.revision_number === cloneSourceRev)) {
      const prevTab =
        availableSourceTabs.find((t) => t.revision_number === selectedRev - 1) ||
        availableSourceTabs[0];
      setCloneSourceRev(prevTab.revision_number);
    }
  }, [availableSourceTabs, cloneSourceRev, selectedRev]);

  useEffect(() => {
    const next: Record<number, Array<{ part_code: string; quantity: number }>> = {};
    for (const m of models) {
      next[m.id] = revisionParts
        .filter((rp) => rp.model_id === m.id && rp.revision_number === selectedRev)
        .map((rp) => ({ part_code: rp.part_code, quantity: rp.quantity }));
    }
    setDraftItemsByModel(next);
  }, [models, revisionParts, selectedRev]);

  const dirtyModelIds = useMemo(() => {
    const dirty: number[] = [];
    for (const m of models) {
      const draftList = draftItemsByModel[m.id];
      if (!draftList) continue;
      const savedList = revisionParts
        .filter((rp) => rp.model_id === m.id && rp.revision_number === selectedRev)
        .map((rp) => ({ part_code: rp.part_code, quantity: rp.quantity }));
      if (JSON.stringify(draftList) !== JSON.stringify(savedList)) {
        dirty.push(m.id);
      }
    }
    return dirty;
  }, [models, draftItemsByModel, revisionParts, selectedRev]);

  const isDirty = dirtyModelIds.length > 0;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!autoSaveEnabled || dirtyModelIds.length === 0 || savingModelId !== null) return;
    const timer = setTimeout(async () => {
      onAutoSaveStart?.();
      saveGestorDraftCache(`revisoes_rev_${selectedRev}`, draftItemsByModel);
      try {
        for (const modelId of dirtyModelIds) {
          const items = draftItemsByModel[modelId] || [];
          const res = await adminFetch(`/api/admin/revisions/${modelId}/${selectedRev}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
          });
          if (!res.ok) throw new Error('Erro ao salvar revisão.');
        }
        await onSaved();
        onAutoSaveComplete?.();
      } catch {
        onAutoSaveError?.('Erro ao salvar — tente novamente');
      }
    }, 850);
    return () => clearTimeout(timer);
  }, [
    autoSaveEnabled,
    dirtyModelIds,
    draftItemsByModel,
    onAutoSaveStart,
    onAutoSaveComplete,
    onAutoSaveError,
    onSaved,
    savingModelId,
    selectedRev,
  ]);

  const handleCloneRevisionAll = async () => {
    if (availableSourceTabs.length === 0 || cloneSourceRev === selectedRev) return;
    setCloningAll(true);
    try {
      const res = await adminFetch('/api/admin/revisions/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_revision: cloneSourceRev,
          target_revision: selectedRev,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao clonar revisão.');
      await onSaved();
      onToast(
        'success',
        `Dados da ${cloneSourceRev}ª revisão clonados para a ${selectedRev}ª revisão (${data.copied_count} itens).`
      );
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao clonar revisão.');
    } finally {
      setCloningAll(false);
    }
  };

  const handleCloneSingleModel = (modelId: number, modelName: string) => {
    const sourceRev =
      modelCloneSourceByModel[modelId] ??
      availableSourceTabs[0]?.revision_number ??
      cloneSourceRev;
    if (!sourceRev || sourceRev === selectedRev) return;

    const sourceItems = revisionParts
      .filter((rp) => rp.model_id === modelId && rp.revision_number === sourceRev)
      .map((rp) => ({ part_code: rp.part_code, quantity: rp.quantity }));

    setDraftItemsByModel((prev) => ({
      ...prev,
      [modelId]: sourceItems,
    }));
    onToast(
      'success',
      `${sourceItems.length} ${sourceItems.length === 1 ? 'item copiado' : 'itens copiados'} da ${sourceRev}ª revisão para ${modelName}. Clique em Salvar para confirmar.`
    );
  };

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
      const res = await adminFetch(`/api/admin/revisions/${modelId}/${selectedRev}`, {
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
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Peças de cada modelo por revisão
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Escolha a revisão e ajuste as peças e quantidades. Os preços vêm do MicroWork.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
                      ? 'bg-ink text-on-ink'
                      : 'border border-border bg-card text-ink-muted hover:bg-surface-neutral hover:text-ink'
                  }`}
                >
                  {tab.revision_number}ª
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Compact Clone Bar: Copiar de... -> Clonar revisão */}
      {availableSourceTabs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <div className="text-xs text-ink-muted">
            <span className="font-bold text-ink">
              Clonar para a {selectedRev}ª revisão:
            </span>{' '}
            copie rapidamente todas as peças e quantidades de uma revisão existente.
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-ink-muted">
              Copiar de:
            </label>
            <select
              value={cloneSourceRev}
              onChange={(e) => setCloneSourceRev(Number(e.target.value))}
              className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
            >
              {availableSourceTabs.map((tab) => (
                <option key={tab.revision_number} value={tab.revision_number}>
                  {tab.label} ({tab.revision_number}ª)
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={cloningAll}
              onClick={handleCloneRevisionAll}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-1.5 text-xs font-bold text-on-ink transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <Copy className="h-3.5 w-3.5" />
              {cloningAll ? 'Clonando...' : 'Clonar revisão'}
            </button>
          </div>
        </div>
      )}

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

          const modelSourceRev =
            modelCloneSourceByModel[model.id] ??
            availableSourceTabs[0]?.revision_number ??
            cloneSourceRev;

          return (
            <div
              key={model.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <button
                type="button"
                onClick={() => setExpandedModelId(isExpanded ? null : model.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface/70"
              >
                <div>
                  <p className="text-sm font-bold text-ink">{model.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
                    {model.hidden && displayCount === 0
                      ? '0 peças · R$ 0,00 · oculto no site'
                      : `${displayCount} ${displayCount === 1 ? 'peça' : 'peças'} · ${formatBRL(displayTotal)}${model.hidden ? ' · oculto no site' : ''}`}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-ink-muted transition-transform ${
                    isExpanded ? 'rotate-180 text-ink' : ''
                  }`}
                />
              </button>

              {isExpanded && (
                <div className="border-t border-border/70 bg-surface/60 px-5 py-4">
                  {/* Atalho de clonagem rápida deste modelo */}
                  {availableSourceTabs.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
                      <span className="text-[11px] font-semibold text-ink-muted">
                        Atalho para {model.name} ({selectedRev}ª revisão)
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={modelSourceRev}
                          onChange={(e) =>
                            setModelCloneSourceByModel((prev) => ({
                              ...prev,
                              [model.id]: Number(e.target.value),
                            }))
                          }
                          className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-ink focus:border-brand focus:outline-none"
                        >
                          {availableSourceTabs.map((tab) => (
                            <option key={tab.revision_number} value={tab.revision_number}>
                              Copiar da {tab.revision_number}ª revisão
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleCloneSingleModel(model.id, model.name)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-neutral px-2.5 py-1 text-[11px] font-bold text-ink transition-colors hover:bg-border/60"
                        >
                          <Copy className="h-3 w-3 text-brand-text" />
                          Copiar peças
                        </button>
                      </div>
                    </div>
                  )}

                  {items.length === 0 ? (
                    <p className="py-3 text-xs text-ink-muted">
                      Nenhuma peça vinculada a este modelo na {selectedRev}ª revisão.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/70 rounded-xl border border-border bg-card">
                      {items.map((item, idx) => {
                        const part = partsMap[item.part_code];
                        const lineTotal = part ? computeLineTotal(part, item.quantity) : 0;

                        return (
                          <div
                            key={`${item.part_code}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-ink">
                                {part?.description || item.part_code}
                                {part?.is_optional && (
                                  <span className="ml-1.5 text-[11px] font-normal text-ink-muted">
                                    (opcional)
                                  </span>
                                )}
                              </p>
                              <p className="font-mono text-[11px] text-ink-muted">
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
                                  className="w-20 rounded-lg border border-border bg-card px-2.5 py-1.5 text-right text-xs font-semibold text-ink tabular-nums focus:border-brand focus:outline-none"
                                />
                                <span className="min-w-[28px] text-[11px] font-semibold text-ink-muted">
                                  {part?.unit || 'UN'}
                                </span>
                              </div>

                              <span className="w-24 text-right text-xs font-bold text-ink tabular-nums">
                                {formatBRL(lineTotal)}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveItem(model.id, idx)}
                                aria-label="Remover peça"
                                className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-brand-soft hover:text-brand-text"
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
                        className="w-full max-w-sm rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                      >
                        {parts.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.code} — {p.description} ({formatBRL(p.price)}
                            {p.unit === 'ML' ? '/100ml' : `/${p.unit}`})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleAddItem(model.id)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-xs font-semibold text-on-ink transition-opacity hover:opacity-90"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right text-xs tabular-nums">
                        <p className="font-bold text-ink">
                          Total: {formatBRL(totalWithOptionals)}
                        </p>
                        <p className="text-[11px] text-ink-muted">
                          Sem opcionais: {formatBRL(totalWithoutOptionals)}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={savingModelId === model.id}
                        onClick={() => handleSaveModelRevision(model.id)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60 ${
                          !autoSaveEnabled && dirtyModelIds.includes(model.id)
                            ? 'ring-2 ring-brand/40 ring-offset-2'
                            : ''
                        }`}
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
