import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Trash2 } from 'lucide-react';
import { Part, PriceMode, STANDARD_PART_UNITS } from '../../types';
import { adminFetch } from '../../utils/adminAuth';
import { formatBRL, formatDateTimeBR } from '../../utils/pricing';

import { saveGestorDraftCache } from '../../utils/gestorBackup';

interface TabPricesPartsProps {
  parts: Part[];
  lastSync: string;
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
  autoSaveEnabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onAutoSaveStart?: () => void;
  onAutoSaveComplete?: () => void;
  onAutoSaveError?: (msg?: string) => void;
}

interface EditablePart extends Part {
  original_code: string;
}

const CUSTOM_UNIT_VALUE = '__CUSTOM__';

function isStandardUnit(unit: string): boolean {
  return (STANDARD_PART_UNITS as readonly string[]).includes(unit);
}

export function TabPricesParts({
  parts,
  lastSync,
  onSaved,
  onToast,
  autoSaveEnabled = true,
  onDirtyChange,
  onAutoSaveStart,
  onAutoSaveComplete,
  onAutoSaveError,
}: TabPricesPartsProps) {
  const [rows, setRows] = useState<EditablePart[]>([]);
  const [customModeByRow, setCustomModeByRow] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [adding, setAdding] = useState(false);

  // New part form
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newUnitSelect, setNewUnitSelect] = useState<string>('UN');
  const [newCustomUnit, setNewCustomUnit] = useState<string>('');
  const [newQty, setNewQty] = useState('1');
  const [newPrice, setNewPrice] = useState('');
  const [newMode, setNewMode] = useState<PriceMode>('auto');
  const [newOptional, setNewOptional] = useState(false);

  useEffect(() => {
    setRows(parts.map((p) => ({ ...p, original_code: p.code })));
    const nextCustomMode: Record<string, boolean> = {};
    for (const p of parts) {
      if (!isStandardUnit(p.unit)) {
        nextCustomMode[p.code] = true;
      }
    }
    setCustomModeByRow(nextCustomMode);
  }, [parts]);

  const isDirty = useMemo(() => {
    if (rows.length !== parts.length) return true;
    return rows.some((r, idx) => {
      const orig = parts[idx];
      if (!orig) return true;
      return (
        r.code !== orig.code ||
        r.description !== orig.description ||
        r.unit !== orig.unit ||
        Number(r.price) !== Number(orig.price) ||
        r.mode !== orig.mode ||
        Boolean(r.is_optional) !== Boolean(orig.is_optional)
      );
    });
  }, [rows, parts]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!autoSaveEnabled || !isDirty || savingBatch) return;
    const allValid = rows.every((r) => r.code.trim() && r.description.trim() && r.unit.trim());
    if (!allValid) return;

    const timer = setTimeout(async () => {
      onAutoSaveStart?.();
      saveGestorDraftCache('precos', rows);
      try {
        const res = await adminFetch('/api/admin/parts/batch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            changes: rows.map((r) => ({
              original_code: r.original_code,
              code: r.code,
              description: r.description,
              unit: r.unit.trim().toUpperCase(),
              price: Number(r.price),
              mode: r.mode,
              is_optional: r.is_optional,
            })),
          }),
        });
        if (!res.ok) throw new Error('Erro ao salvar preços.');
        await onSaved();
        onAutoSaveComplete?.();
      } catch {
        onAutoSaveError?.('Erro ao salvar — tente novamente');
      }
    }, 850);

    return () => clearTimeout(timer);
  }, [
    autoSaveEnabled,
    isDirty,
    savingBatch,
    rows,
    onSaved,
    onAutoSaveStart,
    onAutoSaveComplete,
    onAutoSaveError,
  ]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const updateRow = (originalCode: string, patch: Partial<EditablePart>) => {
    setRows((prev) =>
      prev.map((r) => (r.original_code === originalCode ? { ...r, ...patch } : r))
    );
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await adminFetch('/api/admin/prices/sync', { method: 'POST' });
      const data = await res.json();
      await onSaved();
      onToast(
        data.result?.success === false ? 'error' : 'success',
        data.result?.message || 'Sincronização executada.'
      );
    } catch {
      onToast('error', 'Erro ao sincronizar preços com o MicroWork.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreatePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newDesc.trim()) {
      onToast('error', 'Preencha Código Honda e Descrição.');
      return;
    }

    const effectiveUnit =
      newUnitSelect === CUSTOM_UNIT_VALUE
        ? newCustomUnit.trim().toUpperCase()
        : newUnitSelect;

    if (!effectiveUnit) {
      onToast('error', 'Informe a unidade personalizada (ex.: CX, PCT, CM).');
      return;
    }

    setAdding(true);
    try {
      const res = await adminFetch('/api/admin/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode.trim(),
          description: newDesc.trim(),
          unit: effectiveUnit,
          default_qty: Number(newQty) || 1,
          price: Number(String(newPrice).replace(',', '.')) || 0,
          mode: newMode,
          is_optional: newOptional,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao adicionar peça.');
      setNewCode('');
      setNewDesc('');
      setNewUnitSelect('UN');
      setNewCustomUnit('');
      setNewQty('1');
      setNewPrice('');
      setNewMode('auto');
      setNewOptional(false);
      await onSaved();
      onToast('success', 'Nova peça / insumo adicionada ao catálogo.');
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Erro ao adicionar.');
    } finally {
      setAdding(false);
    }
  };

  const handleSaveBatch = async () => {
    const emptyUnitRow = rows.find((r) => !r.unit.trim());
    if (emptyUnitRow) {
      onToast(
        'error',
        `Informe a unidade personalizada para a peça ${emptyUnitRow.code}.`
      );
      return;
    }

    setSavingBatch(true);
    try {
      const res = await adminFetch('/api/admin/parts/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: rows.map((r) => ({
            original_code: r.original_code,
            code: r.code,
            description: r.description,
            unit: r.unit.trim().toUpperCase(),
            price: Number(r.price),
            mode: r.mode,
            is_optional: r.is_optional,
          })),
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar alterações.');
      await onSaved();
      onToast('success', 'Preços e peças atualizados com sucesso.');
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSavingBatch(false);
    }
  };

  const handleDeletePart = async (code: string) => {
    try {
      const res = await adminFetch(`/api/admin/parts/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao remover peça.');
      await onSaved();
      onToast('success', 'Peça removida do catálogo.');
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Preços das peças
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Origem: MicroWork. Última atualização: {formatDateTimeBR(lastSync)}
          </p>
        </div>

        <button
          type="button"
          disabled={syncing}
          onClick={handleSyncNow}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Atualizando...' : 'Atualizar agora'}
        </button>
      </div>

      {/* Card Nova peça / insumo */}
      <form
        onSubmit={handleCreatePart}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h2 className="text-sm font-bold text-ink">Nova peça / insumo</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="block text-[11px] font-semibold text-ink-muted">
              Código Honda
            </label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="Ex.: 90401KRMR20"
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-ink-muted">
              Descrição da peça
            </label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Ex.: Arruela Plana 12mm"
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted">
              Unidade
            </label>
            <select
              value={newUnitSelect}
              onChange={(e) => setNewUnitSelect(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
            >
              {STANDARD_PART_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u === 'ML' ? 'ML (preço por 100ml)' : u}
                </option>
              ))}
              <option value={CUSTOM_UNIT_VALUE}>Outro...</option>
            </select>
            {newUnitSelect === CUSTOM_UNIT_VALUE && (
              <input
                type="text"
                maxLength={16}
                value={newCustomUnit}
                onChange={(e) => setNewCustomUnit(e.target.value.toUpperCase())}
                placeholder="Ex.: CX, PCT, CM"
                className="mt-1.5 w-full rounded-xl border border-brand/40 bg-brand-soft/60 px-3 py-1.5 font-mono text-xs font-semibold uppercase text-ink placeholder:normal-case focus:border-brand focus:outline-none"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted">
              Qtd. padrão
            </label>
            <input
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink tabular-nums focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink-muted">
              Valor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink tabular-nums focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-muted">Modo:</span>
              <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value as PriceMode)}
                className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink focus:border-brand focus:outline-none"
              >
                <option value="auto">Automático (MicroWork)</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
              <input
                type="checkbox"
                checked={newOptional}
                onChange={(e) => setNewOptional(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-brand"
              />
              Item opcional no orçamento
            </label>
          </div>

          <button
            type="submit"
            disabled={adding}
            className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {adding ? 'Adicionando...' : 'Adicionar Nova Peça / Insumo'}
          </button>
        </div>
      </form>

      {/* Card da tabela */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-4">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código ou nome da peça..."
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-ink-muted tabular-nums">
              {filteredRows.length} de {rows.length} peça(s)
            </span>

            <button
              type="button"
              disabled={!isDirty || savingBatch}
              onClick={handleSaveBatch}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                isDirty
                  ? `bg-brand text-on-brand hover:bg-brand-hover ${
                      !autoSaveEnabled ? 'ring-2 ring-brand/40 ring-offset-2' : ''
                    }`
                  : 'cursor-not-allowed bg-surface-neutral text-ink-muted'
              }`}
            >
              {savingBatch ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-surface text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-3">CÓDIGO</th>
                <th className="px-4 py-3">DESCRIÇÃO</th>
                <th className="px-3 py-3">UN.</th>
                <th className="px-4 py-3 text-right">VALOR (R$)</th>
                <th className="px-3 py-3">MODO</th>
                <th className="px-3 py-3 text-right">MICROWORK</th>
                <th className="px-3 py-3">SITUAÇÃO</th>
                <th className="px-3 py-3 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {filteredRows.map((row) => {
                const isCustom =
                  Boolean(customModeByRow[row.original_code]) || !isStandardUnit(row.unit);
                const selectVal = isCustom ? CUSTOM_UNIT_VALUE : row.unit;

                return (
                  <tr key={row.original_code} className="hover:bg-surface/60">
                    <td className="px-4 py-2.5 align-top">
                      <input
                        type="text"
                        value={row.code}
                        onChange={(e) =>
                          updateRow(row.original_code, { code: e.target.value })
                        }
                        className="w-32 rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-ink focus:border-brand focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) =>
                          updateRow(row.original_code, { description: e.target.value })
                        }
                        className="w-full min-w-[200px] rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-ink focus:border-brand focus:outline-none"
                      />
                      <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-muted">
                        <input
                          type="checkbox"
                          checked={row.is_optional}
                          onChange={(e) =>
                            updateRow(row.original_code, { is_optional: e.target.checked })
                          }
                          className="h-3 w-3 rounded accent-brand"
                        />
                        <span>opcional</span>
                      </label>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex flex-col gap-1">
                        <select
                          value={selectVal}
                          onChange={(e) => {
                            const chosen = e.target.value;
                            if (chosen === CUSTOM_UNIT_VALUE) {
                              setCustomModeByRow((prev) => ({
                                ...prev,
                                [row.original_code]: true,
                              }));
                              if (isStandardUnit(row.unit)) {
                                updateRow(row.original_code, { unit: '' });
                              }
                            } else {
                              setCustomModeByRow((prev) => ({
                                ...prev,
                                [row.original_code]: false,
                              }));
                              updateRow(row.original_code, { unit: chosen });
                            }
                          }}
                          className="w-24 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
                        >
                          {STANDARD_PART_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                          <option value={CUSTOM_UNIT_VALUE}>Outro...</option>
                        </select>
                        {isCustom && (
                          <input
                            type="text"
                            maxLength={16}
                            value={row.unit}
                            onChange={(e) =>
                              updateRow(row.original_code, {
                                unit: e.target.value.toUpperCase(),
                              })
                            }
                            placeholder="Ex.: CX"
                            className="w-24 rounded-lg border border-brand/40 bg-brand-soft/60 px-2 py-1 font-mono text-[11px] font-semibold uppercase text-ink placeholder:normal-case focus:border-brand focus:outline-none"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-top text-right">
                      <div className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1.5">
                        <span className="mr-1.5 text-[11px] font-semibold text-ink-muted">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={row.price}
                          onChange={(e) =>
                            updateRow(row.original_code, { price: Number(e.target.value) })
                          }
                          className="w-20 bg-transparent text-right font-mono text-xs font-semibold text-ink tabular-nums focus:outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <select
                        value={row.mode}
                        onChange={(e) =>
                          updateRow(row.original_code, { mode: e.target.value as PriceMode })
                        }
                        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-ink focus:border-brand focus:outline-none"
                      >
                        <option value="auto">Automático</option>
                        <option value="manual">Manual</option>
                      </select>
                    </td>
                    <td className="px-3 py-3 align-top text-right font-mono text-xs text-ink-muted tabular-nums">
                      {row.microwork_price !== null ? formatBRL(row.microwork_price) : '–'}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-ink-muted">
                      {row.sync_status || '—'}
                    </td>
                    <td className="px-3 py-2.5 align-top text-center">
                      <button
                        type="button"
                        onClick={() => handleDeletePart(row.original_code)}
                        aria-label="Excluir peça"
                        className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-brand-soft hover:text-brand-text"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border/70 bg-surface px-4 py-3 text-xs text-ink-muted">
          Peças em modo manual mantêm o preço salvo e não são sobrescritas pela atualização do MicroWork.
        </div>
      </div>
    </div>
  );
}
