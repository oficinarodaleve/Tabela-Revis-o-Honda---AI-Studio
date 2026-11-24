import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gauge,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import {
  CalculatorContextForWhatsApp,
  CalculatorSettings,
  MotoModel,
  Part,
  RevisionPart,
  RevisionTab,
  Segment,
  UnitLocation,
  WarrantyStatusState,
} from '../types';
import { SiteLanguage, translatePartDescription, translateRevisionLabel } from '../utils/i18n';
import {
  ComputedRevisionSummary,
  LABOR_POLICY_TEXTS,
  comparePartNamesPT,
  computeModelRevision,
  formatBRL,
  isFreeLaborRevision,
} from '../utils/pricing';
import {
  DEFAULT_CALCULATOR_SETTINGS,
  LimitingCriterion,
  RevisionCycleSnapshot,
  calculateRevisionSchedule,
  formatDateISO,
  formatKmPT,
  formatKmTyping,
  getTargetKmForRevision,
  getTargetMonthsForRevision,
  getToleranceKmForRevision,
  getTodayLocalDate,
  normalizeCalculatorSettings,
  parseKmInput,
  validateCalculatorInputs,
} from '../utils/revisionCalculator';
import { WhatsAppIcon } from './WhatsAppIcon';

interface RevisionCalculatorSectionProps {
  models: MotoModel[];
  segments: Segment[];
  revisionTabs: RevisionTab[];
  partsMap: Record<string, Part>;
  revisionParts: RevisionPart[];
  units: UnitLocation[];
  language: SiteLanguage;
  calculatorSettings?: CalculatorSettings | null;
  onOpenScheduleModal: (
    model: MotoModel,
    revisionNumber: number,
    summary: ComputedRevisionSummary,
    calculatorContext?: CalculatorContextForWhatsApp
  ) => void;
  onViewModelInTable: (modelId: number, revisionNumber: number) => void;
  onTrackLead?: (contentName: string, category?: string) => void;
}

const EMPTY_COMPUTED_SUMMARY: ComputedRevisionSummary = {
  items: [],
  partsTotalWithOptionals: 0,
  partsTotalWithoutOptionals: 0,
  laborCost: 0,
  hasDefinedLabor: false,
  totalWithOptionals: 0,
  totalWithoutOptionals: 0,
  oilSurplusNotice: null,
};

