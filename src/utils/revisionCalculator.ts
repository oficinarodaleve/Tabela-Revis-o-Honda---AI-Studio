import type { CalculatorSettings, WarrantyStatusState } from '../types';

export const DEFAULT_CALCULATOR_SETTINGS: CalculatorSettings = {
  first_revision_km: 1000,
  first_revision_months: 6,
  subsequent_km_step: 6000,
  subsequent_months_step: 6,
  warning_km_window: 500,
  warning_days_window: 30,
  eyebrow_text: 'SIMULADOR OFICIAL DE REVISÕES',
  title_text: 'Calculadora de Revisões Honda',
  subtitle_text:
    'Descubra qual é a sua próxima revisão e o que vence primeiro — 1ª revisão com 1.000 km ou 6 meses e as seguintes a cada 6.000 km ou 6 meses a partir da data de venda.',
  rule_badge_text: '1ª em 1.000 km ou 6 meses · Demais a cada 6.000 km ou 6 meses',
  sale_date_help_text:
    'Informe a data de venda constante no manual do proprietário ou na nota fiscal de compra da motocicleta.',
  warranty_ok_text:
    'Respeitar o prazo de data ou quilometragem mantém a garantia de fábrica da Honda ativa.',
  warranty_warning_text:
    'Atenção preventiva: sua motocicleta está próxima do limite de quilometragem ou da data prevista. Agende sua revisão com antecedência para não correr o risco de perder ou comprometer a garantia de fábrica da moto.',
  warranty_overdue_text:
    'Atenção: ultrapassar a data limite ou a quilometragem prevista para a revisão compromete a garantia de fábrica da sua moto. Agende o atendimento o quanto antes para avaliação da nossa equipe.',
};

export function normalizeCalculatorSettings(raw: unknown): CalculatorSettings {
  const r =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Partial<CalculatorSettings>)
      : {};
  const toPositiveInt = (val: unknown, fallback: number, min = 1, max = 500000) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    const rounded = Math.round(n);
    if (rounded < min || rounded > max) return fallback;
    return rounded;
  };
  const toNonEmpty = (val: unknown, fallback: string) =>
    typeof val === 'string' && val.trim().length > 0 ? val : fallback;

  return {
    first_revision_km: toPositiveInt(
      r.first_revision_km,
      DEFAULT_CALCULATOR_SETTINGS.first_revision_km,
      100,
      100000
    ),
    first_revision_months: toPositiveInt(
      r.first_revision_months,
      DEFAULT_CALCULATOR_SETTINGS.first_revision_months,
      1,
      60
    ),
    subsequent_km_step: toPositiveInt(
      r.subsequent_km_step,
      DEFAULT_CALCULATOR_SETTINGS.subsequent_km_step,
      500,
      100000
    ),
    subsequent_months_step: toPositiveInt(
      r.subsequent_months_step,
      DEFAULT_CALCULATOR_SETTINGS.subsequent_months_step,
      1,
      60
    ),
    warning_km_window: toPositiveInt(
      r.warning_km_window,
      DEFAULT_CALCULATOR_SETTINGS.warning_km_window,
      50,
      10000
    ),
    warning_days_window: toPositiveInt(
      r.warning_days_window,
      DEFAULT_CALCULATOR_SETTINGS.warning_days_window,
      1,
      180
    ),
    eyebrow_text: toNonEmpty(r.eyebrow_text, DEFAULT_CALCULATOR_SETTINGS.eyebrow_text),
    title_text: toNonEmpty(r.title_text, DEFAULT_CALCULATOR_SETTINGS.title_text),
    subtitle_text: toNonEmpty(r.subtitle_text, DEFAULT_CALCULATOR_SETTINGS.subtitle_text),
    rule_badge_text: toNonEmpty(r.rule_badge_text, DEFAULT_CALCULATOR_SETTINGS.rule_badge_text),
    sale_date_help_text: toNonEmpty(
      r.sale_date_help_text,
      DEFAULT_CALCULATOR_SETTINGS.sale_date_help_text
    ),
    warranty_ok_text: toNonEmpty(r.warranty_ok_text, DEFAULT_CALCULATOR_SETTINGS.warranty_ok_text),
    warranty_warning_text: toNonEmpty(
      r.warranty_warning_text,
      DEFAULT_CALCULATOR_SETTINGS.warranty_warning_text
    ),
    warranty_overdue_text: toNonEmpty(
      r.warranty_overdue_text,
      DEFAULT_CALCULATOR_SETTINGS.warranty_overdue_text
    ),
  };
}

