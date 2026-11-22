import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Droplets, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { MotoModel, OilSaleMode, Segment } from '../../types';
import { adminFetch } from '../../utils/adminAuth';
import { saveGestorDraftCache } from '../../utils/gestorBackup';
import { formatLitersPT } from '../../utils/pricing';

interface TabModelsPhotosProps {
  models: MotoModel[];
  segments: Segment[];
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
  autoSaveEnabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onAutoSaveStart?: () => void;
  onAutoSaveComplete?: () => void;
  onAutoSaveError?: (msg?: string) => void;
}

export function TabModelsPhotos({
  models,
  segments,
  onSaved,
  onToast,
  autoSaveEnabled = true,
  onDirtyChange,
  onAutoSaveStart,
  onAutoSaveComplete,
  onAutoSaveError,
}: TabModelsPhotosProps) {
  const [drafts, setDrafts] = useState<Record<number, MotoModel>>({});
  const [oilLitersTextById, setOilLitersTextById] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputsRef = useRef<Record<number, HTMLInputElement | null>>({});

  // New model form
  const [newName, setNewName] = useState('');
  const [newSegment, setNewSegment] = useState(segments[0]?.slug || 'cub_scooter');
  const [newOilLiters, setNewOilLiters] = useState('');
  const [newOilSaleMode, setNewOilSaleMode] = useState<OilSaleMode>('exact');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const map: Record<number, MotoModel> = {};
    const oilTextMap: Record<number, string> = {};
    for (const m of models) {
      map[m.id] = {
        ...m,
        oil_liters: m.oil_liters ?? null,
        oil_sale_mode: m.oil_sale_mode === 'closed_bottle_1l' ? 'closed_bottle_1l' : 'exact',
      };
      oilTextMap[m.id] =
        m.oil_liters !== null && m.oil_liters !== undefined ? String(m.oil_liters) : '';
    }
    setDrafts(map);
    setOilLitersTextById(oilTextMap);
  }, [models]);

  const dirtyModelIds = useMemo(() => {
    const dirty: number[] = [];
    for (const m of models) {
      const d = drafts[m.id];
      if (!d) continue;
      const origLiters = m.oil_liters ?? null;
      const draftLiters = d.oil_liters ?? null;
      const origMode = m.oil_sale_mode === 'closed_bottle_1l' ? 'closed_bottle_1l' : 'exact';
      const draftMode = d.oil_sale_mode === 'closed_bottle_1l' ? 'closed_bottle_1l' : 'exact';
      if (
        d.name !== m.name ||
        d.segment_slug !== m.segment_slug ||
        d.image_url !== m.image_url ||
        Boolean(d.hidden) !== Boolean(m.hidden) ||
        draftLiters !== origLiters ||
        draftMode !== origMode
      ) {
        dirty.push(m.id);
      }
    }
    return dirty;
  }, [models, drafts]);

  useEffect(() => {
    onDirtyChange?.(dirtyModelIds.length > 0);
  }, [dirtyModelIds.length, onDirtyChange]);

  useEffect(() => {
    if (!autoSaveEnabled || dirtyModelIds.length === 0 || savingId !== null || uploadingId !== null) {
      return;
    }
    const timer = setTimeout(async () => {
      onAutoSaveStart?.();
      saveGestorDraftCache('modelos', drafts);
      try {
        let savedAny = false;
        for (const id of dirtyModelIds) {
          const draft = drafts[id];
          if (!draft?.name?.trim()) continue;
          const res = await adminFetch(`/api/admin/models/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft),
          });
          if (!res.ok) throw new Error('Erro ao salvar modelo.');
          savedAny = true;
        }
        if (savedAny) {
          await onSaved();
          onAutoSaveComplete?.();
        }
      } catch {
        onAutoSaveError?.('Erro ao salvar — tente novamente');
      }
    }, 850);
    return () => clearTimeout(timer);
  }, [
    autoSaveEnabled,
    dirtyModelIds,
    drafts,
    onAutoSaveStart,
    onAutoSaveComplete,
    onAutoSaveError,
    onSaved,
    savingId,
    uploadingId,
  ]);

  const updateDraft = (id: number, patch: Partial<MotoModel>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const handleOilLitersChange = (id: number, rawInput: string) => {
    setOilLitersTextById((prev) => ({ ...prev, [id]: rawInput }));
    const normalized = rawInput.replace(',', '.').trim();
    if (!normalized) {
      updateDraft(id, { oil_liters: null });
      return;
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed > 0) {
      updateDraft(id, { oil_liters: Number(parsed.toFixed(3)) });
    }
  };

  const handleSaveModel = async (id: number) => {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    try {
      const res = await adminFetch(`/api/admin/models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error('Erro ao salvar modelo.');
      await onSaved();
      onToast('success', `Modelo ${draft.name} atualizado.`);
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSavingId(null);
    }
  };

  const handleUploadPhoto = async (id: number, file: File) => {
    setUploadingId(id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await adminFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no upload.');
      const nextModel = { ...drafts[id], image_url: data.url };
      updateDraft(id, { image_url: data.url });

      // Persist immediately so it reflects on the public site
      await adminFetch(`/api/admin/models/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextModel),
      });
      await onSaved();
      onToast('success', 'Foto enviada e vinculada ao modelo.');
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao enviar foto.');
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeleteModel = async (id: number, name: string) => {
    try {
      const res = await adminFetch(`/api/admin/models/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir modelo.');
      await onSaved();
      onToast('success', `Modelo ${name} removido.`);
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao excluir.');
    }
  };

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      onToast('error', 'Informe o nome do novo modelo.');
      return;
    }
    const parsedOil = Number(newOilLiters.replace(',', '.').trim());
    const validOilLiters =
      newOilLiters.trim() && Number.isFinite(parsedOil) && parsedOil > 0
        ? Number(parsedOil.toFixed(3))
        : null;

    setAdding(true);
    try {
      const res = await adminFetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          segment_slug: newSegment,
          image_url: '',
          hidden: false,
          oil_liters: validOilLiters,
          oil_sale_mode: newOilSaleMode,
        }),
      });
      if (!res.ok) throw new Error('Erro ao adicionar modelo.');
      setNewName('');
      setNewOilLiters('');
      setNewOilSaleMode('exact');
      await onSaved();
      onToast('success', 'Novo modelo cadastrado.');
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao adicionar.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Modelos e fotos
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Categoria, foto, visibilidade e regras de cálculo do óleo de cada moto no site.
        </p>
      </div>

      <div className="space-y-2.5">
        {models.map((m) => {
          const draft = drafts[m.id] || m;
          const oilText = oilLitersTextById[m.id] ?? (draft.oil_liters != null ? String(draft.oil_liters) : '');
          const oilSaleMode: OilSaleMode =
            draft.oil_sale_mode === 'closed_bottle_1l' ? 'closed_bottle_1l' : 'exact';
          const effectiveLiters =
            draft.oil_liters !== null && draft.oil_liters !== undefined && draft.oil_liters > 0
              ? draft.oil_liters
              : null;
          const previewBottles =
            effectiveLiters !== null
              ? Math.max(1, Math.ceil(Number((effectiveLiters - 1e-9).toFixed(6))))
              : null;
          const previewSurplusMl =
            effectiveLiters !== null && previewBottles !== null
              ? Math.max(0, Math.round((previewBottles - effectiveLiters) * 1000))
              : 0;

          return (
            <div
              key={m.id}
              className="space-y-3 rounded-2xl border border-border bg-card p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-1">
                    {draft.image_url ? (
                      <img
                        src={draft.image_url}
                        alt={draft.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-ink-muted" />
                    )}
                  </div>

                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => updateDraft(m.id, { name: e.target.value })}
                    className="min-w-[180px] flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-ink focus:border-brand focus:outline-none"
                  />

                  <select
                    value={draft.segment_slug}
                    onChange={(e) => updateDraft(m.id, { segment_slug: e.target.value })}
                    className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
                  >
                    {segments.map((seg) => (
                      <option key={seg.slug} value={seg.slug}>
                        {seg.name}
                      </option>
                    ))}
                  </select>

                  <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={draft.hidden}
                      onChange={(e) => updateDraft(m.id, { hidden: e.target.checked })}
                      className="h-4 w-4 rounded accent-brand"
                    />
                    Ocultar no site
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => {
                      fileInputsRef.current[m.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadPhoto(m.id, f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploadingId === m.id}
                    onClick={() => fileInputsRef.current[m.id]?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-neutral"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    {uploadingId === m.id ? 'Enviando...' : 'Foto'}
                  </button>

                  <button
                    type="button"
                    disabled={savingId === m.id}
                    onClick={() => handleSaveModel(m.id)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold disabled:opacity-60 ${
                      !autoSaveEnabled && dirtyModelIds.includes(m.id)
                        ? 'bg-brand text-on-brand ring-2 ring-brand/40 ring-offset-2 hover:bg-brand-hover'
                        : 'bg-ink text-on-ink hover:opacity-90'
                    }`}
                  >
                    {savingId === m.id ? 'Salvando...' : 'Salvar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteModel(m.id, m.name)}
                    aria-label="Remover modelo"
                    className="rounded-xl p-2 text-ink-muted hover:bg-brand-soft hover:text-brand-text"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Controle do Óleo do Motor */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-surface/65 px-3 py-2.5">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink">
                  <Droplets className="h-3.5 w-3.5 text-brand-text" />
                  <span>Óleo do Motor:</span>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-ink">
                  <span className="text-[11px] text-ink-muted">
                    Quantidade de óleo no motor (Litros):
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Ex: 0.9, 2.7, 4.2"
                    value={oilText}
                    onChange={(e) => handleOilLitersChange(m.id, e.target.value)}
                    className="w-28 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-ink tabular-nums focus:border-brand focus:outline-none"
                  />
                </label>

                <label className="flex flex-1 min-w-[240px] items-center gap-2 text-xs font-medium text-ink">
                  <span className="shrink-0 text-[11px] text-ink-muted">
                    Modo de venda do óleo:
                  </span>
                  <select
                    value={oilSaleMode}
                    onChange={(e) =>
                      updateDraft(m.id, {
                        oil_sale_mode:
                          e.target.value === 'closed_bottle_1l' ? 'closed_bottle_1l' : 'exact',
                      })
                    }
                    className="w-full max-w-[270px] rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
                  >
                    <option value="exact">Exato (por litro/ml utilizado)</option>
                    <option value="closed_bottle_1l">Apenas frasco fechado de 1L</option>
                  </select>
                </label>

                {oilSaleMode === 'closed_bottle_1l' && effectiveLiters !== null && previewBottles !== null && (
                  <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-text tabular-nums">
                    {previewBottles} {previewBottles === 1 ? 'frasco' : 'frascos'} de 1L (
                    {formatLitersPT(effectiveLiters)}L no motor
                    {previewSurplusMl > 0 ? ` + ${previewSurplusMl}ml de sobra` : ''})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Novo modelo */}
      <form
        onSubmit={handleAddModel}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h2 className="text-sm font-bold text-ink">Novo modelo</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex.: CB 500 HORNET"
            className="min-w-[200px] flex-1 rounded-xl border border-border bg-card px-3.5 py-2 text-xs text-ink focus:border-brand focus:outline-none"
          />
          <select
            value={newSegment}
            onChange={(e) => setNewSegment(e.target.value)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
          >
            {segments.map((seg) => (
              <option key={seg.slug} value={seg.slug}>
                {seg.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="any"
            value={newOilLiters}
            onChange={(e) => setNewOilLiters(e.target.value)}
            placeholder="Óleo (L) ex: 1.0"
            aria-label="Quantidade de óleo no motor (Litros)"
            className="w-32 rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink tabular-nums focus:border-brand focus:outline-none"
          />
          <select
            value={newOilSaleMode}
            onChange={(e) =>
              setNewOilSaleMode(
                e.target.value === 'closed_bottle_1l' ? 'closed_bottle_1l' : 'exact'
              )
            }
            aria-label="Modo de venda do óleo"
            className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
          >
            <option value="exact">Exato (por litro/ml utilizado)</option>
            <option value="closed_bottle_1l">Apenas frasco fechado de 1L</option>
          </select>
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            {adding ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      </form>
    </div>
  );
}
