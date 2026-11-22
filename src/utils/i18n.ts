import { LABOR_POLICY_TEXTS } from './pricing';

export type SiteLanguage = 'pt' | 'en' | 'es';

export interface LanguageOption {
  id: SiteLanguage;
  code: 'PT' | 'EN' | 'ES';
  nativeName: string;
  htmlLang: 'pt-BR' | 'en' | 'es';
  locale: 'pt-BR' | 'en-US' | 'es-ES';
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: 'pt',
    code: 'PT',
    nativeName: 'Português',
    htmlLang: 'pt-BR',
    locale: 'pt-BR',
  },
  {
    id: 'en',
    code: 'EN',
    nativeName: 'English',
    htmlLang: 'en',
    locale: 'en-US',
  },
  {
    id: 'es',
    code: 'ES',
    nativeName: 'Español',
    htmlLang: 'es',
    locale: 'es-ES',
  },
];

export const LANGUAGE_META: Record<SiteLanguage, LanguageOption> = {
  pt: LANGUAGE_OPTIONS[0],
  en: LANGUAGE_OPTIONS[1],
  es: LANGUAGE_OPTIONS[2],
};

const LANGUAGE_STORAGE_KEY = 'rodaleve_site_lang_v1';
let memoryLanguage: SiteLanguage | null = null;

export function isValidLanguage(value: string | null | undefined): value is SiteLanguage {
  return value === 'pt' || value === 'en' || value === 'es';
}

export function getInitialLanguage(): SiteLanguage {
  if (typeof window !== 'undefined') {
    try {
      const urlParam = new URLSearchParams(window.location.search).get('lang')?.toLowerCase();
      if (isValidLanguage(urlParam)) {
        memoryLanguage = urlParam;
        return urlParam;
      }
    } catch {
      // Ignora erro de URL em ambiente restrito
    }

    if (memoryLanguage) return memoryLanguage;

    try {
      const saved = window.localStorage?.getItem(LANGUAGE_STORAGE_KEY)?.toLowerCase();
      if (isValidLanguage(saved)) {
        memoryLanguage = saved;
        return saved;
      }
    } catch {
      // Ignora bloqueio de localStorage em iframe/sandbox
    }
  }
  return 'pt';
}

export function persistLanguage(lang: SiteLanguage): void {
  memoryLanguage = lang;
  if (typeof window === 'undefined') return;

  try {
    window.localStorage?.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Fallback em memória já atualizado
  }

  try {
    if (!window.location.pathname.startsWith('/gestor')) {
      const url = new URL(window.location.href);
      if (lang === 'pt') {
        url.searchParams.delete('lang');
      } else {
        url.searchParams.set('lang', lang);
      }
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      const currUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currUrl) {
        window.history.replaceState({}, '', nextUrl);
      }
    }
  } catch {
    // Ignora caso history.replaceState não seja permitido
  }
}