const MS_PER_DAY = 86_400_000;

export type LimitingCriterion = 'km' | 'time' | 'both';
export type CycleStatus = 'completed' | 'overdue' | 'upcoming' | 'future';
export type ToleranceZone =
  | 'before_window'
  | 'ideal_window'
  | 'tolerance_grace'
  | 'exceeded_limit';

export interface RevisionCycleSnapshot {
  revisionNumber: number;
  targetKm: number;
  prevKm: number;
  toleranceKm: number;
  minIdealKm: number;
  maxToleranceKm: number;
  targetMonths: number;
  targetDate: Date;
  targetDateISO: string;
  targetDateBR: string;
  prevDate: Date;
  // KM metrics relative to targetKm and maxToleranceKm
  kmRemaining: number;
  kmExceeded: number;
  kmUntilMaxTolerance: number;
  kmExceededMaxTolerance: number;
  kmReached: boolean;
  kmToleranceExceeded: boolean;
  kmCyclePercent: number;
  // Time metrics relative to targetDate
  daysRemaining: number;
  daysExceeded: number;
  timeReached: boolean;
  timeExpired: boolean;
  timeCyclePercent: number;
  timeRemainingBreakdown: { months: number; days: number };
  timeExceededBreakdown: { months: number; days: number };
  // Combined evaluation
  toleranceZone: ToleranceZone;
  isDueOrReached: boolean;
  isWithinWarningWindow: boolean;
  warrantyState: WarrantyStatusState;
  firstCriterion: LimitingCriterion;
  status: CycleStatus;
}

export interface RevisionCalculationResult {
  isValid: true;
  settings: CalculatorSettings;
  currentKm: number;
  saleDate: Date;
  saleDateISO: string;
  saleDateBR: string;
  todayDate: Date;
  todayISO: string;
  daysSinceSale: number;
  monthsSinceSale: { months: number; days: number };
  highestExceededByKm: number;
  highestExceededByTime: number;
  latestReachedRevision: number;
  nextUnreachedRevision: number;
  effectiveLastCompleted: number;
  targetRevision: RevisionCycleSnapshot;
  pendingAlertRevision: RevisionCycleSnapshot | null;
  timeline: RevisionCycleSnapshot[];
}

export interface RevisionValidationErrors {
  kmError?: string;
  dateError?: string;
}

function toUtcDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY;
}

export function getTodayLocalDate(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function parseLocalDateISO(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function addCalendarMonths(baseDate: Date, monthsToAdd: number): Date {
  const totalMonths = baseDate.getFullYear() * 12 + baseDate.getMonth() + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const maxDayInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(baseDate.getDate(), maxDayInTargetMonth);
  return new Date(targetYear, targetMonth, clampedDay, 0, 0, 0, 0);
}

export function diffCalendarMonthsAndDays(
  fromDate: Date,
  toDate: Date
): { months: number; days: number } {
  const fromDayNum = toUtcDayNumber(fromDate);
  const toDayNum = toUtcDayNumber(toDate);
  if (toDayNum <= fromDayNum) {
    return { months: 0, days: 0 };
  }

  let estMonths =
    (toDate.getFullYear() - fromDate.getFullYear()) * 12 +
    (toDate.getMonth() - fromDate.getMonth());
  if (toDate.getDate() < fromDate.getDate()) {
    estMonths -= 1;
  }
  estMonths = Math.max(0, estMonths);

  while (toUtcDayNumber(addCalendarMonths(fromDate, estMonths + 1)) <= toDayNum) {
    estMonths += 1;
  }
  while (estMonths > 0 && toUtcDayNumber(addCalendarMonths(fromDate, estMonths)) > toDayNum) {
    estMonths -= 1;
  }

  const anchor = addCalendarMonths(fromDate, estMonths);
  const remDays = Math.max(0, Math.round(toDayNum - toUtcDayNumber(anchor)));
  return { months: estMonths, days: remDays };
}

export function formatKmPT(km: number): string {
  const safe = Number.isFinite(km) ? Math.max(0, Math.round(km)) : 0;
  return safe.toLocaleString('pt-BR');
}

export function parseKmInput(raw: string): {
  isEmpty: boolean;
  isNegative: boolean;
  value: number | null;
} {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { isEmpty: true, isNegative: false, value: null };
  }
  if (trimmed.includes('-')) {
    return { isEmpty: false, isNegative: true, value: null };
  }
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) {
    return { isEmpty: true, isNegative: false, value: null };
  }
  const num = Number(digitsOnly);
  if (!Number.isFinite(num) || num < 0) {
    return { isEmpty: false, isNegative: true, value: null };
  }
  return { isEmpty: false, isNegative: false, value: Math.round(num) };
}

