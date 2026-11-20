import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Trash2 } from 'lucide-react';
import { Part, PartUnit, PriceMode } from '../../types';
import { formatBRL, formatDateTimeBR } from '../../utils/pricing';

interface TabPricesPartsProps {
  parts: Part[];
  lastSync: string;
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
}

interface EditablePart extends Part {
  original_code: string;
}

export function TabPricesParts({
  parts,
  lastSync,
  onSaved,
  onToast,
}: TabPricesPartsProps) {
  const [rows, setRows] = useState<EditablePart[]>([]);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [adding, setAdding] = useState(false);

  // New part form
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newUnit, setNewUnit] = useState<PartUnit>('UN');
  const [newQty, setNewQty] = useState('1');
  const [newPrice, setNewPrice] = useState('');
  const [newMode, setNewMode] = useState<PriceMode>('auto');
  const [newOptional, setNewOptional] = useState(false);

  useEffect(() => {
    setRows(parts.map((p) => ({ ...p, original_code: p.code })));
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
      const res = await fetch('/api/admin/prices/sync', { method: 'POST' });
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
    setAdding(true);
    try {
      const res = await fetch('/api/admin/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCode.trim(),
          description: newDesc.trim(),
          unit: newUnit,
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
      setNewUnit('UN');
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
    setSavingBatch(true);
    try {
      const res = await fetch('/api/admin/parts/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          changes: rows.map((r) => ({
            original_code: r.original_code,
            code: r.code,
            description: r.description,
            unit: r.unit,
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
      const res = await fetch(`/api/admin/parts/${encodeURIComponent(code)}`, {
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
          <h1 className="font-display text-2xl font-bold text-neutral-900">
            Preços das peças
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Origem: MicroWork. Última atualização: {formatDateTimeBR(lastSync)}
          </p>
        </div>

        <button
          type="button"
          disabled={syncing}
          onClick={handleSyncNow}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-[#E4002B] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#C80024] disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Atualizando...' : 'Atualizar agora'}
        </button>
      </div>

      {/* Card Nova peça / insumo */}
      <form
        onSubmit={handleCreatePart}
        className="rounded-2xl border border-neutral-200 bg-white p-5"
      >
        <h2 className="text-sm font-bold text-neutral-900">Nova peça / insumo</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-600">
              Código Honda
            </label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="Ex.: 90401KRMR20"
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-neutral-600">
              Descrição da peça
            </label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Ex.: Arruela Plana 12mm"
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600">
              Unidade
            </label>
            <select
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value as PartUnit)}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
            >
              <option value="UN">UN</option>
              <option value="ML">ML (preço por 100ml)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600">
              Qtd. padrão
            </label>
            <input
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900 tabular-nums focus:border-[#E4002B] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-600">
              Valor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0,00"
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-xs text-neutral-900 tabular-nums focus:border-[#E4002B] focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-600">Modo:</span>
              <select
                value={newMode}
                onChange={(e) => setNewMode(e.target.value as PriceMode)}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 focus:border-[#E4002B] focus:outline-none"
              >
                <option value="auto">Automático (MicroWork)</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-neutral-700">
              <input
                type="checkbox"
                checked={newOptional}
                onChange={(e) => setNewOptional(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 accent-[#E4002B]"
              />
              Item opcional no orçamento
            </label>
          </div>

          <button
            type="submit"
            disabled={adding}
            className="rounded-xl bg-[#E4002B] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#C80024] disabled:opacity-60"
          >
            {adding ? 'Adicionando...' : 'Adicionar Nova Peça / Insumo'}
          </button>
        </div>
      </form>

      {/* Card da tabela */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 p-4">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código ou nome da peça..."
              className="w-full rounded-xl border border-neutral-200 py-2 pl-9 pr-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-[#E4002B] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-neutral-500 tabular-nums">
              {filteredRows.length} de {rows.length} peça(s)
            </span>

            <button
              type="button"
              disabled={!isDirty || savingBatch}
              onClick={handleSaveBatch}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                isDirty
                  ? 'bg-[#E4002B] text-white hover:bg-[#C80024]'
                  : 'cursor-not-allowed bg-red-100 text-red-400'
              }`}
            >
              {savingBatch ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/70 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
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
            <tbody className="divide-y divide-neutral-100">
              {filteredRows.map((row) => (
                <tr key={row.original_code} className="hover:bg-neutral-50/60">
                  <td className="px-4 py-2.5 align-top">
                    <input
                      type="text"
                      value={row.code}
                      onChange={(e) =>
                        updateRow(row.original_code, { code: e.target.value })
                      }
                      className="w-32 rounded-lg border border-neutral-200 px-2.5 py-1.5 font-mono text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) =>
                        updateRow(row.original_code, { description: e.target.value })
                      }
                      className="w-full min-w-[200px] rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-900 focus:border-[#E4002B] focus:outline-none"
                    />
                    <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-500">
                      <input
                        type="checkbox"
                        checked={row.is_optional}
                        onChange={(e) =>
                          updateRow(row.original_code, { is_optional: e.target.checked })
                        }
                        className="h-3 w-3 rounded accent-[#E4002B]"
                      />
                      <span>opcional</span>
                    </label>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <select
                      value={row.unit}
                      onChange={(e) =>
                        updateRow(row.original_code, { unit: e.target.value as PartUnit })
                      }
                      className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs font-semibold text-neutral-700 focus:border-[#E4002B] focus:outline-none"
                    >
                      <option value="UN">UN</option>
                      <option value="ML">ML</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5 align-top text-right">
                    <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5">
                      <span className="mr-1.5 text-[11px] font-semibold text-neutral-400">
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
                        className="w-20 text-right font-mono text-xs font-semibold text-neutral-900 tabular-nums focus:outline-none"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <select
                      value={row.mode}
                      onChange={(e) =>
                        updateRow(row.original_code, { mode: e.target.value as PriceMode })
                      }
                      className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 focus:border-[#E4002B] focus:outline-none"
                    >
                      <option value="auto">Automático</option>
                      <option value="manual">Manual</option>
                    </select>
                  </td>
                  <td className="px-3 py-3 align-top text-right font-mono text-xs text-neutral-500 tabular-nums">
                    {row.microwork_price !== null ? formatBRL(row.microwork_price) : '–'}
                  </td>
                  <td className="px-3 py-3 align-top text-xs text-neutral-500">
                    {row.sync_status || '—'}
                  </td>
                  <td className="px-3 py-2.5 align-top text-center">
                    <button
                      type="button"
                      onClick={() => handleDeletePart(row.original_code)}
                      aria-label="Excluir peça"
                      className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-[#E4002B]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-neutral-100 bg-neutral-50/70 px-4 py-3 text-xs text-neutral-500">
          Peças em modo manual mantêm o preço salvo e não são sobrescritas pela atualização do MicroWork.
        </div>
      </div>
    </div>
  );
}
