import { CustomBlockVariant, PageSectionBlock, VisualBuilderConfig } from '../types';

const VISUAL_BUILDER_STORAGE_KEY = 'rodaleve_visual_builder_v1';
let memoryVisualConfig: string | null = null;

export const CURRENT_SECTIONS_VERSION = 2;

export const DEFAULT_SECTIONS: PageSectionBlock[] = [
  { id: 'hero', type: 'hero', label: 'Hero / Banner Principal', visible: true },
  {
    id: 'notice_box',
    type: 'notice_box',
    label: 'Aviso das Revisões (1ª a 6ª)',
    visible: true,
  },
  {
    id: 'revisions_selector',
    type: 'revisions_selector',
    label: 'Seletor de Revisões (1ª a 7ª)',
    visible: true,
  },
  {
    id: 'filters_catalog',
    type: 'filters_catalog',
    label: 'Seleção e Tabela de Modelos Honda',
    visible: true,
  },
  { id: 'faq_section', type: 'faq_section', label: 'Perguntas Frequentes', visible: true },
  { id: 'units_map', type: 'units_map', label: 'Unidades e Mapa', visible: true },
  { id: 'footer', type: 'footer', label: 'Rodapé', visible: true },
];

export const DEFAULT_SITE_CONTENT: Record<string, string> = {
  header_brand_text: 'RODALEVE',
  nav_revisions: 'Revisões',
  nav_faq: 'Dúvidas Frequentes',
  nav_units: 'Unidades',
  header_cta: 'Agendar revisão',
  hero_eyebrow: 'CONCESSIONÁRIA AUTORIZADA HONDA',
  hero_title: 'Tabela de Manutenção e Revisões',
  hero_subtitle:
    'Consulte peças genuínas e valores estimados por modelo de cada revisão programada.',
  hero_tab_table: 'Tabela por Modelo',
  hero_tab_faq: 'Perguntas Frequentes',
  revisions_prompt_above: 'Escolha a revisão desejada',
  revisions_prompt_below: 'Escolha o modelo da sua motocicleta Honda',
  notice_line_1:
    '1ª e 2ª revisão: a mão de obra é gratuita. É cobrado somente o valor das peças utilizadas.',
  notice_line_2:
    '3ª a 6ª revisão: a mão de obra e o valor das peças utilizadas são cobrados conforme tabela vigente. A troca de óleo da revisão é gratuita, desde que a revisão seja realizada na nossa concessionária e que a moto tenha sido comprada conosco e esteja dentro do prazo estipulado pela montadora, conforme o manual do proprietário.',
  filter_all_label: 'Todos os modelos',
  faq_title: 'Dúvidas Frequentes sobre Revisões Honda',
  faq_subtitle:
    'Tudo o que você precisa saber sobre prazos, garantia e agendamento na Rodaleve.',
  units_eyebrow: 'Onde estamos',
  units_title: 'Unidades e Como Chegar',
  units_subtitle:
    'Localize nossas concessionárias autorizadas em Vitória da Conquista e Guanambi.',
  footer_brand_text: 'RODALEVE',
  footer_social_label: 'Siga nossas redes sociais',
  footer_hours_title: 'Horários de Funcionamento',
  footer_hours_weekdays: 'Segunda a sexta: 07h30 às 18h',
  footer_hours_saturday: 'Sábado: 07h30 às 12h',
  footer_policies_title: 'Políticas e Termos',
  footer_disclaimer:
    'Os valores exibidos nesta tabela são estimados para peças genuínas e insumos básicos de cada revisão e podem variar conforme inspeção técnica ou necessidade adicional da motocicleta.',
  footer_slogan: 'DESBRAVE SEU BEM MAIOR É A VIDA',
  footer_credits: 'Site criado por',
};

export function createDefaultVisualConfig(modelIds: number[] = []): VisualBuilderConfig {
  return {
    sectionsVersion: CURRENT_SECTIONS_VERSION,
    sections: DEFAULT_SECTIONS.map((s) => ({ ...s })),
    siteContent: {},
    modelOrder: modelIds,
    hiddenModelIds: [],
    imageOverrides: {},
  };
}

