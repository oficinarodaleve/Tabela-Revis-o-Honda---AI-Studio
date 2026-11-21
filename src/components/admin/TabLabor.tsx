import React, { useEffect, useMemo, useState } from 'react';
import { Info, Plus, Save, Search, Trash2, Wrench } from 'lucide-react';
import { MotoModel } from '../../types';
import { adminFetch } from '../../utils/adminAuth';
import { formatBRL, normalizeLaborPrice } from '../../utils/pricing';

interface TabLaborProps {
  models: MotoModel[];
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
  autoSaveEnabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onAutoSaveStart?: () => void;
  onAutoSaveComplete?: () => void;
  onAutoSaveError?: (msg?: string) => void;
}

function formatInputValue(price: number | null | undefined): string {
  const normalized = normalizeLaborPrice(price);
  if (normalized === null) return '';
  return normalized.toFixed(2).replace('.', ',');
}

function parseDraftInput(raw: string): { valid: boolean; value: number | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, value: null };
  const cleaned = trimmed.replace(/[R$\s]/gi, '');
  let normalizedStr = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalizedStr = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalizedStr = cleaned.replace(',', '.');
  }
  const num = Number(normalizedStr);
  if (!Number.isFinite(num) || num < 0) {
    return { valid: false, value: null };
  }
  return { valid: true, value: Number(num.toFixed(2)) };
}

