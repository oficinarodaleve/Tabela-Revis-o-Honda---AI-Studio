export const SEED_IMAGES = {
  cub: '/src/assets/images/moto_cub_street_1795147026311.jpg',
  scooter: '/src/assets/images/moto_scooter_pcx_1795147026469.jpg',
  street: '/src/assets/images/moto_street_cg_1795147025649.jpg',
  naked: '/src/assets/images/moto_naked_hornet_1795147026272.jpg',
  trail: '/src/assets/images/moto_trail_adventure_1795147025806.jpg',
  touring: '/src/assets/images/moto_touring_africa_1795147026835.jpg',
  offroad: '/src/assets/images/moto_offroad_crf_1795147026744.jpg',
  ogBanner: 'https://oficinarodaleve.ai.studio/og-image.jpg',
};

export const INITIAL_SEGMENTS = [
  { slug: 'cub_scooter', name: 'Street', visible: 1, sort_order: 1 },
  { slug: 'street_trail', name: 'Adventure', visible: 1, sort_order: 2 },
  { slug: 'off_road', name: 'Off Road', visible: 1, sort_order: 3 },
];

export const INITIAL_REVISION_TABS = [
  { revision_number: 1, label: '1ª Revisão', subtitle: '1.000 km ou 6 meses', visible: 1, sort_order: 1 },
  { revision_number: 2, label: '2ª Revisão', subtitle: '6.000 km ou 12 meses', visible: 1, sort_order: 2 },
  { revision_number: 3, label: '3ª Revisão', subtitle: '12.000 km ou 18 meses', visible: 0, sort_order: 3 },
  { revision_number: 4, label: '4ª Revisão', subtitle: '18.000 km ou 24 meses', visible: 0, sort_order: 4 },
  { revision_number: 5, label: '5ª Revisão', subtitle: '24.000 km ou 30 meses', visible: 0, sort_order: 5 },
  { revision_number: 6, label: '6ª Revisão', subtitle: '30.000 km ou 36 meses', visible: 0, sort_order: 6 },
  { revision_number: 7, label: '7ª Revisão', subtitle: '36.000 km ou 42 meses', visible: 0, sort_order: 7 },
];

export const INITIAL_PARTS = [
  {
    code: '91302PA9003',
    description: 'Anel de Vedação',
    unit: 'UN',
    default_qty: 1,
    price: 40.49,
    mode: 'auto',
    is_optional: 0,
    microwork_price: 40.49,
    sync_status: 'Sincronizado',
  },
  {
    code: '91302KF0003',
    description: 'Anel de Vedação',
    unit: 'UN',
    default_qty: 1,
    price: 63.95,
    mode: 'auto',
    is_optional: 0,
    microwork_price: 63.95,
    sync_status: 'Sincronizado',
  },
  {
    code: '90401KRMR20',
    description: 'Arruela Plana 12mm',
    unit: 'UN',
    default_qty: 1,
    price: 11.51,
    mode: 'auto',
    is_optional: 0,
    microwork_price: 11.51,
    sync_status: 'Sincronizado',
  },
  {
    code: '15412HM5A10',
    description: 'Filtro de Óleo',
    unit: 'UN',
    default_qty: 1,
    price: 126.70,
    mode: 'auto',
    is_optional: 0,
    microwork_price: 126.70,
    sync_status: 'Sincronizado',
  },
  {
    code: '15410MFJD01',
    description: 'Filtro de Óleo Cartucho',
    unit: 'UN',
    default_qty: 1,
    price: 276.84,
    mode: 'auto',
    is_optional: 0,
    microwork_price: 276.84,
    sync_status: 'Sincronizado',
  },
  {
    code: '15412MGSD21',
    description: 'Filtro de Óleo Embreagem',
    unit: 'UN',
    default_qty: 1,
    price: 177.25,
    mode: 'auto',
    is_optional: 0,
    microwork_price: 177.25,
    sync_status: 'Sincronizado',
  },
  {
    code: '06155LUB015',
    description: 'Kit Limpeza e Lubrificação',
    unit: 'UN',
    default_qty: 1,
    price: 70.00,
    mode: 'manual',
    is_optional: 1,
    microwork_price: null,
    sync_status: 'Manual',
  },
  {
    code: '1000 000',
    description: 'Limpa Bico',
    unit: 'UN',
    default_qty: 1,
    price: 59.00,
    mode: 'manual',
    is_optional: 0,
    microwork_price: null,
    sync_status: 'Manual',
  },
  {
    code: '1000 040 100',
    description: 'Redutor de Atrito [Opcional]',
    unit: 'UN',
    default_qty: 1,
    price: 59.50,
    mode: 'manual',
    is_optional: 1,
    microwork_price: null,
    sync_status: 'Manual',
  },
  {
    code: '08233M99200',
    description: 'Óleo Motor',
    unit: 'ML',
    default_qty: 1000,
    price: 7.00,
    mode: 'auto',
    is_optional: 0,
    microwork_price: 7.00,
    sync_status: 'Sincronizado',
  },
  {
    code: '082342MAK1LD1',
    description: 'Óleo Motor 4,2L Full Synthetic',
    unit: 'UN',
    default_qty: 1,
    price: 475.00,
    mode: 'auto',
    is_optional: 0,
    microwork_price: 475.00,
    sync_status: 'Sincronizado',
  },
  {
    code: '082332MB024',
    description: 'Óleo Scooter 1L',
    unit: 'UN',
    default_qty: 1,
    price: 72.00,
    mode: 'auto',
    is_optional: 0,
    microwork_price: 72.00,
    sync_status: 'Sincronizado',
  },
];

