import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RotateCcw, Save, ShieldAlert, ShieldCheck } from 'lucide-react';
import { CalculatorSettings } from '../../types';
import { adminFetch } from '../../utils/adminAuth';
import { saveGestorDraftCache } from '../../utils/gestorBackup';
import {
  DEFAULT_CALCULATOR_SETTINGS,
  formatKmPT,
  getTargetKmForRevision,
  getTargetMonthsForRevision,
  normalizeCalculatorSettings,
} from '../../utils/revisionCalculator';

interface TabCalculatorProps {
  calculatorSettings: CalculatorSettings;
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
  autoSaveEnabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onAutoSaveStart?: () => void;
  onAutoSaveComplete?: () => void;
  onAutoSaveError?: (msg?: string) => void;
}

export function TabCalculator({
  calculatorSettings,
  onSaved,
  onToast,
  autoSaveEnabled = true,
  onDirtyChange,
  onAutoSaveStart,
  onAutoSaveComplete,
  onAutoSaveError,
}: TabCalculatorProps) {
  const [draft, setDraft] = useState<CalculatorSettings>(() =>
    normalizeCalculatorSettings(calculatorSettings)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(normalizeCalculatorSettings(calculatorSettings));
  }, [calculatorSettings]);

  const normalizedBase = useMemo(
    () => normalizeCalculatorSettings(calculatorSettings),
    [calculatorSettings]
  );

  const normalizedDraft = useMemo(() => normalizeCalculatorSettings(draft), [draft]);

  const isDirty = useMemo(
    () => JSON.stringify(normalizedDraft) !== JSON.stringify(normalizedBase),
    [normalizedDraft, normalizedBase]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!autoSaveEnabled || !isDirty || saving) return;

    const timer = setTimeout(async () => {
      onAutoSaveStart?.();
      saveGestorDraftCache('calculadora', normalizedDraft);
      try {
        const res = await adminFetch('/api/admin/calculator-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizedDraft),
        });
        if (!res.ok) throw new Error('Erro ao salvar configurações da calculadora.');
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
    normalizedDraft,
    onSaved,
    onAutoSaveStart,
    onAutoSaveComplete,
    onAutoSaveError,
  ]);

  const previewMilestones = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const n = i + 1;
        return {
          n,
          km: getTargetKmForRevision(n, normalizedDraft),
          months: getTargetMonthsForRevision(n, normalizedDraft),
        };
      }),
    [normalizedDraft]
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/calculator-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedDraft),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar configurações da calculadora.');
      saveGestorDraftCache('calculadora', normalizedDraft);
      await onSaved();
      onToast('success', 'Parâmetros e textos da Calculadora de Revisões salvos!');
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = async () => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/calculator-settings', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao restaurar padrão da calculadora.');
      setDraft({ ...DEFAULT_CALCULATOR_SETTINGS });
      saveGestorDraftCache('calculadora', DEFAULT_CALCULATOR_SETTINGS);
      await onSaved();
      onToast('success', 'Calculadora restaurada para os parâmetros oficiais Honda.');
    } catch (e) {
      onToast('error', e instanceof Error ? e.message : 'Erro ao restaurar padrão.');
    } finally {
      setSaving(false);
    }
  };

  const updateNumberField = (key: keyof CalculatorSettings, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '');
    const parsed = digits ? Number(digits) : 0;
    setDraft((prev) => ({
      ...prev,
      [key]: parsed,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Calculadora de Revisões</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Configure os prazos, intervalos de quilometragem, textos explicativos e avisos de garantia exibidos na calculadora pública.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleResetDefault()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-neutral disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão Honda
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className={`inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-60 ${
              !autoSaveEnabled && isDirty ? 'ring-2 ring-brand/40 ring-offset-2' : ''
            }`}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {/* Card 1: Regra e Parâmetros Numéricos */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold text-ink">Parâmetros da regra de cálculo</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Define os marcos da 1ª revisão, o passo contínuo da 2ª revisão em diante e a janela de alerta preventivo.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-ink">
              1ª Revisão — Quilometragem (km)
            </label>
            <input
              type="number"
              min={100}
              max={100000}
              value={draft.first_revision_km}
              onChange={(e) => updateNumberField('first_revision_km', e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 font-mono text-sm font-semibold text-ink tabular-nums focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">
              1ª Revisão — Prazo (meses)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={draft.first_revision_months}
              onChange={(e) => updateNumberField('first_revision_months', e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 font-mono text-sm font-semibold text-ink tabular-nums focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">
              Demais revisões (2ª+) — Intervalo KM
            </label>
            <input
              type="number"
              min={500}
              max={100000}
              value={draft.subsequent_km_step}
              onChange={(e) => updateNumberField('subsequent_km_step', e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 font-mono text-sm font-semibold text-ink tabular-nums focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">
              Demais revisões (2ª+) — Intervalo meses
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={draft.subsequent_months_step}
              onChange={(e) => updateNumberField('subsequent_months_step', e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 font-mono text-sm font-semibold text-ink tabular-nums focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">
              Janela preventiva — Antecedência KM
            </label>
            <input
              type="number"
              min={50}
              max={10000}
              value={draft.warning_km_window}
              onChange={(e) => updateNumberField('warning_km_window', e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 font-mono text-sm font-semibold text-ink tabular-nums focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">
              Janela preventiva — Antecedência dias
            </label>
            <input
              type="number"
              min={1}
              max={180}
              value={draft.warning_days_window}
              onChange={(e) => updateNumberField('warning_days_window', e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 font-mono text-sm font-semibold text-ink tabular-nums focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>
        </div>

        {/* Prévia em tempo real dos marcos 1ª a 9ª */}
        <div className="mt-5 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Prévia automática dos marcos gerados (1ª a 9ª revisão)
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {previewMilestones.map((m) => (
              <div
                key={m.n}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs tabular-nums"
              >
                <span className="font-bold text-brand-text">{m.n}ª:</span>{' '}
                <span className="font-semibold text-ink">{formatKmPT(m.km)} km</span>{' '}
                <span className="text-ink-muted">/ {m.months}m</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Card 2: Textos Explicativos */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold text-ink">Textos explicativos no site público</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Personalize o título, subtítulo, selo da regra e orientação da data de venda do manual ou nota fiscal.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-ink">Sobretítulo (Eyebrow)</label>
            <input
              type="text"
              value={draft.eyebrow_text}
              onChange={(e) => setDraft((prev) => ({ ...prev, eyebrow_text: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-medium text-ink focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink">Título principal</label>
            <input
              type="text"
              value={draft.title_text}
              onChange={(e) => setDraft((prev) => ({ ...prev, title_text: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-medium text-ink focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-ink">
              Resumo da regra (canto superior direito)
            </label>
            <input
              type="text"
              value={draft.rule_badge_text}
              onChange={(e) => setDraft((prev) => ({ ...prev, rule_badge_text: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-medium text-ink focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-ink">Subtítulo explicativo</label>
            <textarea
              rows={2}
              value={draft.subtitle_text}
              onChange={(e) => setDraft((prev) => ({ ...prev, subtitle_text: e.target.value }))}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-medium text-ink focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-ink">
              Texto de apoio do campo "Data de venda"
            </label>
            <textarea
              rows={2}
              value={draft.sale_date_help_text}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, sale_date_help_text: e.target.value }))
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-medium text-ink focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Card 3: Avisos de Garantia por Estado */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold text-ink">Avisos de garantia de fábrica (3 estados)</h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          Mensagens exibidas conforme a moto esteja em dia, na janela preventiva ou com revisão vencida.
        </p>

        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <label className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Estado 1 — Em dia / Próxima revisão (Verde)
            </label>
            <textarea
              rows={2}
              value={draft.warranty_ok_text}
              onChange={(e) => setDraft((prev) => ({ ...prev, warranty_ok_text: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-ink focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-amber-500/45 bg-amber-500/10 p-4">
            <label className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Estado 2 — Janela de agendamento / Próxima do vencimento (Laranja)
            </label>
            <textarea
              rows={2}
              value={draft.warranty_warning_text}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, warranty_warning_text: e.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-ink focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-brand/50 bg-brand-soft/60 p-4">
            <label className="flex items-center gap-2 text-xs font-bold text-brand-text">
              <ShieldAlert className="h-4 w-4" />
              Estado 3 — Revisão vencida / Fora do prazo (Vermelho)
            </label>
            <textarea
              rows={3}
              value={draft.warranty_overdue_text}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, warranty_overdue_text: e.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
