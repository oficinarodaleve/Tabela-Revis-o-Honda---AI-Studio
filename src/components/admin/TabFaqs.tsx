import React, { useEffect, useMemo, useState } from 'react';
import { GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { FaqItem } from '../../types';
import { adminFetch } from '../../utils/adminAuth';
import { saveGestorDraftCache } from '../../utils/gestorBackup';

interface TabFaqsProps {
  faqs: FaqItem[];
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
  autoSaveEnabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onAutoSaveStart?: () => void;
  onAutoSaveComplete?: () => void;
  onAutoSaveError?: (msg?: string) => void;
}

export function TabFaqs({
  faqs,
  onSaved,
  onToast,
  autoSaveEnabled = true,
  onDirtyChange,
  onAutoSaveStart,
  onAutoSaveComplete,
  onAutoSaveError,
}: TabFaqsProps) {
  const [items, setItems] = useState<Array<{ id: number; question: string; answer: string }>>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })));
  }, [faqs]);

  const isDirty = useMemo(() => {
    const base = faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer }));
    return JSON.stringify(items) !== JSON.stringify(base);
  }, [items, faqs]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!autoSaveEnabled || !isDirty || saving) return;
    const validToAutoSave = items.every((i) => i.question.trim().length > 0 && i.answer.trim().length > 0);
    if (!validToAutoSave) return;

    const timer = setTimeout(async () => {
      onAutoSaveStart?.();
      saveGestorDraftCache('faqs', items);
      try {
        const res = await adminFetch('/api/admin/faqs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ faqs: items }),
        });
        if (!res.ok) throw new Error('Erro ao salvar perguntas.');
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
    saving,
    items,
    onSaved,
    onAutoSaveStart,
    onAutoSaveComplete,
    onAutoSaveError,
  ]);

  const handleUpdate = (idx: number, patch: Partial<{ question: string; answer: string }>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const handleRemove = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now(), question: '', answer: '' },
    ]);
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragIdx(idx);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/faqs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faqs: items }),
      });
      if (!res.ok) throw new Error('Erro ao salvar perguntas.');
      saveGestorDraftCache('faqs', items);
      await onSaved();
      onToast('success', 'Perguntas frequentes salvas e atualizadas no site.');
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
            Perguntas frequentes
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Estas perguntas aparecem na página de dúvidas do site.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className={`inline-flex items-center gap-2 self-start rounded-xl bg-[#E4002B] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#C80024] disabled:opacity-60 ${
            !autoSaveEnabled && isDirty ? 'ring-2 ring-amber-400 ring-offset-2' : ''
          }`}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={`${item.id}-${idx}`}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`rounded-2xl border bg-white p-4 transition-shadow ${
              dragIdx === idx ? 'border-[#E4002B] shadow-md' : 'border-neutral-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                aria-label="Arrastar para reordenar"
                className="mt-2 cursor-grab text-neutral-400 hover:text-neutral-700 active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" />
              </button>

              <div className="flex-1 space-y-2.5">
                <input
                  type="text"
                  value={item.question}
                  onChange={(e) => handleUpdate(idx, { question: e.target.value })}
                  placeholder="Digite a pergunta..."
                  className="w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-sm font-bold text-neutral-900 focus:border-[#E4002B] focus:outline-none"
                />
                <textarea
                  rows={2}
                  value={item.answer}
                  onChange={(e) => handleUpdate(idx, { answer: e.target.value })}
                  placeholder="Digite a resposta objetiva..."
                  className="w-full resize-y rounded-xl border border-neutral-200 px-3.5 py-2 text-xs leading-relaxed text-neutral-700 focus:border-[#E4002B] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => handleRemove(idx)}
                aria-label="Excluir pergunta"
                className="mt-1 rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-[#E4002B]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-neutral-800"
      >
        <Plus className="h-4 w-4" />
        Nova pergunta
      </button>
    </div>
  );
}
