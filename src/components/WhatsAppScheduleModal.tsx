import React, { useMemo, useState } from 'react';
import { Check, MapPin, Phone, X } from 'lucide-react';
import { MotoModel, UnitLocation } from '../types';
import { SiteLanguage, UI_TRANSLATIONS, translatePartDescription } from '../utils/i18n';
import { ComputedRevisionSummary, formatBRL, formatPartQuantity } from '../utils/pricing';
import { WhatsAppIcon, buildWhatsAppHref, getUnitWhatsAppNumber } from './WhatsAppIcon';

interface WhatsAppScheduleModalProps {
  model: MotoModel;
  revisionNumber: number;
  revisionLabel: string;
  revisionSubtitle?: string;
  summary: ComputedRevisionSummary;
  initialIncludeOptionals: boolean;
  units: UnitLocation[];
  language?: SiteLanguage;
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
  onClose,
  onTrackLead,
}: WhatsAppScheduleModalProps) {
  const dict = UI_TRANSLATIONS[language];
  const [selectedUnitId, setSelectedUnitId] = useState<string>(units[0]?.id || 'vitoria-da-conquista');
  const [includeOptionals, setIncludeOptionals] = useState<boolean>(initialIncludeOptionals);

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
      summary.items.filter(({ part }) => (includeOptionals ? true : !part.is_optional)),
    [summary.items, includeOptionals]
  );

  const estimatedTotal = includeOptionals
    ? summary.totalWithOptionals
    : summary.totalWithoutOptionals;

  const isFreeLabor = revisionNumber <= 2;

  const whatsappUrl = useMemo(() => {
    const unitCity = selectedUnit?.city || selectedUnit?.name || 'Vitória da Conquista';
    const unitPhone = getUnitWhatsAppNumber(selectedUnit);
    const revDisplay = revisionSubtitle
      ? `${revisionLabel} (${revisionSubtitle})`
      : revisionLabel;

    const lines: string[] = [
      `Olá, Rodaleve! Gostaria de agendar a *${revDisplay}* da minha *${model.name.toUpperCase()}* na unidade de *${unitCity}*.`,
      '',
    ];

    if (activeItems.length > 0) {
      lines.push('*Resumo estimado das peças:*');
      for (const { revisionPart, part, lineTotal } of activeItems) {
        const qtySuffix =
          part.unit === 'ML' || revisionPart.quantity > 1
            ? ` (${formatPartQuantity(part, revisionPart.quantity)})`
            : '';
        const optTag = part.is_optional ? ' [Opcional]' : '';
        lines.push(`• ${part.description}${optTag}${qtySuffix}: ${formatBRL(lineTotal)}`);
      }
      lines.push('');
    }

    if (hasOptionals) {
      lines.push(
        includeOptionals
          ? '_Inclui itens opcionais selecionados no simulador._'
          : '_Orçamento somente com peças obrigatórias (sem itens opcionais)._'
      );
    }

    lines.push(`*Valor total estimado:* ${formatBRL(estimatedTotal)}`);
    lines.push(
      isFreeLabor
        ? '_Mão de obra gratuita (1ª e 2ª revisão conforme manual). Atendimento por ordem de chegada._'
        : '_Solicito confirmação de horário e mão de obra para agendamento prévio._'
    );

    return buildWhatsAppHref(unitPhone, lines.join('\n'));
  }, [
    selectedUnit,
    revisionLabel,
    revisionSubtitle,
    model.name,
    activeItems,
    hasOptionals,
    includeOptionals,
    estimatedTotal,
    isFreeLabor,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#E4002B]">
              {dict.modalEyebrow}
            </p>
            <h3 className="mt-0.5 font-display text-lg font-extrabold text-neutral-900 dark:text-white">
              Honda {model.name} · {revisionLabel}
            </h3>
            {revisionSubtitle && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {revisionSubtitle} ·{' '}
                {isFreeLabor ? dict.modalSubtitleFree : dict.modalSubtitlePaid}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.modalCloseAria}
            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Escolha da Unidade */}
          <div>
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
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
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? 'border-[#E4002B] bg-red-50/60 ring-1 ring-[#E4002B] dark:bg-red-950/20'
                        : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-neutral-900 dark:text-white">
                          {unit.city || unit.name}
                        </span>
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                            isSelected
                              ? 'border-[#E4002B] bg-[#E4002B] text-white'
                              : 'border-neutral-300 dark:border-neutral-700'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                      </div>
                      <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-neutral-600 dark:text-neutral-400">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-[#E4002B]" />
                        <span>{fullAddress}</span>
                      </p>
                    </div>
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                      <Phone className="h-3 w-3" />
                      WhatsApp: {unitWa}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumo das Peças + Checkbox Opcionais */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                {dict.modalStep2(activeItems.length)}
              </p>

              {hasOptionals && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={includeOptionals}
                    onChange={(e) => setIncludeOptionals(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-[#E4002B]"
                  />
                  {dict.modalIncludeOptionals}
                </label>
              )}
            </div>

            {activeItems.length === 0 ? (
              <p className="mt-3 text-xs text-neutral-500">{dict.modalNoParts}</p>
            ) : (
              <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto pr-1 text-xs">
                {activeItems.map(({ revisionPart, part, lineTotal }) => {
                  const translatedDesc = translatePartDescription(part.description, language);
                  return (
                    <li
                      key={`${revisionPart.id}-${part.code}`}
                      className="flex items-center justify-between gap-3 text-neutral-700 dark:text-neutral-300"
                    >
                      <span className="truncate">
                        {translatedDesc}
                        {part.is_optional &&
                        !translatedDesc.includes('[Opcional]') &&
                        !translatedDesc.includes('[Optional]')
                          ? ` ${dict.optionalTag}`
                          : ''}
                      </span>
                      <span className="shrink-0 font-semibold text-neutral-900 tabular-nums dark:text-white">
                        {formatBRL(lineTotal)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  {dict.modalEstimatedTotal}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {isFreeLabor ? dict.modalFreeLaborNote : dict.modalPaidLaborNote}
                </p>
              </div>
              <p className="font-display text-2xl font-extrabold text-[#E4002B] tabular-nums">
                {formatBRL(estimatedTotal)}
              </p>
            </div>
          </div>

          {/* Ação final */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {dict.modalCancel}
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                onTrackLead?.(selectedUnit?.city || selectedUnit?.name || 'Rodaleve');
                setTimeout(onClose, 150);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#1FB858]"
            >
              <WhatsAppIcon className="h-4 w-4" />
              {dict.modalSendWhatsApp(selectedUnit?.city || 'Rodaleve')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
