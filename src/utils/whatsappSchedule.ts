import { CalculatorContextForWhatsApp, MotoModel, UnitLocation } from '../types';
import { getUnitWhatsAppNumber, sanitizeWhatsAppDigits } from '../components/WhatsAppIcon';
import {
  ComputedRevisionSummary,
  comparePartNamesPT,
  formatBRL,
  formatExactOilQuantity,
  formatLitersPT,
  formatPartQuantity,
  isFreeLaborRevision,
} from './pricing';
import { formatKmPT } from './revisionCalculator';

export interface BuildWhatsAppMessageParams {
  model: MotoModel;
  revisionNumber: number;
  revisionLabel: string;
  revisionSubtitle?: string;
  summary: ComputedRevisionSummary;
  includeOptionals: boolean;
  unit?: UnitLocation;
  includeDownloadedImageNote?: boolean;
  calculatorContext?: CalculatorContextForWhatsApp;
}

function formatUnitAddress(unit?: UnitLocation): string {
  if (!unit) return '';
  const streetPart = unit.street
    ? `${unit.street}${unit.number ? `, ${unit.number}` : ''}`
    : '';
  const cityState =
    unit.city && unit.state ? `${unit.city} - ${unit.state}` : unit.city || '';
  return [streetPart, unit.neighborhood || '', cityState].filter(Boolean).join(', ');
}

export function buildWhatsAppScheduleMessage({
  model,
  revisionNumber,
  revisionLabel,
  revisionSubtitle,
  summary,
  includeOptionals,
  unit,
  includeDownloadedImageNote = false,
  calculatorContext,
}: BuildWhatsAppMessageParams): string {
  const unitCity = unit?.city || unit?.name || 'Vitória da Conquista';
  const unitAddress = formatUnitAddress(unit);
  const revDisplay = revisionSubtitle
    ? `${revisionLabel} (${revisionSubtitle})`
    : revisionLabel;
  const displayModelName = calculatorContext?.modelLabel || model.name;

  const activeItems = [...summary.items]
    .filter(({ part }) => (includeOptionals ? true : !part.is_optional))
    .sort((a, b) => {
      const byName = comparePartNamesPT(a.part.description, b.part.description);
      if (byName !== 0) return byName;
      return comparePartNamesPT(a.part.code, b.part.code);
    });

  const hasOptionals = summary.items.some(({ part }) => part.is_optional);
  const estimatedTotal = includeOptionals
    ? summary.totalWithOptionals
    : summary.totalWithoutOptionals;
  const isFreeLabor = isFreeLaborRevision(revisionNumber);

  const lines: string[] = [
    `Olá, Rodaleve! Gostaria de agendar a *${revDisplay}* da minha *${displayModelName.toUpperCase()}* na unidade de *${unitCity}*.`,
  ];

  if (unitAddress) {
    lines.push(`📍 *Endereço:* ${unitAddress}`);
  }

  if (calculatorContext) {
    lines.push('');
    lines.push('*Dados da Calculadora de Revisões:*');
    lines.push(`• *Modelo:* ${calculatorContext.modelLabel}`);
    lines.push(`• *Quilometragem atual:* ${formatKmPT(calculatorContext.currentKm)} km`);
    lines.push(`• *Data de venda (manual/NF):* ${calculatorContext.saleDateBR}`);
    lines.push(
      `• *Revisão identificada:* ${revisionLabel} (${calculatorContext.revisionSubtitle})`
    );
    lines.push(`• *Critério principal:* ${calculatorContext.criterionLabel}`);
    lines.push(`• *Limite por tempo:* ${calculatorContext.targetDateBR}`);
    lines.push(`• *Status prazo/garantia:* ${calculatorContext.warrantyStatusTitle}`);
  }

  lines.push('');

  if (activeItems.length > 0) {
    lines.push('*Resumo estimado das peças:*');
    for (const { revisionPart, part, lineTotal, oilMeta } of activeItems) {
      let qtySuffix = '';
      if (oilMeta?.isEngineOil) {
        if (oilMeta.saleMode === 'closed_bottle_1l') {
          const bottleWord = oilMeta.bottles === 1 ? 'frasco' : 'frascos';
          qtySuffix =
            oilMeta.surplusMl > 0
              ? ` (${oilMeta.bottles} ${bottleWord} de 1L — ${formatLitersPT(oilMeta.oilLiters)}L no motor + ${oilMeta.surplusMl}ml de sobra entregue ao cliente)`
              : ` (${oilMeta.bottles} ${bottleWord} de 1L — ${formatLitersPT(oilMeta.oilLiters)}L)`;
        } else {
          qtySuffix = ` (${formatExactOilQuantity(oilMeta.oilLiters)})`;
        }
      } else if (part.unit === 'ML' || revisionPart.quantity > 1) {
        qtySuffix = ` (${formatPartQuantity(part, revisionPart.quantity)})`;
      }

      const rawDescription = (part.description || '').trim();
      const alreadyTaggedOptional = /\[opcional\]|\[optional\]/i.test(rawDescription);
      const optTag = part.is_optional && !alreadyTaggedOptional ? ' [Opcional]' : '';

      lines.push(`• ${rawDescription}${optTag}${qtySuffix}: ${formatBRL(lineTotal)}`);
    }
    lines.push('');
  } else if (calculatorContext && !calculatorContext.hasCatalogEstimate) {
    lines.push(
      '_Solicito orçamento personalizado de peças e mão de obra para esta revisão._'
    );
    lines.push('');
  }

  if (!isFreeLabor && summary.laborCost > 0) {
    lines.push(`• Mão de obra (a partir da 3.ª revisão): ${formatBRL(summary.laborCost)}`);
    lines.push('');
  }

  if (hasOptionals) {
    lines.push(
      includeOptionals
        ? '_Inclui itens opcionais selecionados no simulador._'
        : '_Orçamento somente com peças obrigatórias (sem itens opcionais)._'
    );
  }

  if (estimatedTotal > 0) {
    lines.push(`*Valor total estimado:* ${formatBRL(estimatedTotal)}`);
  }
  lines.push(
    isFreeLabor
      ? '_Mão de obra gratuita: 1.ª e 2.ª revisão (conforme manual)._'
      : '_Mão de obra cobrada conforme tabela / manual. Solicito confirmação de horário para agendamento prévio._'
  );

  if (includeDownloadedImageNote) {
    lines.push(
      '_Imagem do resumo salva como "revisao-rodaleve.png" caso deseje anexar na conversa._'
    );
  }

  return lines.join('\n');
}