export function mergeWithDefaultVisualConfig(
  saved: Partial<VisualBuilderConfig> | null | undefined,
  currentModelIds: number[] = []
): VisualBuilderConfig {
  const safeModelIds = Array.isArray(currentModelIds) ? currentModelIds : [];
  const base = createDefaultVisualConfig(safeModelIds);
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;

  const defaultLabelById = new Map(DEFAULT_SECTIONS.map((d) => [d.id, d.label]));
  const rawList = Array.isArray(saved.sections) ? saved.sections : [];
  const validSavedSections = rawList.filter(
    (s): s is PageSectionBlock =>
      Boolean(s) &&
      typeof s === 'object' &&
      typeof s.id === 'string' &&
      typeof s.type === 'string'
  );

  const rawSavedSections = validSavedSections.map((s) => ({
    ...s,
    visible: s.visible !== false,
    label: s.type === 'custom' ? s.label || 'Bloco Personalizado' : defaultLabelById.get(s.id) || s.label || s.id,
  }));

  const existingIds = new Set(rawSavedSections.map((s) => s.id));
  let mergedSections: PageSectionBlock[] = [
    ...rawSavedSections,
    ...DEFAULT_SECTIONS.filter((def) => !existingIds.has(def.id)).map((def) => ({ ...def })),
  ];

  // Upgrade v1 saved configs where revisions_selector was adjacent right before notice_box
  if (!saved.sectionsVersion || saved.sectionsVersion < CURRENT_SECTIONS_VERSION) {
    const revIdx = mergedSections.findIndex((s) => s.id === 'revisions_selector');
    const noticeIdx = mergedSections.findIndex((s) => s.id === 'notice_box');
    if (revIdx !== -1 && noticeIdx === revIdx + 1) {
      const copy = [...mergedSections];
      const [noticeBlock] = copy.splice(noticeIdx, 1);
      copy.splice(revIdx, 0, noticeBlock);
      mergedSections = copy;
    }
  }

  // Keep saved model order, append any newly added models
  const rawOrder = Array.isArray(saved.modelOrder) ? saved.modelOrder : [];
  const savedOrder = rawOrder.filter((id) => safeModelIds.includes(id));
  const missingIds = safeModelIds.filter((id) => !savedOrder.includes(id));

  const siteContent =
    saved.siteContent && typeof saved.siteContent === 'object' && !Array.isArray(saved.siteContent)
      ? saved.siteContent
      : {};
  const hiddenModelIds = Array.isArray(saved.hiddenModelIds)
    ? saved.hiddenModelIds.filter((id) => typeof id === 'number')
    : [];
  const imageOverrides =
    saved.imageOverrides &&
    typeof saved.imageOverrides === 'object' &&
    !Array.isArray(saved.imageOverrides)
      ? saved.imageOverrides
      : {};

  return {
    sectionsVersion: CURRENT_SECTIONS_VERSION,
    sections: mergedSections,
    siteContent,
    modelOrder: [...savedOrder, ...missingIds],
    hiddenModelIds,
    imageOverrides,
  };
}

export function restoreDefaultSectionOrder(current: VisualBuilderConfig): VisualBuilderConfig {
  const currentById = new Map(current.sections.map((s) => [s.id, s]));
  const orderedBuiltIns = DEFAULT_SECTIONS.map((def) => {
    const existing = currentById.get(def.id);
    return existing ? { ...existing, label: def.label } : { ...def };
  });
  const customBlocks = current.sections.filter((s) => s.type === 'custom');
  const footerIdx = orderedBuiltIns.findIndex((s) => s.id === 'footer');
  if (customBlocks.length > 0) {
    if (footerIdx >= 0) {
      orderedBuiltIns.splice(footerIdx, 0, ...customBlocks);
    } else {
      orderedBuiltIns.push(...customBlocks);
    }
  }
  return {
    ...current,
    sectionsVersion: CURRENT_SECTIONS_VERSION,
    sections: orderedBuiltIns,
  };
}

export function loadLocalVisualConfig(): Partial<VisualBuilderConfig> | null {
  try {
    const raw = memoryVisualConfig || window.localStorage?.getItem(VISUAL_BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Partial<VisualBuilderConfig>;
  } catch {
    if (memoryVisualConfig) {
      try {
        const parsed = JSON.parse(memoryVisualConfig) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Partial<VisualBuilderConfig>;
        }
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function saveLocalVisualConfig(config: VisualBuilderConfig): void {
  const serialized = JSON.stringify(config);
  memoryVisualConfig = serialized;
  try {
    window.localStorage?.setItem(VISUAL_BUILDER_STORAGE_KEY, serialized);
  } catch {
    // Ignore storage quota / iframe restrictions; memory fallback holds active copy
  }
}

export function clearLocalVisualConfig(): void {
  memoryVisualConfig = null;
  try {
    window.localStorage?.removeItem(VISUAL_BUILDER_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function createCustomBlock(variant: CustomBlockVariant): PageSectionBlock {
  const uid = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  if (variant === 'banner') {
    return {
      id: uid,
      type: 'custom',
      label: 'Banner Personalizado',
      visible: true,
      customData: {
        variant: 'banner',
        badge: 'NOVIDADE RODALEVE',
        title: 'Revisão Programada com Peças Genuínas Honda',
        body: 'Mantenha a garantia e a segurança da sua motocicleta em dia com atendimento especializado.',
        cta_label: 'Falar com consultor',
        cta_url: 'https://wa.me/557728880003',
        theme: 'red',
      },
    };
  }
  if (variant === 'notice') {
    return {
      id: uid,
      type: 'custom',
      label: 'Bloco de Aviso',
      visible: true,
      customData: {
        variant: 'notice',
        badge: 'INFORMATIVO',
        title: 'Importante sobre o agendamento',
        body: 'Traga o manual do proprietário e o documento da motocicleta para registro oficial da garantia.',
        theme: 'gray',
      },
    };
  }
  return {
    id: uid,
    type: 'custom',
    label: 'Bloco de Texto Livre',
    visible: true,
    customData: {
      variant: 'text',
      title: 'Título do novo bloco',
      body: 'Clique neste texto para editar diretamente na tela ou adicione uma imagem pelo botão Trocar Imagem.',
      theme: 'light',
    },
  };
}

/**
 * Compresses raster images via Canvas to avoid overflowing localStorage.
 * SVGs and tiny icons are kept crisp cleanly as data URLs.
 */
export async function compressImageFile(file: File, maxDimension = 1200): Promise<string> {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao ler arquivo SVG.'));
      reader.readAsDataURL(file);
    });
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const preferPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        const mime = preferPng ? 'image/webp' : 'image/jpeg';
        const compressed = canvas.toDataURL(mime, 0.82);
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Falha ao processar imagem.'));
    reader.readAsDataURL(file);
  });
}