export function TabLabor({
  models,
  onSaved,
  onToast,
  autoSaveEnabled = true,
  onDirtyChange,
  onAutoSaveStart,
  onAutoSaveComplete,
  onAutoSaveError,
}: TabLaborProps) {
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Quick add/update form
  const [quickModelId, setQuickModelId] = useState<number>(() => models[0]?.id ?? 0);
  const [quickValue, setQuickValue] = useState('');
  const [savingQuick, setSavingQuick] = useState(false);

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const m of models) {
      next[m.id] = formatInputValue(m.labor_price);
    }
    setDrafts(next);
    if (models.length > 0 && !models.some((m) => m.id === quickModelId)) {
      setQuickModelId(models[0].id);
    }
  }, [models, quickModelId]);

  const dirtyModelIds = useMemo(() => {
    const dirty: number[] = [];
    for (const m of models) {
      const currentNorm = normalizeLaborPrice(m.labor_price);
      const parsed = parseDraftInput(drafts[m.id] ?? '');
      if (!parsed.valid) {
        dirty.push(m.id);
        continue;
      }
      if (parsed.value !== currentNorm) {
        dirty.push(m.id);
      }
    }
    return dirty;
  }, [models, drafts]);

  useEffect(() => {
    onDirtyChange?.(dirtyModelIds.length > 0);
  }, [dirtyModelIds.length, onDirtyChange]);

  useEffect(() => {
    if (
      !autoSaveEnabled ||
      dirtyModelIds.length === 0 ||
      savingId !== null ||
      deletingId !== null ||
      savingQuick
    ) {
      return;
    }

    const validDirty = dirtyModelIds.filter((id) => parseDraftInput(drafts[id] ?? '').valid);
    if (validDirty.length === 0) return;

    const timer = window.setTimeout(async () => {
      onAutoSaveStart?.();
      try {
        for (const id of validDirty) {
          const parsed = parseDraftInput(drafts[id] ?? '');
          if (!parsed.valid) continue;
          const res =
            parsed.value === null
              ? await adminFetch(`/api/admin/models/${id}/labor`, { method: 'DELETE' })
              : await adminFetch(`/api/admin/models/${id}/labor`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ labor_price: parsed.value }),
                });
          if (!res.ok) {
            throw new Error('Erro ao salvar mão de obra.');
          }
        }
        await onSaved();
        onAutoSaveComplete?.();
      } catch {
        onAutoSaveError?.('Erro ao salvar mão de obra — tente novamente');
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    autoSaveEnabled,
    dirtyModelIds,
    drafts,
    savingId,
    deletingId,
    savingQuick,
    onSaved,
    onAutoSaveStart,
    onAutoSaveComplete,
    onAutoSaveError,
  ]);

  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.segment_slug || '').toLowerCase().includes(q)
    );
  }, [models, search]);

  const activeLaborCount = useMemo(
    () => models.filter((m) => normalizeLaborPrice(m.labor_price) !== null).length,
    [models]
  );

  const handleSaveRow = async (model: MotoModel) => {
    const parsed = parseDraftInput(drafts[model.id] ?? '');
    if (!parsed.valid) {
      onToast('error', `Informe um valor numérico válido para ${model.name}.`);
      return;
    }
    setSavingId(model.id);
    try {
      const res =
        parsed.value === null
          ? await adminFetch(`/api/admin/models/${model.id}/labor`, { method: 'DELETE' })
          : await adminFetch(`/api/admin/models/${model.id}/labor`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ labor_price: parsed.value }),
            });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao salvar valor de mão de obra.');
      }
      await onSaved();
      onToast(
        'success',
        parsed.value === null
          ? `Mão de obra removida para ${model.name}.`
          : `Mão de obra de ${model.name} salva: ${formatBRL(parsed.value)} (3ª+ revisão).`
      );
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao salvar mão de obra.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteRow = async (model: MotoModel) => {
    setDeletingId(model.id);
    try {
      const res = await adminFetch(`/api/admin/models/${model.id}/labor`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao excluir valor de mão de obra.');
      }
      setDrafts((prev) => ({ ...prev, [model.id]: '' }));
      await onSaved();
      onToast('success', `Valor de mão de obra excluído para ${model.name}.`);
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao excluir.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleQuickSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickModelId) {
      onToast('error', 'Selecione um modelo de motocicleta.');
      return;
    }
    const parsed = parseDraftInput(quickValue);
    if (!parsed.valid || parsed.value === null) {
      onToast('error', 'Digite um valor em R$ válido (ex.: 180,00).');
      return;
    }
    setSavingQuick(true);
    try {
      const res = await adminFetch(`/api/admin/models/${quickModelId}/labor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labor_price: parsed.value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao salvar mão de obra.');
      }
      const modelName = models.find((m) => m.id === quickModelId)?.name || 'modelo';
      setQuickValue('');
      await onSaved();
      onToast(
        'success',
        `Mão de obra de ${modelName} atualizada para ${formatBRL(parsed.value)}.`
      );
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Erro ao salvar mão de obra.');
    } finally {
      setSavingQuick(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho e regra operacional */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Mão de Obra por Motocicleta
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Defina o valor fixo da mão de obra por modelo. Aplicado automaticamente nos cards e no orçamento do WhatsApp.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface-neutral px-3.5 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Modelos configurados
            </p>
            <p className="font-display text-base font-extrabold text-ink tabular-nums">
              {activeLaborCount} / {models.length}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface-neutral px-4 py-3 text-xs leading-relaxed text-ink">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-text" />
          <p>
            <strong>Regra de aplicação automática:</strong> O valor cadastrado aplica-se a todas as revisões do modelo,{' '}
            <strong>mas só é somado e cobrado a partir da 3ª revisão</strong>. Na{' '}
            <strong>1ª e 2ª revisão</strong> a mão de obra permanece gratuita conforme o manual Honda.
          </p>
        </div>

        {/* Cadastro / atualização rápida + Busca */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <form
            onSubmit={handleQuickSave}
            className="flex flex-wrap items-end gap-2.5 rounded-xl border border-border bg-surface p-3.5 lg:col-span-8"
          >
            <div className="min-w-[180px] flex-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Modelo da motocicleta
              </label>
              <select
                value={quickModelId}
                onChange={(e) => setQuickModelId(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Valor (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={quickValue}
                onChange={(e) => setQuickValue(e.target.value)}
                placeholder="Ex.: 180,00"
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-ink tabular-nums focus:border-brand focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={savingQuick || models.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {savingQuick ? 'Salvando...' : 'Salvar / Adicionar'}
            </button>
          </form>

          <div className="flex flex-col justify-end lg:col-span-4">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Buscar modelo
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar modelo..."
                className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-xs text-ink focus:border-brand focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de valores por modelo */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <th className="px-5 py-3.5">Modelo</th>
                <th className="px-5 py-3.5">Valor Mão de Obra (3ª+ revisão)</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filteredModels.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-ink-muted">
                    Nenhum modelo encontrado para &ldquo;{search}&rdquo;.
                  </td>
                </tr>
              ) : (
                filteredModels.map((model) => {
                  const savedLabor = normalizeLaborPrice(model.labor_price);
                  const draftStr = drafts[model.id] ?? '';
                  const parsed = parseDraftInput(draftStr);
                  const isActive = savedLabor !== null;
                  const isDirty = dirtyModelIds.includes(model.id);

                  return (
                    <tr key={model.id} className="hover:bg-surface/60">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {model.image_url ? (
                            <img
                              src={model.image_url}
                              alt={model.name}
                              width={44}
                              height={32}
                              className="h-8 w-11 shrink-0 rounded-lg border border-border bg-white object-contain p-0.5"
                            />
                          ) : (
                            <div className="flex h-8 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-neutral text-[10px] font-bold text-ink-muted">
                              Moto
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-ink">{model.name}</p>
                            {isDirty && (
                              <p className="text-[10px] font-semibold text-brand-text">
                                Alteração pendente
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-muted">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Valor de mão de obra para ${model.name}`}
                            value={draftStr}
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [model.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleSaveRow(model);
                              }
                            }}
                            placeholder="0,00"
                            className={`w-32 rounded-xl border px-3 py-1.5 font-semibold text-ink tabular-nums focus:outline-none ${
                              parsed.valid
                                ? 'border-border bg-card focus:border-brand'
                                : 'border-brand bg-brand-soft'
                            }`}
                          />
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {isActive ? (
                          <span className="inline-flex items-center rounded-full border border-brand/25 bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand-text">
                            Ativo (3ª em +) · {formatBRL(savedLabor)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-border bg-surface-neutral px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                            Não definido
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={savingId === model.id || deletingId === model.id || !parsed.valid}
                            onClick={() => void handleSaveRow(model)}
                            className="inline-flex items-center gap-1 rounded-xl bg-ink px-3 py-1.5 text-[11px] font-bold text-on-ink transition-colors hover:bg-brand hover:text-on-brand disabled:opacity-45"
                          >
                            <Save className="h-3 w-3" />
                            {savingId === model.id ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            type="button"
                            disabled={!isActive || deletingId === model.id || savingId === model.id}
                            onClick={() => void handleDeleteRow(model)}
                            title="Remover valor de mão de obra cadastrado"
                            className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-ink-muted transition-colors hover:border-brand/30 hover:bg-brand-soft hover:text-brand-text disabled:opacity-40"
                          >
                            <Trash2 className="h-3 w-3" />
                            {deletingId === model.id ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