export const SITE_CONTENT_TRANSLATIONS: Record<Exclude<SiteLanguage, 'pt'>, Record<string, string>> = {
  en: {
    nav_revisions: 'Services',
    nav_faq: 'FAQ',
    nav_units: 'Locations',
    header_cta: 'Book service',
    hero_eyebrow: 'AUTHORIZED HONDA DEALERSHIP',
    hero_title: 'Maintenance & Service Price Table',
    hero_subtitle:
      'Check genuine Honda parts and estimated values by model for each scheduled service.',
    hero_tab_table: 'Table by Model',
    hero_tab_faq: 'Frequently Asked Questions',
    revisions_prompt_above: 'Choose the desired service',
    revisions_prompt_below: 'Choose your Honda motorcycle model',
    notice_line_1:
      '1st and 2nd service: labor is free of charge. Only the cost of the parts used is charged.',
    notice_line_2:
      "3rd to 6th service: labor and the cost of parts used are charged according to the current price table. The service oil change is free, provided that the service is performed at our dealership, the motorcycle was purchased from us, and it is within the manufacturer's stipulated deadline as stated in the owner's manual.",
    filter_all_label: 'All models',
    faq_title: 'Frequently Asked Questions about Honda Services',
    faq_subtitle:
      'Everything you need to know about deadlines, warranty, and scheduling at Rodaleve.',
    units_eyebrow: 'Where we are',
    units_title: 'Locations & Directions',
    units_subtitle:
      'Find our authorized dealerships in Vitória da Conquista and Guanambi.',
    footer_social_label: 'Follow our social media',
    footer_hours_title: 'Business Hours',
    footer_hours_weekdays: 'Monday to Friday: 07:30 AM to 06:00 PM',
    footer_hours_saturday: 'Saturday: 07:30 AM to 12:00 PM',
    footer_policies_title: 'Policies & Terms',
    footer_disclaimer:
      'The prices shown in this table are estimates for genuine parts and basic supplies for each service and may vary according to technical inspection or additional motorcycle needs.',
    footer_slogan: 'SLOW DOWN, YOUR GREATEST ASSET IS LIFE',
    footer_credits: 'Website created by',
  },
  es: {
    nav_revisions: 'Revisiones',
    nav_faq: 'Preguntas Frecuentes',
    nav_units: 'Sucursales',
    header_cta: 'Agendar revisión',
    hero_eyebrow: 'CONCESIONARIO AUTORIZADO HONDA',
    hero_title: 'Tabla de Mantenimiento y Revisiones',
    hero_subtitle:
      'Consulta piezas genuinas y valores estimados por modelo para cada revisión programada.',
    hero_tab_table: 'Tabla por Modelo',
    hero_tab_faq: 'Preguntas Frecuentes',
    revisions_prompt_above: 'Elige la revisión deseada',
    revisions_prompt_below: 'Elige el modelo de tu motocicleta Honda',
    notice_line_1:
      '1ª y 2ª revisión: la mano de obra es gratuita. Solo se cobra el valor de las piezas utilizadas.',
    notice_line_2:
      '3ª a 6ª revisión: la mano de obra y el valor de las piezas utilizadas se cobran según la tabla vigente. El cambio de aceite de la revisión es gratuito, siempre que la revisión se realice en nuestro concesionario, la motocicleta haya sido comprada con nosotros y esté dentro del plazo estipulado por el fabricante, conforme al manual del propietario.',
    filter_all_label: 'Todos los modelos',
    faq_title: 'Preguntas Frecuentes sobre Revisiones Honda',
    faq_subtitle:
      'Todo lo que necesitas saber sobre plazos, garantía y agendamiento en Rodaleve.',
    units_eyebrow: 'Dónde estamos',
    units_title: 'Sucursales y Cómo Llegar',
    units_subtitle:
      'Ubica nuestros concesionarios autorizados en Vitória da Conquista y Guanambi.',
    footer_social_label: 'Síguenos en redes sociales',
    footer_hours_title: 'Horarios de Atención',
    footer_hours_weekdays: 'Lunes a viernes: 07:30 a 18:00',
    footer_hours_saturday: 'Sábado: 07:30 a 12:00',
    footer_policies_title: 'Políticas y Términos',
    footer_disclaimer:
      'Los valores mostrados en esta tabla son estimados para piezas genuinas e insumos básicos de cada revisión y pueden variar según inspección técnica o necesidad adicional de la motocicleta.',
    footer_slogan: 'DESACELERA, TU MAYOR BIEN ES LA VIDA',
    footer_credits: 'Sitio creado por',
  },
};

export interface UiDictionary {
  languageSelectorLabel: string;
  searchPlaceholder: string;
  clearSearch: string;
  quickSelectPlaceholder: string;
  shortcutFaq: string;
  shortcutUnits: string;
  showingModels: (visible: number, total: number) => string;
  prevModel: string;
  nextModel: string;
  scrollModelsLeft: string;
  scrollModelsRight: string;
  gridViewAria: string;
  listViewAria: string;
  noModelsTitle: string;
  noModelsDesc: string;
  clearFilters: string;
  itemSingular: string;
  itemPlural: string;
  walkInBadge: string;
  appointmentBadge: string;
  freeLaborBadge: string;
  consultLaborBadge: string;
  noPartsLinked: string;
  codePrefix: string;
  optionalTag: string;
  totalOfPrefix: string;
  withoutOptionals: string;
  bookModelWhatsApp: string;
  bookWhatsAppShort: string;
  generatingImage: string;
  generatingQuote: string;
  collapseModels: string;
  viewAllModels: (count: number) => string;
  lightTheme: string;
  darkTheme: string;
  privacyPolicy: string;
  termsOfUse: string;
  privacyParagraph1: string;
  privacyParagraph2: string;
  termsParagraph1: string;
  termsParagraph2: string;
  gestorLink: string;
  // Units map
  unitsRouteTitle: (city: string) => string;
  modeMoto: string;
  modeCar: string;
  originPlaceholder: string;
  originPlaceholderFallback: string;
  clearAddress: string;
  useMyLocation: string;
  locating: string;
  traceRouteBtn: string;
  routeCalculated: (mode: 'moto' | 'carro') => string;
  geoUnsupported: string;
  geoError: string;
  originRequiredError: string;
  focusOnMap: string;
  openInMaps: string;
  mapView: string;
  satelliteView: string;
  viewBothUnits: string;
  directMapsTitle: string;
  directMapsDesc: (unitName: string, address: string) => string;
  openCityInMaps: (city: string) => string;
  yourStartPoint: string;
  // WhatsApp Schedule Modal
  modalEyebrow: string;
  modalSubtitleFree: string;
  modalSubtitlePaid: string;
  modalCloseAria: string;
  modalStep1: string;
  modalStep2: (count: number) => string;
  modalIncludeOptionals: string;
  modalNoParts: string;
  modalEstimatedTotal: string;
  modalFreeLaborNote: string;
  modalPaidLaborNote: string;
  modalCancel: string;
  modalSendWhatsApp: (city: string) => string;
  // Floating WhatsApp
  floatingWhatsAppAria: string;
  floatingWhatsAppTitle: string;
  // Loading / Error
  loadingTable: string;
  loadErrorTitle: string;
  tryAgain: string;
}