export const INITIAL_MODELS = [
  { name: 'POP 110i', segment_slug: 'cub_scooter', image_url: SEED_IMAGES.cub, hidden: 0, sort_order: 1, profile: 'cub800' },
  { name: 'BIZ 125', segment_slug: 'cub_scooter', image_url: SEED_IMAGES.cub, hidden: 0, sort_order: 2, profile: 'cub800' },
  { name: 'ELITE 125', segment_slug: 'cub_scooter', image_url: SEED_IMAGES.scooter, hidden: 0, sort_order: 3, profile: 'scooter' },
  { name: 'CG 160', segment_slug: 'cub_scooter', image_url: SEED_IMAGES.street, hidden: 0, sort_order: 4, profile: 'street1000' },
  { name: 'PCX 160', segment_slug: 'cub_scooter', image_url: SEED_IMAGES.scooter, hidden: 0, sort_order: 5, profile: 'scooter' },
  { name: 'ADV 160', segment_slug: 'street_trail', image_url: SEED_IMAGES.trail, hidden: 0, sort_order: 6, profile: 'scooter' },
  { name: 'NXR Bros 160', segment_slug: 'street_trail', image_url: SEED_IMAGES.trail, hidden: 0, sort_order: 7, profile: 'street1000' },
  { name: 'XRE 190', segment_slug: 'street_trail', image_url: SEED_IMAGES.trail, hidden: 0, sort_order: 8, profile: 'trail190' },
  { name: 'CB 300F Twister', segment_slug: 'cub_scooter', image_url: SEED_IMAGES.naked, hidden: 0, sort_order: 9, profile: 'trail300' },
  { name: 'Sahara 300', segment_slug: 'street_trail', image_url: SEED_IMAGES.trail, hidden: 0, sort_order: 10, profile: 'trail300' },
  { name: 'XR 300L Tornado', segment_slug: 'street_trail', image_url: SEED_IMAGES.trail, hidden: 0, sort_order: 11, profile: 'trail300' },
  { name: 'CB 500X', segment_slug: 'street_trail', image_url: SEED_IMAGES.touring, hidden: 0, sort_order: 12, profile: 'mid500' },
  { name: 'CB Hornet 500', segment_slug: 'cub_scooter', image_url: SEED_IMAGES.naked, hidden: 0, sort_order: 13, profile: 'mid500' },
  { name: 'NX 500', segment_slug: 'street_trail', image_url: SEED_IMAGES.touring, hidden: 0, sort_order: 14, profile: 'mid500' },
  { name: 'CB 650R', segment_slug: 'cub_scooter', image_url: SEED_IMAGES.naked, hidden: 0, sort_order: 15, profile: 'sport650' },
  { name: 'CB Hornet 750', segment_slug: 'cub_scooter', image_url: SEED_IMAGES.naked, hidden: 0, sort_order: 16, profile: 'twin750' },
  { name: 'NC 750X', segment_slug: 'street_trail', image_url: SEED_IMAGES.touring, hidden: 0, sort_order: 17, profile: 'twin750' },
  { name: 'NC 750X DCT', segment_slug: 'street_trail', image_url: SEED_IMAGES.touring, hidden: 0, sort_order: 18, profile: 'twin750dct' },
  { name: 'XL 750 Transalp', segment_slug: 'street_trail', image_url: SEED_IMAGES.touring, hidden: 0, sort_order: 19, profile: 'twin750' },
  { name: 'CB Hornet 1000', segment_slug: 'cub_scooter', image_url: SEED_IMAGES.naked, hidden: 0, sort_order: 20, profile: 'hornet1000' },
  { name: 'CRF 1100 Africa Twin', segment_slug: 'street_trail', image_url: SEED_IMAGES.touring, hidden: 0, sort_order: 21, profile: 'africa' },
  { name: 'CRF 1100 Africa Twin DCT', segment_slug: 'street_trail', image_url: SEED_IMAGES.touring, hidden: 0, sort_order: 22, profile: 'africadct' },
  { name: 'CRF', segment_slug: 'off_road', image_url: SEED_IMAGES.offroad, hidden: 1, sort_order: 23, profile: 'offroad' },
  { name: 'TRX', segment_slug: 'off_road', image_url: SEED_IMAGES.offroad, hidden: 1, sort_order: 24, profile: 'offroad' },
] as const;