export function formatKmTyping(raw: string): string {
  const digitsOnly = (raw || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  const cleaned = digitsOnly.slice(0, 7);
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return '';
  return num.toLocaleString('pt-BR');
}

export function validateCalculatorInputs(
  kmRaw: string,
  saleDateISO: string,
  referenceNow: Date = new Date()
): RevisionValidationErrors {
  const errors: RevisionValidationErrors = {};
  const parsedKm = parseKmInput(kmRaw);
  if (parsedKm.isNegative) {
    errors.kmError = 'A quilometragem atual não pode ser negativa.';
  } else if (parsedKm.isEmpty || parsedKm.value === null) {
    errors.kmError = 'Informe a quilometragem atual da motocicleta.';
  }

  if (!saleDateISO || !saleDateISO.trim()) {
    errors.dateError = 'Informe a data de venda constante no manual ou na nota fiscal.';
  } else {
    const parsedDate = parseLocalDateISO(saleDateISO);
    if (!parsedDate) {
      errors.dateError = 'Data de venda inválida.';
    } else {
      const today = getTodayLocalDate(referenceNow);
      if (toUtcDayNumber(parsedDate) > toUtcDayNumber(today)) {
        errors.dateError = 'A data de venda não pode ser uma data futura.';
      }
    }
  }

  return errors;
}

/**
 * 1ª revisão: 1.000 km (ou first_revision_km)
 * 2ª em diante (N >= 2): 6.000 * (N - 1) km (ou subsequent_km_step * (N - 1))
 */
export function getTargetKmForRevision(
  revisionNumber: number,
  settings: CalculatorSettings = DEFAULT_CALCULATOR_SETTINGS
): number {
  const n = Math.max(1, Math.floor(revisionNumber));
  if (n === 1) return settings.first_revision_km;
  return settings.subsequent_km_step * (n - 1);
}

/**
 * Tolerância de quilometragem:
 * 1ª revisão: ±100 km (10% de 1.000 km -> 900 km a 1.100 km)
 * 2ª em diante (N >= 2): ±600 km (10% de 6.000 km -> ex.: 5.400 km a 6.600 km)
 */
export function getToleranceKmForRevision(
  revisionNumber: number,
  settings: CalculatorSettings = DEFAULT_CALCULATOR_SETTINGS
): number {
  const n = Math.max(1, Math.floor(revisionNumber));
  if (n === 1) {
    return Math.max(50, Math.round(settings.first_revision_km * 0.1));
  }
  return Math.max(100, Math.round(settings.subsequent_km_step * 0.1));
}

/**
 * 1ª revisão: 6 meses (ou first_revision_months)
 * 2ª em diante (N >= 2): first_revision_months + subsequent_months_step * (N - 1) -> 12, 18, 24, ...
 */
export function getTargetMonthsForRevision(
  revisionNumber: number,
  settings: CalculatorSettings = DEFAULT_CALCULATOR_SETTINGS
): number {
  const n = Math.max(1, Math.floor(revisionNumber));
  if (n === 1) return settings.first_revision_months;
  return settings.first_revision_months + settings.subsequent_months_step * (n - 1);
}

/**
 * Formata dinamicamente a duração total em meses seguindo o padrão:
 * 6 -> "6 meses"
 * 12 -> "1 ano"
 * 18 -> "1 ano e 6 meses"
 * 24 -> "2 anos"
 * 30 -> "2 anos e 6 meses", etc.
 */
export function formatRevisionTimeframe(
  totalMonths: number,
  language: 'pt' | 'en' | 'es' = 'pt'
): string {
  const safeMonths = Math.max(1, Math.round(totalMonths));
  const years = Math.floor(safeMonths / 12);
  const remMonths = safeMonths % 12;

  if (language === 'en') {
    if (years === 0) {
      return `${safeMonths} ${safeMonths === 1 ? 'month' : 'months'}`;
    }
    const yearPart = `${years} ${years === 1 ? 'year' : 'years'}`;
    if (remMonths === 0) return yearPart;
    return `${yearPart} and ${remMonths} ${remMonths === 1 ? 'month' : 'months'}`;
  }

  if (language === 'es') {
    if (years === 0) {
      return `${safeMonths} ${safeMonths === 1 ? 'mes' : 'meses'}`;
    }
    const yearPart = `${years} ${years === 1 ? 'año' : 'años'}`;
    if (remMonths === 0) return yearPart;
    return `${yearPart} y ${remMonths} ${remMonths === 1 ? 'mes' : 'meses'}`;
  }

  if (years === 0) {
    return `${safeMonths} ${safeMonths === 1 ? 'mês' : 'meses'}`;
  }
  const yearPart = `${years} ${years === 1 ? 'ano' : 'anos'}`;
  if (remMonths === 0) return yearPart;
  return `${yearPart} e ${remMonths} ${remMonths === 1 ? 'mês' : 'meses'}`;
}

export function buildRevisionCycleSnapshot(
  revisionNumber: number,
  currentKm: number,
  saleDate: Date,
  todayDate: Date,
  completedUpTo: number,
  settings: CalculatorSettings = DEFAULT_CALCULATOR_SETTINGS
): RevisionCycleSnapshot {
  const n = Math.max(1, Math.floor(revisionNumber));
  const targetKm = getTargetKmForRevision(n, settings);
  const prevKm = n === 1 ? 0 : getTargetKmForRevision(n - 1, settings);
  const toleranceKm = getToleranceKmForRevision(n, settings);
  const minIdealKm = Math.max(0, targetKm - toleranceKm);
  const maxToleranceKm = targetKm + toleranceKm;
  const cycleKmSpan = Math.max(1, targetKm - prevKm);

  const targetMonths = getTargetMonthsForRevision(n, settings);
  const prevMonths = n === 1 ? 0 : getTargetMonthsForRevision(n - 1, settings);
  const targetDate = addCalendarMonths(saleDate, targetMonths);
  const prevDate = n === 1 ? saleDate : addCalendarMonths(saleDate, prevMonths);

  const kmRemaining = Math.max(0, targetKm - currentKm);
  const kmExceeded = Math.max(0, currentKm - targetKm);
  const kmUntilMaxTolerance = Math.max(0, maxToleranceKm - currentKm);
  const kmExceededMaxTolerance = Math.max(0, currentKm - maxToleranceKm);
  const kmReached = currentKm >= targetKm;
  const kmToleranceExceeded = currentKm > maxToleranceKm;
  const kmCyclePercent = Math.max(
    0,
    Math.round(((currentKm - prevKm) / cycleKmSpan) * 1000) / 10
  );

  const todayNum = toUtcDayNumber(todayDate);
  const targetNum = toUtcDayNumber(targetDate);
  const prevNum = toUtcDayNumber(prevDate);
  const cycleTotalDays = Math.max(1, targetNum - prevNum);
  const elapsedCycleDays = todayNum - prevNum;

  const daysRemaining = Math.max(0, Math.round(targetNum - todayNum));
  const daysExceeded = Math.max(0, Math.round(todayNum - targetNum));
  const timeReached = todayNum >= targetNum;
  const timeExpired = todayNum > targetNum;
  const timeCyclePercent = Math.max(
    0,
    Math.round((elapsedCycleDays / cycleTotalDays) * 1000) / 10
  );

  const timeRemainingBreakdown = timeReached
    ? { months: 0, days: 0 }
    : diffCalendarMonthsAndDays(todayDate, targetDate);
  const timeExceededBreakdown = timeExpired
    ? diffCalendarMonthsAndDays(targetDate, todayDate)
    : { months: 0, days: 0 };

  let toleranceZone: ToleranceZone;
  if (kmToleranceExceeded || timeExpired) {
    toleranceZone = 'exceeded_limit';
  } else if (currentKm > targetKm && currentKm <= maxToleranceKm) {
    toleranceZone = 'tolerance_grace';
  } else if (currentKm >= minIdealKm && currentKm <= targetKm) {
    toleranceZone = 'ideal_window';
  } else {
    toleranceZone = 'before_window';
  }

  const isDueOrReached = kmToleranceExceeded || timeExpired;

  const isWithinWarningWindow =
    !isDueOrReached &&
    (toleranceZone === 'tolerance_grace' || daysRemaining <= settings.warning_days_window);

  const warrantyState: WarrantyStatusState = isDueOrReached
    ? 'overdue'
    : toleranceZone === 'tolerance_grace' ||
        (toleranceZone === 'before_window' && daysRemaining <= settings.warning_days_window)
      ? 'warning'
      : 'on_track';

  let firstCriterion: LimitingCriterion;
  if (kmToleranceExceeded && timeExpired) {
    firstCriterion = 'both';
  } else if (kmToleranceExceeded) {
    firstCriterion = 'km';
  } else if (timeExpired) {
    firstCriterion = 'time';
  } else if (toleranceZone === 'tolerance_grace') {
    firstCriterion = 'km';
  } else if (Math.abs(kmCyclePercent - timeCyclePercent) >= 0.5) {
    firstCriterion = kmCyclePercent >= timeCyclePercent ? 'km' : 'time';
  } else {
    const totalKmRatio = currentKm / Math.max(1, targetKm);
    const totalTimeRatio =
      Math.max(0, todayNum - toUtcDayNumber(saleDate)) /
      Math.max(1, targetNum - toUtcDayNumber(saleDate));
    firstCriterion = totalKmRatio >= totalTimeRatio ? 'km' : 'time';
  }

  let status: CycleStatus;
  if (n <= completedUpTo) {
    status = 'completed';
  } else if (isDueOrReached) {
    status = 'overdue';
  } else if (n === completedUpTo + 1) {
    status = 'upcoming';
  } else {
    status = 'future';
  }

  return {
    revisionNumber: n,
    targetKm,
    prevKm,
    toleranceKm,
    minIdealKm,
    maxToleranceKm,
    targetMonths,
    targetDate,
    targetDateISO: formatDateISO(targetDate),
    targetDateBR: formatDateBR(targetDate),
    prevDate,
    kmRemaining,
    kmExceeded,
    kmUntilMaxTolerance,
    kmExceededMaxTolerance,
    kmReached,
    kmToleranceExceeded,
    kmCyclePercent,
    daysRemaining,
    daysExceeded,
    timeReached,
    timeExpired,
    timeCyclePercent,
    timeRemainingBreakdown,
    timeExceededBreakdown,
    toleranceZone,
    isDueOrReached,
    isWithinWarningWindow,
    warrantyState,
    firstCriterion,
    status,
  };
}

export function calculateRevisionSchedule(params: {
  currentKm: number;
  saleDateISO: string;
  lastCompletedRevision?: 'auto' | number;
  referenceNow?: Date;
  settings?: CalculatorSettings | null;
}): RevisionCalculationResult | null {
  const {
    currentKm,
    saleDateISO,
    lastCompletedRevision = 'auto',
    referenceNow = new Date(),
    settings: rawSettings,
  } = params;

  const settings = normalizeCalculatorSettings(rawSettings);
  if (!Number.isFinite(currentKm) || currentKm < 0) return null;
  const saleDate = parseLocalDateISO(saleDateISO);
  if (!saleDate) return null;

  const todayDate = getTodayLocalDate(referenceNow);
  const todayNum = toUtcDayNumber(todayDate);
  const saleNum = toUtcDayNumber(saleDate);
  if (saleNum > todayNum) return null;

  const safeKm = Math.round(currentKm);
  const daysSinceSale = Math.max(0, Math.round(todayNum - saleNum));
  const monthsSinceSale = diffCalendarMonthsAndDays(saleDate, todayDate);

  // Highest revision whose MAX tolerance (targetKm + toleranceKm) was strictly exceeded
  let highestExceededByKm = 0;
  while (
    safeKm >
    getTargetKmForRevision(highestExceededByKm + 1, settings) +
      getToleranceKmForRevision(highestExceededByKm + 1, settings)
  ) {
    highestExceededByKm += 1;
    if (highestExceededByKm > 500) break;
  }

  // Highest revision whose due date strictly expired (today > targetDate)
  let highestExceededByTime = 0;
  while (
    toUtcDayNumber(
      addCalendarMonths(saleDate, getTargetMonthsForRevision(highestExceededByTime + 1, settings))
    ) < todayNum
  ) {
    highestExceededByTime += 1;
    if (highestExceededByTime > 500) break;
  }

  const latestReachedRevision = Math.max(highestExceededByKm, highestExceededByTime);
  const nextUnreachedRevision = latestReachedRevision + 1;

  const effectiveLastCompleted =
    lastCompletedRevision === 'auto'
      ? Math.max(0, latestReachedRevision - 1)
      : Math.max(0, Math.floor(lastCompletedRevision));

  const targetRevisionNumber =
    lastCompletedRevision === 'auto' ? nextUnreachedRevision : effectiveLastCompleted + 1;

  const targetRevision = buildRevisionCycleSnapshot(
    targetRevisionNumber,
    safeKm,
    saleDate,
    todayDate,
    effectiveLastCompleted,
    settings
  );

  // If the customer is already inside the active window (ideal or tolerance) of `targetRevision`,
  // do not show a stale red alert for the previous cycle (`targetRevisionNumber - 1`).
  const isTargetAlreadyInWindow =
    targetRevision.toleranceZone === 'ideal_window' ||
    targetRevision.toleranceZone === 'tolerance_grace' ||
    targetRevision.daysRemaining <= settings.warning_days_window;

  const pendingAlertRevision =
    lastCompletedRevision === 'auto' && latestReachedRevision >= 1 && !isTargetAlreadyInWindow
      ? buildRevisionCycleSnapshot(
          latestReachedRevision,
          safeKm,
          saleDate,
          todayDate,
          Math.max(0, latestReachedRevision - 1),
          settings
        )
      : null;

  // Exibe no mínimo 1ª..9ª Revisão e expande dinamicamente caso a revisão alvo ultrapasse a 9ª
  const maxTimelineRevision = Math.min(25, Math.max(9, targetRevisionNumber));
  const timeline: RevisionCycleSnapshot[] = [];
  for (let n = 1; n <= maxTimelineRevision; n += 1) {
    timeline.push(
      buildRevisionCycleSnapshot(n, safeKm, saleDate, todayDate, effectiveLastCompleted, settings)
    );
  }

  return {
    isValid: true,
    settings,
    currentKm: safeKm,
    saleDate,
    saleDateISO: formatDateISO(saleDate),
    saleDateBR: formatDateBR(saleDate),
    todayDate,
    todayISO: formatDateISO(todayDate),
    daysSinceSale,
    monthsSinceSale,
    highestExceededByKm,
    highestExceededByTime,
    latestReachedRevision,
    nextUnreachedRevision,
    effectiveLastCompleted,
    targetRevision,
    pendingAlertRevision,
    timeline,
  };
}