export const UI_TRANSLATIONS: Record<SiteLanguage, UiDictionary> = {
  pt: {
    languageSelectorLabel: 'Selecionar idioma',
    searchPlaceholder: 'Buscar modelo (ex.: CG 160, Sahara, Biz, PCX), peça ou código...',
    clearSearch: 'Limpar busca',
    quickSelectPlaceholder: 'Ir direto para a moto...',
    shortcutFaq: 'Perguntas Frequentes',
    shortcutUnits: 'Unidades e Como Chegar',
    showingModels: (visible, total) => `Exibindo ${visible} de ${total} modelos`,
    prevModel: 'Modelo anterior',
    nextModel: 'Próximo modelo',
    scrollModelsLeft: 'Rolar modelos para a esquerda',
    scrollModelsRight: 'Rolar modelos para a direita',
    gridViewAria: 'Visualização em carrossel horizontal',
    listViewAria: 'Visualização em lista',
    noModelsTitle: 'Nenhum modelo encontrado',
    noModelsDesc: 'Tente buscar por outro nome de motocicleta, peça ou código Honda.',
    clearFilters: 'Limpar filtros',
    itemSingular: 'item',
    itemPlural: 'itens',
    walkInBadge: 'Atendimento por ordem de chegada',
    appointmentBadge: 'Necessário agendamento prévio',
    freeLaborBadge: LABOR_POLICY_TEXTS.pt.freeBadge,
    consultLaborBadge: LABOR_POLICY_TEXTS.pt.paidBadge,
    noPartsLinked: 'Nenhuma peça vinculada a esta revisão.',
    codePrefix: 'CÓD.',
    optionalTag: '[Opcional]',
    totalOfPrefix: 'TOTAL DA',
    withoutOptionals: 'Sem opcionais',
    bookModelWhatsApp: 'Agendar esta revisão no WhatsApp',
    bookWhatsAppShort: 'Agendar no WhatsApp',
    generatingImage: 'Gerando imagem...',
    generatingQuote: 'Gerando orçamento...',
    collapseModels: 'Recolher lista (mostrar 9 principais)',
    viewAllModels: (count) => `Ver todos os modelos (${count})`,
    lightTheme: 'Tema claro',
    darkTheme: 'Tema escuro',
    privacyPolicy: 'Política de Privacidade',
    termsOfUse: 'Termos de Uso',
    privacyParagraph1:
      'A Rodaleve Honda respeita a sua privacidade. Este portal de consulta de revisões não armazena dados pessoais sensíveis no navegador. Caso você utilize o recurso de geolocalização para traçar rotas até nossas unidades, sua localização é processada apenas em tempo real para o cálculo do trajeto.',
    privacyParagraph2:
      'Ao clicar em "Agendar revisão", você será direcionado ao atendimento oficial da Rodaleve via WhatsApp (77) 2888-0003, em conformidade com a Lei Geral de Proteção de Dados (LGPD).',
    termsParagraph1:
      'As informações e preços exibidos nesta Tabela de Manutenção e Revisões têm caráter informativo e estimativo para peças genuínas Honda e insumos recomendados.',
    termsParagraph2:
      'Eventuais serviços adicionais identificados na inspeção técnica ou variações de estoque serão previamente informados e aprovados junto ao cliente na recepção da oficina Rodaleve.',
    gestorLink: 'Gestor',
    unitsRouteTitle: (city) => `Trace rota até ${city}`,
    modeMoto: 'Moto',
    modeCar: 'Carro',
    originPlaceholder: 'Digite seu endereço, rua ou bairro de partida...',
    originPlaceholderFallback: 'Digite seu endereço ou bairro de partida...',
    clearAddress: 'Limpar endereço',
    useMyLocation: 'Usar minha localização',
    locating: 'Localizando...',
    traceRouteBtn: 'Traçar rota no mapa',
    routeCalculated: (mode) => `Rota calculada (${mode === 'moto' ? 'Moto' : 'Carro'})`,
    geoUnsupported: 'Geolocalização não suportada pelo seu navegador.',
    geoError: 'Não foi possível obter sua localização. Digite seu endereço de partida.',
    originRequiredError: 'Digite um endereço de partida ou clique em "Usar minha localização".',
    focusOnMap: 'Focar no mapa',
    openInMaps: 'Abrir no Maps',
    mapView: 'Mapa',
    satelliteView: 'Satélite',
    viewBothUnits: 'Ver ambos',
    directMapsTitle: 'Visualização direta no Google Maps',
    directMapsDesc: (unitName, address) =>
      `Abra a localização oficial da ${unitName} (${address}) diretamente no Google Maps.`,
    openCityInMaps: (city) => `Abrir ${city} no Google Maps`,
    yourStartPoint: 'Seu ponto de partida',
    modalEyebrow: 'Orçamento & Agendamento WhatsApp',
    modalSubtitleFree: 'Mão de obra gratuita · Ordem de chegada',
    modalSubtitlePaid: 'Necessário agendamento prévio · Consultar mão de obra',
    modalCloseAria: 'Fechar modal',
    modalStep1: '1. Escolha a unidade de atendimento',
    modalStep2: (count) => `2. Resumo do orçamento (${count} ${count === 1 ? 'item' : 'itens'})`,
    modalIncludeOptionals: 'Incluir itens opcionais',
    modalNoParts: 'Nenhuma peça cadastrada para esta revisão. Você pode enviar sua solicitação mesmo assim.',
    modalEstimatedTotal: 'Total estimado',
    modalFreeLaborNote: LABOR_POLICY_TEXTS.pt.freeBadge,
    modalPaidLaborNote: LABOR_POLICY_TEXTS.pt.paidBadge,
    modalCancel: 'Cancelar',
    modalSendWhatsApp: (city) => `Enviar para WhatsApp (${city})`,
    floatingWhatsAppAria: 'Falar no WhatsApp Rodaleve (arrastável)',
    floatingWhatsAppTitle: 'Falar no WhatsApp Rodaleve (arraste para reposicionar)',
    loadingTable: 'Carregando Tabela de Manutenção Rodaleve Honda...',
    loadErrorTitle: 'Não foi possível carregar os dados',
    tryAgain: 'Tentar novamente',
  },
  en: {
    languageSelectorLabel: 'Select language',
    searchPlaceholder: 'Search model (e.g. CG 160, Sahara, Biz, PCX), part or code...',
    clearSearch: 'Clear search',
    quickSelectPlaceholder: 'Jump to motorcycle...',
    shortcutFaq: 'Frequently Asked Questions',
    shortcutUnits: 'Locations & Directions',
    showingModels: (visible, total) => `Showing ${visible} of ${total} models`,
    prevModel: 'Previous model',
    nextModel: 'Next model',
    scrollModelsLeft: 'Scroll models left',
    scrollModelsRight: 'Scroll models right',
    gridViewAria: 'Horizontal carousel view',
    listViewAria: 'List view',
    noModelsTitle: 'No models found',
    noModelsDesc: 'Try searching for another motorcycle name, part, or Honda part code.',
    clearFilters: 'Clear filters',
    itemSingular: 'item',
    itemPlural: 'items',
    walkInBadge: 'Walk-in service (first-come)',
    appointmentBadge: 'Prior appointment required',
    freeLaborBadge: LABOR_POLICY_TEXTS.en.freeBadge,
    consultLaborBadge: LABOR_POLICY_TEXTS.en.paidBadge,
    noPartsLinked: 'No parts linked to this service.',
    codePrefix: 'CODE',
    optionalTag: '[Optional]',
    totalOfPrefix: 'TOTAL FOR',
    withoutOptionals: 'Without optionals',
    bookModelWhatsApp: 'Book this service on WhatsApp',
    bookWhatsAppShort: 'Book on WhatsApp',
    generatingImage: 'Generating image...',
    generatingQuote: 'Generating quote...',
    collapseModels: 'Collapse list (show top 9)',
    viewAllModels: (count) => `View all models (${count})`,
    lightTheme: 'Light theme',
    darkTheme: 'Dark theme',
    privacyPolicy: 'Privacy Policy',
    termsOfUse: 'Terms of Use',
    privacyParagraph1:
      'Rodaleve Honda respects your privacy. This service inquiry portal does not store sensitive personal data in your browser. If you use the geolocation feature to plan routes to our branches, your location is processed solely in real time to calculate the route.',
    privacyParagraph2:
      'When clicking "Book service", you will be directed to official Rodaleve support via WhatsApp (77) 2888-0003, in compliance with data protection regulations (LGPD).',
    termsParagraph1:
      'The information and prices displayed in this Maintenance & Service Table are for informational and estimation purposes regarding genuine Honda parts and recommended supplies.',
    termsParagraph2:
      'Any additional services identified during technical inspection or stock variations will be informed and approved in advance with the customer at the Rodaleve workshop reception.',
    gestorLink: 'Admin',
    unitsRouteTitle: (city) => `Get directions to ${city}`,
    modeMoto: 'Moto',
    modeCar: 'Car',
    originPlaceholder: 'Enter your starting address, street or neighborhood...',
    originPlaceholderFallback: 'Enter your starting address or neighborhood...',
    clearAddress: 'Clear address',
    useMyLocation: 'Use my location',
    locating: 'Locating...',
    traceRouteBtn: 'Show route on map',
    routeCalculated: (mode) => `Route calculated (${mode === 'moto' ? 'Motorcycle' : 'Car'})`,
    geoUnsupported: 'Geolocation is not supported by your browser.',
    geoError: 'Could not get your location. Please type your starting address.',
    originRequiredError: 'Enter a starting address or click "Use my location".',
    focusOnMap: 'Focus on map',
    openInMaps: 'Open in Maps',
    mapView: 'Map',
    satelliteView: 'Satellite',
    viewBothUnits: 'View both',
    directMapsTitle: 'Direct view on Google Maps',
    directMapsDesc: (unitName, address) =>
      `Open the official location of ${unitName} (${address}) directly on Google Maps.`,
    openCityInMaps: (city) => `Open ${city} in Google Maps`,
    yourStartPoint: 'Your starting point',
    modalEyebrow: 'Quote & WhatsApp Scheduling',
    modalSubtitleFree: 'Free labor · First-come, first-served',
    modalSubtitlePaid: 'Prior appointment required · Check labor cost',
    modalCloseAria: 'Close modal',
    modalStep1: '1. Choose a service location',
    modalStep2: (count) => `2. Quote summary (${count} ${count === 1 ? 'item' : 'items'})`,
    modalIncludeOptionals: 'Include optional items',
    modalNoParts: 'No parts registered for this service. You can still send your request.',
    modalEstimatedTotal: 'Estimated total',
    modalFreeLaborNote: LABOR_POLICY_TEXTS.en.freeBadge,
    modalPaidLaborNote: LABOR_POLICY_TEXTS.en.paidBadge,
    modalCancel: 'Cancel',
    modalSendWhatsApp: (city) => `Send to WhatsApp (${city})`,
    floatingWhatsAppAria: 'Chat on WhatsApp Rodaleve (draggable)',
    floatingWhatsAppTitle: 'Chat on WhatsApp Rodaleve (drag to reposition)',
    loadingTable: 'Loading Rodaleve Honda Maintenance Table...',
    loadErrorTitle: 'Could not load data',
    tryAgain: 'Try again',
  },
  es: {
    languageSelectorLabel: 'Seleccionar idioma',
    searchPlaceholder: 'Buscar modelo (ej.: CG 160, Sahara, Biz, PCX), pieza o código...',
    clearSearch: 'Limpiar búsqueda',
    quickSelectPlaceholder: 'Ir directo a la moto...',
    shortcutFaq: 'Preguntas Frecuentes',
    shortcutUnits: 'Sucursales y Cómo Llegar',
    showingModels: (visible, total) => `Mostrando ${visible} de ${total} modelos`,
    prevModel: 'Modelo anterior',
    nextModel: 'Siguiente modelo',
    scrollModelsLeft: 'Desplazar modelos a la izquierda',
    scrollModelsRight: 'Desplazar modelos a la derecha',
    gridViewAria: 'Vista en carrusel horizontal',
    listViewAria: 'Vista en lista',
    noModelsTitle: 'Ningún modelo encontrado',
    noModelsDesc: 'Intenta buscar otro nombre de motocicleta, pieza o código Honda.',
    clearFilters: 'Limpiar filtros',
    itemSingular: 'ítem',
    itemPlural: 'ítems',
    walkInBadge: 'Atención por orden de llegada',
    appointmentBadge: 'Requiere cita previa',
    freeLaborBadge: LABOR_POLICY_TEXTS.es.freeBadge,
    consultLaborBadge: LABOR_POLICY_TEXTS.es.paidBadge,
    noPartsLinked: 'Ninguna pieza vinculada a esta revisión.',
    codePrefix: 'CÓD.',
    optionalTag: '[Opcional]',
    totalOfPrefix: 'TOTAL DE LA',
    withoutOptionals: 'Sin opcionales',
    bookModelWhatsApp: 'Agendar esta revisión por WhatsApp',
    bookWhatsAppShort: 'Agendar por WhatsApp',
    generatingImage: 'Generando imagen...',
    generatingQuote: 'Generando presupuesto...',
    collapseModels: 'Contraer lista (mostrar 9 principales)',
    viewAllModels: (count) => `Ver todos los modelos (${count})`,
    lightTheme: 'Tema claro',
    darkTheme: 'Tema oscuro',
    privacyPolicy: 'Política de Privacidad',
    termsOfUse: 'Términos de Uso',
    privacyParagraph1:
      'Rodaleve Honda respeta tu privacidad. Este portal de consulta de revisiones no almacena datos personales sensibles en el navegador. Si utilizas la función de geolocalización para trazar rutas hasta nuestras sucursales, tu ubicación se procesa únicamente en tiempo real para calcular el trayecto.',
    privacyParagraph2:
      'Al hacer clic en "Agendar revisión", serás redirigido a la atención oficial de Rodaleve por WhatsApp (77) 2888-0003, conforme a la normativa de protección de datos (LGPD).',
    termsParagraph1:
      'La información y los precios mostrados en esta Tabla de Mantenimiento y Revisiones tienen carácter informativo y estimativo para piezas genuinas Honda e insumos recomendados.',
    termsParagraph2:
      'Cualquier servicio adicional identificado en la inspección técnica o variaciones de stock serán informados y aprobados previamente con el cliente en la recepción del taller Rodaleve.',
    gestorLink: 'Gestor',
    unitsRouteTitle: (city) => `Trazar ruta hasta ${city}`,
    modeMoto: 'Moto',
    modeCar: 'Auto',
    originPlaceholder: 'Ingresa tu dirección, calle o barrio de partida...',
    originPlaceholderFallback: 'Ingresa tu dirección o barrio de partida...',
    clearAddress: 'Limpiar dirección',
    useMyLocation: 'Usar mi ubicación',
    locating: 'Ubicando...',
    traceRouteBtn: 'Trazar ruta en el mapa',
    routeCalculated: (mode) => `Ruta calculada (${mode === 'moto' ? 'Moto' : 'Auto'})`,
    geoUnsupported: 'La geolocalización no es compatible con tu navegador.',
    geoError: 'No se pudo obtener tu ubicación. Escribe tu dirección de partida.',
    originRequiredError: 'Escribe una dirección de partida o haz clic en "Usar mi ubicación".',
    focusOnMap: 'Enfocar en mapa',
    openInMaps: 'Abrir en Maps',
    mapView: 'Mapa',
    satelliteView: 'Satélite',
    viewBothUnits: 'Ver ambas',
    directMapsTitle: 'Visualización directa en Google Maps',
    directMapsDesc: (unitName, address) =>
      `Abre la ubicación oficial de ${unitName} (${address}) directamente en Google Maps.`,
    openCityInMaps: (city) => `Abrir ${city} en Google Maps`,
    yourStartPoint: 'Tu punto de partida',
    modalEyebrow: 'Presupuesto y Cita por WhatsApp',
    modalSubtitleFree: 'Mano de obra gratuita · Orden de llegada',
    modalSubtitlePaid: 'Requiere cita previa · Consultar mano de obra',
    modalCloseAria: 'Cerrar ventana',
    modalStep1: '1. Elige la sucursal de atención',
    modalStep2: (count) => `2. Resumen del presupuesto (${count} ${count === 1 ? 'ítem' : 'ítems'})`,
    modalIncludeOptionals: 'Incluir ítems opcionales',
    modalNoParts: 'No hay piezas registradas para esta revisión. Puedes enviar tu solicitud igualmente.',
    modalEstimatedTotal: 'Total estimado',
    modalFreeLaborNote: LABOR_POLICY_TEXTS.es.freeBadge,
    modalPaidLaborNote: LABOR_POLICY_TEXTS.es.paidBadge,
    modalCancel: 'Cancelar',
    modalSendWhatsApp: (city) => `Enviar a WhatsApp (${city})`,
    floatingWhatsAppAria: 'Hablar por WhatsApp Rodaleve (arrastrable)',
    floatingWhatsAppTitle: 'Hablar por WhatsApp Rodaleve (arrastra para mover)',
    loadingTable: 'Cargando Tabla de Mantenimiento Rodaleve Honda...',
    loadErrorTitle: 'No se pudieron cargar los datos',
    tryAgain: 'Intentar de nuevo',
  },
};

