import { FaqItem, MotoModel, PageSectionBlock, VisualBuilderConfig } from '../types';
import { escapeHtmlText } from './htmlSanitizer';
import { DEFAULT_SITE_CONTENT } from './visualBuilder';

export type HtmlTargetCategory =
  | 'avisos'
  | 'hero_textos'
  | 'secoes'
  | 'modelos'
  | 'faqs'
  | 'rodape_unidades';

export interface HtmlEditableTarget {
  key: string;
  label: string;
  category: HtmlTargetCategory;
  categoryLabel: string;
  description: string;
  defaultHtml: string;
  hasOverride: boolean;
}

export interface HtmlTargetsSource {
  sections: PageSectionBlock[];
  models: MotoModel[];
  faqs: FaqItem[];
  vbConfig: VisualBuilderConfig;
}

export const HTML_CATEGORY_LABELS: Record<HtmlTargetCategory, string> = {
  avisos: 'Avisos & Destaques',
  hero_textos: 'Hero & Chamadas',
  secoes: 'Seções & Blocos da Página',
  modelos: 'Modelos Honda (Cards)',
  faqs: 'Perguntas Frequentes (FAQ)',
  rodape_unidades: 'Unidades & Rodapé',
};

function getTextDefault(key: string, vbConfig: VisualBuilderConfig): string {
  return vbConfig.siteContent?.[key]?.text || DEFAULT_SITE_CONTENT[key] || '';
}

export function buildNoticeBoxDefaultHtml(vbConfig: VisualBuilderConfig): string {
  const line1 = getTextDefault('notice_line_1', vbConfig);
  const line2 = getTextDefault('notice_line_2', vbConfig);
  return `<div class="space-y-1.5">\n  <p>${escapeHtmlText(line1)}</p>\n  <p>${escapeHtmlText(line2)}</p>\n</div>`;
}

export function buildCustomBlockDefaultHtml(block: PageSectionBlock): string {
  const custom = block.customData;
  if (!custom) {
    return `<div class="space-y-2">\n  <h2 class="text-xl font-bold">${escapeHtmlText(block.label)}</h2>\n  <p>Conteúdo HTML personalizado deste bloco.</p>\n</div>`;
  }
  const parts: string[] = [];
  if (custom.badge) {
    parts.push(`<p class="text-xs font-bold uppercase tracking-widest text-brand-text">${escapeHtmlText(custom.badge)}</p>`);
  }
  if (custom.title) {
    parts.push(`<h2 class="text-2xl font-extrabold tracking-tight">${escapeHtmlText(custom.title)}</h2>`);
  }
  if (custom.body) {
    parts.push(`<p class="text-sm leading-relaxed">${escapeHtmlText(custom.body)}</p>`);
  }
  if (custom.cta_label && custom.cta_url) {
    parts.push(
      `<div class="pt-2"><a href="${escapeHtmlText(custom.cta_url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-on-brand">${escapeHtmlText(custom.cta_label)}</a></div>`
    );
  }
  return `<div class="space-y-2">\n  ${parts.join('\n  ')}\n</div>`;
}

export function buildSectionDefaultHtml(
  block: PageSectionBlock,
  vbConfig: VisualBuilderConfig
): string {
  if (block.id === 'notice_box') {
    return buildNoticeBoxDefaultHtml(vbConfig);
  }
  if (block.type === 'custom') {
    return buildCustomBlockDefaultHtml(block);
  }
  return `<div class="rounded-xl border border-border bg-brand-soft/60 px-4 py-3 text-xs text-ink">\n  <strong>${escapeHtmlText(block.label)}:</strong> Edite este HTML personalizado para exibir um destaque, aviso ou banner nesta seção.\n</div>`;
}

export function buildModelDefaultHtml(model: MotoModel): string {
  return `<div class="rounded-lg border border-border bg-brand-soft/60 px-2.5 py-1.5 text-[11px] text-ink">\n  <strong>${escapeHtmlText(model.name)}:</strong> Condições especiais e peças genuínas Honda com garantia de fábrica.\n</div>`;
}