const CALC_TEXTS = {
  pt: {
    formTitle: 'Dados da sua motocicleta',
    modelLabel: 'Modelo da moto',
    genericOption: 'Não sei / Outro modelo Honda (cálculo genérico)',
    genericLabel: 'Modelo Honda Genérico',
    kmLabel: 'Quilometragem atual (km)',
    kmPlaceholder: 'Ex.: 8.450',
    saleDateLabel: 'Data de venda do veículo (manual ou nota fiscal)',
    clearBtn: 'Limpar',
    emptyTitle: 'Preencha os dados para simular sua revisão',
    emptyDesc:
      'Informe a quilometragem atual e a data de venda constante no manual do proprietário ou na nota fiscal. A calculadora aplica as janelas de tolerância oficiais e informa se há risco para a garantia.',
    ruleCard1Title: '1ª Revisão',
    ruleCard2Title: '2ª Revisão',
    ruleCardNTitle: '3ª Revisão em diante',
    alertTitle: (n: number) => `${n}ª Revisão vencida / fora do prazo`,
    alertConfirmBtn: (n: number) => `Já fiz a ${n}ª revisão`,
    criterionKm: 'Por quilometragem',
    criterionTime: 'Por tempo / data de venda',
    criterionBoth: 'KM e tempo atingidos',
    statusOnTrack: 'Em dia · Próxima revisão',
    statusIdealFirst: 'Faixa ideal · Dentro do prazo',
    statusIdealAdvance: 'Antecipação permitida · Dentro do prazo',
    statusToleranceGrace: 'Fora do prazo padrão · Dentro da tolerância',
    statusWarning: 'Janela de agendamento · Próxima do vencimento',
    statusOverdue: 'Revisão vencida / Fora do prazo',
    decisivePrefix: 'O que ocorre primeiro:',
    kmCardTitle: 'Marco por quilometragem',
    timeCardTitle: 'Marco por tempo',
    currentKmLabel: 'Atual:',
    targetKmLabel: 'Meta:',
    saleLabel: 'Venda:',
    dueDateLabel: 'Data limite:',
    remainingPrefix: 'Faltam',
    exceededPrefix: 'Ultrapassou',
    overdueTimePrefix: 'Vencida há',
    todayDue: 'Vence hoje',
    monthSingular: 'mês',
    monthPlural: 'meses',
    daySingular: 'dia',
    dayPlural: 'dias',
    estimateTitle: (n: number, modelName: string) =>
      `Itens e estimativa para ${n}ª Revisão · ${modelName}`,
    estimateGenericTitle: (n: number) => `Orçamento personalizado · ${n}ª Revisão`,
    estimateGenericDesc:
      'Para modelos sem tabela pré-cadastrada ou revisões além da tabela exibida, selecione sua unidade Rodaleve para receber a confirmação de peças e valores no WhatsApp.',
    bookWhatsAppBtn: 'Agendar esta revisão no WhatsApp',
    bookOverdueWhatsAppBtn: (n: number) => `Agendar ${n}ª Revisão no WhatsApp`,
    viewTableBtn: 'Ver na Tabela por Modelo',
    timelineTitle: 'Linha do tempo das revisões Honda',
    badgeDone: 'Realizada',
    badgeOverdue: 'Vencida',
    badgeTolerance: 'Tolerância',
    badgeIdeal: 'Janela ideal',
    badgeWarning: 'Janela',
    badgeNext: 'Próxima',
    badgeFuture: 'Futura',
    moreItemsLabel: (count: number) =>
      `+ ${count} ${count === 1 ? 'outro item' : 'outros itens'} incluídos no orçamento`,
    sinceSaleLabel: (km: number, m: number, d: number) =>
      `Uso informado: ${formatKmPT(km)} km rodados em ${m} ${m === 1 ? 'mês' : 'meses'} e ${d} ${d === 1 ? 'dia' : 'dias'} desde a venda.`,
  },
  en: {
    formTitle: 'Motorcycle details',
    modelLabel: 'Motorcycle model',
    genericOption: "Don't know / Other Honda model (generic calculation)",
    genericLabel: 'Generic Honda Model',
    kmLabel: 'Current mileage (km)',
    kmPlaceholder: 'e.g. 8,450',
    saleDateLabel: "Vehicle sale date (owner's manual or invoice)",
    clearBtn: 'Clear',
    emptyTitle: 'Enter your details to calculate',
    emptyDesc:
      'Provide your current mileage and the purchase date from the manual or invoice to check tolerance windows, next service, and warranty status.',
    ruleCard1Title: '1st Service',
    ruleCard2Title: '2nd Service',
    ruleCardNTitle: '3rd Service onwards',
    alertTitle: (n: number) => `Service #${n} overdue / limit reached`,
    alertConfirmBtn: (n: number) => `I already did service #${n}`,
    criterionKm: 'By mileage',
    criterionTime: 'By time / sale date',
    criterionBoth: 'KM & time reached',
    statusOnTrack: 'On track · Next service',
    statusIdealFirst: 'Ideal window · Within warranty',
    statusIdealAdvance: 'Early service allowed · On track',
    statusToleranceGrace: 'Past standard km · Within tolerance',
    statusWarning: 'Booking window · Due soon',
    statusOverdue: 'Overdue · Out of schedule',
    decisivePrefix: 'Whichever comes first:',
    kmCardTitle: 'Mileage milestone',
    timeCardTitle: 'Time milestone',
    currentKmLabel: 'Current:',
    targetKmLabel: 'Target:',
    saleLabel: 'Sale:',
    dueDateLabel: 'Due date:',
    remainingPrefix: 'Remaining',
    exceededPrefix: 'Exceeded by',
    overdueTimePrefix: 'Overdue by',
    todayDue: 'Due today',
    monthSingular: 'month',
    monthPlural: 'months',
    daySingular: 'day',
    dayPlural: 'days',
    estimateTitle: (n: number, modelName: string) =>
      `Parts & estimate for Service #${n} · ${modelName}`,
    estimateGenericTitle: (n: number) => `Custom quote · Service #${n}`,
    estimateGenericDesc:
      'For models without a pre-listed table or higher service numbers, choose your Rodaleve branch to confirm parts and pricing on WhatsApp.',
    bookWhatsAppBtn: 'Book this service on WhatsApp',
    bookOverdueWhatsAppBtn: (n: number) => `Book Service #${n} on WhatsApp`,
    viewTableBtn: 'View in Model Table',
    timelineTitle: 'Honda service timeline',
    badgeDone: 'Completed',
    badgeOverdue: 'Overdue',
    badgeTolerance: 'Tolerance',
    badgeIdeal: 'Ideal window',
    badgeWarning: 'Window',
    badgeNext: 'Next',
    badgeFuture: 'Upcoming',
    moreItemsLabel: (count: number) => `+ ${count} more ${count === 1 ? 'item' : 'items'} included`,
    sinceSaleLabel: (km: number, m: number, d: number) =>
      `Usage: ${formatKmPT(km)} km in ${m} ${m === 1 ? 'month' : 'months'} and ${d} ${d === 1 ? 'day' : 'days'} since sale.`,
  },
  es: {
    formTitle: 'Datos de tu motocicleta',
    modelLabel: 'Modelo de motocicleta',
    genericOption: 'No sé / Otro modelo Honda (cálculo genérico)',
    genericLabel: 'Modelo Honda Genérico',
    kmLabel: 'Kilometraje actual (km)',
    kmPlaceholder: 'Ej.: 8.450',
    saleDateLabel: 'Fecha de venta del vehículo (manual o factura)',
    clearBtn: 'Limpiar',
    emptyTitle: 'Completa los datos para calcular',
    emptyDesc:
      'Ingresa el kilometraje actual y la fecha de venta del manual o factura para conocer tu ventana de tolerancia, próxima revisión y estado de garantía.',
    ruleCard1Title: '1ª Revisión',
    ruleCard2Title: '2ª Revisión',
    ruleCardNTitle: '3ª Revisión en adelante',
    alertTitle: (n: number) => `${n}ª Revisión vencida / fuera de plazo`,
    alertConfirmBtn: (n: number) => `Ya hice la ${n}ª revisión`,
    criterionKm: 'Por kilometraje',
    criterionTime: 'Por tiempo / fecha de venta',
    criterionBoth: 'KM y tiempo alcanzados',
    statusOnTrack: 'Al día · Próxima revisión',
    statusIdealFirst: 'Franja ideal · En plazo',
    statusIdealAdvance: 'Anticipo permitido · En plazo',
    statusToleranceGrace: 'Fuera del estándar · En tolerancia',
    statusWarning: 'Ventana de reserva · Próxima a vencer',
    statusOverdue: 'Revisión vencida / Fuera de plazo',
    decisivePrefix: 'Lo que ocurre primero:',
    kmCardTitle: 'Hito por kilometraje',
    timeCardTitle: 'Hito por tiempo',
    currentKmLabel: 'Actual:',
    targetKmLabel: 'Meta:',
    saleLabel: 'Venta:',
    dueDateLabel: 'Fecha límite:',
    remainingPrefix: 'Faltan',
    exceededPrefix: 'Superó en',
    overdueTimePrefix: 'Vencida hace',
    todayDue: 'Vence hoy',
    monthSingular: 'mes',
    monthPlural: 'meses',
    daySingular: 'día',
    dayPlural: 'días',
    estimateTitle: (n: number, modelName: string) =>
      `Piezas y estimación para ${n}ª Revisión · ${modelName}`,
    estimateGenericTitle: (n: number) => `Presupuesto personalizado · ${n}ª Revisión`,
    estimateGenericDesc:
      'Para modelos sin tabla registrada o revisiones posteriores, selecciona tu sede Rodaleve para confirmar piezas y valores por WhatsApp.',
    bookWhatsAppBtn: 'Agendar esta revisión por WhatsApp',
    bookOverdueWhatsAppBtn: (n: number) => `Agendar ${n}ª Revisión por WhatsApp`,
    viewTableBtn: 'Ver en Tabla por Modelo',
    timelineTitle: 'Línea de tiempo de revisiones Honda',
    badgeDone: 'Realizada',
    badgeOverdue: 'Vencida',
    badgeTolerance: 'Tolerancia',
    badgeIdeal: 'Franja ideal',
    badgeWarning: 'Ventana',
    badgeNext: 'Próxima',
    badgeFuture: 'Futura',
    moreItemsLabel: (count: number) => `+ ${count} ${count === 1 ? 'ítem más' : 'ítems más'} incluidos`,
    sinceSaleLabel: (km: number, m: number, d: number) =>
      `Uso: ${formatKmPT(km)} km en ${m} ${m === 1 ? 'mes' : 'meses'} y ${d} ${d === 1 ? 'día' : 'días'} desde la venta.`,
  },
} as const;

function getFallbackSegmentPhoto(segmentSlug: string): string {
  switch (segmentSlug) {
    case 'street_trail':
      return '/src/assets/images/moto_trail_adventure_1795147025806.jpg';
    case 'off_road':
      return '/src/assets/images/moto_offroad_crf_1795147026744.jpg';
    default:
      return '/src/assets/images/moto_street_cg_1795147025649.jpg';
  }
}