const ORDINAL_EN: Record<number, string> = {
  1: '1st Service',
  2: '2nd Service',
  3: '3rd Service',
  4: '4th Service',
  5: '5th Service',
  6: '6th Service',
  7: '7th Service',
};

export function translateRevisionLabel(
  revisionNumber: number,
  rawLabel: string,
  lang: SiteLanguage
): string {
  if (lang === 'pt') return rawLabel;
  if (lang === 'en') {
    return ORDINAL_EN[revisionNumber] || `${revisionNumber}th Service`;
  }
  if (lang === 'es') {
    return rawLabel.replace(/Revis[aã]o/gi, 'Revisión');
  }
  return rawLabel;
}

export function translateRevisionSubtitle(rawSubtitle: string, lang: SiteLanguage): string {
  if (lang === 'pt' || !rawSubtitle) return rawSubtitle;
  if (lang === 'en') {
    return rawSubtitle
      .replace(/(\d)\.(\d{3})/g, '$1,$2')
      .replace(/\bou\b/gi, 'or')
      .replace(/\bmeses\b/gi, 'months')
      .replace(/\bm[êe]s\b/gi, 'month')
      .replace(/\banos\b/gi, 'years')
      .replace(/\bano\b/gi, 'year');
  }
  if (lang === 'es') {
    return rawSubtitle
      .replace(/\bou\b/gi, 'o')
      .replace(/\bm[êe]s\b/gi, 'mes')
      .replace(/\banos\b/gi, 'años')
      .replace(/\bano\b/gi, 'año');
  }
  return rawSubtitle;
}

