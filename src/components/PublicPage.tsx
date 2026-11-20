import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Instagram,
  LayoutGrid,
  List,
  MessageCircle,
  Moon,
  Search,
  Sun,
  X,
  Youtube,
} from 'lucide-react';
import { PublicBootstrapData } from '../types';
import {
  computeModelRevision,
  formatBRL,
  formatDateTimeBR,
  formatPartQuantity,
} from '../utils/pricing';
import { UnitsMapSection } from './UnitsMapSection';

interface PublicPageProps {
  data: PublicBootstrapData;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigate: (path: string) => void;
}

const WHATSAPP_NUMBER = '557728880003';

function buildWhatsAppUrl(modelName?: string, revisionLabel?: string): string {
  const text = modelName && revisionLabel
    ? `Olá! Gostaria de agendar a ${revisionLabel} da minha Honda ${modelName} na Rodaleve.`
    : `Olá! Gostaria de agendar uma revisão da minha moto Honda na Rodaleve.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

export function PublicPage({
  data,
  darkMode,
  onToggleDarkMode,
  onNavigate,
}: PublicPageProps) {
  const [activeNav, setActiveNav] = useState<'revisoes' | 'faq' | 'unidades'>('revisoes');
  const [heroTab, setHeroTab] = useState<'tabela' | 'faq'>('tabela');
  const [selectedRevision, setSelectedRevision] = useState<number>(
    data.revision_tabs[0]?.revision_number ?? 1
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [openFaqId, setOpenFaqId] = useState<number | null>(data.faqs[0]?.id ?? null);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  const segmentNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const seg of data.segments) {
      map[seg.slug] = seg.name;
    }
    return map;
  }, [data.segments]);

  const partsMap = useMemo(() => {
    const map: Record<string, (typeof data.parts)[number]> = {};
    for (const part of data.parts) {
      map[part.code] = part;
    }
    return map;
  }, [data.parts]);

  const activeRevisionObj = useMemo(
    () =>
      data.revision_tabs.find((t) => t.revision_number === selectedRevision) ||
      data.revision_tabs[0],
    [data.revision_tabs, selectedRevision]
  );

  const revisionLabel = activeRevisionObj?.label || `${selectedRevision}ª Revisão`;

  const computedModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return data.models
      .map((model) => {
        const summary = computeModelRevision(
          model.id,
          selectedRevision,
          data.revision_parts,
          partsMap
        );
        return { model, summary };
      })
      .filter(({ model, summary }) => {
        if (selectedSegment !== 'all' && model.segment_slug !== selectedSegment) {
          return false;
        }
        if (!q) return true;
        if (model.name.toLowerCase().includes(q)) return true;
        const segName = (segmentNameMap[model.segment_slug] || '').toLowerCase();
        if (segName.includes(q)) return true;
        return summary.items.some(
          ({ part }) =>
            part.description.toLowerCase().includes(q) ||
            part.code.toLowerCase().includes(q)
        );
      });
  }, [data.models, data.revision_parts, partsMap, selectedRevision, selectedSegment, searchQuery, segmentNameMap]);

  const handleNavClick = (target: 'revisoes' | 'faq' | 'unidades') => {
    setActiveNav(target);
    if (target === 'revisoes') {
      setHeroTab('tabela');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'faq') {
      setHeroTab('faq');
      const el = document.getElementById('hero-tabs');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (target === 'unidades') {
      const el = document.getElementById('unidades');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-neutral-900 transition-colors dark:bg-neutral-950 dark:text-neutral-100">
      {/* 1. Cabeçalho fixo no topo */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('revisoes');
            }}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap"
          >
            {data.seo.logo_url ? (
              <img
                src={data.seo.logo_url}
                alt={data.seo.logo_alt || 'RODALEVE'}
                className="h-8 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="font-display text-xl font-extrabold tracking-tight text-[#E4002B]">
                RODALEVE
              </span>
            )}
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            <button
              type="button"
              onClick={() => handleNavClick('revisoes')}
              className={`whitespace-nowrap border-b-2 py-5 text-sm font-semibold transition-colors ${
                activeNav === 'revisoes' && heroTab === 'tabela'
                  ? 'border-[#E4002B] text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Revisões
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('faq')}
              className={`whitespace-nowrap border-b-2 py-5 text-sm font-semibold transition-colors ${
                heroTab === 'faq'
                  ? 'border-[#E4002B] text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Dúvidas Frequentes
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('unidades')}
              className={`whitespace-nowrap border-b-2 py-5 text-sm font-semibold transition-colors ${
                activeNav === 'unidades'
                  ? 'border-[#E4002B] text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              Unidades
            </button>
          </nav>

          <a
            href={buildWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#E4002B] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#C80024] sm:text-sm"
          >
            Agendar revisão
          </a>
        </div>
      </header>

      {/* 2. Hero */}
      <section
        id="hero-tabs"
        className="border-b border-neutral-200/70 bg-white py-10 dark:border-neutral-800 dark:bg-neutral-950 sm:py-12"
      >
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-[#E4002B]">
                CONCESSIONÁRIA AUTORIZADA HONDA
              </p>
              <h1 className="mt-2 text-balance font-display text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-4xl lg:text-[42px] lg:leading-[1.12]">
                Tabela de Manutenção e Revisões
              </h1>
              <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
                Consulte peças genuínas e valores estimados por modelo de cada revisão programada.
              </p>
              <p className="mt-2 text-xs font-medium text-neutral-500 tabular-nums dark:text-neutral-500">
                Preços atualizados em: {formatDateTimeBR(data.last_price_sync)}
              </p>
            </div>

            {/* Seletor em pílula com duas abas */}
            <div className="inline-flex self-start rounded-full border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-800 dark:bg-neutral-900 lg:self-end">
              <button
                type="button"
                onClick={() => {
                  setHeroTab('tabela');
                  setActiveNav('revisoes');
                }}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                  heroTab === 'tabela'
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                Tabela por Modelo
              </button>
              <button
                type="button"
                onClick={() => {
                  setHeroTab('faq');
                  setActiveNav('faq');
                }}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                  heroTab === 'faq'
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                Perguntas Frequentes
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Either Revision Table or FAQ */}
      {heroTab === 'tabela' ? (
        <main className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
          {/* 3. Seletor de revisão */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
            {data.revision_tabs.map((tab) => {
              const isSelected = selectedRevision === tab.revision_number;
              return (
                <button
                  key={tab.revision_number}
                  type="button"
                  onClick={() => setSelectedRevision(tab.revision_number)}
                  className={`flex min-w-[210px] flex-col items-start rounded-2xl border px-5 py-4 text-left transition-all ${
                    isSelected
                      ? 'border-[#E4002B] bg-[#E4002B] text-white shadow-sm'
                      : 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:hover:border-neutral-700'
                  }`}
                >
                  <span className="font-display text-base font-bold">{tab.label}</span>
                  <span
                    className={`mt-0.5 text-xs ${
                      isSelected ? 'text-white/90' : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {tab.subtitle}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 4. Aviso informativo */}
          <div className="mt-6 flex items-start gap-3.5 rounded-2xl border border-neutral-200 bg-neutral-100/80 p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#E4002B]" />
            <div className="space-y-1.5 text-xs leading-relaxed text-neutral-700 sm:text-sm dark:text-neutral-300">
              <p>
                <strong>1ª e 2ª revisão:</strong> a mão de obra é gratuita. É cobrado somente o valor das peças utilizadas.
              </p>
              <p>
                <strong>3ª a 6ª revisão:</strong> a mão de obra e o valor das peças utilizadas são cobrados conforme tabela vigente. A troca de óleo da revisão é gratuita, desde que a revisão seja realizada na nossa concessionária e que a moto tenha sido comprada conosco e esteja dentro do prazo estipulado pela montadora, conforme o manual do proprietário.
              </p>
            </div>
          </div>

          {/* 5. Barra de busca e filtros */}
          <div className="mt-7 flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar modelo, peça ou código..."
                className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#E4002B] focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedSegment('all')}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                    selectedSegment === 'all'
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  Todos os modelos
                </button>
                {data.segments.map((seg) => (
                  <button
                    key={seg.slug}
                    type="button"
                    onClick={() => setSelectedSegment(seg.slug)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                      selectedSegment === seg.slug
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {seg.name}
                  </button>
                ))}
              </div>

              {/* Grid/List switcher */}
              <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label="Visualização em grade"
                  className={`rounded-lg p-1.5 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-label="Visualização em lista"
                  className={`rounded-lg p-1.5 transition-colors ${
                    viewMode === 'list'
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 6. Grade de cards de motos */}
          {computedModels.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-12 text-center dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-base font-semibold text-neutral-900 dark:text-white">
                Nenhum modelo encontrado
              </p>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Tente buscar por outro nome de motocicleta, peça ou código Honda.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSegment('all');
                }}
                className="mt-4 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900"
              >
                Limpar filtros
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="mt-7 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {computedModels.map(({ model, summary }) => {
                const categoryLabel = segmentNameMap[model.segment_slug] || 'Street';
                const revTitleUpper = `TOTAL DA ${revisionLabel.toUpperCase()}`;
                const scheduleText = `Agendar ${revisionLabel.toLowerCase()} desta moto`;

                return (
                  <article
                    key={model.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    {/* Foto grande da moto (fundo branco, centralizada) */}
                    <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-white p-5 border-b border-neutral-100 dark:border-neutral-800">
                      {model.image_url ? (
                        <img
                          src={model.image_url}
                          alt={`Honda ${model.name}`}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-xl bg-neutral-50 text-xs font-semibold text-neutral-400">
                          Honda {model.name}
                        </div>
                      )}
                    </div>

                    {/* Cabeçalho do card */}
                    <div className="flex items-start justify-between gap-3 px-5 pt-4">
                      <div>
                        <h2 className="font-display text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                          {model.name}
                        </h2>
                        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          {categoryLabel}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-neutral-500 tabular-nums dark:text-neutral-400">
                        {summary.items.length} {summary.items.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>

                    {/* Lista de peças da revisão */}
                    <div className="mt-4 flex-1 divide-y divide-neutral-100 px-5 dark:divide-neutral-800">
                      {summary.items.length === 0 ? (
                        <p className="py-6 text-center text-xs text-neutral-400">
                          Nenhuma peça vinculada a esta revisão.
                        </p>
                      ) : (
                        summary.items.map(({ revisionPart, part, lineTotal }) => (
                          <div
                            key={`${revisionPart.id}-${part.code}`}
                            className="flex items-start justify-between gap-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium leading-snug text-neutral-800 dark:text-neutral-200">
                                {part.description}
                                {part.is_optional && !part.description.includes('[Opcional]') ? (
                                  <span className="ml-1 text-neutral-500">[Opcional]</span>
                                ) : null}
                              </p>
                              <p className="mt-0.5 font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
                                CÓD. {part.code}
                                {(part.unit === 'ML' || revisionPart.quantity > 1) &&
                                  ` · ${formatPartQuantity(part, revisionPart.quantity)}`}
                              </p>
                            </div>
                            <span className="shrink-0 text-[13px] font-bold text-neutral-900 tabular-nums dark:text-white">
                              {formatBRL(lineTotal)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Rodapé vermelho de destaque */}
                    <div className="mt-4 bg-[#E4002B] px-5 py-3.5 text-white">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-white/95">
                            {revTitleUpper}
                          </p>
                          <p className="text-[11px] text-white/85 tabular-nums">
                            sem opcionais {formatBRL(summary.totalWithoutOptionals)}
                          </p>
                        </div>
                        <p className="font-display text-xl font-extrabold tracking-tight tabular-nums">
                          {formatBRL(summary.totalWithOptionals)}
                        </p>
                      </div>
                    </div>

                    {/* Link inferior */}
                    <a
                      href={buildWhatsAppUrl(model.name, revisionLabel)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 bg-neutral-50 px-5 py-3 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-[#E4002B] dark:bg-neutral-950/60 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      <Calendar className="h-3.5 w-3.5 text-[#E4002B]" />
                      {scheduleText}
                    </a>
                  </article>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="mt-7 space-y-4">
              {computedModels.map(({ model, summary }) => {
                const categoryLabel = segmentNameMap[model.segment_slug] || 'Street';
                return (
                  <article
                    key={model.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 md:flex-row"
                  >
                    <div className="flex w-full shrink-0 items-center justify-center bg-white p-5 md:w-60 md:border-r md:border-neutral-100 dark:md:border-neutral-800">
                      <img
                        src={model.image_url}
                        alt={`Honda ${model.name}`}
                        referrerPolicy="no-referrer"
                        className="h-40 w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-3">
                            <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
                              {model.name}
                            </h2>
                            <span className="text-xs font-medium text-neutral-500">{categoryLabel}</span>
                          </div>
                          <span className="text-xs font-semibold text-neutral-500 tabular-nums">
                            {summary.items.length} {summary.items.length === 1 ? 'item' : 'itens'}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
                          {summary.items.map(({ revisionPart, part, lineTotal }) => (
                            <div
                              key={`${revisionPart.id}-${part.code}`}
                              className="flex items-center justify-between border-b border-neutral-100 py-1.5 text-xs dark:border-neutral-800"
                            >
                              <span className="truncate pr-2 text-neutral-700 dark:text-neutral-300">
                                {part.description}
                                {part.is_optional && !part.description.includes('[Opcional]') ? ' [Opcional]' : ''}
                                <span className="ml-1.5 font-mono text-[10px] text-neutral-400">
                                  ({part.code})
                                </span>
                              </span>
                              <span className="shrink-0 font-semibold text-neutral-900 tabular-nums dark:text-white">
                                {formatBRL(lineTotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#E4002B] px-4 py-3 text-white">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider">
                            TOTAL DA {revisionLabel.toUpperCase()}
                          </span>
                          <span className="ml-3 text-xs text-white/85 tabular-nums">
                            sem opcionais {formatBRL(summary.totalWithoutOptionals)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-display text-lg font-extrabold tabular-nums">
                            {formatBRL(summary.totalWithOptionals)}
                          </span>
                          <a
                            href={buildWhatsAppUrl(model.name, revisionLabel)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#E4002B] hover:bg-neutral-100"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            Agendar
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      ) : (
        /* Perguntas Frequentes View */
        <main className="mx-auto max-w-[920px] px-4 py-10 sm:px-6 sm:py-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-neutral-900 dark:text-white">
                Dúvidas Frequentes sobre Revisões Honda
              </h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Tudo o que você precisa saber sobre prazos, garantia e agendamento na Rodaleve.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {data.faqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-bold text-neutral-900 dark:text-white sm:text-base">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform ${
                        isOpen ? 'rotate-180 text-[#E4002B]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* 7. Seção "Onde estamos" / "Unidades e Como Chegar" */}
      <UnitsMapSection
        units={data.seo.units}
        mapsActive={data.maps_config.active}
        mapsApiKey={data.maps_config.api_key}
      />

      {/* 8. Rodapé */}
      <footer className="border-t border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Coluna 1: Logo + Redes + Tema escuro */}
            <div>
              <span className="font-display text-2xl font-extrabold tracking-tight text-[#E4002B]">
                RODALEVE
              </span>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                Siga nossas redes sociais
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                <a
                  href={data.seo.instagram_url || 'https://instagram.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram Rodaleve"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-[#E4002B] hover:text-[#E4002B] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href={data.seo.youtube_url || 'https://youtube.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube Rodaleve"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-[#E4002B] hover:text-[#E4002B] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  <Youtube className="h-4 w-4" />
                </a>
              </div>
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white"
              >
                {darkMode ? (
                  <>
                    <Sun className="h-3.5 w-3.5" />
                    Tema claro
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5" />
                    Tema escuro
                  </>
                )}
              </button>
            </div>

            {/* Coluna 2: Horários de Funcionamento */}
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Horários de Funcionamento
              </h3>
              <ul className="mt-3 space-y-1.5 text-sm text-neutral-600 dark:text-neutral-400">
                <li>Segunda a sexta: 07h30 às 18h</li>
                <li>Sábado: 07h30 às 12h</li>
                <li className="pt-1 font-semibold text-neutral-800 dark:text-neutral-200">
                  WhatsApp:{' '}
                  <a
                    href={buildWhatsAppUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tabular-nums text-[#E4002B] hover:underline"
                  >
                    (77) 2888-0003
                  </a>
                </li>
              </ul>
            </div>

            {/* Coluna 3: Políticas e Termos */}
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Políticas e Termos
              </h3>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => setLegalModal('privacy')}
                  className="text-neutral-700 underline-offset-4 hover:text-[#E4002B] hover:underline dark:text-neutral-300"
                >
                  Política de Privacidade
                </button>
                <button
                  type="button"
                  onClick={() => setLegalModal('terms')}
                  className="text-neutral-700 underline-offset-4 hover:text-[#E4002B] hover:underline dark:text-neutral-300"
                >
                  Termos de Uso
                </button>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                Os valores exibidos nesta tabela são estimados para peças genuínas e insumos básicos de cada revisão e podem variar conforme inspeção técnica ou necessidade adicional da motocicleta.
              </p>
            </div>
          </div>

          {/* Faixa inferior */}
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-neutral-200 pt-6 text-xs text-neutral-500 dark:border-neutral-800 sm:flex-row">
            <p className="font-bold tracking-wide text-neutral-800 dark:text-neutral-200">
              DESBRAVE SEU BEM MAIOR É A VIDA
            </p>
            <p>
              Site criado por Zarvic Marketing –{' '}
              <a
                href="/gestor"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/gestor');
                }}
                className="font-semibold text-neutral-700 underline-offset-4 hover:text-[#E4002B] hover:underline dark:text-neutral-300"
              >
                Gestor
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Botão flutuante verde do WhatsApp no canto inferior esquerdo */}
      <a
        href={buildWhatsAppUrl()}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp Rodaleve"
        className="fixed bottom-5 left-5 z-40 inline-flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#1FB857]"
      >
        <MessageCircle className="h-6 w-6 fill-white" />
      </a>

      {/* Modal Políticas e Termos */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <h4 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
                {legalModal === 'privacy' ? 'Política de Privacidade' : 'Termos de Uso'}
              </h4>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              {legalModal === 'privacy' ? (
                <>
                  <p>
                    A Rodaleve Honda respeita a sua privacidade. Este portal de consulta de revisões não armazena dados pessoais sensíveis no navegador. Caso você utilize o recurso de geolocalização para traçar rotas até nossas unidades, sua localização é processada apenas em tempo real para o cálculo do trajeto.
                  </p>
                  <p>
                    Ao clicar em "Agendar revisão", você será direcionado ao atendimento oficial da Rodaleve via WhatsApp (77) 2888-0003, em conformidade com a Lei Geral de Proteção de Dados (LGPD).
                  </p>
                </>
              ) : (
                <>
                  <p>
                    As informações e preços exibidos nesta Tabela de Manutenção e Revisões têm caráter informativo e estimativo para peças genuínas Honda e insumos recomendados.
                  </p>
                  <p>
                    Eventuais serviços adicionais identificados na inspeção técnica ou variações de estoque serão previamente informados e aprovados junto ao cliente na recepção da oficina Rodaleve.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
