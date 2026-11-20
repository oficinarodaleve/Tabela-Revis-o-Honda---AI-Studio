export type PartUnit = 'UN' | 'ML';
export type PriceMode = 'auto' | 'manual';

export interface Segment {
  id: number;
  slug: string;
  name: string;
  visible: boolean;
  sort_order: number;
}

export interface RevisionTab {
  id: number;
  revision_number: number;
  label: string;
  subtitle: string;
  visible: boolean;
  sort_order: number;
}

export interface Part {
  code: string;
  description: string;
  unit: PartUnit;
  default_qty: number;
  price: number;
  mode: PriceMode;
  is_optional: boolean;
  microwork_price: number | null;
  sync_status: string;
  updated_at: string;
}

export interface RevisionPart {
  id: number;
  model_id: number;
  revision_number: number;
  part_code: string;
  quantity: number;
}

export interface MotoModel {
  id: number;
  name: string;
  segment_slug: string;
  image_url: string;
  hidden: boolean;
  sort_order: number;
}

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  sort_order: number;
}

export interface UnitLocation {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  hours: string;
  gmb_url: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  rating: number;
  lat: number;
  lng: number;
}

export interface SeoSettings {
  favicon_url: string;
  logo_url: string;
  logo_alt: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  author_brand: string;
  canonical_url: string;
  og_same_title: boolean;
  og_title: string;
  og_same_description: boolean;
  og_description: string;
  og_image: string;
  og_type: 'website' | 'article' | 'product';
  twitter_card: 'summary_large_image' | 'summary';
  business_type: string;
  company_name: string;
  instagram_url: string;
  youtube_url: string;
  facebook_url: string;
  robots_policy: 'index, follow' | 'noindex, follow' | 'index, nofollow' | 'noindex, nofollow';
  robots_txt: string;
  sitemap_xml: string;
  head_scripts: string;
  body_scripts: string;
  units: UnitLocation[];
}

export interface MicroWorkConfig {
  auto_sync_enabled: boolean;
  update_mode: 'manual' | 'auto_api';
  endpoint_url: string;
  has_token: boolean;
  token_masked: string;
  frequency: 'daily' | 'weekly';
  last_sync_at: string;
  last_sync_result: string;
}

export interface GoogleMapsIntegration {
  active: boolean;
  custom_api_key: string;
}

export interface CustomIntegration {
  id: string;
  name: string;
  value: string;
  active: boolean;
}

export interface IntegrationsData {
  google_maps: GoogleMapsIntegration;
  microwork: MicroWorkConfig;
  custom_integrations: CustomIntegration[];
}

export interface PublicBootstrapData {
  models: MotoModel[];
  segments: Segment[];
  revision_tabs: RevisionTab[];
  parts: Part[];
  revision_parts: RevisionPart[];
  faqs: FaqItem[];
  seo: SeoSettings;
  last_price_sync: string;
  maps_config: {
    active: boolean;
    api_key: string;
  };
  public_integrations: CustomIntegration[];
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
}