export function buildRodaleveApiWhatsAppUrl(message: string, rawPhone?: string): string {
  const digits = sanitizeWhatsAppDigits(rawPhone || '557728880003');
  return `https://api.whatsapp.com/send/?phone=${digits}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
}

export function openExternalLink(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function preloadHtml2Canvas(): void {
  void import('html2canvas').catch(() => {});
}

function normalizeColorForHtml2Canvas(
  ctx: CanvasRenderingContext2D | null,
  value: string,
  fallback: string
): string {
  if (!value) return value;
  const lower = value.toLowerCase();
  if (!lower.includes('oklab') && !lower.includes('oklch') && !lower.includes('color-mix')) {
    return value;
  }
  if (ctx) {
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000000';
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      const alpha = Number((data[3] / 255).toFixed(3));
      return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${alpha})`;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

async function waitForImagesInElement(element: HTMLElement): Promise<void> {
  const imgs = Array.from(element.querySelectorAll('img'));
  if (imgs.length === 0) return;
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.loading === 'lazy') {
            img.loading = 'eager';
          }
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const timer = window.setTimeout(resolve, 1200);
          const done = () => {
            window.clearTimeout(timer);
            resolve();
          };
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        })
    )
  );
}

function triggerFileDownload(href: string, filename: string, revokeAfterMs?: number): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (revokeAfterMs && href.startsWith('blob:')) {
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(href);
      } catch {
        // Ignora erro de revoke
      }
    }, revokeAfterMs);
  }
}