export function buildHtmlEditableTargets({
  sections,
  models,
  faqs,
  vbConfig,
}: HtmlTargetsSource): HtmlEditableTarget[] {
  const overrides = vbConfig.htmlOverrides || {};
  const targets: HtmlEditableTarget[] = [];

  const pushTextTarget = (
    key: string,
    label: string,
    category: HtmlTargetCategory,
    description: string,
    fallbackText?: string
  ) => {
    const baseText = fallbackText ?? getTextDefault(key, vbConfig);
    targets.push({
      key,
      label,
      category,
      categoryLabel: HTML_CATEGORY_LABELS[category],
      description,
      defaultHtml: escapeHtmlText(baseText),
      hasOverride: Boolean(overrides[key] && overrides[key].trim().length > 0),
    });
  };

  // 1. Avisos & Destaques
  pushTextTarget(
    'notice_line_1',
    'Aviso 1 (1ª e 2ª revisão)',
    'avisos',
    'Primeira linha da caixa de avisos sobre mão de obra gratuita.'
  );
  pushTextTarget(
    'notice_line_2',
    'Aviso 2 (3ª a 6ª revisão e óleo)',
    'avisos',
    'Segunda linha da caixa de avisos com regras de revisão e troca de óleo.'
  );
  targets.push({
    key: 'section_html_notice_box',
    label: 'Caixa Completa de Avisos (HTML Livre)',
    category: 'avisos',
    categoryLabel: HTML_CATEGORY_LABELS.avisos,
    description: 'Substitui todo o conteúdo interno da caixa de avisos por HTML personalizado.',
    defaultHtml: buildNoticeBoxDefaultHtml(vbConfig),
    hasOverride: Boolean(overrides['section_html_notice_box']?.trim()),
  });

  // 2. Hero & Chamadas
  pushTextTarget('hero_eyebrow', 'Sobretítulo do Hero', 'hero_textos', 'Etiqueta superior acima do título principal.');
  pushTextTarget('hero_title', 'Título Principal (H1)', 'hero_textos', 'Título principal exibido no topo da página.');
  pushTextTarget('hero_subtitle', 'Subtítulo do Hero', 'hero_textos', 'Descrição logo abaixo do título principal.');
  pushTextTarget('hero_tab_table', 'Botão Aba "Tabela por Modelo"', 'hero_textos', 'Texto da aba principal do seletor do Hero.');
  pushTextTarget('hero_tab_calculator', 'Botão Aba "Calculadora de Revisões"', 'hero_textos', 'Texto da aba da calculadora no seletor do Hero.');
  pushTextTarget('hero_tab_faq', 'Botão Aba "Perguntas Frequentes"', 'hero_textos', 'Texto da aba de FAQ no seletor do Hero.');
  pushTextTarget('revisions_prompt_above', 'Chamada: Escolha a revisão', 'hero_textos', 'Texto exibido acima das abas de 1ª a 7ª revisão.');
  pushTextTarget('revisions_prompt_below', 'Chamada: Escolha o modelo', 'hero_textos', 'Texto exibido acima da barra de busca e filtros.');
  pushTextTarget('filter_all_label', 'Botão "Todos os modelos"', 'hero_textos', 'Texto do chip inicial de filtro de segmento.');

  // 3. Seções & Blocos da Página
  for (const block of sections) {
    if (block.id === 'notice_box') continue; // já listado em Avisos & Destaques
    const key = `section_html_${block.id}`;
    targets.push({
      key,
      label: block.type === 'custom' ? `Bloco Personalizado: ${block.label}` : `Seção: ${block.label}`,
      category: 'secoes',
      categoryLabel: HTML_CATEGORY_LABELS.secoes,
      description:
        block.type === 'custom'
          ? 'Substitui o conteúdo interno deste bloco personalizado pelo seu HTML.'
          : 'Exibe um bloco HTML customizado no topo desta seção da página.',
      defaultHtml: buildSectionDefaultHtml(block, vbConfig),
      hasOverride: Boolean(overrides[key]?.trim()),
    });
  }

  // 4. Modelos Honda (Cards)
  for (const model of models) {
    const key = `model_html_${model.id}`;
    targets.push({
      key,
      label: `Modelo: ${model.name}`,
      category: 'modelos',
      categoryLabel: HTML_CATEGORY_LABELS.modelos,
      description: `Bloco HTML exibido dentro do card da motocicleta ${model.name} (grade e lista).`,
      defaultHtml: buildModelDefaultHtml(model),
      hasOverride: Boolean(overrides[key]?.trim()),
    });
  }

  // 5. Perguntas Frequentes (FAQ)
  pushTextTarget('faq_title', 'Título do FAQ', 'faqs', 'Título da seção de Dúvidas Frequentes.');
  pushTextTarget('faq_subtitle', 'Subtítulo do FAQ', 'faqs', 'Subtítulo explicativo da seção de Dúvidas Frequentes.');
  for (const faq of faqs) {
    pushTextTarget(
      `faq_q_${faq.id}`,
      `FAQ Pergunta #${faq.id}: ${faq.question.slice(0, 48)}${faq.question.length > 48 ? '...' : ''}`,
      'faqs',
      'Pergunta exibida no cabeçalho do item do FAQ.',
      vbConfig.siteContent?.[`faq_q_${faq.id}`]?.text || faq.question
    );
    pushTextTarget(
      `faq_a_${faq.id}`,
      `FAQ Resposta #${faq.id}: ${faq.question.slice(0, 48)}${faq.question.length > 48 ? '...' : ''}`,
      'faqs',
      'Resposta HTML exibida quando a pergunta é expandida.',
      vbConfig.siteContent?.[`faq_a_${faq.id}`]?.text || faq.answer
    );
  }

  // 6. Unidades & Rodapé
  pushTextTarget('units_eyebrow', 'Unidades: Sobretítulo', 'rodape_unidades', 'Texto pequeno acima do título de Unidades.');
  pushTextTarget('units_title', 'Unidades: Título', 'rodape_unidades', 'Título da seção de Unidades e Como Chegar.');
  pushTextTarget('units_subtitle', 'Unidades: Subtítulo', 'rodape_unidades', 'Descrição abaixo do título de Unidades.');
  pushTextTarget('footer_hours_title', 'Rodapé: Título Horários', 'rodape_unidades', 'Título da coluna de horários no rodapé.');
  pushTextTarget('footer_hours_weekdays', 'Rodapé: Horário Semana', 'rodape_unidades', 'Texto de funcionamento de segunda a sexta.');
  pushTextTarget('footer_hours_saturday', 'Rodapé: Horário Sábado', 'rodape_unidades', 'Texto de funcionamento aos sábados.');
  pushTextTarget('footer_policies_title', 'Rodapé: Título Políticas', 'rodape_unidades', 'Título da coluna de políticas e termos.');
  pushTextTarget('footer_disclaimer', 'Rodapé: Aviso Estimativo', 'rodape_unidades', 'Texto legal sobre valores estimados no rodapé.');
  pushTextTarget('footer_slogan', 'Rodapé: Slogan', 'rodape_unidades', 'Frase de destaque na faixa inferior do rodapé.');

  return targets;
}