const PART_TRANSLATIONS: Record<string, { en: string; es: string }> = {
  'anel de vedação': { en: 'Sealing Ring', es: 'Anillo de Sellado' },
  'arruela plana 12mm': { en: '12mm Flat Washer', es: 'Arandela Plana 12mm' },
  'filtro de óleo': { en: 'Oil Filter', es: 'Filtro de Aceite' },
  'filtro de óleo cartucho': { en: 'Cartridge Oil Filter', es: 'Filtro de Aceite Cartucho' },
  'filtro de óleo embreagem': { en: 'Clutch Oil Filter', es: 'Filtro de Aceite Embrague' },
  'kit limpeza e lubrificação': {
    en: 'Cleaning & Lubrication Kit',
    es: 'Kit de Limpieza y Lubricación',
  },
  'limpa bico': { en: 'Fuel Injector Cleaner', es: 'Limpiador de Inyectores' },
  'redutor de atrito [opcional]': {
    en: 'Friction Reducer [Optional]',
    es: 'Reductor de Fricción [Opcional]',
  },
  'redutor de atrito': { en: 'Friction Reducer', es: 'Reductor de Fricción' },
  'óleo motor': { en: 'Engine Oil', es: 'Aceite de Motor' },
  'óleo motor 4,2l full synthetic': {
    en: 'Full Synthetic Engine Oil 4.2L',
    es: 'Aceite de Motor 4,2L Full Synthetic',
  },
  'óleo scooter 1l': { en: 'Scooter Oil 1L', es: 'Aceite Scooter 1L' },
};