export function buildRevisionPartsForProfile(profile: string, revisionNumber: number): Array<{ part_code: string; quantity: number }> {
  const isEvenOrHigher = revisionNumber >= 2;
  const items: Array<{ part_code: string; quantity: number }> = [];

  switch (profile) {
    case 'cub800':
      items.push({ part_code: '08233M99200', quantity: 800 });
      items.push({ part_code: '90401KRMR20', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '06155LUB015', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'scooter':
      items.push({ part_code: '082332MB024', quantity: 1 });
      items.push({ part_code: '90401KRMR20', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'street1000':
      items.push({ part_code: '08233M99200', quantity: 1000 });
      items.push({ part_code: '90401KRMR20', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '06155LUB015', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'trail190':
      items.push({ part_code: '08233M99200', quantity: 1000 });
      items.push({ part_code: '90401KRMR20', quantity: 1 });
      items.push({ part_code: '91302PA9003', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '06155LUB015', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'trail300':
      items.push({ part_code: '08233M99200', quantity: 1500 });
      items.push({ part_code: '90401KRMR20', quantity: 1 });
      items.push({ part_code: '15412HM5A10', quantity: 1 });
      items.push({ part_code: '91302KF0003', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '06155LUB015', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'mid500':
      items.push({ part_code: '08233M99200', quantity: 2700 });
      items.push({ part_code: '90401KRMR20', quantity: 1 });
      items.push({ part_code: '15410MFJD01', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '06155LUB015', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'sport650':
      items.push({ part_code: '08233M99200', quantity: 3000 });
      items.push({ part_code: '90401KRMR20', quantity: 1 });
      items.push({ part_code: '15410MFJD01', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '06155LUB015', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'twin750':
      items.push({ part_code: '08233M99200', quantity: 3400 });
      items.push({ part_code: '90401KRMR20', quantity: 1 });
      items.push({ part_code: '15410MFJD01', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '06155LUB015', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'twin750dct':
      items.push({ part_code: '08233M99200', quantity: 3600 });
      items.push({ part_code: '90401KRMR20', quantity: 1 });
      items.push({ part_code: '15410MFJD01', quantity: 1 });
      items.push({ part_code: '15412MGSD21', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '06155LUB015', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'hornet1000':
      items.push({ part_code: '08233M99200', quantity: 3500 });
      items.push({ part_code: '90401KRMR20', quantity: 1 });
      items.push({ part_code: '15410MFJD01', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '06155LUB015', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'africa':
      items.push({ part_code: '082342MAK1LD1', quantity: 1 });
      items.push({ part_code: '90401KRMR20', quantity: 2 });
      items.push({ part_code: '15410MFJD01', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '06155LUB015', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'africadct':
      items.push({ part_code: '082342MAK1LD1', quantity: 1 });
      items.push({ part_code: '90401KRMR20', quantity: 2 });
      items.push({ part_code: '15410MFJD01', quantity: 1 });
      items.push({ part_code: '15412MGSD21', quantity: 1 });
      if (isEvenOrHigher) items.push({ part_code: '1000 000', quantity: 1 });
      items.push({ part_code: '06155LUB015', quantity: 1 });
      items.push({ part_code: '1000 040 100', quantity: 1 });
      break;
    case 'offroad':
    default:
      break;
  }

  return items;
}

export const INITIAL_FAQS = [
  {
    question: 'Quando devo fazer a primeira revisão?',
    answer: 'A 1ª revisão programada deve ser realizada ao atingir 1.000 km rodados ou 6 meses após a data da compra da motocicleta (o que ocorrer primeiro), garantindo a preservação da garantia Honda.',
  },
  {
    question: 'Existe tolerância de quilometragem ou de data?',
    answer: 'Sim. Conforme o manual do proprietário de cada modelo, há uma tolerância padrão de ±10% na quilometragem (por exemplo, entre 900 km e 1.100 km na 1ª revisão). Consulte sempre os prazos específicos do seu manual.',
  },
  {
    question: 'Posso fazer a revisão em outra oficina?',
    answer: 'Para manter a garantia de fábrica da sua Honda válida, todas as revisões periódicas obrigatórias devem ser realizadas exclusivamente em uma concessionária autorizada Honda, como a Rodaleve.',
  },
  {
    question: 'Perco a garantia se atrasar uma revisão?',
    answer: 'Realizar a revisão fora do prazo ou acima da tolerância prevista no manual do proprietário pode acarretar a perda da garantia contratual. Recomendamos acompanhar o odômetro e as datas regularmente.',
  },
  {
    question: 'Qual o prazo da garantia da minha moto?',
    answer: 'A garantia padrão Honda é de 3 anos sem limite de quilometragem para a maioria dos modelos de rua e alta cilindrada, condicionada ao cumprimento integral do plano de manutenção periódica na rede autorizada.',
  },
  {
    question: 'A revisão é gratuita?',
    answer: 'Na 1ª e na 2ª revisão, a mão de obra é gratuita (custeada pela Honda), sendo cobrado do cliente apenas o valor das peças e insumos substituídos. A partir da 3ª revisão, aplicam-se os valores de peças e mão de obra.',
  },
  {
    question: 'Quanto custa a revisão da minha moto?',
    answer: 'Você pode consultar nesta página os valores estimados de peças genuínas e insumos para cada modelo e faixa de revisão, incluindo opções com e sem itens opcionais de limpeza e proteção.',
  },
  {
    question: 'O que é feito na revisão?',
    answer: 'Nossa oficina autorizada executa todos os itens do checklist oficial Honda: troca de óleo e filtros, reaperto geral de parafusos, verificação e lubrificação da transmissão, freios, suspensão, sistema elétrico e diagnóstico eletrônico.',
  },
  {
    question: 'Por que o óleo e as peças variam de um modelo para outro?',
    answer: 'Cada motorização possui especificações técnicas próprias de capacidade de óleo (em ml ou litros), tipo de filtro de óleo (tela, cartucho ou embreagem DCT) e anéis de vedação específicos do projeto Honda.',
  },
  {
    question: 'Como agendo a revisão?',
    answer: 'O agendamento pode ser feito diretamente pelo nosso WhatsApp (77) 2888-0003 ou telefone da unidade. O agendamento prévio se aplica a partir da 3ª revisão; a 1ª e a 2ª revisão são atendidas por ordem de chegada.',
  },
  {
    question: 'Preciso levar o manual ou o certificado de garantia?',
    answer: 'Sim, recomendamos trazer o Manual do Proprietário com o Certificado de Garantia para registro oficial da revisão, além do documento da motocicleta.',
  },
  {
    question: 'Posso passar na loja sem agendar?',
    answer: 'Sim! A 1ª e a 2ª revisão são realizadas por ordem de chegada durante nosso horário comercial. Para revisões a partir da 3ª ou serviços específicos, recomendamos agendar pelo WhatsApp.',
  },
  {
    question: 'Qual o horário de atendimento?',
    answer: 'Atendemos de segunda a sexta-feira das 07h30 às 18h00, e aos sábados das 07h30 às 12h00, nas unidades de Vitória da Conquista e Guanambi.',
  },
];

export const INITIAL_UNITS = [
  {
    id: 'vitoria-da-conquista',
    name: 'Rodaleve Honda – Vitória da Conquista',
    cnpj: '13.681.912/0001-25',
    phone: '(77) 3427-8000',
    whatsapp: '(77) 2888-0003',
    hours: 'Mo-Fr 07:30-18:00, Sa 07:30-12:00',
    gmb_url:
      'https://www.google.com/maps/search/?api=1&query=Rodaleve%20Honda%2C%20Av.%20Pres.%20Dutra%2C%202879%20-%20Centro%2C%20Vit%C3%B3ria%20da%20Conquista%20-%20BA%2C%2045065-075',
    street: 'Av. Pres. Dutra',
    number: '2879',
    neighborhood: 'Centro',
    city: 'Vitória da Conquista',
    state: 'BA',
    zip: '45065-075',
    rating: 4.8,
    lat: -14.8655,
    lng: -40.8385,
  },
  {
    id: 'guanambi',
    name: 'Rodaleve Guanambi',
    cnpj: '13.681.912/0002-06',
    phone: '(77) 3451-8000',
    whatsapp: '(77) 2888-0003',
    hours: 'Mo-Fr 07:30-18:00, Sa 07:30-12:00',
    gmb_url: 'https://www.google.com/maps/search/?api=1&query=Av.+Santos+Dumont,+1837+-+Aeroporto+Velho,+Guanambi+-+BA,+46430-000',
    street: 'Av. Santos Dumont',
    number: '1837',
    neighborhood: 'Aeroporto Velho',
    city: 'Guanambi',
    state: 'BA',
    zip: '46430-000',
    rating: 4.8,
    lat: -14.2156,
    lng: -42.7758,
  },
];

export const INITIAL_SEO_SETTINGS = {
  favicon_url: '',
  logo_url: '',
  logo_alt: 'Rodaleve Honda – Concessionária Autorizada',
  short_name: 'Rodaleve',
  gestor_logo_url: '/rodaleve-gestor-logo.svg',
  gestor_title: 'Gestor Rodaleve',
  gestor_subtitle: 'Tabela de manutenção e revisões',
  meta_title: 'Rodaleve Honda – Tabela de Manutenção e Revisões',
  meta_description: 'Consulte peças genuínas e valores estimados por modelo de cada revisão programada Honda na concessionária autorizada Rodaleve.',
  meta_keywords: 'revisão honda, tabela de revisão honda, rodaleve honda, vitória da conquista, guanambi, manutenção moto honda',
  author_brand: 'Rodaleve Honda',
  canonical_url: 'https://revisoes.rodaleve.com.br',
  og_same_title: true,
  og_title: 'Rodaleve Honda – Tabela de Manutenção e Revisões',
  og_same_description: true,
  og_description: 'Consulte peças genuínas e valores estimados por modelo de cada revisão programada Honda na concessionária autorizada Rodaleve.',
  og_image: SEED_IMAGES.ogBanner,
  og_type: 'website' as const,
  twitter_card: 'summary_large_image' as const,
  business_type: 'MotorcycleDealer',
  company_name: 'Rodaleve Honda',
  instagram_url: 'https://instagram.com/rodalevehonda',
  youtube_url: 'https://youtube.com/@rodalevehonda',
  facebook_url: 'https://www.facebook.com/concessionariarodaleve/',
  robots_policy: 'index, follow' as const,
  robots_txt: `User-agent: *\nAllow: /\nDisallow: /gestor\n\nSitemap: https://revisoes.rodaleve.com.br/sitemap.xml`,
  sitemap_xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://revisoes.rodaleve.com.br/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>`,
  head_scripts: '',
  body_scripts: '',
  meta_pixel: {
    enabled: false,
    pixel_id: '',
    events: {
      page_view: true,
      view_content: true,
      lead_contact: true,
    },
    custom_code: '',
  },
  google_tag: {
    enabled: false,
    ga4_id: '',
    ads_id: '',
    conversion_label: '',
    events: {
      page_view: true,
      view_content: true,
      lead_contact: true,
    },
    custom_code: '',
  },
  tiktok_pixel: {
    enabled: false,
    pixel_id: '',
    events: {
      page_view: true,
      view_content: true,
      lead_contact: true,
    },
    custom_code: '',
  },
  units: INITIAL_UNITS,
};
