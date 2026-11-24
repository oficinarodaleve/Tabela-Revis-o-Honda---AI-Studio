import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, MapPin, Phone, X } from 'lucide-react';
import { CalculatorContextForWhatsApp, MotoModel, UnitLocation } from '../types';
import { SiteLanguage, UI_TRANSLATIONS, translatePartDescription } from '../utils/i18n';
import {
  ComputedRevisionSummary,
  LABOR_POLICY_TEXTS,
  comparePartNamesPT,
  formatBRL,
  formatLitersPT,
  getLaborBadgeText,
  isFreeLaborRevision,
} from '../utils/pricing';
import { formatKmPT } from '../utils/revisionCalculator';
import {
  buildRodaleveApiWhatsAppUrl,
  buildWhatsAppScheduleMessage,
  downloadAndOpenWhatsApp,
  openExternalLink,
  preloadHtml2Canvas,
} from '../utils/whatsappSchedule';
import { WhatsAppIcon, getUnitWhatsAppNumber } from './WhatsAppIcon';

interface WhatsAppScheduleModalProps {
  model: MotoModel;
  revisionNumber: number;
  revisionLabel: string;
  revisionSubtitle?: string;
  summary: ComputedRevisionSummary;
  initialIncludeOptionals: boolean;
  units: UnitLocation[];
  language?: SiteLanguage;
  darkMode?: boolean;
  calculatorContext?: CalculatorContextForWhatsApp;
  onClose: () => void;
  onTrackLead?: (unitName: string) => void;
}