export function RevisionCalculatorSection({
  models,
  segments,
  revisionTabs,
  partsMap,
  revisionParts,
  language,
  calculatorSettings,
  onOpenScheduleModal,
  onViewModelInTable,
  onTrackLead,
}: RevisionCalculatorSectionProps) {
  const t = CALC_TEXTS[language] || CALC_TEXTS.pt;
  const settings = useMemo(
    () => normalizeCalculatorSettings(calculatorSettings ?? DEFAULT_CALCULATOR_SETTINGS),
    [calculatorSettings]
  );
  const todayISO = useMemo(() => formatDateISO(getTodayLocalDate()), []);

  const [selectedModelValue, setSelectedModelValue] = useState<string>('generic');
  const [kmInput, setKmInput] = useState<string>('');
  const [saleDateISO, setSaleDateISO] = useState<string>('');
  const [dismissedOverdueRevision, setDismissedOverdueRevision] = useState<number | null>(null);
  const [modelImgFailed, setModelImgFailed] = useState<string>('');

  const copy = useMemo(() => {
    const firstKm = formatKmPT(settings.first_revision_km);
    const firstTol = getToleranceKmForRevision(1, settings);
    const firstMinKm = formatKmPT(Math.max(0, settings.first_revision_km - firstTol));
    const firstMaxKm = formatKmPT(settings.first_revision_km + firstTol);

    const stepKm = formatKmPT(settings.subsequent_km_step);
    const secondKm = formatKmPT(getTargetKmForRevision(2, settings));
    const secondMonths = getTargetMonthsForRevision(2, settings);
    const stepTol = formatKmPT(getToleranceKmForRevision(2, settings));

    if (language === 'en') {
      return {
        eyebrow: 'OFFICIAL SERVICE CALCULATOR',
        title: 'Honda Service Calculator',
        subtitle: `Find out which service is due next and which limit comes first — 1st service at ${firstKm} km or ${settings.first_revision_months} months, then every ${stepKm} km or ${settings.subsequent_months_step} months from sale date.`,
        ruleBadge: `1st at ${firstKm} km or ${settings.first_revision_months} mo · Next every ${stepKm} km or ${settings.subsequent_months_step} mo`,
        saleDateHelp:
          "Enter the sale date printed in the owner's manual or on the motorcycle purchase invoice.",
        rule1Desc: `${firstKm} km or ${settings.first_revision_months} months (${firstMinKm}–${firstMaxKm} km)`,
        rule2Desc: `${secondKm} km or ${secondMonths} months (±${stepTol} km)`,
        ruleNDesc: `+${stepKm} km or +${settings.subsequent_months_step} months per cycle`,
        timelineHint: `1st at ${firstKm} km or ${settings.first_revision_months} months · Subsequent every ${stepKm} km or ${settings.subsequent_months_step} months.`,
        warrantyOk:
          'Following the time or mileage deadline keeps your Honda factory warranty active.',
        warrantyWarning:
          'Preventive notice: your motorcycle is close to the mileage or date limit. Schedule your service in advance so you do not risk compromising the factory warranty.',
        warrantyOverdue:
          'Warning: exceeding the due date or maximum mileage limit compromises the factory warranty of your motorcycle. Schedule an inspection as soon as possible with our team.',
      };
    }

    if (language === 'es') {
      return {
        eyebrow: 'SIMULADOR OFICIAL DE REVISIONES',
        title: 'Calculadora de Revisiones Honda',
        subtitle: `Descubre cuál es tu próxima revisión y qué vence primero — 1ª revisión a los ${firstKm} km o ${settings.first_revision_months} meses y las siguientes cada ${stepKm} km o ${settings.subsequent_months_step} meses desde la fecha de venta.`,
        ruleBadge: `1ª en ${firstKm} km o ${settings.first_revision_months}m · Siguientes cada ${stepKm} km o ${settings.subsequent_months_step}m`,
        saleDateHelp:
          'Indica la fecha de venta que consta en el manual del propietario o en la factura de compra.',
        rule1Desc: `${firstKm} km o ${settings.first_revision_months} meses (${firstMinKm}–${firstMaxKm} km)`,
        rule2Desc: `${secondKm} km o ${secondMonths} meses (±${stepTol} km)`,
        ruleNDesc: `+${stepKm} km o +${settings.subsequent_months_step} meses por ciclo`,
        timelineHint: `1ª con ${firstKm} km o ${settings.first_revision_months} meses · Siguientes cada ${stepKm} km o ${settings.subsequent_months_step} meses.`,
        warrantyOk:
          'Respetar el plazo de fecha o kilometraje mantiene activa la garantía de fábrica de Honda.',
        warrantyWarning:
          'Atención preventiva: tu motocicleta está cerca del límite de kilometraje o fecha prevista. Agenda tu revisión con anticipación para no comprometer la garantía de fábrica.',
        warrantyOverdue:
          'Atención: superar la fecha límite o el kilometraje máximo permitido compromete la garantía de fábrica de tu moto. Agenda atención cuanto antes para evaluación de nuestro equipo.',
      };
    }

    return {
      eyebrow: settings.eyebrow_text,
      title: settings.title_text,
      subtitle: settings.subtitle_text,
      ruleBadge: settings.rule_badge_text,
      saleDateHelp: settings.sale_date_help_text,
      rule1Desc: `${firstKm} km ou ${settings.first_revision_months} meses (${firstMinKm} a ${firstMaxKm} km)`,
      rule2Desc: `${secondKm} km ou ${secondMonths} meses (± ${stepTol} km)`,
      ruleNDesc: `+${stepKm} km ou +${settings.subsequent_months_step} meses por ciclo`,
      timelineHint: `1ª com ${firstKm} km ou ${settings.first_revision_months} meses · Seguintes a cada ${stepKm} km ou ${settings.subsequent_months_step} meses.`,
      warrantyOk: settings.warranty_ok_text,
      warrantyWarning: settings.warranty_warning_text,
      warrantyOverdue: settings.warranty_overdue_text,
    };
  }, [language, settings]);

  const groupedModels = useMemo(() => {
    const segNameBySlug = new Map(segments.map((s) => [s.slug, s.name]));
    const groups = new Map<string, { label: string; items: MotoModel[] }>();
    for (const model of models) {
      const slug = model.segment_slug || 'outros';
      const label = segNameBySlug.get(slug) || slug;
      if (!groups.has(slug)) {
        groups.set(slug, { label, items: [] });
      }
      groups.get(slug)!.items.push(model);
    }
    return Array.from(groups.values());
  }, [models, segments]);

  const selectedModel = useMemo(() => {
    if (selectedModelValue === 'generic') return null;
    const id = Number(selectedModelValue);
    return models.find((m) => m.id === id) || null;
  }, [models, selectedModelValue]);

  const parsedKm = useMemo(() => parseKmInput(kmInput), [kmInput]);
  const hasAnyTypedInput = kmInput.trim().length > 0 || saleDateISO.trim().length > 0;

  const validation = useMemo(() => {
    const raw = validateCalculatorInputs(kmInput, saleDateISO);
    return {
      kmError:
        kmInput.trim().length > 0 && parsedKm.isNegative
          ? raw.kmError
          : kmInput.trim().length > 0 && raw.kmError
            ? raw.kmError
            : undefined,
      dateError: saleDateISO.trim().length > 0 ? raw.dateError : undefined,
    };
  }, [kmInput, saleDateISO, parsedKm.isNegative]);

  const calculation = useMemo(() => {
    if (parsedKm.isNegative || parsedKm.isEmpty || parsedKm.value === null) return null;
    if (!saleDateISO.trim() || validation.dateError) return null;
    return calculateRevisionSchedule({
      currentKm: parsedKm.value,
      saleDateISO,
      lastCompletedRevision:
        dismissedOverdueRevision !== null ? dismissedOverdueRevision : 'auto',
      settings,
    });
  }, [parsedKm, saleDateISO, validation.dateError, dismissedOverdueRevision, settings]);

  const targetRevisionNumber = calculation?.targetRevision.revisionNumber ?? null;

  const matchedTab = useMemo(() => {
    if (!targetRevisionNumber) return null;
    return revisionTabs.find((tab) => tab.revision_number === targetRevisionNumber) || null;
  }, [revisionTabs, targetRevisionNumber]);

  const buildEstimateForRevision = (revNum: number): ComputedRevisionSummary | null => {
    if (!selectedModel) return null;
    const hasTab = revisionTabs.some((tab) => tab.revision_number === revNum);
    const summary = computeModelRevision(
      selectedModel.id,
      revNum,
      revisionParts,
      partsMap,
      selectedModel.labor_price,
      {
        oilLiters: selectedModel.oil_liters,
        oilSaleMode: selectedModel.oil_sale_mode,
      }
    );
    const hasLinkedData = summary.items.length > 0 || summary.laborCost > 0;
    return hasTab && hasLinkedData ? summary : null;
  };

  const modelEstimate = useMemo(() => {
    if (!selectedModel || !targetRevisionNumber) return null;
    const summary = computeModelRevision(
      selectedModel.id,
      targetRevisionNumber,
      revisionParts,
      partsMap,
      selectedModel.labor_price,
      {
        oilLiters: selectedModel.oil_liters,
        oilSaleMode: selectedModel.oil_sale_mode,
      }
    );
    const hasLinkedParts = summary.items.length > 0 || summary.laborCost > 0;
    return hasLinkedParts && matchedTab ? summary : null;
  }, [selectedModel, targetRevisionNumber, revisionParts, partsMap, matchedTab]);

  const sortedPreviewItems = useMemo(() => {
    if (!modelEstimate) return [];
    return [...modelEstimate.items].sort((a, b) =>
      comparePartNamesPT(a.part.description, b.part.description)
    );
  }, [modelEstimate]);

  const formatDurationBreakdown = (bd: { months: number; days: number }) => {
    const parts: string[] = [];
    if (bd.months > 0) {
      parts.push(`${bd.months} ${bd.months === 1 ? t.monthSingular : t.monthPlural}`);
    }
    if (bd.days > 0 || parts.length === 0) {
      parts.push(`${bd.days} ${bd.days === 1 ? t.daySingular : t.dayPlural}`);
    }
    const conj = language === 'en' ? ' and ' : language === 'es' ? ' y ' : ' e ';
    return parts.join(conj);
  };

  const getCriterionLabel = (criterion: LimitingCriterion) => {
    if (criterion === 'both') return t.criterionBoth;
    return criterion === 'km' ? t.criterionKm : t.criterionTime;
  };

  const getWarrantyStatusMeta = (snap: RevisionCycleSnapshot) => {
    const state: WarrantyStatusState = snap.warrantyState;
    const targetKmStr = formatKmPT(snap.targetKm);
    const minKmStr = formatKmPT(snap.minIdealKm);
    const maxKmStr = formatKmPT(snap.maxToleranceKm);

    if (state === 'overdue') {
      return {
        title: t.statusOverdue,
        notice: copy.warrantyOverdue,
        cardClass: 'border-brand/55 bg-brand-soft/65',
        badgeClass: 'bg-brand text-on-brand',
        icon: ShieldAlert,
        iconClass: 'text-brand-text',
      };
    }

    if (snap.toleranceZone === 'tolerance_grace') {
      const graceNotice =
        language === 'en'
          ? `Outside the standard ${targetKmStr} km mark, but still within the maximum tolerance (up to ${maxKmStr} km) — you can perform the service now. Be careful not to exceed ${maxKmStr} km or ${snap.targetDateBR} so you do not compromise the factory warranty.`
          : language === 'es'
            ? `Fuera del plazo estándar de ${targetKmStr} km, pero aún dentro del límite máximo de tolerancia (hasta ${maxKmStr} km) — puedes hacer la revisión ahora. Ten cuidado de no superar los ${maxKmStr} km ni la fecha límite (${snap.targetDateBR}) para no comprometer la garantía.`
            : snap.revisionNumber === 1
              ? `Fora do prazo padrão de ${targetKmStr} km, mas ainda dentro da tolerância (até ${maxKmStr} km) — você pode realizar a revisão agora. Atenção para não ultrapassar os ${maxKmStr} km nem a data limite (${snap.targetDateBR}) para não comprometer a garantia de fábrica.`
              : `Fora do prazo padrão de ${targetKmStr} km (passou dos ${targetKmStr} km), mas ainda dentro do limite máximo de tolerância (até ${maxKmStr} km) — você pode fazer a revisão agora. Reforçamos o cuidado para não ultrapassar os ${maxKmStr} km nem a data limite (${snap.targetDateBR}) para não comprometer a garantia.`;

      return {
        title: t.statusToleranceGrace,
        notice: graceNotice,
        cardClass: 'border-amber-500/45 bg-amber-500/10',
        badgeClass: 'bg-amber-600 text-white',
        icon: AlertTriangle,
        iconClass: 'text-amber-700 dark:text-amber-300',
      };
    }

    if (snap.toleranceZone === 'ideal_window') {
      const idealNotice =
        snap.revisionNumber === 1
          ? language === 'en'
            ? `Your motorcycle is between ${minKmStr} km and ${targetKmStr} km. You can already schedule and perform the 1st service within the factory warranty deadline (up to ${snap.targetDateBR}).`
            : language === 'es'
              ? `Tu moto está entre ${minKmStr} km y ${targetKmStr} km. Ya puedes agendar y realizar la 1ª revisión dentro del plazo de garantía (hasta ${snap.targetDateBR}).`
              : `Você já pode agendar e realizar a 1ª revisão dentro do prazo de garantia (faixa ideal de ${minKmStr} km a ${targetKmStr} km, ou até ${snap.targetDateBR}).`
          : language === 'en'
            ? `Early service allowed: between ${minKmStr} km and ${targetKmStr} km you can already schedule your ${snap.revisionNumber}th service within the normal deadline (by ${snap.targetDateBR}).`
            : language === 'es'
              ? `Anticipo permitido: entre ${minKmStr} km y ${targetKmStr} km ya puedes adelantar tu ${snap.revisionNumber}ª revisión dentro del plazo normal (hasta ${snap.targetDateBR}).`
              : `Antecipação permitida: entre ${minKmStr} km e ${targetKmStr} km você já pode antecipar a ${snap.revisionNumber}ª revisão dentro do prazo normal (ou até ${snap.targetDateBR}).`;

      return {
        title: snap.revisionNumber === 1 ? t.statusIdealFirst : t.statusIdealAdvance,
        notice: idealNotice,
        cardClass: 'border-emerald-500/40 bg-emerald-500/10',
        badgeClass: 'bg-emerald-600 text-white',
        icon: ShieldCheck,
        iconClass: 'text-emerald-700 dark:text-emerald-300',
      };
    }

    if (state === 'warning') {
      return {
        title: t.statusWarning,
        notice: copy.warrantyWarning,
        cardClass: 'border-amber-500/45 bg-amber-500/10',
        badgeClass: 'bg-amber-600 text-white',
        icon: AlertTriangle,
        iconClass: 'text-amber-700 dark:text-amber-300',
      };
    }

    return {
      title: t.statusOnTrack,
      notice: copy.warrantyOk,
      cardClass: 'border-emerald-500/40 bg-emerald-500/10',
      badgeClass: 'bg-emerald-600 text-white',
      icon: ShieldCheck,
      iconClass: 'text-emerald-700 dark:text-emerald-300',
    };
  };

  const handleClear = () => {
    setKmInput('');
    setSaleDateISO('');
    setDismissedOverdueRevision(null);
  };

  const handleKmChange = (raw: string) => {
    setDismissedOverdueRevision(null);
    if (raw.includes('-')) {
      setKmInput(raw);
      return;
    }
    const formatted = formatKmTyping(raw);
    setKmInput(formatted);
  };

  const handleSaleDateChange = (nextISO: string) => {
    setDismissedOverdueRevision(null);
    setSaleDateISO(nextISO);
  };

  const handleOpenWhatsAppModalForSnapshot = (snap: RevisionCycleSnapshot) => {
    if (!calculation) return;

    const estimate = buildEstimateForRevision(snap.revisionNumber);
    const hasCatalogEstimate = Boolean(
      estimate && (estimate.items.length > 0 || estimate.laborCost > 0)
    );
    const modelForModal: MotoModel = selectedModel || {
      id: 0,
      name: t.genericLabel,
      segment_slug: 'street_city',
      image_url: '',
      hidden: false,
      sort_order: 999,
      labor_price: null,
    };
    const modelLabel = selectedModel ? `Honda ${selectedModel.name}` : t.genericLabel;
    const statusMeta = getWarrantyStatusMeta(snap);

    const calcContext: CalculatorContextForWhatsApp = {
      modelLabel,
      isGenericModel: !selectedModel,
      currentKm: calculation.currentKm,
      saleDateBR: calculation.saleDateBR,
      revisionNumber: snap.revisionNumber,
      revisionSubtitle: `${formatKmPT(snap.targetKm)} km ou ${snap.targetMonths} meses`,
      warrantyState: snap.warrantyState,
      warrantyStatusTitle: statusMeta.title,
      warrantyNotice: statusMeta.notice,
      criterionLabel: getCriterionLabel(snap.firstCriterion),
      targetDateBR: snap.targetDateBR,
      targetKm: snap.targetKm,
      hasCatalogEstimate,
    };

    onTrackLead?.(
      `${modelLabel} - ${snap.revisionNumber}ª Revisão (Calculadora)`,
      'Calculadora de Revisões'
    );

    onOpenScheduleModal(
      modelForModal,
      snap.revisionNumber,
      estimate || EMPTY_COMPUTED_SUMMARY,
      calcContext
    );
  };

  const renderCriterionSummaryText = (snap: RevisionCycleSnapshot) => {
    const revName = `${snap.revisionNumber}ª Revisão`;
    const kmTargetStr = `${formatKmPT(snap.targetKm)} km`;
    const maxKmStr = `${formatKmPT(snap.maxToleranceKm)} km`;
    const minKmStr = `${formatKmPT(snap.minIdealKm)} km`;
    const monthsTotal = snap.targetMonths;

    if (snap.isDueOrReached) {
      if (snap.firstCriterion === 'both') {
        return language === 'en'
          ? `${revName} (${kmTargetStr}, max ${maxKmStr}, or ${monthsTotal} months) exceeded both mileage and time limits (due ${snap.targetDateBR}).`
          : language === 'es'
            ? `La ${revName} (${kmTargetStr}, máx. ${maxKmStr}, o ${monthsTotal} meses) superó ambos límites de kilometraje y tiempo (venció el ${snap.targetDateBR}).`
            : `A ${revName} (${kmTargetStr}, limite de tolerância ${maxKmStr}, ou ${monthsTotal} meses) ultrapassou os dois limites — quilometragem máxima e a data de ${snap.targetDateBR}.`;
      }
      if (snap.firstCriterion === 'km') {
        return language === 'en'
          ? `${revName} exceeded the maximum mileage limit of ${maxKmStr} by ${formatKmPT(snap.kmExceededMaxTolerance)} km (time limit is ${snap.targetDateBR}).`
          : language === 'es'
            ? `La ${revName} superó el límite máximo de ${maxKmStr} en ${formatKmPT(snap.kmExceededMaxTolerance)} km (el plazo por tiempo es ${snap.targetDateBR}).`
            : `A ${revName} ultrapassou o limite máximo de ${maxKmStr} em ${formatKmPT(snap.kmExceededMaxTolerance)} km (prazo por tempo em ${snap.targetDateBR}).`;
      }
      return language === 'en'
        ? `${revName} expired by time on ${snap.targetDateBR} (${formatDurationBreakdown(snap.timeExceededBreakdown)} ago), even with ${formatKmPT(snap.kmRemaining)} km remaining to ${kmTargetStr}.`
        : language === 'es'
          ? `La ${revName} venció por tiempo el ${snap.targetDateBR} (hace ${formatDurationBreakdown(snap.timeExceededBreakdown)}), aunque falten ${formatKmPT(snap.kmRemaining)} km para ${kmTargetStr}.`
          : `A ${revName} venceu por tempo após a data limite de ${snap.targetDateBR} (há ${formatDurationBreakdown(snap.timeExceededBreakdown)}), mesmo restando ${formatKmPT(snap.kmRemaining)} km para ${kmTargetStr}.`;
    }

    if (snap.toleranceZone === 'tolerance_grace') {
      return language === 'en'
        ? `Passed standard ${kmTargetStr} by ${formatKmPT(snap.kmExceeded)} km, with ${formatKmPT(snap.kmUntilMaxTolerance)} km remaining until the ${maxKmStr} ceiling (time limit ${snap.targetDateBR}).`
        : language === 'es'
          ? `Superó los ${kmTargetStr} estándar en ${formatKmPT(snap.kmExceeded)} km, restando ${formatKmPT(snap.kmUntilMaxTolerance)} km hasta el tope de ${maxKmStr} (fecha límite ${snap.targetDateBR}).`
          : `Passou dos ${kmTargetStr} padrão em ${formatKmPT(snap.kmExceeded)} km, restando ${formatKmPT(snap.kmUntilMaxTolerance)} km até o teto máximo de ${maxKmStr} (ou até ${snap.targetDateBR}).`;
    }

    if (snap.toleranceZone === 'ideal_window') {
      return language === 'en'
        ? `Mileage is inside the ideal window (${minKmStr}–${kmTargetStr}), with ${formatKmPT(snap.kmRemaining)} km to the standard mark and time limit on ${snap.targetDateBR}.`
        : language === 'es'
          ? `El kilometraje está en la franja ideal (${minKmStr} a ${kmTargetStr}), faltando ${formatKmPT(snap.kmRemaining)} km para el hito estándar y fecha límite el ${snap.targetDateBR}.`
          : `Quilometragem na faixa ideal (${minKmStr} a ${kmTargetStr}): faltam ${formatKmPT(snap.kmRemaining)} km para o marco padrão de ${kmTargetStr} e o prazo por tempo vai até ${snap.targetDateBR}.`;
    }

    if (snap.firstCriterion === 'km') {
      return language === 'en'
        ? `At your current pace, mileage will come first: ${formatKmPT(snap.kmRemaining)} km left to ${kmTargetStr}, while the time limit is ${snap.targetDateBR}.`
        : language === 'es'
          ? `Al ritmo actual, el kilometraje vencerá primero: faltan ${formatKmPT(snap.kmRemaining)} km para ${kmTargetStr}, mientras que por tiempo vence el ${snap.targetDateBR}.`
          : `No ritmo atual, o limite por quilometragem vence primeiro: faltam ${formatKmPT(snap.kmRemaining)} km para ${kmTargetStr}, enquanto por tempo vence em ${snap.targetDateBR}.`;
    }
    return language === 'en'
      ? `At your current pace, time will come first: due on ${snap.targetDateBR} (in ${formatDurationBreakdown(snap.timeRemainingBreakdown)}), while ${formatKmPT(snap.kmRemaining)} km remain.`
      : language === 'es'
        ? `Al ritmo actual, el tiempo vencerá primero: vence el ${snap.targetDateBR} (en ${formatDurationBreakdown(snap.timeRemainingBreakdown)}), mientras que faltan ${formatKmPT(snap.kmRemaining)} km.`
        : `No ritmo atual, o limite por tempo vence primeiro: data limite em ${snap.targetDateBR} (em ${formatDurationBreakdown(snap.timeRemainingBreakdown)}), enquanto faltam ${formatKmPT(snap.kmRemaining)} km.`;
  };

  const selectedModelImg = useMemo(() => {
    if (!selectedModel) return '';
    if (modelImgFailed && modelImgFailed === selectedModel.image_url) {
      return getFallbackSegmentPhoto(selectedModel.segment_slug);
    }
    return selectedModel.image_url || getFallbackSegmentPhoto(selectedModel.segment_slug);
  }, [selectedModel, modelImgFailed]);

  const targetWarrantyMeta = calculation
    ? getWarrantyStatusMeta(calculation.targetRevision)
    : null;
  const TargetStatusIcon = targetWarrantyMeta?.icon ?? ShieldCheck;
  const laborTexts = LABOR_POLICY_TEXTS[language] || LABOR_POLICY_TEXTS.pt;

  return (
    <section
      id="calculadora-revisoes"
      aria-labelledby="calculator-section-heading"
      className="mx-auto max-w-[1180px] scroll-mt-24 px-4 py-10 sm:px-6 sm:py-12"
    >
      {/* Editorial Section Header */}
      <div className="mb-7 flex flex-col justify-between gap-4 border-b border-border/80 pb-5 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-text">
            {copy.eyebrow}
          </p>
          <h2
            id="calculator-section-heading"
            className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl"
            style={{ textWrap: 'balance' }}
          >
            {copy.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted sm:text-base">
            {copy.subtitle}
          </p>
        </div>

        <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-ink md:self-end">
          <Clock className="h-3.5 w-3.5 shrink-0 text-brand-text" />
          <span className="tabular-nums">{copy.ruleBadge}</span>
        </div>
      </div>

      {/* Main Split: Inputs (5 cols) + Diagnosis & Timeline (7 cols) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left Form */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_2px_10px_rgba(17,24,39,0.04)] sm:p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-3.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
                <Calculator className="h-4 w-4" />
              </span>
              <h3 className="font-display text-base font-bold text-ink">{t.formTitle}</h3>
            </div>
            {hasAnyTypedInput && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <RotateCcw className="h-3 w-3" />
                {t.clearBtn}
              </button>
            )}
          </div>

          <div className="mt-5 space-y-4">
            {/* 1. Modelo da moto */}
            <div>
              <label
                htmlFor="calc-model-select"
                className="mb-1.5 block text-xs font-semibold text-ink"
              >
                {t.modelLabel}
              </label>
              <select
                id="calc-model-select"
                value={selectedModelValue}
                onChange={(e) => {
                  setSelectedModelValue(e.target.value);
                  setModelImgFailed('');
                }}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-ink transition-colors focus:border-brand focus:bg-card focus:outline-none"
              >
                <option value="generic">{t.genericOption}</option>
                {groupedModels.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.items.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        Honda {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {selectedModel && (
                <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-1">
                    <img
                      src={selectedModelImg}
                      alt={`Honda ${selectedModel.name}`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain"
                      onError={() => {
                        if (selectedModel.image_url && modelImgFailed !== selectedModel.image_url) {
                          setModelImgFailed(selectedModel.image_url);
                        }
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-ink">
                      Honda {selectedModel.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {segments.find((s) => s.slug === selectedModel.segment_slug)?.name || 'Honda'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Quilometragem atual */}
            <div>
              <label
                htmlFor="calc-current-km"
                className="mb-1.5 block text-xs font-semibold text-ink"
              >
                {t.kmLabel} <span className="text-brand-text">*</span>
              </label>
              <div className="relative">
                <Gauge className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  id="calc-current-km"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={kmInput}
                  onChange={(e) => handleKmChange(e.target.value)}
                  placeholder={t.kmPlaceholder}
                  aria-invalid={Boolean(validation.kmError)}
                  className={`w-full rounded-xl border bg-surface py-2.5 pl-10 pr-12 font-mono text-sm font-semibold text-ink tabular-nums placeholder:font-sans placeholder:font-normal placeholder:text-ink-muted focus:bg-card focus:outline-none ${
                    validation.kmError
                      ? 'border-brand ring-1 ring-brand/30'
                      : 'border-border focus:border-brand'
                  }`}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold uppercase text-ink-muted">
                  km
                </span>
              </div>
              {validation.kmError && (
                <p role="alert" className="mt-1.5 text-xs font-semibold text-brand-text">
                  {validation.kmError}
                </p>
              )}
            </div>

            {/* 3. Data de venda do veículo */}
            <div>
              <label
                htmlFor="calc-sale-date"
                className="mb-1.5 block text-xs font-semibold text-ink"
              >
                {t.saleDateLabel} <span className="text-brand-text">*</span>
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  id="calc-sale-date"
                  type="date"
                  max={todayISO}
                  value={saleDateISO}
                  onChange={(e) => handleSaleDateChange(e.target.value)}
                  aria-invalid={Boolean(validation.dateError)}
                  className={`w-full rounded-xl border bg-surface py-2.5 pl-10 pr-3.5 text-sm font-medium text-ink tabular-nums focus:bg-card focus:outline-none ${
                    validation.dateError
                      ? 'border-brand ring-1 ring-brand/30'
                      : 'border-border focus:border-brand'
                  }`}
                />
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">{copy.saleDateHelp}</p>
              {validation.dateError && (
                <p role="alert" className="mt-1 text-xs font-semibold text-brand-text">
                  {validation.dateError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Diagnosis & Timeline */}
        <div className="space-y-5 lg:col-span-7">
          {!calculation || !targetWarrantyMeta ? (
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="flex items-start gap-3.5">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
                  <Wrench className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">{t.emptyTitle}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t.emptyDesc}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface p-3.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-text">
                    {t.ruleCard1Title}
                  </p>
                  <p className="mt-1 font-display text-sm font-bold text-ink tabular-nums">
                    {copy.rule1Desc}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-text">
                    {t.ruleCard2Title}
                  </p>
                  <p className="mt-1 font-display text-sm font-bold text-ink tabular-nums">
                    {copy.rule2Desc}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-text">
                    {t.ruleCardNTitle}
                  </p>
                  <p className="mt-1 font-display text-sm font-bold text-ink tabular-nums">
                    {copy.ruleNDesc}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Estado 3 proeminente quando ciclo anterior teve teto ou data ultrapassados */}
              {calculation.pendingAlertRevision && (
                <div className="rounded-2xl border border-brand/55 bg-brand-soft/65 p-4 sm:p-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-brand-text" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-brand px-2.5 py-0.5 text-[11px] font-bold text-on-brand">
                            {t.statusOverdue}
                          </span>
                          <span className="text-xs font-semibold text-ink-muted">
                            {getCriterionLabel(calculation.pendingAlertRevision.firstCriterion)}
                          </span>
                        </div>
                        <p className="mt-1.5 font-display text-base font-extrabold text-ink">
                          {t.alertTitle(calculation.pendingAlertRevision.revisionNumber)}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-ink">
                          {renderCriterionSummaryText(calculation.pendingAlertRevision)}
                        </p>
                        <p className="mt-2 text-xs font-semibold leading-relaxed text-brand-text">
                          {copy.warrantyOverdue}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-brand/20 pt-3.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenWhatsAppModalForSnapshot(calculation.pendingAlertRevision!)
                      }
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-whatsapp px-4 py-2 text-xs font-bold text-on-whatsapp shadow-xs transition-colors hover:bg-whatsapp-hover"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5" />
                      {t.bookOverdueWhatsAppBtn(calculation.pendingAlertRevision.revisionNumber)}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedOverdueRevision(
                          calculation.pendingAlertRevision!.revisionNumber
                        )
                      }
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-brand/40 bg-card px-3.5 py-2 text-xs font-bold text-ink transition-colors hover:border-brand hover:text-brand-text"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-brand-text" />
                      {t.alertConfirmBtn(calculation.pendingAlertRevision.revisionNumber)}
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Target Revision Card */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_2px_10px_rgba(17,24,39,0.04)] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-brand px-2.5 py-1 font-display text-xs font-extrabold uppercase tracking-wider text-on-brand">
                        {calculation.targetRevision.revisionNumber}ª Revisão
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${targetWarrantyMeta.badgeClass}`}
                      >
                        <TargetStatusIcon className="h-3.5 w-3.5" />
                        {targetWarrantyMeta.title}
                      </span>
                    </div>

                    <h3 className="mt-2.5 font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl tabular-nums">
                      {formatKmPT(calculation.targetRevision.targetKm)} km ou{' '}
                      {calculation.targetRevision.targetMonths} meses
                    </h3>
                    <p className="mt-1 text-xs text-ink-muted tabular-nums">
                      {t.sinceSaleLabel(
                        calculation.currentKm,
                        calculation.monthsSinceSale.months,
                        calculation.monthsSinceSale.days
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left sm:text-right">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                      {t.decisivePrefix}
                    </p>
                    <p className="mt-0.5 font-display text-sm font-extrabold text-brand-text">
                      {getCriterionLabel(calculation.targetRevision.firstCriterion)}
                    </p>
                  </div>
                </div>

                {/* Aviso de Garantia e Tolerância por Estado */}
                <div
                  className={`mt-4 flex items-start gap-2.5 rounded-xl border p-3.5 ${targetWarrantyMeta.cardClass}`}
                >
                  <TargetStatusIcon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${targetWarrantyMeta.iconClass}`}
                  />
                  <div className="space-y-1 text-xs leading-relaxed text-ink">
                    <p className="font-semibold">
                      {renderCriterionSummaryText(calculation.targetRevision)}
                    </p>
                    <p className="text-ink-muted">{targetWarrantyMeta.notice}</p>
                  </div>
                </div>

                {/* Dual Comparison: KM vs Tempo */}
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Marco por Quilometragem */}
                  <div
                    className={`rounded-xl border p-4 transition-colors ${
                      calculation.targetRevision.firstCriterion === 'km' ||
                      calculation.targetRevision.firstCriterion === 'both'
                        ? 'border-brand/60 bg-brand-soft/30'
                        : 'border-border bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink">
                        <Gauge className="h-3.5 w-3.5 text-brand-text" />
                        {t.kmCardTitle}
                      </span>
                      <span className="font-mono text-xs font-bold text-ink tabular-nums">
                        {Math.min(100, calculation.targetRevision.kmCyclePercent).toFixed(0)}%
                      </span>
                    </div>

                    <p className="mt-2.5 font-display text-lg font-extrabold text-ink tabular-nums">
                      {calculation.targetRevision.kmToleranceExceeded
                        ? `${t.exceededPrefix} ${formatKmPT(calculation.targetRevision.kmExceededMaxTolerance)} km do teto`
                        : calculation.targetRevision.toleranceZone === 'tolerance_grace'
                          ? `Restam ${formatKmPT(calculation.targetRevision.kmUntilMaxTolerance)} km (tolerância)`
                          : `${t.remainingPrefix} ${formatKmPT(calculation.targetRevision.kmRemaining)} km`}
                    </p>

                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          calculation.targetRevision.kmToleranceExceeded
                            ? 'bg-brand'
                            : calculation.targetRevision.toleranceZone === 'tolerance_grace'
                              ? 'bg-amber-600'
                              : calculation.targetRevision.firstCriterion === 'km'
                                ? 'bg-brand'
                                : 'bg-ink/70'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(4, calculation.targetRevision.kmCyclePercent))}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] text-ink-muted tabular-nums">
                      <span>
                        {t.currentKmLabel} {formatKmPT(calculation.currentKm)} km
                      </span>
                      <span>
                        Janela: {formatKmPT(calculation.targetRevision.minIdealKm)}–
                        {formatKmPT(calculation.targetRevision.maxToleranceKm)} km
                      </span>
                    </div>
                  </div>

                  {/* Marco por Tempo */}
                  <div
                    className={`rounded-xl border p-4 transition-colors ${
                      calculation.targetRevision.firstCriterion === 'time' ||
                      calculation.targetRevision.firstCriterion === 'both'
                        ? 'border-brand/60 bg-brand-soft/30'
                        : 'border-border bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink">
                        <Calendar className="h-3.5 w-3.5 text-brand-text" />
                        {t.timeCardTitle}
                      </span>
                      <span className="font-mono text-xs font-bold text-ink tabular-nums">
                        {Math.min(100, calculation.targetRevision.timeCyclePercent).toFixed(0)}%
                      </span>
                    </div>

                    <p className="mt-2.5 font-display text-lg font-extrabold text-ink tabular-nums">
                      {calculation.targetRevision.timeExpired
                        ? `${t.overdueTimePrefix} ${formatDurationBreakdown(
                            calculation.targetRevision.timeExceededBreakdown
                          )}`
                        : calculation.targetRevision.timeReached
                          ? t.todayDue
                          : `${t.remainingPrefix} ${formatDurationBreakdown(
                              calculation.targetRevision.timeRemainingBreakdown
                            )}`}
                    </p>

                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          calculation.targetRevision.timeExpired ||
                          calculation.targetRevision.firstCriterion === 'time'
                            ? 'bg-brand'
                            : 'bg-ink/70'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(4, calculation.targetRevision.timeCyclePercent))}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-muted tabular-nums">
                      <span>
                        {t.saleLabel} {calculation.saleDateBR}
                      </span>
                      <span>
                        {t.dueDateLabel} {calculation.targetRevision.targetDateBR}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Integrated Model Parts Breakdown + WhatsApp Schedule Modal */}
                <div className="mt-5 rounded-xl border border-border bg-surface p-4">
                  {selectedModel && modelEstimate && targetRevisionNumber ? (
                    <div className="space-y-3.5">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-brand-text">
                            {t.estimateTitle(targetRevisionNumber, selectedModel.name)}
                          </p>
                          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
                            <span className="font-display text-2xl font-extrabold text-ink tabular-nums">
                              {formatBRL(modelEstimate.totalWithOptionals)}
                            </span>
                            <span className="text-xs text-ink-muted tabular-nums">
                              ({modelEstimate.items.length}{' '}
                              {modelEstimate.items.length === 1 ? 'item' : 'itens'} ·{' '}
                              {isFreeLaborRevision(targetRevisionNumber)
                                ? laborTexts.freeBadge
                                : `${laborTexts.laborItemLabel}: ${formatBRL(modelEstimate.laborCost)}`}
                              )
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onViewModelInTable(selectedModel.id, targetRevisionNumber)
                            }
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-ink transition-colors hover:border-brand hover:text-brand-text"
                          >
                            {t.viewTableBtn}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenWhatsAppModalForSnapshot(calculation.targetRevision)
                            }
                            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-whatsapp px-4 py-2.5 text-xs font-bold text-on-whatsapp shadow-xs transition-colors hover:bg-whatsapp-hover"
                          >
                            <WhatsAppIcon className="h-3.5 w-3.5" />
                            {t.bookWhatsAppBtn}
                          </button>
                        </div>
                      </div>

                      {sortedPreviewItems.length > 0 && (
                        <ul className="divide-y divide-border/70 border-t border-border pt-2 text-xs">
                          {sortedPreviewItems.slice(0, 5).map(({ revisionPart, part, lineTotal }) => {
                            const desc = translatePartDescription(part.description, language);
                            return (
                              <li
                                key={`${revisionPart.id}-${part.code}`}
                                className="flex items-center justify-between gap-3 py-1.5 text-ink-muted"
                              >
                                <span className="min-w-0 truncate">
                                  {desc}
                                  {part.is_optional && !/\[opcional\]|\[optional\]/i.test(desc)
                                    ? ' [Opcional]'
                                    : ''}
                                </span>
                                <span className="shrink-0 font-semibold text-ink tabular-nums">
                                  {formatBRL(lineTotal)}
                                </span>
                              </li>
                            );
                          })}
                          {sortedPreviewItems.length > 5 && (
                            <li className="pt-1.5 text-[11px] font-medium text-ink-muted">
                              {t.moreItemsLabel(sortedPreviewItems.length - 5)}
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-ink">
                          {t.estimateGenericTitle(calculation.targetRevision.revisionNumber)}
                          {selectedModel ? ` · Honda ${selectedModel.name}` : ''}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                          {t.estimateGenericDesc}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenWhatsAppModalForSnapshot(calculation.targetRevision)
                        }
                        className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-whatsapp px-4 py-2.5 text-xs font-bold text-on-whatsapp shadow-xs transition-colors hover:bg-whatsapp-hover"
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5" />
                        {t.bookWhatsAppBtn}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Linha do tempo das revisões Honda (1ª até 9ª Revisão, sem / Xm) */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_2px_10px_rgba(17,24,39,0.04)] sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3.5">
                  <div>
                    <h4 className="font-display text-base font-bold text-ink">
                      {t.timelineTitle}
                    </h4>
                    <p className="text-xs text-ink-muted">{copy.timelineHint}</p>
                  </div>
                </div>

                <div className="mt-4 divide-y divide-border">
                  {calculation.timeline.map((item) => {
                    const isCurrentTarget =
                      item.revisionNumber === calculation.targetRevision.revisionNumber;
                    const localizedLabel = translateRevisionLabel(
                      item.revisionNumber,
                      `${item.revisionNumber}ª Revisão`,
                      language
                    );
                    return (
                      <div
                        key={item.revisionNumber}
                        className={`flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center ${
                          isCurrentTarget ? 'my-1 rounded-xl bg-brand-soft/45 px-3' : 'px-1'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-xs font-extrabold tabular-nums ${
                              item.status === 'completed'
                                ? 'bg-surface-neutral text-ink-muted'
                                : isCurrentTarget || item.status === 'overdue'
                                  ? 'bg-brand text-on-brand'
                                  : item.warrantyState === 'warning'
                                    ? 'bg-amber-600 text-white'
                                    : 'border border-border bg-surface text-ink'
                            }`}
                          >
                            {item.revisionNumber}ª
                          </span>
                          <div>
                            <p className="font-display text-sm font-bold text-ink tabular-nums">
                              {localizedLabel} · {formatKmPT(item.targetKm)} km
                            </p>
                            <p className="text-xs text-ink-muted tabular-nums">
                              {t.dueDateLabel} {item.targetDateBR} ·{' '}
                              {item.kmToleranceExceeded
                                ? `+${formatKmPT(item.kmExceededMaxTolerance)} km`
                                : item.toleranceZone === 'tolerance_grace'
                                  ? `+${formatKmPT(item.kmExceeded)} km (${t.badgeTolerance})`
                                  : `${t.remainingPrefix} ${formatKmPT(item.kmRemaining)} km`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pl-11 sm:pl-0">
                          <span
                            className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold ${
                              item.status === 'completed'
                                ? 'bg-surface-neutral text-ink-muted'
                                : item.status === 'overdue'
                                  ? 'bg-brand-soft text-brand-text'
                                  : item.toleranceZone === 'tolerance_grace' ||
                                      item.warrantyState === 'warning'
                                    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                                    : item.toleranceZone === 'ideal_window' ||
                                        isCurrentTarget ||
                                        item.status === 'upcoming'
                                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                                      : 'border border-border bg-surface text-ink-muted'
                            }`}
                          >
                            {item.status === 'completed'
                              ? t.badgeDone
                              : item.status === 'overdue'
                                ? `${t.badgeOverdue} (${getCriterionLabel(item.firstCriterion)})`
                                : item.toleranceZone === 'tolerance_grace'
                                  ? t.badgeTolerance
                                  : item.toleranceZone === 'ideal_window'
                                    ? t.badgeIdeal
                                    : item.warrantyState === 'warning'
                                      ? `${t.badgeWarning} · ${t.badgeNext}`
                                      : isCurrentTarget || item.status === 'upcoming'
                                        ? t.badgeNext
                                        : t.badgeFuture}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