export async function downloadElementAsPng(
  element: HTMLElement,
  darkMode: boolean,
  filename = 'revisao-rodaleve.png'
): Promise<boolean> {
  try {
    await waitForImagesInElement(element);
    const { default: html2canvas } = await import('html2canvas');

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = 1;
    tmpCanvas.height = 1;
    const colorCtx = tmpCanvas.getContext('2d');

    const origImgs = Array.from(element.querySelectorAll('img'));

    const renderPromise = html2canvas(element, {
      useCORS: true,
      scale: 2,
      backgroundColor: darkMode ? '#171A21' : '#FFFFFF',
      logging: false,
      ignoreElements: (el) => el.getAttribute('data-html2canvas-ignore') === 'true',
      onclone: (clonedDoc, clonedEl) => {
        clonedEl.style.position = 'static';
        clonedEl.style.left = 'auto';
        clonedEl.style.top = 'auto';
        clonedEl.style.transform = 'none';
        clonedEl.style.transition = 'none';
        clonedEl.style.boxShadow = '0 4px 16px rgba(17, 24, 39, 0.08)';
        clonedEl.style.opacity = '1';
        clonedEl.style.filter = 'none';
        clonedEl.style.maxHeight = 'none';
        clonedEl.style.height = 'auto';
        clonedEl.style.overflow = 'visible';

        // Remove action buttons and close button from captured quote
        clonedEl.querySelectorAll('[data-html2canvas-ignore="true"]').forEach((node) => {
          node.remove();
        });

        // Expand scrollable items list so all items are visible in the image
        clonedEl
          .querySelectorAll<HTMLElement>('[data-capture-scroll-list="true"]')
          .forEach((listEl) => {
            listEl.style.height = 'auto';
            listEl.style.maxHeight = 'none';
            listEl.style.overflow = 'visible';
            listEl.style.flex = 'none';
          });

        // Standard RGB linear gradient if footer uses Tailwind v4 `in oklab`
        clonedEl
          .querySelectorAll<HTMLElement>('[data-capture-footer-gradient="true"]')
          .forEach((footerEl) => {
            footerEl.style.backgroundImage = 'linear-gradient(to right, #C8102E, #A50D25)';
            footerEl.style.backgroundColor = '#C8102E';
          });

        const clonedImgs = Array.from(clonedEl.querySelectorAll('img'));
        clonedImgs.forEach((clonedImg, idx) => {
          const origImg = origImgs[idx];
          const resolvedSrc = origImg?.currentSrc || origImg?.src;
          if (resolvedSrc) {
            clonedImg.src = resolvedSrc;
          }
          clonedImg.loading = 'eager';
        });

        const defaultView = clonedDoc.defaultView || window;
        const allNodes = [clonedEl, ...Array.from(clonedEl.querySelectorAll<HTMLElement>('*'))];
        for (const el of allNodes) {
          const cs = defaultView.getComputedStyle(el);
          const colorProps: Array<
            [
              | 'color'
              | 'backgroundColor'
              | 'borderTopColor'
              | 'borderRightColor'
              | 'borderBottomColor'
              | 'borderLeftColor',
              string,
            ]
          > = [
            ['color', darkMode ? '#F3F4F6' : '#111827'],
            ['backgroundColor', 'transparent'],
            ['borderTopColor', darkMode ? '#2A2F3A' : '#E5E7EB'],
            ['borderRightColor', darkMode ? '#2A2F3A' : '#E5E7EB'],
            ['borderBottomColor', darkMode ? '#2A2F3A' : '#E5E7EB'],
            ['borderLeftColor', darkMode ? '#2A2F3A' : '#E5E7EB'],
          ];
          for (const [prop, fallback] of colorProps) {
            const val = cs[prop];
            if (val && /oklab|oklch|color-mix/i.test(val)) {
              el.style[prop] = normalizeColorForHtml2Canvas(colorCtx, val, fallback);
            }
          }
          if (cs.backgroundImage && /oklab|oklch|color-mix/i.test(cs.backgroundImage)) {
            if (!el.hasAttribute('data-capture-footer-gradient')) {
              el.style.backgroundImage = 'none';
            }
          }
          if (cs.boxShadow && /oklab|oklch|color-mix/i.test(cs.boxShadow)) {
            el.style.boxShadow = 'none';
          }
        }
      },
    });

    const canvas = await Promise.race([
      renderPromise,
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Tempo limite na captura da imagem.')), 3500);
      }),
    ]);

    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), 'image/png');
      } catch {
        resolve(null);
      }
    });

    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      triggerFileDownload(objectUrl, filename, 2500);
      return true;
    }

    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.startsWith('data:image/png')) {
      triggerFileDownload(dataUrl, filename);
      return true;
    }
  } catch {
    // Nunca trava o envio para o WhatsApp se a captura falhar
  }

  return false;
}

export async function downloadAndOpenWhatsApp(
  params: BuildWhatsAppMessageParams & {
    captureElement: HTMLElement | null;
    darkMode: boolean;
  }
): Promise<void> {
  const { captureElement, darkMode, ...msgParams } = params;

  const downloaded = captureElement
    ? await downloadElementAsPng(captureElement, darkMode, 'revisao-rodaleve.png')
    : false;

  const message = buildWhatsAppScheduleMessage({
    ...msgParams,
    includeDownloadedImageNote: downloaded,
  });

  const targetUrl = buildRodaleveApiWhatsAppUrl(
    message,
    getUnitWhatsAppNumber(msgParams.unit)
  );

  openExternalLink(targetUrl);
}