export function WhatsAppScheduleModal({
  model,
  revisionNumber,
  revisionLabel,
  revisionSubtitle,
  summary,
  initialIncludeOptionals,
  units,
  language = 'pt',
  darkMode = false,
  calculatorContext,
  onClose,
  onTrackLead,
}: WhatsAppScheduleModalProps) {
  const dict = UI_TRANSLATIONS[language];
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    units[0]?.id || 'vitoria-da-conquista'
  );
  const [includeOptionals, setIncludeOptionals] = useState<boolean>(initialIncludeOptionals);
  const [sending, setSending] = useState<boolean>(false);
  const modalCaptureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    preloadHtml2Canvas();
  }, []);

  const hasOptionals = useMemo(
    () => summary.items.some(({ part }) => part.is_optional),
    [summary.items]
  );

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) || units[0],
    [units, selectedUnitId]
  );

  const activeItems = useMemo(
    () =>
      summary.items
        .filter(({ part }) => (includeOptionals ? true : !part.is_optional))
        .sort((a, b) => comparePartNamesPT(a.part.description, b.part.description)),
    [summary.items, includeOptionals]
  );

  const estimatedTotal = includeOptionals
    ? summary.totalWithOptionals
    : summary.totalWithoutOptionals;

  const isFreeLabor = isFreeLaborRevision(revisionNumber);
  const laborTexts = LABOR_POLICY_TEXTS[language] || LABOR_POLICY_TEXTS.pt;
  const laborBadgeText = getLaborBadgeText(revisionNumber, language);

  const handleConfirmSend = async () => {
    if (sending) return;
    const unitSnapshot = units.find((u) => u.id === selectedUnitId) || units[0];

    try {
      onTrackLead?.(unitSnapshot?.city || unitSnapshot?.name || 'Rodaleve');
    } catch {
      // Nunca impede o envio ao WhatsApp caso algum pixel falhe
    }

    setSending(true);
    try {
      await downloadAndOpenWhatsApp({
        captureElement: modalCaptureRef.current,
        darkMode,
        model,
        revisionNumber,
        revisionLabel,
        revisionSubtitle,
        summary,
        includeOptionals,
        unit: unitSnapshot,
        calculatorContext,
      });
    } catch {
      const fallbackMessage = buildWhatsAppScheduleMessage({
        model,
        revisionNumber,
        revisionLabel,
        revisionSubtitle,
        summary,
        includeOptionals,
        unit: unitSnapshot,
        includeDownloadedImageNote: false,
        calculatorContext,
      });
      openExternalLink(
        buildRodaleveApiWhatsAppUrl(fallbackMessage, getUnitWhatsAppNumber(unitSnapshot))
      );
    } finally {
      setSending(false);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (!sending && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalCaptureRef}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-text">
              {dict.modalEyebrow}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-extrabold text-ink">
              {calculatorContext ? calculatorContext.modelLabel : `Honda ${model.name}`} ·{' '}
              {revisionLabel}
            </h3>
            {revisionSubtitle && (
              <p className="text-xs text-ink-muted">
                {revisionSubtitle} ·{' '}
                {isFreeLabor ? dict.modalSubtitleFree : dict.modalSubtitlePaid}
              </p>
            )}
          </div>
          <button
            type="button"
            data-html2canvas-ignore="true"
            disabled={sending}
            onClick={onClose}
            aria-label={dict.modalCloseAria}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Escolha da Unidade */}
          <div>
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink">
              {dict.modalStep1}
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {units.map((unit) => {
                const isSelected = selectedUnit?.id === unit.id;
                const unitWa = getUnitWhatsAppNumber(unit);
                const fullAddress = `${unit.street}${unit.number ? `, ${unit.number}` : ''}${
                  unit.neighborhood ? ` - ${unit.neighborhood}` : ''
                }, ${unit.city} - ${unit.state}`;
                return (
                  <button
                    key={unit.id}
                    type="button"
                    disabled={sending}
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? 'border-brand bg-brand-soft/60 ring-1 ring-brand'
                        : 'border-border bg-card hover:border-ink-muted/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink">
                          {unit.city || unit.name}
                        </span>
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                            isSelected
                              ? 'border-brand bg-brand text-on-brand'
                              : 'border-border'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                      </div>
                      <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-ink-muted">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-brand-text" />
                        <span>{fullAddress}</span>
                      </p>
                    </div>
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-ink-muted tabular-nums">
                      <Phone className="h-3 w-3 text-whatsapp" />
                      WhatsApp: {unitWa}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dados preenchidos da Calculadora de Revisões */}
          {calculatorContext && (
            <div
              className={`rounded-xl border p-3.5 text-xs ${
                calculatorContext.warrantyState === 'overdue'
                  ? 'border-brand/50 bg-brand-soft/60'
                  : calculatorContext.warrantyState === 'warning'
                    ? 'border-amber-500/45 bg-amber-500/10'
                    : 'border-emerald-500/40 bg-emerald-500/10'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold uppercase tracking-wider text-ink">
                  Simulação da Calculadora
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    calculatorContext.warrantyState === 'overdue'
                      ? 'bg-brand text-on-brand'
                      : calculatorContext.warrantyState === 'warning'
                        ? 'bg-amber-600 text-white'
                        : 'bg-emerald-600 text-white'
                  }`}
                >
                  {calculatorContext.warrantyStatusTitle}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-ink-muted tabular-nums">
                <span>
                  <strong className="text-ink">KM atual:</strong>{' '}
                  {formatKmPT(calculatorContext.currentKm)} km
                </span>
                <span>
                  <strong className="text-ink">Data venda:</strong> {calculatorContext.saleDateBR}
                </span>
                <span>
                  <strong className="text-ink">Critério:</strong>{' '}
                  {calculatorContext.criterionLabel}
                </span>
                <span>
                  <strong className="text-ink">Prazo tempo:</strong>{' '}
                  {calculatorContext.targetDateBR}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-ink-muted">
                {calculatorContext.warrantyNotice}
              </p>
            </div>
          )}

          {/* Resumo das Peças + Checkbox Opcionais */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink">
                {dict.modalStep2(activeItems.length)}
              </p>

              {hasOptionals && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-ink">
                  <input
                    type="checkbox"
                    disabled={sending}
                    checked={includeOptionals}
                    onChange={(e) => setIncludeOptionals(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-brand"
                  />
                  {dict.modalIncludeOptionals}
                </label>
              )}
            </div>

            {activeItems.length === 0 ? (
              <p className="mt-3 text-xs text-ink-muted">
                {calculatorContext && !calculatorContext.hasCatalogEstimate
                  ? 'Modelo genérico ou revisão fora da tabela base: nossa equipe confirmará peças e orçamento personalizado no WhatsApp.'
                  : dict.modalNoParts}
              </p>
            ) : (
              <ul
                data-capture-scroll-list="true"
                className="mt-3 max-h-40 space-y-1.5 overflow-y-auto pr-1 text-xs"
              >
                {activeItems.map(({ revisionPart, part, lineTotal, oilMeta }) => {
                  const translatedDesc = translatePartDescription(part.description, language);
                  return (
                    <li
                      key={`${revisionPart.id}-${part.code}`}
                      className="flex items-start justify-between gap-3 text-ink-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate">
                          {translatedDesc}
                          {part.is_optional &&
                          !translatedDesc.includes('[Opcional]') &&
                          !translatedDesc.includes('[Optional]')
                            ? ` ${dict.optionalTag}`
                            : ''}
                        </span>
                        {oilMeta?.isEngineOil &&
                          oilMeta.saleMode === 'closed_bottle_1l' &&
                          oilMeta.surplusMl > 0 && (
                            <span className="block text-[10px] text-ink-muted">
                              {oilMeta.bottles} {oilMeta.bottles === 1 ? 'frasco' : 'frascos'} de 1L (
                              {formatLitersPT(oilMeta.oilLiters)}L no motor + {oilMeta.surplusMl}ml de
                              sobra)
                            </span>
                          )}
                      </span>
                      <span className="shrink-0 font-semibold text-ink tabular-nums">
                        {formatBRL(lineTotal)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {summary.oilSurplusNotice && summary.oilSurplusNotice.surplusMl > 0 && (
              <p className="mt-2.5 rounded-lg border border-border bg-card px-2.5 py-2 text-[11px] leading-snug text-ink-muted">
                Óleo comercializado apenas em frascos fechados de 1L. O excedente (
                {summary.oilSurplusNotice.surplusMl}ml) é entregue ao cliente para reposição.
              </p>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <div>
                {!isFreeLabor && summary.laborCost > 0 && (
                  <p className="mb-1 text-xs font-semibold text-ink tabular-nums">
                    {laborTexts.laborItemLabel}:{' '}
                    <span className="font-bold text-ink">
                      {formatBRL(summary.laborCost)}
                    </span>
                  </p>
                )}
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  {dict.modalEstimatedTotal}
                </p>
                <p className="text-[11px] text-ink-muted">
                  {laborBadgeText}
                </p>
              </div>
              <p className="font-display text-2xl font-extrabold text-brand-text tabular-nums">
                {estimatedTotal > 0 ? formatBRL(estimatedTotal) : 'Sob consulta'}
              </p>
            </div>
          </div>

          {/* Ação final */}
          <div
            data-html2canvas-ignore="true"
            className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
          >
            <button
              type="button"
              disabled={sending}
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-ink hover:bg-surface disabled:opacity-50"
            >
              {dict.modalCancel}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleConfirmSend()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-whatsapp px-5 py-2.5 text-sm font-bold text-on-whatsapp shadow-sm transition-colors hover:bg-whatsapp-hover disabled:cursor-wait disabled:opacity-75"
            >
              <WhatsAppIcon className="h-4 w-4" />
              {sending
                ? dict.generatingQuote
                : dict.modalSendWhatsApp(selectedUnit?.city || 'Rodaleve')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