export function translatePartDescription(description: string, lang: SiteLanguage): string {
  if (lang === 'pt' || !description) return description;
  const trimmed = description.trim();
  const normalized = trimmed.toLowerCase();
  const direct = PART_TRANSLATIONS[normalized];
  if (direct) {
    return lang === 'en' ? direct.en : direct.es;
  }
  // Fallback: replace [Opcional] marker cleanly while keeping unknown part names readable
  if (lang === 'en') {
    return trimmed.replace(/\[Opcional\]/gi, '[Optional]');
  }
  return trimmed;
}

const FAQ_TRANSLATION_MAP: Record<
  string,
  Record<Exclude<SiteLanguage, 'pt'>, { question: string; answer: string }>
> = {
  'quando devo fazer a primeira revisão?': {
    en: {
      question: 'When should I get the first service?',
      answer:
        'The 1st scheduled service must be performed upon reaching 1,000 km or 6 months after the motorcycle purchase date (whichever comes first), ensuring your Honda warranty remains valid.',
    },
    es: {
      question: '¿Cuándo debo hacer la primera revisión?',
      answer:
        'La 1ª revisión programada debe realizarse al alcanzar los 1.000 km recorridos o a los 6 meses desde la fecha de compra de la motocicleta (lo que ocurra primero), garantizando la validez de la garantía Honda.',
    },
  },
  'existe tolerância de quilometragem ou de data?': {
    en: {
      question: 'Is there a mileage or date tolerance?',
      answer:
        "Yes. According to each model's owner's manual, there is a standard ±10% tolerance on mileage (for example, between 900 km and 1,100 km for the 1st service). Always check the specific deadlines in your manual.",
    },
    es: {
      question: '¿Existe tolerancia de kilometraje o de fecha?',
      answer:
        'Sí. Según el manual del propietario de cada modelo, existe una tolerancia estándar de ±10% en el kilometraje (por ejemplo, entre 900 km y 1.100 km en la 1ª revisión). Consulta siempre los plazos específicos de tu manual.',
    },
  },
  'posso fazer a revisão em outra oficina?': {
    en: {
      question: 'Can I have the service done at another workshop?',
      answer:
        'To keep your Honda factory warranty valid, all mandatory periodic services must be performed exclusively at an authorized Honda dealership, such as Rodaleve.',
    },
    es: {
      question: '¿Puedo hacer la revisión en otro taller?',
      answer:
        'Para mantener válida la garantía de fábrica de tu Honda, todas las revisiones periódicas obligatorias deben realizarse exclusivamente en un concesionario autorizado Honda, como Rodaleve.',
    },
  },
  'perco a garantia se atrasar uma revisão?': {
    en: {
      question: 'Do I lose my warranty if I delay a service?',
      answer:
        "Performing the service past the deadline or beyond the tolerance stated in the owner's manual may void the contractual warranty. We recommend checking your odometer and dates regularly.",
    },
    es: {
      question: '¿Pierdo la garantía si me atraso en una revisión?',
      answer:
        'Realizar la revisión fuera de plazo o por encima de la tolerancia prevista en el manual del propietario puede conllevar la pérdida de la garantía contractual. Recomendamos revisar el odómetro y las fechas con regularidad.',
    },
  },
  'qual o prazo da garantia da minha moto?': {
    en: {
      question: 'What is the warranty period for my motorcycle?',
      answer:
        'The standard Honda warranty is 3 years with unlimited mileage for most street and high-displacement models, subject to full compliance with the periodic maintenance schedule at the authorized network.',
    },
    es: {
      question: '¿Cuál es el plazo de garantía de mi motocicleta?',
      answer:
        'La garantía estándar Honda es de 3 años sin límite de kilometraje para la mayoría de los modelos urbanos y de alta cilindrada, sujeta al cumplimiento integral del plan de mantenimiento periódico en la red autorizada.',
    },
  },
  'a revisão é gratuita?': {
    en: {
      question: 'Is the service free?',
      answer:
        'For the 1st and 2nd services, labor is free (covered by Honda), and only the replaced parts and supplies are charged. From the 3rd service onward, both parts and labor fees apply.',
    },
    es: {
      question: '¿La revisión es gratuita?',
      answer:
        'En la 1ª y 2ª revisión, la mano de obra es gratuita (cubierta por Honda) y solo se cobra al cliente el valor de las piezas e insumos sustituidos. A partir de la 3ª revisión, se aplican los valores de piezas y mano de obra.',
    },
  },
  'quanto custa a revisão da minha moto?': {
    en: {
      question: 'How much does my motorcycle service cost?',
      answer:
        'You can check the estimated values for genuine parts and supplies on this page for each model and service interval, including options with and without optional cleaning and protection items.',
    },
    es: {
      question: '¿Cuánto cuesta la revisión de mi motocicleta?',
      answer:
        'Puedes consultar en esta página los valores estimados de piezas genuinas e insumos para cada modelo y rango de revisión, incluyendo opciones con y sin ítems opcionales de limpieza y protección.',
    },
  },
  'o que é feito na revisão?': {
    en: {
      question: 'What is done during the service?',
      answer:
        'Our authorized workshop performs all items in the official Honda checklist: oil and filter changes, general bolt tightening, drivetrain inspection and lubrication, brakes, suspension, electrical system, and electronic diagnostics.',
    },
    es: {
      question: '¿Qué se realiza en la revisión?',
      answer:
        'Nuestro taller autorizado ejecuta todos los ítems de la lista oficial Honda: cambio de aceite y filtros, reapriete general de tornillos, verificación y lubricación de transmisión, frenos, suspensión, sistema eléctrico y diagnóstico electrónico.',
    },
  },
  'por que o óleo e as peças variam de um modelo para outro?': {
    en: {
      question: 'Why do oil and parts vary from one model to another?',
      answer:
        'Each engine has specific technical requirements for oil capacity (in ml or liters), oil filter type (screen, cartridge, or DCT clutch), and sealing rings designed specifically for that Honda engine.',
    },
    es: {
      question: '¿Por qué el aceite y las piezas varían de un modelo a otro?',
      answer:
        'Cada motorización posee especificaciones técnicas propias de capacidad de aceite (en ml o litros), tipo de filtro de aceite (malla, cartucho o embrague DCT) y anillos de sellado específicos del diseño Honda.',
    },
  },
  'como agendo a revisão?': {
    en: {
      question: 'How do I schedule a service?',
      answer:
        'Scheduling can be done directly through our WhatsApp (77) 2888-0003 or branch phone. Prior booking applies from the 3rd service onward; the 1st and 2nd services are handled on a walk-in, first-come basis.',
    },
    es: {
      question: '¿Cómo agendo la revisión?',
      answer:
        'La cita puede realizarse directamente por nuestro WhatsApp (77) 2888-0003 o teléfono de la sucursal. La cita previa aplica a partir de la 3ª revisión; la 1ª y 2ª revisión se atienden por orden de llegada.',
    },
  },
  'preciso levar o manual ou o certificado de garantia?': {
    en: {
      question: 'Do I need to bring the manual or warranty certificate?',
      answer:
        "Yes, we recommend bringing the Owner's Manual with the Warranty Certificate for official service registration, along with the motorcycle registration document.",
    },
    es: {
      question: '¿Debo llevar el manual o el certificado de garantía?',
      answer:
        'Sí, recomendamos traer el Manual del Propietario con el Certificado de Garantía para el registro oficial de la revisión, además del documento de la motocicleta.',
    },
  },
  'posso passar na loja sem agendar?': {
    en: {
      question: 'Can I stop by the dealership without an appointment?',
      answer:
        'Yes! The 1st and 2nd services are handled on a walk-in basis during business hours. For services from the 3rd onward or specific repairs, we recommend scheduling via WhatsApp.',
    },
    es: {
      question: '¿Puedo ir a la tienda sin cita previa?',
      answer:
        '¡Sí! La 1ª y 2ª revisión se atienden por orden de llegada durante nuestro horario comercial. Para revisiones a partir de la 3ª o servicios específicos, recomendamos agendar por WhatsApp.',
    },
  },
  'qual o horário de atendimento?': {
    en: {
      question: 'What are your business hours?',
      answer:
        'We are open Monday through Friday from 7:30 AM to 6:00 PM, and on Saturdays from 7:30 AM to 12:00 PM, at our Vitória da Conquista and Guanambi branches.',
    },
    es: {
      question: '¿Cuál es el horario de atención?',
      answer:
        'Atendemos de lunes a viernes de 07:30 a 18:00 y los sábados de 07:30 a 12:00 en nuestras sucursales de Vitória da Conquista y Guanambi.',
    },
  },
};

export function translateFaqItem(
  question: string,
  answer: string,
  lang: SiteLanguage
): { question: string; answer: string } {
  if (lang === 'pt') return { question, answer };
  const match = FAQ_TRANSLATION_MAP[question.trim().toLowerCase()];
  if (match && match[lang]) {
    return match[lang];
  }
  return { question, answer };
}
