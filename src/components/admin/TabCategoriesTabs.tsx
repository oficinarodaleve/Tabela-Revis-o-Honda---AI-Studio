import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { RevisionTab, Segment } from '../../types';
import { adminFetch } from '../../utils/adminAuth';

interface TabCategoriesTabsProps {
  segments: Segment[];
  revisionTabs: RevisionTab[];
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
}

export function TabCategoriesTabs({
  segments,
  revisionTabs,
  onSaved,
  onToast,
}: TabCategoriesTabsProps) {
  const [segDrafts, setSegDrafts] = useState<Array<{ slug: string; name: string; visible: boolean }>>([]);
  const [tabDrafts, setTabDrafts] = useState<
    Array<{ revision_number: number; label: string; subtitle: string; visible: boolean }>
  >([]);
  const [newSegName, setNewSegName] = useState('');
  const [newRevNumber, setNewRevNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSegDrafts(segments.map((s) => ({ slug: s.slug, name: s.name, visible: s.visible })));
    setTabDrafts(
      revisionTabs.map((t) => ({
        revision_number: t.revision_number,
        label: t.label,
        subtitle: t.subtitle,
        visible: t.visible,
      }))
    );
  }, [segments, revisionTabs]);

  const handleAddSegment = () => {
    if (!newSegName.trim()) return;
    const slug = newSegName
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    if (segDrafts.some((s) => s.slug === slug)) {
      onToast('error', 'Já existe um segmento com este identificador.');
      return;
    }
    setSegDrafts((prev) => [...prev, { slug, name: newSegName.trim(), visible: true }]);
    setNewSegName('');
  };

  const handleAddTab = () => {
    const num = Number(newRevNumber);
    if (!Number.isFinite(num) || num <= 0) {
      onToast('error', 'Informe um número de revisão válido (ex.: 8).');
      return;
    }
    if (tabDrafts.some((t) => t.revision_number === num)) {
      onToast('error', `A ${num}ª revisão já está cadastrada.`);
      return;
    }
    const km = num === 1 ? 1000 : (num - 1) * 6000;
    const months = num * 6;
    setTabDrafts((prev) =>
      [
        ...prev,
        {
          revision_number: num,
          label: `${num}ª Revisão`,
          subtitle: `${km.toLocaleString('pt-BR')} km ou ${months} meses`,
          visible: false,
        },
      ].sort((a, b) => a.revision_number - b.revision_number)
    );
    setNewRevNumber('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: segDrafts, revision_tabs: tabDrafts }),
      });
      if (!res.ok) throw new Error('Erro ao salvar categorias e abas.');
      await onSaved();
      onToast('success', 'Categorias e abas atualizadas no site.');
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-neutral-900">
            Categorias e abas
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Inclua, oculte ou remova os segmentos e as abas de revisão do site.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-[#E4002B] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#C80024] disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      {/* Card Segmentos */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-bold text-neutral-900">Segmentos</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Edite o nome, marque para aparecer no filtro do site ou remova o segmento.
        </p>

        <div className="mt-4 space-y-2.5">
          {segDrafts.map((seg, idx) => (
            <div
              key={seg.slug}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50/50 px-3.5 py-2.5"
            >
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <span className="w-32 font-mono text-xs text-neutral-500">
                  {seg.slug}
                </span>
                <input
                  type="text"
                  value={seg.name}
                  onChange={(e) =>
                    setSegDrafts((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, name: e.target.value } : s))
                    )
                  }
                  className="min-w-[180px] flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 focus:border-[#E4002B] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-neutral-700">
                  <input
                    type="checkbox"
                    checked={seg.visible}
                    onChange={(e) =>
                      setSegDrafts((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, visible: e.target.checked } : s
                        )
                      )
                    }
                    className="h-4 w-4 rounded accent-[#E4002B]"
                  />
                  Visível
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setSegDrafts((prev) => prev.filter((_, i) => i !== idx))
                  }
                  aria-label="Remover segmento"
                  className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-[#E4002B]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-neutral-100 pt-4">
          <input
            type="text"
            value={newSegName}
            onChange={(e) => setNewSegName(e.target.value)}
            placeholder="Novo segmento (ex.: Scooter elétrica)"
            className="min-w-[220px] flex-1 rounded-xl border border-neutral-200 px-3.5 py-2 text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddSegment}
            className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>
      </div>

      {/* Card Abas de revisão */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-bold text-neutral-900">Abas de revisão</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Desmarque para ocultar a aba do site ou use a lixeira para removê-la.
        </p>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {tabDrafts.map((tab, idx) => (
            <div
              key={tab.revision_number}
              className={`inline-flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs ${
                tab.visible
                  ? 'border-[#E4002B]/40 bg-red-50/40 text-neutral-900'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-600'
              }`}
            >
              <label className="inline-flex cursor-pointer items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={tab.visible}
                  onChange={(e) =>
                    setTabDrafts((prev) =>
                      prev.map((t, i) =>
                        i === idx ? { ...t, visible: e.target.checked } : t
                      )
                    )
                  }
                  className="h-4 w-4 rounded accent-[#E4002B]"
                />
                <span>{tab.revision_number}ª</span>
              </label>

              <button
                type="button"
                onClick={() =>
                  setTabDrafts((prev) => prev.filter((_, i) => i !== idx))
                }
                aria-label="Remover aba de revisão"
                className="rounded p-1 text-neutral-400 hover:text-[#E4002B]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-neutral-100 pt-4">
          <input
            type="number"
            min={1}
            value={newRevNumber}
            onChange={(e) => setNewRevNumber(e.target.value)}
            placeholder="Nº da revisão (ex.: 8)"
            className="w-56 rounded-xl border border-neutral-200 px-3.5 py-2 text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddTab}
            className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar aba
          </button>
        </div>
      </div>
    </div>
  );
}
