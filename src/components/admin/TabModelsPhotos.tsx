import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { MotoModel, Segment } from '../../types';

interface TabModelsPhotosProps {
  models: MotoModel[];
  segments: Segment[];
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
}

export function TabModelsPhotos({
  models,
  segments,
  onSaved,
  onToast,
}: TabModelsPhotosProps) {
  const [drafts, setDrafts] = useState<Record<number, MotoModel>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputsRef = useRef<Record<number, HTMLInputElement | null>>({});

  // New model form
  const [newName, setNewName] = useState('');
  const [newSegment, setNewSegment] = useState(segments[0]?.slug || 'cub_scooter');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const map: Record<number, MotoModel> = {};
    for (const m of models) map[m.id] = { ...m };
    setDrafts(map);
  }, [models]);

  const updateDraft = (id: number, patch: Partial<MotoModel>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const handleSaveModel = async (id: number) => {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/models/${id}`, {
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
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no upload.');
      const nextModel = { ...drafts[id], image_url: data.url };
      updateDraft(id, { image_url: data.url });

      // Persist immediately so it reflects on the public site
      await fetch(`/api/admin/models/${id}`, {
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
      const res = await fetch(`/api/admin/models/${id}`, { method: 'DELETE' });
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
    setAdding(true);
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          segment_slug: newSegment,
          image_url: '',
          hidden: false,
        }),
      });
      if (!res.ok) throw new Error('Erro ao adicionar modelo.');
      setNewName('');
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
        <h1 className="font-display text-2xl font-bold text-neutral-900">
          Modelos e fotos
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Categoria, foto e visibilidade de cada moto no site.
        </p>
      </div>

      <div className="space-y-2.5">
        {models.map((m) => {
          const draft = drafts[m.id] || m;
          return (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3.5"
            >
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white p-1">
                  {draft.image_url ? (
                    <img
                      src={draft.image_url}
                      alt={draft.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-neutral-300" />
                  )}
                </div>

                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => updateDraft(m.id, { name: e.target.value })}
                  className="min-w-[180px] flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-900 focus:border-[#E4002B] focus:outline-none"
                />

                <select
                  value={draft.segment_slug}
                  onChange={(e) => updateDraft(m.id, { segment_slug: e.target.value })}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 focus:border-[#E4002B] focus:outline-none"
                >
                  {segments.map((seg) => (
                    <option key={seg.slug} value={seg.slug}>
                      {seg.name}
                    </option>
                  ))}
                </select>

                <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs font-medium text-neutral-700">
                  <input
                    type="checkbox"
                    checked={draft.hidden}
                    onChange={(e) => updateDraft(m.id, { hidden: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#E4002B]"
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  {uploadingId === m.id ? 'Enviando...' : 'Foto'}
                </button>

                <button
                  type="button"
                  disabled={savingId === m.id}
                  onClick={() => handleSaveModel(m.id)}
                  className="rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-neutral-800 disabled:opacity-60"
                >
                  {savingId === m.id ? 'Salvando...' : 'Salvar'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteModel(m.id, m.name)}
                  aria-label="Remover modelo"
                  className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-[#E4002B]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Novo modelo */}
      <form
        onSubmit={handleAddModel}
        className="rounded-2xl border border-neutral-200 bg-white p-5"
      >
        <h2 className="text-sm font-bold text-neutral-900">Novo modelo</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex.: CB 500 HORNET"
            className="min-w-[220px] flex-1 rounded-xl border border-neutral-200 px-3.5 py-2 text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
          />
          <select
            value={newSegment}
            onChange={(e) => setNewSegment(e.target.value)}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 focus:border-[#E4002B] focus:outline-none"
          >
            {segments.map((seg) => (
              <option key={seg.slug} value={seg.slug}>
                {seg.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#E4002B] px-4 py-2 text-xs font-bold text-white hover:bg-[#C80024] disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            {adding ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      </form>
    </div>
  );
}
