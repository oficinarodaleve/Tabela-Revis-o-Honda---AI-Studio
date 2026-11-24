import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Eye,
  EyeOff,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  LayoutGrid,
  List,
  MapPin,
  Moon,
  Paintbrush,
  Search,
  Sun,
  Wrench,
  X,
} from 'lucide-react';
import {
  CalculatorContextForWhatsApp,
  CustomBlockVariant,
  EditableTextEntry,
  MotoModel,
  PageSectionBlock,
  PublicBootstrapData,
  VisualBuilderConfig,
} from '../types';
import { adminFetch } from '../utils/adminAuth';
import { getAutoSavePreference } from '../utils/gestorBackup';
import {
  buildHtmlEditableTargets,
  buildModelDefaultHtml,
  buildNoticeBoxDefaultHtml,
  buildSectionDefaultHtml,
} from '../utils/htmlTargets';
import {
  ComputedRevisionSummary,
  LABOR_POLICY_TEXTS,
  computeModelRevision,
  formatBRL,
  formatExactOilQuantity,
  formatLitersPT,
  formatPartQuantity,
  getLaborBadgeText,
  isFreeLaborRevision,
} from '../utils/pricing';
import {
  formatKmPT,
  getTargetKmForRevision,
  getTargetMonthsForRevision,
  normalizeCalculatorSettings,
} from '../utils/revisionCalculator';
import {
  CURRENT_SECTIONS_VERSION,
  DEFAULT_SITE_CONTENT,
  clearLocalVisualConfig,
  createCustomBlock,
  createDefaultVisualConfig,
  loadLocalVisualConfig,
  mergeWithDefaultVisualConfig,
  restoreDefaultSectionOrder,
  saveLocalVisualConfig,
} from '../utils/visualBuilder';
import {
  initAllTrackingPixels,
  trackAllPixelsLeadContact,
  trackAllPixelsViewContent,
} from '../utils/metaPixel';
import { ErrorBoundary } from './ErrorBoundary';
import { FloatingWhatsApp } from './FloatingWhatsApp';
import { LanguageSelector } from './LanguageSelector';
import { RevisionCalculatorSection } from './RevisionCalculatorSection';
import { SafeHtml } from './SafeHtml';
import {
  WhatsAppIcon,
  buildWhatsAppHref,
  getUnitWhatsAppNumber,
} from './WhatsAppIcon';
import { EditableText, HtmlEditorProvider } from './editor/EditableText';
import type { HtmlModalTarget } from './editor/HtmlEditorModal';
import { DropPosition, SectionEditorWrapper } from './editor/SectionEditorWrapper';

const UnitsMapSection = lazy(() =>
  import('./UnitsMapSection').then((m) => ({ default: m.UnitsMapSection }))
);
const WhatsAppScheduleModal = lazy(() =>
  import('./WhatsAppScheduleModal').then((m) => ({ default: m.WhatsAppScheduleModal }))
);
const AddBlockModal = lazy(() =>
  import('./editor/AddBlockModal').then((m) => ({ default: m.AddBlockModal }))
);
const ImageSwapModal = lazy(() =>
  import('./editor/ImageSwapModal').then((m) => ({ default: m.ImageSwapModal }))
);
const VisualEditorToolbar = lazy(() =>
  import('./editor/VisualEditorToolbar').then((m) => ({ default: m.VisualEditorToolbar }))
);
const HtmlEditorModal = lazy(() =>
  import('./editor/HtmlEditorModal').then((m) => ({ default: m.HtmlEditorModal }))
);
import {
  SITE_CONTENT_TRANSLATIONS,
  SiteLanguage,
  UI_TRANSLATIONS,
  translateFaqItem,
  translatePartDescription,
  translateRevisionLabel,
  translateRevisionSubtitle,
} from '../utils/i18n';

interface PublicPageProps {
  data: PublicBootstrapData;
  language: SiteLanguage;
  onChangeLanguage: (lang: SiteLanguage) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onNavigate: (path: string) => void;
  isAdminLoggedIn: boolean;
  isEditMode: boolean;
  isHtmlEditMode?: boolean;
  onEnterEditMode: () => void;
  onEnterHtmlEditMode?: () => void;
  onExitHtmlEditMode?: () => void;
  onExitHtmlEditModeToGestor?: () => void;
  onExitEditModeToGestor: () => void;
  onPublicDataChanged: () => Promise<void>;
}

function buildWhatsAppUrl(
  rawPhone: string | undefined,
  modelName?: string,
  revisionLabel?: string
): string {
  const text =
    modelName && revisionLabel
      ? `Olá, Rodaleve! Gostaria de agendar a ${revisionLabel} da minha Honda ${modelName}.`
      : `Olá, Rodaleve! Gostaria de agendar uma revisão da minha moto Honda.`;
  return buildWhatsAppHref(rawPhone, text);
}

function formatFooterDateTimeBR(date: Date): string {
  const datePart = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `${datePart} • ${timePart}`;
}

function FooterClock() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time
      dateTime={now.toISOString()}
      className="block text-center text-xs font-normal text-ink-muted tabular-nums"
    >
      {formatFooterDateTimeBR(now)}
    </time>
  );
}

const FALLBACK_EDITORIAL_FAQS = [
  {
    id: 1,
    sort_order: 1,
    question: 'Quando devo fazer a primeira revisão?',
    answer:
      'A 1ª revisão programada deve ser realizada ao atingir 1.000 km rodados ou 6 meses após a data da compra da motocicleta (o que ocorrer primeiro), garantindo a preservação da garantia Honda.',
  },
  {
    id: 2,
    sort_order: 2,
    question: 'Existe tolerância de quilometragem ou de data?',
    answer:
      'Sim. Conforme o manual do proprietário da rede autorizada Honda, há uma tolerância padrão de quilometragem e prazo prevista para cada modelo. Recomendamos agendar com antecedência na Rodaleve para não comprometer a cobertura da garantia.',
  },
  {
    id: 3,
    sort_order: 3,
    question: 'Posso fazer a revisão em outra oficina?',
    answer:
      'Para manter a garantia de fábrica Honda e o histórico oficial de revisões válido no sistema da montadora, todas as revisões periódicas devem ser realizadas exclusivamente em uma concessionária autorizada Honda, como a Rodaleve.',
  },
  {
    id: 4,
    sort_order: 4,
    question: 'Perco a garantia se atrasar uma revisão?',
    answer:
      'Realizar a revisão fora dos prazos ou limites de quilometragem previstos no manual pode impactar a garantia do conjunto afetado. Caso tenha ocorrido algum atraso, consulte a equipe técnica da Rodaleve para avaliação individual do seu caso.',
  },
  {
    id: 5,
    sort_order: 5,
    question: 'Qual o prazo da garantia da minha moto?',
    answer:
      'A garantia padrão Honda é de 3 anos sem limite de quilometragem para a maioria dos modelos urbanos e de alta cilindrada, variando conforme a linha da motocicleta. Consulte sempre o manual do proprietário e o termo de garantia do seu modelo.',
  },
  {
    id: 6,
    sort_order: 6,
    question: 'A revisão é gratuita?',
    answer:
      'Na 1ª e na 2ª revisão programada, a mão de obra é gratuita (custeada pela Honda), havendo cobrança apenas das peças, lubrificantes e itens de desgaste natural substituídos. A partir da 3ª revisão aplicam-se peças e mão de obra conforme tabela vigente.',
  },
];

type ActiveImageModalTarget =
  | { kind: 'logo'; title: string; currentUrl: string }
  | { kind: 'favicon'; title: string; currentUrl: string }
  | { kind: 'model'; modelId: number; title: string; currentUrl: string }
  | { kind: 'custom_block'; blockId: string; title: string; currentUrl: string };

function getFallbackMotoImage(segmentSlug: string): string {
  switch (segmentSlug) {
    case 'street_trail':
      return '/src/assets/images/moto_trail_adventure_1795147025806.jpg';
    case 'off_road':
      return '/src/assets/images/moto_offroad_crf_1795147026744.jpg';
    default:
      return '/src/assets/images/moto_street_cg_1795147025649.jpg';
  }
}

function getOptimizedMotoImageSources(
  rawUrl: string,
  forceFallbackSegment?: string
): { webpSrc?: string; fallbackSrc: string } {
  const clean = forceFallbackSegment
    ? getFallbackMotoImage(forceFallbackSegment)
    : (rawUrl || '').trim();
  if (!clean) return { fallbackSrc: '' };
  if (/^\/src\/assets\/images\/moto_[^/?#]+\.jpe?g$/i.test(clean)) {
    return {
      webpSrc: clean.replace(/\.jpe?g$/i, '.webp'),
      fallbackSrc: clean,
    };
  }
  return { fallbackSrc: clean };
}

export function PublicPage({
  data,
  language,
  onChangeLanguage,
  darkMode,
  onToggleDarkMode,
  onNavigate,
  isAdminLoggedIn,
  isEditMode,
  isHtmlEditMode = false,
  onEnterEditMode,
  onEnterHtmlEditMode,
  onExitHtmlEditMode,
  onExitHtmlEditModeToGestor,
  onExitEditModeToGestor,
  onPublicDataChanged,
}: PublicPageProps) {
  const activeHtmlEditMode = Boolean(isHtmlEditMode && isAdminLoggedIn && !isEditMode);
  const dict = UI_TRANSLATIONS[language];
  const [activeNav, setActiveNav] = useState<'revisoes' | 'calculadora' | 'faq' | 'unidades'>(
    'revisoes'
  );
  const [heroTab, setHeroTab] = useState<'tabela' | 'calculadora' | 'faq'>('tabela');
  const [selectedRevision, setSelectedRevision] = useState<number>(
    data.revision_tabs?.[0]?.revision_number ?? 1
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [highlightedModelId, setHighlightedModelId] = useState<number | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<{
    model: MotoModel;
    summary: ComputedRevisionSummary;
    includeOptionals: boolean;
    revisionNumber?: number;
    revisionLabel?: string;
    revisionSubtitle?: string;
    calculatorContext?: CalculatorContextForWhatsApp;
  } | null>(null);
  const [openFaqId, setOpenFaqId] = useState<number | null>(
    data.faqs?.[0]?.id ?? FALLBACK_EDITORIAL_FAQS[0].id
  );
  const faqButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const railRef = useRef<HTMLDivElement | null>(null);
  const railDragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startScrollLeft: number;
  }>({ active: false, moved: false, startX: 0, startScrollLeft: 0 });
  const suppressRailClickRef = useRef(false);
  const railDragCleanupRef = useRef<(() => void) | null>(null);
  const [isDraggingRail, setIsDraggingRail] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [shouldMountUnits, setShouldMountUnits] = useState(isEditMode);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);
  const [failedModelImageIds, setFailedModelImageIds] = useState<Record<number, string>>({});

  useEffect(() => {
    if (isEditMode) {
      setShouldMountUnits(true);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (shouldMountUnits) return;
    const el = document.getElementById('unidades');
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShouldMountUnits(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldMountUnits(true);
          observer.disconnect();
        }
      },
      { rootMargin: '550px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldMountUnits]);

  // Pixels, Tags (GTM, GA4, Google Ads, Meta Pixel, TikTok Pixel): adiado até 1ª interação ou pós-carga para priorizar LCP mobile
  useEffect(() => {
    if (isEditMode) return;
    let triggered = false;
    let timerId: number | null = null;
    const cleanupListeners = () => {
      window.removeEventListener('pointerdown', trigger);
      window.removeEventListener('keydown', trigger);
      window.removeEventListener('touchstart', trigger);
      window.removeEventListener('scroll', trigger);
    };
    const trigger = () => {
      if (triggered) return;
      triggered = true;
      cleanupListeners();
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      try {
        initAllTrackingPixels(data.seo, data.tracking_config);
      } catch {
        // Ignore tracking script errors so the public page never fails to render
      }
    };

    window.addEventListener('pointerdown', trigger, { passive: true, once: true });
    window.addEventListener('keydown', trigger, { passive: true, once: true });
    window.addEventListener('touchstart', trigger, { passive: true, once: true });
    window.addEventListener('scroll', trigger, { passive: true, once: true });
    timerId = window.setTimeout(trigger, 2600);

    return () => {
      cleanupListeners();
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [data.seo, data.tracking_config, isEditMode]);

  // Glassmorphism scroll shadow + scroll-spy batido via requestAnimationFrame (evita forced reflow)
  useEffect(() => {
    if (isEditMode) return;
    let rafId: number | null = null;

    const measureScroll = () => {
      rafId = null;
      const y = window.scrollY;
      setIsScrolled(y > 10);

      const unitsEl = document.getElementById('unidades');
      const faqEl = document.getElementById('perguntas-frequentes');
      const calcEl = document.getElementById('calculadora-revisoes');
      const unitsTop = unitsEl ? unitsEl.getBoundingClientRect().top : Infinity;
      const faqTop = faqEl ? faqEl.getBoundingClientRect().top : Infinity;
      const calcTop = calcEl ? calcEl.getBoundingClientRect().top : Infinity;

      if (unitsTop <= 190) {
        setActiveNav('unidades');
      } else if (faqTop <= 190 || heroTab === 'faq') {
        setActiveNav('faq');
      } else if (calcTop <= 190 || heroTab === 'calculadora') {
        setActiveNav('calculadora');
      } else {
        setActiveNav('revisoes');
      }
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(measureScroll);
    };

    measureScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isEditMode, heroTab]);

  // Visual Builder state + Undo/Redo stacks
  const allModelIds = useMemo(() => (data.models || []).map((m) => m.id), [data.models]);
  const buildInitialConfig = useCallback(() => {
    const localSaved = loadLocalVisualConfig();
    const serverSaved = data.visual_builder;
    return mergeWithDefaultVisualConfig(localSaved || serverSaved, allModelIds);
  }, [data.visual_builder, allModelIds]);

  const [vbConfig, setVbConfig] = useState<VisualBuilderConfig>(() => buildInitialConfig());
  const [undoStack, setUndoStack] = useState<VisualBuilderConfig[]>([]);
  const [redoStack, setRedoStack] = useState<VisualBuilderConfig[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [savingVisual, setSavingVisual] = useState(false);
  const [visualToast, setVisualToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(
    null
  );

  // Visual Builder auto-save state (synced with Gestor preference)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => getAutoSavePreference());
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const autoSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isEditMode) {
      setAutoSaveEnabled(getAutoSavePreference());
    }
  }, [isEditMode]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Drag & Drop state for sections and model cards
  const [dragSectionIdx, setDragSectionIdx] = useState<number | null>(null);
  const [dragOverSectionTarget, setDragOverSectionTarget] = useState<{
    index: number;
    position: DropPosition;
  } | null>(null);
  const [dragModelId, setDragModelId] = useState<number | null>(null);
  const [dragOverModelId, setDragOverModelId] = useState<number | null>(null);

  // Modals for visual & HTML editor
  const [addBlockAfterIndex, setAddBlockAfterIndex] = useState<number | null>(null);
  const [isAddBlockOpen, setIsAddBlockOpen] = useState(false);
  const [imageModal, setImageModal] = useState<ActiveImageModalTarget | null>(null);
  const [htmlModalTarget, setHtmlModalTarget] = useState<HtmlModalTarget | null>(null);
  const [savingHtmlModal, setSavingHtmlModal] = useState(false);

  // Pending image syncs (applied cleanly on Save & Publish to SEO & Model tables)
  const [pendingLogoUrl, setPendingLogoUrl] = useState<string | undefined>(undefined);
  const [pendingFaviconUrl, setPendingFaviconUrl] = useState<string | undefined>(undefined);
  const [pendingModelImageById, setPendingModelImageById] = useState<Record<number, string>>({});

  // Re-sync default config when underlying data changes and there are no unsaved edits
  useEffect(() => {
    if (!hasUnsavedChanges) {
      setVbConfig(buildInitialConfig());
    }
  }, [buildInitialConfig, hasUnsavedChanges]);

  const showVisualToast = useCallback((type: 'success' | 'error', msg: string) => {
    setVisualToast({ type, msg });
    setTimeout(() => {
      setVisualToast((curr) => (curr?.msg === msg ? null : curr));
    }, 4000);
  }, []);

  const scheduleVisualAutoSave = useCallback(
    (nextConfig: VisualBuilderConfig) => {
      saveLocalVisualConfig(nextConfig);
      const shouldAutoSave = getAutoSavePreference();
      setAutoSaveEnabled(shouldAutoSave);
      if (!shouldAutoSave || !isAdminLoggedIn) return;

      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      setAutoSaveStatus('saving');
      autoSaveTimerRef.current = window.setTimeout(async () => {
        try {
          const vbRes = await adminFetch('/api/admin/visual-builder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextConfig),
          });
          if (!vbRes.ok) throw new Error('Falha no auto-save do layout');
          setAutoSaveStatus('saved');
          setHasUnsavedChanges(false);
          await onPublicDataChanged();
        } catch {
          setAutoSaveStatus('error');
        }
      }, 450);
    },
    [isAdminLoggedIn, onPublicDataChanged]
  );

  const commitVisualChange = useCallback(
    (updater: (prev: VisualBuilderConfig) => VisualBuilderConfig) => {
      setVbConfig((curr) => {
        const next = {
          ...updater(curr),
          sectionsVersion: CURRENT_SECTIONS_VERSION,
        };
        setUndoStack((u) => [...u.slice(-39), curr]);
        setRedoStack([]);
        setHasUnsavedChanges(true);
        scheduleVisualAutoSave(next);
        return next;
      });
    },
    [scheduleVisualAutoSave]
  );

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setVbConfig((curr) => {
        setRedoStack((r) => [...r, curr]);
        return previous;
      });
      setHasUnsavedChanges(true);
      scheduleVisualAutoSave(previous);
      return prev.slice(0, -1);
    });
  }, [scheduleVisualAutoSave]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setVbConfig((curr) => {
        setUndoStack((u) => [...u, curr]);
        return next;
      });
      setHasUnsavedChanges(true);
      scheduleVisualAutoSave(next);
      return prev.slice(0, -1);
    });
  }, [scheduleVisualAutoSave]);

  // Keyboard shortcuts Ctrl+Z / Ctrl+Y in Visual Edit Mode
  useEffect(() => {
    if (!isEditMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        e.key.toLowerCase() === 'y' ||
        (e.key.toLowerCase() === 'z' && e.shiftKey)
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditMode, handleUndo, handleRedo]);

  const handleCommitText = useCallback(
    (key: string, entry: EditableTextEntry) => {
      commitVisualChange((prev) => ({
        ...prev,
        siteContent: {
          ...prev.siteContent,
          [key]: entry,
        },
      }));
    },
    [commitVisualChange]
  );

  const htmlTargetsMap = useMemo(() => {
    const list = buildHtmlEditableTargets({
      sections: vbConfig.sections,
      models: data.models || [],
      faqs: data.faqs || [],
      vbConfig,
    });
    return new Map(list.map((t) => [t.key, t]));
  }, [vbConfig, data.models, data.faqs]);

  const openHtmlModalForKey = useCallback(
    (key: string, fallbackInitial?: string) => {
      if (!isAdminLoggedIn) return;
      const meta = htmlTargetsMap.get(key);
      const currentOverride = vbConfig.htmlOverrides?.[key];
      const hasOverride = typeof currentOverride === 'string' && currentOverride.trim().length > 0;
      setHtmlModalTarget({
        key,
        label: meta?.label || key,
        categoryLabel: meta?.categoryLabel,
        description: meta?.description,
        initialHtml: hasOverride ? currentOverride! : fallbackInitial ?? meta?.defaultHtml ?? '',
        hasOverride,
      });
    },
    [isAdminLoggedIn, htmlTargetsMap, vbConfig.htmlOverrides]
  );

  const handleSaveHtmlOverride = useCallback(
    async (key: string, nextHtml: string) => {
      if (!isAdminLoggedIn) return;
      setSavingHtmlModal(true);
      try {
        const nextOverrides = { ...(vbConfig.htmlOverrides || {}) };
        if (nextHtml.trim()) {
          nextOverrides[key] = nextHtml;
        } else {
          delete nextOverrides[key];
        }
        const nextConfig: VisualBuilderConfig = {
          ...vbConfig,
          sectionsVersion: CURRENT_SECTIONS_VERSION,
          htmlOverrides: nextOverrides,
        };
        setVbConfig(nextConfig);
        saveLocalVisualConfig(nextConfig);
        const res = await adminFetch('/api/admin/visual-builder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextConfig),
        });
        if (!res.ok) {
          throw new Error(`Erro HTTP ${res.status} ao salvar HTML.`);
        }
        await onPublicDataChanged();
        setHtmlModalTarget(null);
        showVisualToast('success', 'Código HTML salvo e aplicado na página!');
      } catch (e) {
        showVisualToast(
          'error',
          e instanceof Error
            ? `${e.message} (Salvo localmente no navegador.)`
            : 'Erro ao salvar HTML no servidor.'
        );
      } finally {
        setSavingHtmlModal(false);
      }
    },
    [isAdminLoggedIn, vbConfig, onPublicDataChanged, showVisualToast]
  );

  const handleResetHtmlOverride = useCallback(
    async (key: string) => {
      if (!isAdminLoggedIn) return;
      setSavingHtmlModal(true);
      try {
        const nextOverrides = { ...(vbConfig.htmlOverrides || {}) };
        delete nextOverrides[key];
        const nextConfig: VisualBuilderConfig = {
          ...vbConfig,
          sectionsVersion: CURRENT_SECTIONS_VERSION,
          htmlOverrides: nextOverrides,
        };
        setVbConfig(nextConfig);
        saveLocalVisualConfig(nextConfig);
        const res = await adminFetch('/api/admin/visual-builder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextConfig),
        });
        if (!res.ok) {
          throw new Error(`Erro HTTP ${res.status} ao restaurar HTML padrão.`);
        }
        await onPublicDataChanged();
        setHtmlModalTarget(null);
        showVisualToast('success', 'Bloco restaurado para o conteúdo padrão original.');
      } catch (e) {
        showVisualToast(
          'error',
          e instanceof Error ? e.message : 'Erro ao restaurar bloco.'
        );
      } finally {
        setSavingHtmlModal(false);
      }
    },
    [isAdminLoggedIn, vbConfig, onPublicDataChanged, showVisualToast]
  );

  const handleRestoreDefault = async () => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const resetCfg = createDefaultVisualConfig(allModelIds);
    setUndoStack((u) => [...u.slice(-39), vbConfig]);
    setRedoStack([]);
    setVbConfig(resetCfg);
    setPendingLogoUrl(undefined);
    setPendingFaviconUrl(undefined);
    setPendingModelImageById({});
    clearLocalVisualConfig();
    if (isAdminLoggedIn) {
      try {
        await adminFetch('/api/admin/visual-builder', { method: 'DELETE' });
        await onPublicDataChanged();
      } catch {
        // Ignore network error during reset
      }
    }
    setAutoSaveStatus('idle');
    setHasUnsavedChanges(false);
    showVisualToast('success', 'Layout e textos restaurados para o padrão original.');
  };

  const handleSaveAndPublish = async () => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setSavingVisual(true);
    try {
      // 1. Always save locally in localStorage (+ memory fallback)
      saveLocalVisualConfig(vbConfig);

      // 2. Persist Visual Builder config on server if authenticated
      if (isAdminLoggedIn) {
        const vbRes = await adminFetch('/api/admin/visual-builder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vbConfig),
        });
        if (!vbRes.ok) throw new Error('Erro ao salvar layout visual.');

        // 3. Sync Logo & Favicon with SEO & Identidade tab
        if (pendingLogoUrl !== undefined || pendingFaviconUrl !== undefined) {
          const nextSeo = {
            ...data.seo,
            logo_url: pendingLogoUrl !== undefined ? pendingLogoUrl : data.seo.logo_url,
            favicon_url:
              pendingFaviconUrl !== undefined ? pendingFaviconUrl : data.seo.favicon_url,
          };
          const seoRes = await adminFetch('/api/admin/seo', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextSeo),
          });
          if (!seoRes.ok) throw new Error('Erro ao sincronizar logo/favicon com SEO.');
        }

        // 4. Sync Model photos with Modelos e fotos tab
        const modelIdsToSync = Object.keys(pendingModelImageById).map(Number);
        for (const modelId of modelIdsToSync) {
          const modelObj = data.models.find((m) => m.id === modelId);
          if (!modelObj) continue;
          await adminFetch(`/api/admin/models/${modelId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...modelObj,
              image_url: pendingModelImageById[modelId],
            }),
          });
        }
      }

      setPendingLogoUrl(undefined);
      setPendingFaviconUrl(undefined);
      setPendingModelImageById({});
      setHasUnsavedChanges(false);
      await onPublicDataChanged();
      showVisualToast('success', 'Alterações salvas e publicadas no site com sucesso!');
    } catch (e) {
      showVisualToast(
        'error',
        e instanceof Error ? e.message : 'Erro ao salvar e publicar.'
      );
    } finally {
      setSavingVisual(false);
    }
  };

  const handleRestoreDefaultOrder = () => {
    commitVisualChange((prev) => restoreDefaultSectionOrder(prev));
    showVisualToast('success', 'Ordem padrão dos blocos restaurada!');
  };

  // Section manipulation handlers
  const moveSection = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= vbConfig.sections.length || fromIndex === toIndex) return;
    commitVisualChange((prev) => {
      const copy = [...prev.sections];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return { ...prev, sections: copy };
    });
  };

  const moveSectionByDrop = (
    fromIndex: number,
    targetIndex: number,
    position: DropPosition
  ) => {
    let insertAt = position === 'after' ? targetIndex + 1 : targetIndex;
    if (fromIndex < insertAt) {
      insertAt -= 1;
    }
    if (insertAt < 0 || insertAt >= vbConfig.sections.length || insertAt === fromIndex) return;
    moveSection(fromIndex, insertAt);
  };

  const toggleSectionVisibility = (blockId: string) => {
    commitVisualChange((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === blockId ? { ...s, visible: !s.visible } : s
      ),
    }));
  };

  const duplicateSection = (index: number) => {
    const source = vbConfig.sections[index];
    if (!source) return;
    const newId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    let duplicated: PageSectionBlock;
    if (source.type === 'custom' && source.customData) {
      duplicated = {
        ...source,
        id: newId,
        label: `${source.label} (cópia)`,
        customData: { ...source.customData },
      };
    } else {
      // Create an independently editable custom copy representing the duplicated section
      const titleFallback =
        source.type === 'hero'
          ? vbConfig.siteContent.hero_title?.text || DEFAULT_SITE_CONTENT.hero_title
          : source.type === 'notice_box'
            ? 'Aviso Informativo (Cópia)'
            : source.type === 'faq_section'
              ? vbConfig.siteContent.faq_title?.text || DEFAULT_SITE_CONTENT.faq_title
              : source.label;
      const bodyFallback =
        source.type === 'hero'
          ? vbConfig.siteContent.hero_subtitle?.text || DEFAULT_SITE_CONTENT.hero_subtitle
          : source.type === 'notice_box'
            ? vbConfig.siteContent.notice_line_1?.text || DEFAULT_SITE_CONTENT.notice_line_1
            : 'Bloco duplicado. Clique em qualquer texto para personalizar livremente.';

      duplicated = {
        id: newId,
        type: 'custom',
        label: `${source.label} (cópia)`,
        visible: true,
        customData: {
          variant: source.type === 'notice_box' ? 'notice' : 'banner',
          badge: 'DESTAQUE RODALEVE',
          title: titleFallback,
          body: bodyFallback,
          theme: source.type === 'notice_box' ? 'gray' : 'light',
        },
      };
    }

    commitVisualChange((prev) => {
      const next = [...prev.sections];
      next.splice(index + 1, 0, duplicated);
      return { ...prev, sections: next };
    });
  };

  const deleteSection = (blockId: string) => {
    commitVisualChange((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== blockId),
    }));
  };

  const handleInsertCustomBlock = (variant: CustomBlockVariant) => {
    const block = createCustomBlock(variant);
    commitVisualChange((prev) => {
      const next = [...prev.sections];
      if (addBlockAfterIndex !== null && addBlockAfterIndex >= 0) {
        next.splice(addBlockAfterIndex + 1, 0, block);
      } else {
        // Insert before footer by default
        const footerIdx = next.findIndex((s) => s.type === 'footer');
        if (footerIdx >= 0) next.splice(footerIdx, 0, block);
        else next.push(block);
      }
      return { ...prev, sections: next };
    });
    setAddBlockAfterIndex(null);
  };

  const updateCustomBlockData = (
    blockId: string,
    patch: Partial<NonNullable<PageSectionBlock['customData']>>
  ) => {
    commitVisualChange((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === blockId && s.customData
          ? { ...s, customData: { ...s.customData, ...patch } }
          : s
      ),
    }));
  };

  // Model card reordering & visibility in visual mode
  const moveModelCard = (modelId: number, delta: number) => {
    commitVisualChange((prev) => {
      const order = [...prev.modelOrder];
      const idx = order.indexOf(modelId);
      if (idx === -1) return prev;
      const target = idx + delta;
      if (target < 0 || target >= order.length) return prev;
      const [moved] = order.splice(idx, 1);
      order.splice(target, 0, moved);
      return { ...prev, modelOrder: order };
    });
  };

  const reorderModelCards = (sourceId: number, targetId: number) => {
    if (sourceId === targetId) return;
    commitVisualChange((prev) => {
      const order = [...prev.modelOrder];
      const from = order.indexOf(sourceId);
      const to = order.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      return { ...prev, modelOrder: order };
    });
  };

  const toggleModelCardHidden = (modelId: number) => {
    commitVisualChange((prev) => {
      const hiddenSet = new Set(prev.hiddenModelIds);
      if (hiddenSet.has(modelId)) hiddenSet.delete(modelId);
      else hiddenSet.add(modelId);
      return { ...prev, hiddenModelIds: Array.from(hiddenSet) };
    });
  };

  const effectiveLogoUrl =
    pendingLogoUrl !== undefined
      ? pendingLogoUrl
      : vbConfig.imageOverrides?.['site_logo'] !== undefined
        ? vbConfig.imageOverrides['site_logo']
        : data.seo?.logo_url || '';

  useEffect(() => {
    setLogoLoadFailed(false);
  }, [effectiveLogoUrl]);

  const effectiveFaviconUrl =
    pendingFaviconUrl !== undefined
      ? pendingFaviconUrl
      : vbConfig.imageOverrides?.['site_favicon'] !== undefined
        ? vbConfig.imageOverrides['site_favicon']
        : data.seo?.favicon_url || '';

  const segmentNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const seg of data.segments || []) {
      map[seg.slug] = seg.name;
    }
    return map;
  }, [data.segments]);

  const partsMap = useMemo(() => {
    const map: Record<string, (typeof data.parts)[number]> = {};
    for (const part of data.parts || []) {
      map[part.code] = part;
    }
    return map;
  }, [data.parts]);

  const activeRevisionObj = useMemo(
    () =>
      (data.revision_tabs || []).find((t) => t.revision_number === selectedRevision) ||
      (data.revision_tabs || [])[0],
    [data.revision_tabs, selectedRevision]
  );

  const revisionLabel = translateRevisionLabel(
    selectedRevision,
    activeRevisionObj?.label || `${selectedRevision}ª Revisão`,
    language
  );
  const revisionSubtitle = translateRevisionSubtitle(
    activeRevisionObj?.subtitle || '',
    language
  );

  const getLocalizedContent = useCallback(
    (key: string, fallbackPt?: string) => {
      const basePt = fallbackPt ?? DEFAULT_SITE_CONTENT[key] ?? '';
      const savedEntry = vbConfig.siteContent?.[key];
      if (language === 'pt') {
        return { defaultText: basePt, entry: savedEntry };
      }
      const translated = SITE_CONTENT_TRANSLATIONS[language]?.[key];
      if (!translated) {
        return { defaultText: basePt, entry: savedEntry };
      }
      const savedText = typeof savedEntry?.text === 'string' ? savedEntry.text : '';
      const matchesDefaultPt = !savedEntry || savedText.trim() === basePt.trim();
      return {
        defaultText: translated,
        entry: savedEntry
          ? {
              ...savedEntry,
              text: matchesDefaultPt ? translated : savedText,
            }
          : undefined,
      };
    },
    [language, vbConfig.siteContent]
  );

  const renderNoticeParagraph = useCallback(
    (textKey: 'notice_line_1' | 'notice_line_2') => {
      const { defaultText, entry } = getLocalizedContent(textKey);
      const hasHtmlOverride = Boolean(vbConfig.htmlOverrides?.[textKey]?.trim());
      if (isEditMode || activeHtmlEditMode || hasHtmlOverride) {
        return (
          <EditableText
            as="p"
            textKey={textKey}
            defaultText={defaultText}
            entry={entry}
            isEditMode={isEditMode}
            onCommit={handleCommitText}
            className="block"
          />
        );
      }
      const fullText = entry?.text || defaultText;
      const match = fullText.match(/^((?:1ª|1st|3ª|3rd)[^:]{3,28}:)\s*(.*)$/i);
      if (match) {
        return (
          <p className="block">
            <strong className="font-bold text-ink">{match[1]}</strong>{' '}
            {match[2]}
          </p>
        );
      }
      return <p className="block">{fullText}</p>;
    },
    [getLocalizedContent, handleCommitText, isEditMode, activeHtmlEditMode, vbConfig.htmlOverrides]
  );

  const orderedModels = useMemo(() => {
    const posMap = new Map<number, number>();
    (vbConfig.modelOrder || []).forEach((id, idx) => posMap.set(id, idx));
    return [...(data.models || [])].sort((a, b) => {
      const pa = posMap.has(a.id) ? (posMap.get(a.id) as number) : 9999;
      const pb = posMap.has(b.id) ? (posMap.get(b.id) as number) : 9999;
      return pa - pb;
    });
  }, [data.models, vbConfig.modelOrder]);

  const computedModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const hiddenSet = new Set(vbConfig.hiddenModelIds || []);

    return orderedModels
      .map((model) => {
        const effectiveImage =
          pendingModelImageById[model.id] ??
          vbConfig.imageOverrides?.[`model_${model.id}`] ??
          model.image_url;
        const summary = computeModelRevision(
          model.id,
          selectedRevision,
          data.revision_parts || [],
          partsMap,
          model.labor_price,
          {
            oilLiters: model.oil_liters,
            oilSaleMode: model.oil_sale_mode,
          }
        );
        return {
          model: { ...model, image_url: effectiveImage },
          summary,
          isVisuallyHidden: hiddenSet.has(model.id),
        };
      })
      .filter(({ model, summary, isVisuallyHidden }) => {
        if (!isEditMode && isVisuallyHidden) return false;
        if (selectedSegment !== 'all' && model.segment_slug !== selectedSegment) {
          return false;
        }
        if (!q) return true;
        if ((model.name || '').toLowerCase().includes(q)) return true;
        return summary.items.some(
          ({ part }) =>
            (part.description || '').toLowerCase().includes(q) ||
            (part.code || '').toLowerCase().includes(q)
        );
      });
  }, [
    orderedModels,
    vbConfig.hiddenModelIds,
    vbConfig.imageOverrides,
    pendingModelImageById,
    selectedRevision,
    data.revision_parts,
    partsMap,
    selectedSegment,
    searchQuery,
    isEditMode,
  ]);

  const primaryWhatsAppNumber = useMemo(
    () => getUnitWhatsAppNumber(data.seo?.units?.[0]),
    [data.seo?.units]
  );

  const quickJumpModels = useMemo(() => {
    const hiddenSet = new Set(vbConfig.hiddenModelIds);
    return orderedModels.filter((m) => isEditMode || !hiddenSet.has(m.id));
  }, [orderedModels, vbConfig.hiddenModelIds, isEditMode]);

  const scrollToSection = useCallback((elementId: string) => {
    if (elementId === 'unidades') {
      setShouldMountUnits(true);
    }
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const railRafRef = useRef<number | null>(null);

  const updateRailScrollState = useCallback(() => {
    railRafRef.current = null;
    const el = railRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  const scheduleRailScrollUpdate = useCallback(() => {
    if (railRafRef.current !== null) return;
    railRafRef.current = window.requestAnimationFrame(updateRailScrollState);
  }, [updateRailScrollState]);

  const scrollRailBy = useCallback((direction: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    const step = Math.max(320, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }, []);

  const handleRailMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isEditMode || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, option')) return;
      const el = railRef.current;
      if (!el) return;

      railDragCleanupRef.current?.();
      railDragRef.current = {
        active: true,
        moved: false,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!railDragRef.current.active) return;
        const dx = moveEvent.clientX - railDragRef.current.startX;
        if (!railDragRef.current.moved && Math.abs(dx) > 6) {
          railDragRef.current.moved = true;
          setIsDraggingRail(true);
        }
        if (railDragRef.current.moved) {
          el.scrollLeft = railDragRef.current.startScrollLeft - dx;
        }
      };

      const cleanup = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        railDragCleanupRef.current = null;
      };

      const onMouseUp = () => {
        const hadMoved = railDragRef.current.moved;
        railDragRef.current.active = false;
        railDragRef.current.moved = false;
        setIsDraggingRail(false);
        if (hadMoved) {
          suppressRailClickRef.current = true;
          window.setTimeout(() => {
            suppressRailClickRef.current = false;
          }, 0);
        }
        cleanup();
      };

      railDragCleanupRef.current = cleanup;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [isEditMode]
  );

  const handleRailClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressRailClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressRailClickRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      railDragCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    const raf = window.requestAnimationFrame(updateRailScrollState);
    window.addEventListener('resize', scheduleRailScrollUpdate, { passive: true });
    return () => {
      window.cancelAnimationFrame(raf);
      if (railRafRef.current !== null) {
        window.cancelAnimationFrame(railRafRef.current);
        railRafRef.current = null;
      }
      window.removeEventListener('resize', scheduleRailScrollUpdate);
    };
  }, [updateRailScrollState, scheduleRailScrollUpdate, computedModels.length, viewMode, heroTab]);

  const handleQuickSelectModel = useCallback(
    (modelIdStr: string) => {
      const id = Number(modelIdStr);
      if (!id) return;
      const matchedModel = orderedModels.find((m) => m.id === id);
      if (matchedModel) {
        trackAllPixelsViewContent(
          data.seo,
          {
            content_name: matchedModel.name,
            content_category: segmentNameMap[matchedModel.segment_slug] || 'Honda',
            content_ids: [String(matchedModel.id)],
          },
          data.tracking_config
        );
      }
      setHeroTab('tabela');
      setSearchQuery('');
      setSelectedSegment('all');
      setHighlightedModelId(id);
      window.setTimeout(() => {
        window.requestAnimationFrame(() => {
          const card = document.getElementById(`model-card-${id}`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            window.requestAnimationFrame(() => {
              const rect = card.getBoundingClientRect();
              if (rect.top < 120 || rect.bottom > window.innerHeight) {
                const topTarget = Math.max(0, window.scrollY + rect.top - 165);
                window.scrollTo({ top: topTarget, behavior: 'smooth' });
              }
            });
          }
          scheduleRailScrollUpdate();
        });
      }, 90);
      window.setTimeout(() => {
        setHighlightedModelId((curr) => (curr === id ? null : curr));
      }, 2400);
    },
    [orderedModels, data.seo, data.tracking_config, segmentNameMap, scheduleRailScrollUpdate]
  );

  const handleNavClick = (target: 'revisoes' | 'calculadora' | 'faq' | 'unidades') => {
    setActiveNav(target);
    if (target === 'revisoes') {
      setHeroTab('tabela');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'calculadora') {
      setHeroTab('calculadora');
      setTimeout(() => scrollToSection('calculadora-revisoes'), 40);
    } else if (target === 'faq') {
      setHeroTab('tabela');
      setTimeout(() => scrollToSection('perguntas-frequentes'), 40);
    } else if (target === 'unidades') {
      scrollToSection('unidades');
    }
  };

  const handleFaqKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number, total: number) => {
      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === 'INPUT' ||
          targetEl.tagName === 'TEXTAREA' ||
          targetEl.isContentEditable)
      ) {
        return;
      }
      if (total <= 0) return;

      let nextIndex: number | null = null;
      if (e.key === 'ArrowDown') {
        nextIndex = (index + 1) % total;
      } else if (e.key === 'ArrowUp') {
        nextIndex = (index - 1 + total) % total;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = total - 1;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        faqButtonRefs.current[nextIndex]?.focus();
      }
    },
    []
  );

  const renderSectionContent = (block: PageSectionBlock) => {
    switch (block.type) {
      case 'hero': {
        const heroEyebrow = getLocalizedContent('hero_eyebrow');
        const heroTitle = getLocalizedContent('hero_title');
        const heroSubtitle = getLocalizedContent('hero_subtitle');
        const heroTabTable = getLocalizedContent('hero_tab_table');
        const heroTabCalculator = getLocalizedContent('hero_tab_calculator');
        const heroTabFaq = getLocalizedContent('hero_tab_faq');
        return (
          <section
            id="hero-tabs"
            className="border-b border-border bg-card py-10 sm:py-12"
          >
            <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
              <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                <div className="max-w-2xl">
                  <EditableText
                    as="p"
                    textKey="hero_eyebrow"
                    defaultText={heroEyebrow.defaultText}
                    entry={heroEyebrow.entry}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="text-xs font-bold uppercase tracking-widest text-brand-text"
                  />
                  <EditableText
                    as="h1"
                    textKey="hero_title"
                    defaultText={heroTitle.defaultText}
                    entry={heroTitle.entry}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="mt-2 block text-balance font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-[42px] lg:leading-[1.12]"
                  />
                  <EditableText
                    as="p"
                    textKey="hero_subtitle"
                    defaultText={heroSubtitle.defaultText}
                    entry={heroSubtitle.entry}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="mt-3 block text-base text-ink-muted"
                  />
                </div>

                {/* Seletor em pílula com três abas */}
                <div className="inline-flex max-w-full flex-wrap items-center gap-1 self-start rounded-2xl border border-border bg-surface p-1 sm:flex-nowrap sm:rounded-full lg:self-end">
                  <button
                    type="button"
                    onClick={() => {
                      setHeroTab('tabela');
                      setActiveNav('revisoes');
                    }}
                    className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
                      heroTab === 'tabela'
                        ? 'bg-brand-soft text-brand-text shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <EditableText
                      textKey="hero_tab_table"
                      defaultText={heroTabTable.defaultText}
                      entry={heroTabTable.entry}
                      isEditMode={isEditMode}
                      onCommit={handleCommitText}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeroTab('calculadora');
                      setActiveNav('calculadora');
                    }}
                    className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
                      heroTab === 'calculadora'
                        ? 'bg-brand-soft text-brand-text shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <EditableText
                      textKey="hero_tab_calculator"
                      defaultText={heroTabCalculator.defaultText}
                      entry={heroTabCalculator.entry}
                      isEditMode={isEditMode}
                      onCommit={handleCommitText}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeroTab('faq');
                      setActiveNav('faq');
                    }}
                    className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${
                      heroTab === 'faq'
                        ? 'bg-brand-soft text-brand-text shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <EditableText
                      textKey="hero_tab_faq"
                      defaultText={heroTabFaq.defaultText}
                      entry={heroTabFaq.entry}
                      isEditMode={isEditMode}
                      onCommit={handleCommitText}
                    />
                  </button>
                </div>
              </div>
            </div>
          </section>
        );
      }

      case 'revisions_selector': {
        if (heroTab !== 'tabela' && !isEditMode) return null;
        const promptAbove = getLocalizedContent('revisions_prompt_above');
        return (
          <div className="mx-auto max-w-[1180px] px-4 pt-5 pb-1 sm:px-6 sm:pt-6 sm:pb-2">
            <EditableText
              as="p"
              textKey="revisions_prompt_above"
              defaultText={promptAbove.defaultText}
              entry={promptAbove.entry}
              isEditMode={isEditMode}
              onCommit={handleCommitText}
              className="mb-3 block text-sm font-semibold text-ink"
            />
            <div className="no-scrollbar flex flex-nowrap items-stretch gap-2 overflow-x-auto scroll-smooth py-1 lg:gap-1.5 lg:overflow-visible xl:gap-2">
              {data.revision_tabs.map((tab) => {
                const isSelected = selectedRevision === tab.revision_number;
                const localizedTabLabel = translateRevisionLabel(
                  tab.revision_number,
                  tab.label,
                  language
                );
                const localizedTabSub = translateRevisionSubtitle(tab.subtitle, language);
                const savedTabLabel = vbConfig.siteContent[`rev_tab_label_${tab.revision_number}`];
                const savedTabSub = vbConfig.siteContent[`rev_tab_sub_${tab.revision_number}`];
                const labelEntry =
                  language === 'pt'
                    ? savedTabLabel
                    : savedTabLabel && savedTabLabel.text.trim() !== tab.label.trim()
                      ? savedTabLabel
                      : undefined;
                const subEntry =
                  language === 'pt'
                    ? savedTabSub
                    : savedTabSub && savedTabSub.text.trim() !== tab.subtitle.trim()
                      ? savedTabSub
                      : undefined;

                return (
                  <button
                    key={tab.revision_number}
                    type="button"
                    onClick={() => {
                      setSelectedRevision(tab.revision_number);
                      trackAllPixelsViewContent(
                        data.seo,
                        {
                          content_name: tab.label,
                          content_category: 'Revisão Programada',
                        },
                        data.tracking_config
                      );
                    }}
                    className={`inline-flex w-fit shrink-0 cursor-pointer flex-col items-start rounded-2xl border px-3 py-2 text-left transition-all duration-150 ease-out lg:min-w-0 lg:flex-1 lg:px-2 lg:py-2 xl:px-3 xl:py-2.5 ${
                      isSelected
                        ? 'border-brand bg-brand text-on-brand shadow-sm'
                        : 'border-border bg-card text-ink hover:-translate-y-0.5 hover:border-brand/70 hover:shadow-sm'
                    }`}
                  >
                    <EditableText
                      textKey={`rev_tab_label_${tab.revision_number}`}
                      defaultText={localizedTabLabel}
                      entry={labelEntry}
                      isEditMode={isEditMode}
                      onCommit={handleCommitText}
                      className="max-w-full truncate whitespace-nowrap font-display text-sm font-bold lg:text-[13px] xl:text-[15px]"
                    />
                    <EditableText
                      textKey={`rev_tab_sub_${tab.revision_number}`}
                      defaultText={localizedTabSub}
                      entry={subEntry}
                      isEditMode={isEditMode}
                      onCommit={handleCommitText}
                      className={`mt-0.5 max-w-full truncate whitespace-nowrap text-[11px] lg:text-[10px] xl:text-[11.5px] ${
                        isSelected ? 'text-on-brand/90' : 'text-ink-muted'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      case 'notice_box': {
        if (heroTab !== 'tabela' && !isEditMode) return null;
        const noticeSectionHtml = vbConfig.htmlOverrides?.['section_html_notice_box']?.trim();
        return (
          <div className="mx-auto max-w-[1180px] px-4 pt-6 pb-1 sm:px-6 sm:pt-8 sm:pb-2">
            <div
              onClick={
                activeHtmlEditMode
                  ? () =>
                      openHtmlModalForKey(
                        'section_html_notice_box',
                        noticeSectionHtml || buildNoticeBoxDefaultHtml(vbConfig)
                      )
                  : undefined
              }
              className={`relative flex items-start gap-3.5 rounded-2xl border border-border bg-card/85 p-4 sm:p-5 ${
                activeHtmlEditMode
                  ? 'cursor-pointer border-dashed border-brand/60 hover:border-brand hover:bg-brand-soft/25'
                  : ''
              }`}
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-text" />
              <div className="min-w-0 flex-1 space-y-1.5 text-xs leading-relaxed text-ink-muted sm:text-sm">
                {noticeSectionHtml ? (
                  <SafeHtml
                    html={noticeSectionHtml}
                    className="space-y-1.5 [&_a]:text-brand-text [&_a]:underline [&_strong]:font-bold [&_strong]:text-ink"
                  />
                ) : (
                  <>
                    {renderNoticeParagraph('notice_line_1')}
                    {renderNoticeParagraph('notice_line_2')}
                  </>
                )}
              </div>
              {activeHtmlEditMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openHtmlModalForKey(
                      'section_html_notice_box',
                      noticeSectionHtml || buildNoticeBoxDefaultHtml(vbConfig)
                    );
                  }}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-[10px] font-bold text-on-brand shadow-xs hover:bg-brand-hover"
                >
                  <Code2 className="h-3 w-3" />
                  HTML do Aviso
                </button>
              )}
            </div>
          </div>
        );
      }

      case 'filters_catalog': {
        if (heroTab !== 'tabela' && !isEditMode) return null;
        const visibleModels = computedModels;
        const isFreeLabor = isFreeLaborRevision(selectedRevision);
        const laborBadgeText = getLaborBadgeText(selectedRevision, language);
        const laborTexts = LABOR_POLICY_TEXTS[language] || LABOR_POLICY_TEXTS.pt;

        const filterAllContent = getLocalizedContent('filter_all_label');
        const promptBelow = getLocalizedContent('revisions_prompt_below');
        return (
          <main className="mx-auto max-w-[1180px] px-4 py-5 sm:px-6 sm:pb-10">
            <EditableText
              as="p"
              textKey="revisions_prompt_below"
              defaultText={promptBelow.defaultText}
              entry={promptBelow.entry}
              isEditMode={isEditMode}
              onCommit={handleCommitText}
              className="mb-3 block text-sm font-semibold text-ink"
            />
            {/* Barra horizontal compacta de busca, seleção rápida e filtros */}
            <div
              className="relative -mx-1 rounded-2xl border border-border bg-card/95 p-2.5 shadow-sm backdrop-blur sm:mx-0 sm:p-3"
            >
              {/* Linha 1 horizontal: Busca + Ir direto para a moto + Atalhos */}
              <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                <div className="relative min-w-[210px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={dict.searchPlaceholder}
                    className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-8 text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:bg-card focus:outline-none sm:text-sm"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label={dict.clearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-muted hover:text-ink"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <select
                  aria-label={dict.quickSelectPlaceholder}
                  value=""
                  onChange={(e) => handleQuickSelectModel(e.target.value)}
                  className="w-full shrink-0 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-ink focus:border-brand focus:outline-none sm:w-auto sm:min-w-[190px]"
                >
                  <option value="">{dict.quickSelectPlaceholder}</option>
                  {quickJumpModels.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => scrollToSection('perguntas-frequentes')}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand-text"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-brand-text" />
                  {dict.shortcutFaq}
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('unidades')}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand-text"
                >
                  <MapPin className="h-3.5 w-3.5 text-brand-text" />
                  {dict.shortcutUnits}
                </button>
              </div>

              {/* Linha 2 horizontal: Pílulas de segmento + contador + setas do carrossel + alternador grade/lista */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                <div className="no-scrollbar flex max-w-full items-center gap-1.5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedSegment('all')}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      selectedSegment === 'all'
                        ? 'border border-ink bg-ink text-on-ink'
                        : 'border border-border bg-card text-ink hover:bg-surface'
                    }`}
                  >
                    <EditableText
                      textKey="filter_all_label"
                      defaultText={filterAllContent.defaultText}
                      entry={filterAllContent.entry}
                      isEditMode={isEditMode}
                      onCommit={handleCommitText}
                    />
                  </button>
                  {data.segments.map((seg) => (
                    <button
                      key={seg.slug}
                      type="button"
                      onClick={() => {
                        setSelectedSegment(seg.slug);
                        trackAllPixelsViewContent(
                          data.seo,
                          {
                            content_name: seg.name,
                            content_category: 'Segmento',
                          },
                          data.tracking_config
                        );
                      }}
                      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        selectedSegment === seg.slug
                          ? 'border border-ink bg-ink text-on-ink'
                          : 'border border-border bg-card text-ink hover:bg-surface'
                      }`}
                    >
                      <EditableText
                        textKey={`segment_${seg.slug}`}
                        defaultText={seg.name}
                        entry={vbConfig.siteContent[`segment_${seg.slug}`]}
                        isEditMode={isEditMode}
                        onCommit={handleCommitText}
                      />
                    </button>
                  ))}
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="whitespace-nowrap text-xs font-medium text-ink-muted tabular-nums">
                    {dict.showingModels(visibleModels.length, computedModels.length)}
                  </span>

                  {viewMode === 'grid' && computedModels.length > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-0.5">
                      <button
                        type="button"
                        onClick={() => scrollRailBy(-1)}
                        disabled={!canScrollLeft}
                        aria-label={dict.prevModel}
                        title={dict.scrollModelsLeft}
                        className="rounded-lg p-1.5 text-ink transition-colors hover:bg-surface hover:text-brand-text disabled:opacity-30"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollRailBy(1)}
                        disabled={!canScrollRight}
                        aria-label={dict.nextModel}
                        title={dict.scrollModelsRight}
                        className="rounded-lg p-1.5 text-ink transition-colors hover:bg-surface hover:text-brand-text disabled:opacity-30"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Grid/List switcher */}
                  <div className="inline-flex rounded-xl border border-border bg-card p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      aria-label={dict.gridViewAria}
                      className={`rounded-lg p-1.5 transition-colors ${
                        viewMode === 'grid'
                          ? 'bg-ink text-on-ink'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      aria-label={dict.listViewAria}
                      className={`rounded-lg p-1.5 transition-colors ${
                        viewMode === 'list'
                          ? 'bg-ink text-on-ink'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Trilho horizontal rolável / Lista de cards de motos */}
            {computedModels.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-border bg-card p-10 text-center">
                <p className="text-base font-semibold text-ink">{dict.noModelsTitle}</p>
                <p className="mt-1 text-sm text-ink-muted">{dict.noModelsDesc}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedSegment('all');
                  }}
                  className="mt-4 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-on-ink"
                >
                  {dict.clearFilters}
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="relative mt-5">
                <button
                  type="button"
                  onClick={() => scrollRailBy(-1)}
                  disabled={!canScrollLeft}
                  aria-label={dict.scrollModelsLeft}
                  className="hidden sm:flex absolute -left-3 top-1/2 z-20 h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 text-ink shadow-md backdrop-blur transition-all hover:border-brand hover:text-brand-text disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div
                  ref={railRef}
                  onScroll={scheduleRailScrollUpdate}
                  onMouseDown={handleRailMouseDown}
                  onClickCapture={handleRailClickCapture}
                  onDragStart={(e) => {
                    if (!isEditMode) e.preventDefault();
                  }}
                  className={`flex flex-row items-stretch gap-4 overflow-x-auto pb-3 pt-1 ${
                    isDraggingRail
                      ? 'cursor-grabbing select-none'
                      : isEditMode
                        ? ''
                        : 'cursor-grab snap-x snap-mandatory scroll-smooth'
                  }`}
                >
                  {visibleModels.map(({ model, summary, isVisuallyHidden }, modelIdx) => {
                    const categoryLabel = segmentNameMap[model.segment_slug] || 'Street';
                    const revTitleUpper = `${dict.totalOfPrefix} ${revisionLabel.toUpperCase()}`;
                    const includeOptionals = true;
                    const activeTotal = summary.totalWithOptionals;
                    const isHighlighted = highlightedModelId === model.id;
                    const failedUrl = failedModelImageIds[model.id];
                    const useFallbackImg = Boolean(failedUrl && failedUrl === model.image_url);
                    const imgSources = getOptimizedMotoImageSources(
                      model.image_url,
                      useFallbackImg ? model.segment_slug : undefined
                    );

                    return (
                      <article
                        id={`model-card-${model.id}`}
                        key={model.id}
                        draggable={isEditMode}
                        onDragStart={(e) => {
                          if (!isEditMode) return;
                          e.stopPropagation();
                          setDragModelId(model.id);
                        }}
                        onDragOver={(e) => {
                          if (!isEditMode || dragModelId === null) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverModelId(model.id);
                        }}
                        onDrop={(e) => {
                          if (!isEditMode || dragModelId === null) return;
                          e.preventDefault();
                          e.stopPropagation();
                          reorderModelCards(dragModelId, model.id);
                          setDragModelId(null);
                          setDragOverModelId(null);
                        }}
                        className={`moto-card-animated-border relative flex w-[285px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl shadow-[0_2px_10px_rgba(17,24,39,0.05)] transition-all duration-200 sm:w-[318px] md:w-[336px] ${
                          isEditMode && dragOverModelId === model.id
                            ? 'ring-2 ring-brand'
                            : isHighlighted
                              ? 'ring-2 ring-brand/60 shadow-lg'
                              : 'hover:-translate-y-0.5'
                        } ${isVisuallyHidden ? 'opacity-45 grayscale' : ''}`}
                      >
                        {isEditMode && (
                          <div
                            data-html2canvas-ignore="true"
                            className="flex items-center justify-between gap-1 border-b border-border bg-brand-soft px-3 py-1.5 text-[11px] text-ink"
                          >
                            <span className="inline-flex cursor-grab items-center gap-1 font-bold active:cursor-grabbing">
                              <GripVertical className="h-3.5 w-3.5 text-brand-text" />
                              Arrastar card
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveModelCard(model.id, -1)}
                                title="Mover para esquerda"
                                className="rounded bg-card p-1 hover:bg-surface"
                              >
                                <ArrowLeft className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveModelCard(model.id, 1)}
                                title="Mover para direita"
                                className="rounded bg-card p-1 hover:bg-surface"
                              >
                                <ArrowRight className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleModelCardHidden(model.id)}
                                title={isVisuallyHidden ? 'Exibir card' : 'Ocultar card'}
                                className="rounded bg-card p-1 hover:bg-surface"
                              >
                                {isVisuallyHidden ? (
                                  <EyeOff className="h-3 w-3 text-brand-text" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Foto compacta da moto (fundo branco, centralizada) */}
                        <div className="group/img relative flex h-40 w-full items-center justify-center overflow-hidden border-b border-border bg-white p-3.5 sm:h-44">
                          {imgSources.fallbackSrc ? (
                            <picture className="flex h-full w-full items-center justify-center">
                              {imgSources.webpSrc && (
                                <source srcSet={imgSources.webpSrc} type="image/webp" />
                              )}
                              <img
                                src={imgSources.fallbackSrc}
                                alt={`Honda ${model.name}`}
                                width={440}
                                height={330}
                                loading={modelIdx < 4 ? 'eager' : 'lazy'}
                                decoding="async"
                                referrerPolicy="no-referrer"
                                onError={() => {
                                  if (!useFallbackImg && model.image_url) {
                                    setFailedModelImageIds((prev) => ({
                                      ...prev,
                                      [model.id]: model.image_url,
                                    }));
                                  }
                                }}
                                className="h-full w-full object-contain"
                              />
                            </picture>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-xl bg-surface-neutral text-xs font-semibold text-ink-muted">
                              Honda {model.name}
                            </div>
                          )}
                          {isEditMode && (
                            <button
                              type="button"
                              data-html2canvas-ignore="true"
                              onClick={() =>
                                setImageModal({
                                  kind: 'model',
                                  modelId: model.id,
                                  title: `Foto de ${model.name}`,
                                  currentUrl: model.image_url,
                                })
                              }
                              className="absolute inset-x-0 bottom-2 mx-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-ink/85 px-3.5 py-1.5 text-xs font-bold text-on-ink opacity-95 shadow-lg backdrop-blur transition-all hover:bg-brand hover:text-on-brand group-hover/img:opacity-100"
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                              Trocar Imagem
                            </button>
                          )}
                        </div>

                        {/* Cabeçalho do card */}
                        <div className="flex items-start justify-between gap-2.5 px-4 pt-3">
                          <div className="min-w-0">
                            <EditableText
                              as="h2"
                              textKey={`model_name_${model.id}`}
                              defaultText={model.name}
                              entry={vbConfig.siteContent[`model_name_${model.id}`]}
                              isEditMode={isEditMode}
                              onCommit={handleCommitText}
                              className="truncate font-display text-base font-bold tracking-tight text-ink sm:text-lg"
                            />
                            <EditableText
                              as="p"
                              textKey={`model_cat_${model.id}`}
                              defaultText={categoryLabel}
                              entry={vbConfig.siteContent[`model_cat_${model.id}`]}
                              isEditMode={isEditMode}
                              onCommit={handleCommitText}
                              className="block text-xs font-medium text-ink-muted"
                            />
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-ink-muted tabular-nums">
                            {summary.items.length}{' '}
                            {summary.items.length === 1 ? dict.itemSingular : dict.itemPlural}
                          </span>
                        </div>

                        {/* Badges informativos transparentes (Atendimento, Mão de obra e Opcionais) */}
                        <div className="mt-2 flex flex-wrap items-center gap-1 px-4">
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-neutral px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                            <Clock className="h-3 w-3 shrink-0" />
                            {isFreeLabor ? dict.walkInBadge : dict.appointmentBadge}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold leading-tight ${
                              isFreeLabor
                                ? 'bg-brand-soft text-brand-text'
                                : 'bg-surface-neutral text-ink-muted'
                            }`}
                          >
                            <Wrench className="h-3 w-3 shrink-0 text-brand-text" />
                            <span>{laborBadgeText}</span>
                          </span>
                        </div>

                        {(vbConfig.htmlOverrides?.[`model_html_${model.id}`]?.trim() ||
                          activeHtmlEditMode) && (
                          <div className="mt-2 px-4">
                            {vbConfig.htmlOverrides?.[`model_html_${model.id}`]?.trim() && (
                              <SafeHtml
                                html={vbConfig.htmlOverrides[`model_html_${model.id}`]}
                                onClick={
                                  activeHtmlEditMode
                                    ? (e) => {
                                        e.stopPropagation();
                                        openHtmlModalForKey(
                                          `model_html_${model.id}`,
                                          buildModelDefaultHtml(model)
                                        );
                                      }
                                    : undefined
                                }
                                className={`text-[11px] leading-snug text-ink [&_a]:text-brand-text [&_a]:underline ${
                                  activeHtmlEditMode
                                    ? 'cursor-pointer rounded-lg outline-2 outline-dashed outline-brand/50 hover:outline-brand'
                                    : ''
                                }`}
                              />
                            )}
                            {activeHtmlEditMode && (
                              <button
                                type="button"
                                data-html2canvas-ignore="true"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openHtmlModalForKey(
                                    `model_html_${model.id}`,
                                    buildModelDefaultHtml(model)
                                  );
                                }}
                                className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1 text-[10px] font-bold text-brand-text hover:bg-brand hover:text-on-brand"
                              >
                                <Code2 className="h-3 w-3" />
                                Editar HTML ({model.name})
                              </button>
                            )}
                          </div>
                        )}

                        {/* Lista compacta de peças da revisão (altura alinhada no carrossel) */}
                        <div
                          data-capture-scroll-list="true"
                          className="mt-2.5 h-[196px] flex-1 overflow-y-auto divide-y divide-border px-4"
                        >
                          {summary.items.length === 0 && (isFreeLabor || summary.laborCost <= 0) ? (
                            <p className="py-6 text-center text-xs text-ink-muted">
                              {dict.noPartsLinked}
                            </p>
                          ) : (
                            <>
                              {summary.items.map(({ revisionPart, part, lineTotal, oilMeta }) => {
                                const dimmedOptional = part.is_optional && !includeOptionals;
                                const translatedDesc = translatePartDescription(
                                  part.description,
                                  language
                                );
                                const oilCodeSubtext = oilMeta?.isEngineOil
                                  ? oilMeta.saleMode === 'closed_bottle_1l'
                                    ? oilMeta.surplusMl > 0
                                      ? `${dict.codePrefix} ${part.code} • ${oilMeta.bottles} ${oilMeta.bottles === 1 ? 'frasco' : 'frascos'} de 1L (${formatLitersPT(oilMeta.oilLiters)}L no motor + ${oilMeta.surplusMl}ml de sobra entregue ao cliente)`
                                      : `${dict.codePrefix} ${part.code} • ${oilMeta.bottles} ${oilMeta.bottles === 1 ? 'frasco' : 'frascos'} de 1L (${formatLitersPT(oilMeta.oilLiters)}L)`
                                    : `${dict.codePrefix} ${part.code} · ${formatExactOilQuantity(oilMeta.oilLiters)}`
                                  : `${dict.codePrefix} ${part.code}${
                                      part.unit === 'ML' || revisionPart.quantity > 1
                                        ? ` · ${formatPartQuantity(part, revisionPart.quantity)}`
                                        : ''
                                    }`;
                                return (
                                  <div
                                    key={`${revisionPart.id}-${part.code}`}
                                    className={`flex items-start justify-between gap-2.5 py-2 transition-opacity ${
                                      dimmedOptional ? 'opacity-45' : ''
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <p
                                        className={`text-xs font-medium leading-snug text-ink ${
                                          dimmedOptional ? 'line-through' : ''
                                        }`}
                                      >
                                        {translatedDesc}
                                        {part.is_optional &&
                                        !translatedDesc.includes('[Opcional]') &&
                                        !translatedDesc.includes('[Optional]') ? (
                                          <span className="ml-1 text-ink-muted">
                                            {dict.optionalTag}
                                          </span>
                                        ) : null}
                                      </p>
                                      <p className="mt-0.5 font-mono text-[10px] leading-snug text-ink-muted">
                                        {oilCodeSubtext}
                                      </p>
                                    </div>
                                    <span
                                      className={`shrink-0 text-xs font-bold text-ink tabular-nums ${
                                        dimmedOptional ? 'line-through' : ''
                                      }`}
                                    >
                                      {formatBRL(lineTotal)}
                                    </span>
                                  </div>
                                );
                              })}
                              {!isFreeLabor && summary.laborCost > 0 && (
                                <div className="flex items-center justify-between gap-2.5 py-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold leading-snug text-ink">
                                      {laborTexts.laborShortLabel}
                                    </p>
                                  </div>
                                  <span className="shrink-0 text-xs font-bold text-ink tabular-nums">
                                    {formatBRL(summary.laborCost)}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {summary.oilSurplusNotice && summary.oilSurplusNotice.surplusMl > 0 && (
                          <p className="border-t border-border bg-surface/75 px-4 py-2 text-[10px] leading-snug text-ink-muted">
                            Óleo comercializado apenas em frascos fechados de 1L. O excedente (
                            {summary.oilSurplusNotice.surplusMl}ml) é entregue ao cliente para
                            reposição.
                          </p>
                        )}

                        {/* Rodapé vermelho de destaque */}
                        <div
                          data-capture-footer-gradient="true"
                          className={`${
                            summary.oilSurplusNotice && summary.oilSurplusNotice.surplusMl > 0
                              ? ''
                              : 'mt-2.5'
                          } bg-gradient-to-r from-brand to-brand-hover px-4 py-3 text-on-brand`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-on-brand">
                                {revTitleUpper}
                              </p>
                              <p className="text-[10px] text-on-brand/90 tabular-nums">
                                {dict.withoutOptionals}: {formatBRL(summary.totalWithoutOptionals)}
                              </p>
                            </div>
                            <p className="font-display text-lg font-extrabold tracking-tight tabular-nums sm:text-xl">
                              {formatBRL(activeTotal)}
                            </p>
                          </div>
                        </div>

                        {/* Botão de agendamento direto via modal WhatsApp */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditMode) return;
                            trackAllPixelsLeadContact(
                              data.seo,
                              {
                                content_name: model.name,
                                content_category: revisionLabel,
                              },
                              data.tracking_config
                            );
                            setScheduleTarget({
                              model,
                              summary,
                              includeOptionals,
                            });
                          }}
                          className="flex items-center justify-center gap-2 border-t border-border bg-card px-4 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-surface"
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-whatsapp text-on-brand">
                            <WhatsAppIcon className="h-3 w-3" />
                          </span>
                          {language === 'pt' ? (
                            <EditableText
                              textKey={`model_cta_${model.id}`}
                              defaultText={dict.bookModelWhatsApp}
                              entry={vbConfig.siteContent[`model_cta_${model.id}`]}
                              isEditMode={isEditMode}
                              onCommit={handleCommitText}
                            />
                          ) : (
                            <span>{dict.bookModelWhatsApp}</span>
                          )}
                        </button>
                      </article>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => scrollRailBy(1)}
                  disabled={!canScrollRight}
                  aria-label={dict.scrollModelsRight}
                  className="hidden sm:flex absolute -right-3 top-1/2 z-20 h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/95 text-ink shadow-md backdrop-blur transition-all hover:border-brand hover:text-brand-text disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : (
              /* List View */
              <div className="mt-7 space-y-4">
                {visibleModels.map(({ model, summary, isVisuallyHidden }, modelIdx) => {
                  const categoryLabel = segmentNameMap[model.segment_slug] || 'Street';
                  const includeOptionals = true;
                  const activeTotal = summary.totalWithOptionals;
                  const isHighlighted = highlightedModelId === model.id;
                  const failedUrl = failedModelImageIds[model.id];
                  const useFallbackImg = Boolean(failedUrl && failedUrl === model.image_url);
                  const imgSources = getOptimizedMotoImageSources(
                    model.image_url,
                    useFallbackImg ? model.segment_slug : undefined
                  );

                  return (
                    <article
                      id={`model-card-${model.id}`}
                      key={model.id}
                      className={`moto-card-animated-border flex flex-col overflow-hidden rounded-2xl shadow-[0_2px_10px_rgba(17,24,39,0.05)] transition-all duration-200 md:flex-row ${
                        isHighlighted
                          ? 'ring-2 ring-brand/60 shadow-lg'
                          : 'hover:-translate-y-0.5'
                      } ${isVisuallyHidden ? 'opacity-45 grayscale' : ''}`}
                    >
                      <div className="relative flex w-full shrink-0 items-center justify-center bg-white p-5 md:w-60 md:border-r md:border-border">
                        {imgSources.fallbackSrc ? (
                          <picture className="flex h-40 w-full items-center justify-center">
                            {imgSources.webpSrc && (
                              <source srcSet={imgSources.webpSrc} type="image/webp" />
                            )}
                            <img
                              src={imgSources.fallbackSrc}
                              alt={`Honda ${model.name}`}
                              width={440}
                              height={330}
                              loading={modelIdx < 4 ? 'eager' : 'lazy'}
                              decoding="async"
                              referrerPolicy="no-referrer"
                              onError={() => {
                                if (!useFallbackImg && model.image_url) {
                                  setFailedModelImageIds((prev) => ({
                                    ...prev,
                                    [model.id]: model.image_url,
                                  }));
                                }
                              }}
                              className="h-40 w-full object-contain"
                            />
                          </picture>
                        ) : (
                          <div className="flex h-40 w-full items-center justify-center rounded-xl bg-surface-neutral text-xs font-semibold text-ink-muted">
                            Honda {model.name}
                          </div>
                        )}
                        {isEditMode && (
                          <button
                            type="button"
                            data-html2canvas-ignore="true"
                            onClick={() =>
                              setImageModal({
                                kind: 'model',
                                modelId: model.id,
                                title: `Foto de ${model.name}`,
                                currentUrl: model.image_url,
                              })
                            }
                            className="absolute bottom-2 inline-flex items-center gap-1 rounded-full bg-ink/85 px-3 py-1 text-[11px] font-bold text-on-ink shadow hover:bg-brand hover:text-on-brand"
                          >
                            <ImageIcon className="h-3 w-3" />
                            Trocar Imagem
                          </button>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-5">
                        <div>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className="flex items-baseline gap-3">
                              <h2 className="font-display text-lg font-bold text-ink">
                                {model.name}
                              </h2>
                              <span className="text-xs font-medium text-ink-muted">
                                {categoryLabel}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-ink-muted tabular-nums">
                              {summary.items.length}{' '}
                              {summary.items.length === 1 ? dict.itemSingular : dict.itemPlural}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-surface-neutral px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                              <Clock className="h-3 w-3 shrink-0" />
                              {isFreeLabor ? dict.walkInBadge : dict.appointmentBadge}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                isFreeLabor
                                  ? 'bg-brand-soft text-brand-text'
                                  : 'bg-surface-neutral text-ink-muted'
                              }`}
                            >
                              <Wrench className="h-3 w-3 shrink-0 text-brand-text" />
                              <span>{laborBadgeText}</span>
                            </span>
                          </div>

                          {(vbConfig.htmlOverrides?.[`model_html_${model.id}`]?.trim() ||
                            activeHtmlEditMode) && (
                            <div className="mt-2.5">
                              {vbConfig.htmlOverrides?.[`model_html_${model.id}`]?.trim() && (
                                <SafeHtml
                                  html={vbConfig.htmlOverrides[`model_html_${model.id}`]}
                                  onClick={
                                    activeHtmlEditMode
                                      ? (e) => {
                                          e.stopPropagation();
                                          openHtmlModalForKey(
                                            `model_html_${model.id}`,
                                            buildModelDefaultHtml(model)
                                          );
                                        }
                                      : undefined
                                  }
                                  className={`text-xs leading-snug text-ink [&_a]:text-brand-text [&_a]:underline ${
                                    activeHtmlEditMode
                                      ? 'cursor-pointer rounded-lg outline-2 outline-dashed outline-brand/50 hover:outline-brand'
                                      : ''
                                  }`}
                                />
                              )}
                              {activeHtmlEditMode && (
                                <button
                                  type="button"
                                  data-html2canvas-ignore="true"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openHtmlModalForKey(
                                      `model_html_${model.id}`,
                                      buildModelDefaultHtml(model)
                                    );
                                  }}
                                  className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1 text-[10px] font-bold text-brand-text hover:bg-brand hover:text-on-brand"
                                >
                                  <Code2 className="h-3 w-3" />
                                  Editar HTML ({model.name})
                                </button>
                              )}
                            </div>
                          )}

                          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
                            {summary.items.map(({ revisionPart, part, lineTotal, oilMeta }) => {
                              const dimmedOptional = part.is_optional && !includeOptionals;
                              const translatedDesc = translatePartDescription(
                                part.description,
                                language
                              );
                              const oilSubtext = oilMeta?.isEngineOil
                                ? oilMeta.saleMode === 'closed_bottle_1l'
                                  ? oilMeta.surplusMl > 0
                                    ? `${dict.codePrefix} ${part.code} • ${oilMeta.bottles} ${oilMeta.bottles === 1 ? 'frasco' : 'frascos'} de 1L (${formatLitersPT(oilMeta.oilLiters)}L no motor + ${oilMeta.surplusMl}ml de sobra entregue ao cliente)`
                                    : `${dict.codePrefix} ${part.code} • ${oilMeta.bottles} ${oilMeta.bottles === 1 ? 'frasco' : 'frascos'} de 1L (${formatLitersPT(oilMeta.oilLiters)}L)`
                                  : `${dict.codePrefix} ${part.code} · ${formatExactOilQuantity(oilMeta.oilLiters)}`
                                : `(${part.code})`;
                              return (
                                <div
                                  key={`${revisionPart.id}-${part.code}`}
                                  className={`flex items-start justify-between gap-3 border-b border-border py-1.5 text-xs ${
                                    dimmedOptional ? 'opacity-45 line-through' : ''
                                  }`}
                                >
                                  <div className="min-w-0 pr-2 text-ink">
                                    <p className="truncate">
                                      {translatedDesc}
                                      {part.is_optional &&
                                      !translatedDesc.includes('[Opcional]') &&
                                      !translatedDesc.includes('[Optional]')
                                        ? ` ${dict.optionalTag}`
                                        : ''}
                                    </p>
                                    <p className="font-mono text-[10px] leading-snug text-ink-muted">
                                      {oilSubtext}
                                    </p>
                                  </div>
                                  <span className="shrink-0 font-semibold text-ink tabular-nums">
                                    {formatBRL(lineTotal)}
                                  </span>
                                </div>
                              );
                            })}
                            {!isFreeLabor && summary.laborCost > 0 && (
                              <div className="flex items-center justify-between border-b border-border py-1.5 text-xs">
                                <span className="truncate pr-2 font-semibold text-ink">
                                  {laborTexts.laborShortLabel}
                                </span>
                                <span className="shrink-0 font-semibold text-ink tabular-nums">
                                  {formatBRL(summary.laborCost)}
                                </span>
                              </div>
                            )}
                          </div>

                          {summary.oilSurplusNotice && summary.oilSurplusNotice.surplusMl > 0 && (
                            <p className="mt-3 rounded-lg border border-border bg-surface/75 px-3 py-2 text-[11px] leading-snug text-ink-muted">
                              Óleo comercializado apenas em frascos fechados de 1L. O excedente (
                              {summary.oilSurplusNotice.surplusMl}ml) é entregue ao cliente para
                              reposição.
                            </p>
                          )}
                        </div>

                        <div
                          data-capture-footer-gradient="true"
                          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-brand to-brand-hover px-4 py-3 text-on-brand"
                        >
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider">
                              {dict.totalOfPrefix} {revisionLabel.toUpperCase()}
                            </span>
                            <span className="ml-3 text-xs text-on-brand/90 tabular-nums">
                              {dict.withoutOptionals}: {formatBRL(summary.totalWithoutOptionals)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-display text-lg font-extrabold tabular-nums">
                              {formatBRL(activeTotal)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditMode) return;
                                trackAllPixelsLeadContact(
                                  data.seo,
                                  {
                                    content_name: model.name,
                                    content_category: revisionLabel,
                                  },
                                  data.tracking_config
                                );
                                setScheduleTarget({
                                  model,
                                  summary,
                                  includeOptionals,
                                });
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-surface"
                            >
                              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-whatsapp text-on-brand">
                                <WhatsAppIcon className="h-2.5 w-2.5" />
                              </span>
                              {dict.bookWhatsAppShort}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </main>
        );
      }

      case 'revision_calculator': {
        if (heroTab === 'faq' && !isEditMode) return null;
        const normalizedCalcSettings = normalizeCalculatorSettings(data.calculator_settings);
        return (
          <RevisionCalculatorSection
            models={quickJumpModels}
            segments={data.segments || []}
            revisionTabs={data.revision_tabs || []}
            partsMap={partsMap}
            revisionParts={data.revision_parts || []}
            units={data.seo?.units || []}
            language={language}
            calculatorSettings={normalizedCalcSettings}
            onOpenScheduleModal={(model, revNum, summary, calculatorContext) => {
              const matched = (data.revision_tabs || []).find((t) => t.revision_number === revNum);
              const revLab = translateRevisionLabel(
                revNum,
                matched?.label || `${revNum}ª Revisão`,
                language
              );
              const fallbackSub = `${formatKmPT(
                getTargetKmForRevision(revNum, normalizedCalcSettings)
              )} km ou ${getTargetMonthsForRevision(revNum, normalizedCalcSettings)} meses`;
              const revSub = translateRevisionSubtitle(
                calculatorContext?.revisionSubtitle || matched?.subtitle || fallbackSub,
                language
              );
              setScheduleTarget({
                model,
                summary,
                includeOptionals: true,
                revisionNumber: revNum,
                revisionLabel: revLab,
                revisionSubtitle: revSub,
                calculatorContext,
              });
            }}
            onViewModelInTable={(modelId, revNum) => {
              if ((data.revision_tabs || []).some((t) => t.revision_number === revNum)) {
                setSelectedRevision(revNum);
              }
              handleQuickSelectModel(String(modelId));
            }}
            onTrackLead={(name, cat) =>
              trackAllPixelsLeadContact(
                data.seo,
                {
                  content_name: name,
                  content_category: cat || 'Calculadora de Revisões',
                },
                data.tracking_config
              )
            }
          />
        );
      }

      case 'faq_section': {
        const faqTitleContent = getLocalizedContent('faq_title');
        const faqSubtitleContent = getLocalizedContent('faq_subtitle');
        const faqItems =
          data.faqs && data.faqs.length > 0 ? data.faqs : FALLBACK_EDITORIAL_FAQS;
        return (
          <section
            id="perguntas-frequentes"
            aria-labelledby="faq-section-heading"
            className="mx-auto max-w-[920px] scroll-mt-24 px-4 py-10 sm:px-6 sm:py-14"
          >
            <div className="mb-7 flex items-end justify-between gap-4 border-b border-border/80 pb-5">
              <div id="faq-section-heading">
                <EditableText
                  as="h2"
                  textKey="faq_title"
                  defaultText={faqTitleContent.defaultText}
                  entry={faqTitleContent.entry}
                  isEditMode={isEditMode}
                  onCommit={handleCommitText}
                  className="block font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl"
                />
                <EditableText
                  as="p"
                  textKey="faq_subtitle"
                  defaultText={faqSubtitleContent.defaultText}
                  entry={faqSubtitleContent.entry}
                  isEditMode={isEditMode}
                  onCommit={handleCommitText}
                  className="mt-1.5 block text-sm leading-relaxed text-ink-muted sm:text-base"
                />
              </div>
            </div>

            <div className="space-y-3.5" role="presentation">
              {faqItems.map((faq, faqIdx) => {
                const isOpen = openFaqId === faq.id;
                const itemNumber = String(faqIdx + 1).padStart(2, '0');
                const triggerId = `faq-trigger-${faq.id}`;
                const panelId = `faq-panel-${faq.id}`;
                const translatedFaq = translateFaqItem(faq.question, faq.answer, language);
                const savedFaqQ = vbConfig.siteContent[`faq_q_${faq.id}`];
                const savedFaqA = vbConfig.siteContent[`faq_a_${faq.id}`];
                const qEntry =
                  language === 'pt'
                    ? savedFaqQ
                    : savedFaqQ && savedFaqQ.text.trim() !== faq.question.trim()
                      ? savedFaqQ
                      : undefined;
                const aEntry =
                  language === 'pt'
                    ? savedFaqA
                    : savedFaqA && savedFaqA.text.trim() !== faq.answer.trim()
                      ? savedFaqA
                      : undefined;
                return (
                  <article
                    key={faq.id}
                    className={`rounded-2xl border transition-all duration-200 ${
                      isOpen
                        ? 'faq-item-active bg-card'
                        : 'border-border bg-card hover:border-brand/45 hover:bg-[#FAF8F5] dark:hover:bg-[#1D212B]'
                    }`}
                  >
                    <h3 className="m-0">
                      <button
                        ref={(el) => {
                          faqButtonRefs.current[faqIdx] = el;
                        }}
                        id={triggerId}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                        onKeyDown={(e) => handleFaqKeyDown(e, faqIdx, faqItems.length)}
                        className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl px-4 py-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:gap-5 sm:px-6 sm:py-5"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-5">
                          <span
                            aria-hidden="true"
                            className={`shrink-0 font-display text-2xl font-extrabold leading-none tracking-tight tabular-nums transition-all duration-200 sm:min-w-[2.75rem] sm:text-[28px] ${
                              isOpen
                                ? 'translate-x-0.5 text-brand-text'
                                : 'text-ink-muted/65 group-hover:translate-x-0.5 group-hover:text-brand-text group-focus-visible:translate-x-0.5 group-focus-visible:text-brand-text'
                            }`}
                          >
                            {itemNumber}
                          </span>
                          <EditableText
                            textKey={`faq_q_${faq.id}`}
                            defaultText={translatedFaq.question}
                            entry={qEntry}
                            isEditMode={isEditMode}
                            onCommit={handleCommitText}
                            className={`flex-1 text-sm font-bold leading-snug transition-colors sm:text-base ${
                              isOpen
                                ? 'text-brand-text'
                                : 'text-ink group-hover:text-brand-text group-focus-visible:text-brand-text'
                            }`}
                          />
                        </div>
                        <span
                          aria-hidden="true"
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                            isOpen
                              ? 'border-brand/35 bg-brand-soft text-brand-text'
                              : 'border-border bg-surface text-ink-muted group-hover:border-brand/35 group-hover:bg-brand-soft/60 group-hover:text-brand-text group-focus-visible:border-brand/35 group-focus-visible:text-brand-text'
                          }`}
                        >
                          <ChevronDown
                            className={`faq-chevron h-4 w-4 transition-transform duration-300 ease-out ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </span>
                      </button>
                    </h3>
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={triggerId}
                      aria-hidden={!isOpen}
                      className={`faq-accordion-panel ${
                        isOpen ? 'faq-accordion-panel--open' : ''
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="border-t border-border/75 px-4 pt-3.5 pb-5 text-sm leading-relaxed text-ink-muted sm:px-6 sm:pl-[5.5rem] sm:pb-6">
                          <EditableText
                            as="p"
                            textKey={`faq_a_${faq.id}`}
                            defaultText={translatedFaq.answer}
                            entry={aEntry}
                            isEditMode={isEditMode}
                            onCommit={handleCommitText}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      }

      case 'units_map': {
        const unitsEyebrow = getLocalizedContent('units_eyebrow');
        const unitsTitle = getLocalizedContent('units_title');
        const unitsSubtitle = getLocalizedContent('units_subtitle');
        return (
          <ErrorBoundary compact screenName="Unidades e Mapa" fallback={null}>
            {shouldMountUnits ? (
              <Suspense
                fallback={
                  <section
                    id="unidades"
                    className="min-h-[540px] border-t border-border bg-card py-16"
                  />
                }
              >
                <UnitsMapSection
                  units={data.seo?.units || []}
                  mapsActive={data.maps_config?.active ?? true}
                  mapsApiKey={data.maps_config?.api_key || ''}
                  language={language}
                  renderEyebrow={() => (
                    <EditableText
                      as="p"
                      textKey="units_eyebrow"
                      defaultText={unitsEyebrow.defaultText}
                      entry={unitsEyebrow.entry}
                      isEditMode={isEditMode}
                      onCommit={handleCommitText}
                      className="text-xs font-bold uppercase tracking-widest text-brand-text"
                    />
                  )}
                  renderTitle={() => (
                    <EditableText
                      as="h2"
                      textKey="units_title"
                      defaultText={unitsTitle.defaultText}
                      entry={unitsTitle.entry}
                      isEditMode={isEditMode}
                      onCommit={handleCommitText}
                      className="mt-1 block text-2xl font-bold tracking-tight text-ink sm:text-3xl"
                    />
                  )}
                  renderSubtitle={() => (
                    <EditableText
                      as="p"
                      textKey="units_subtitle"
                      defaultText={unitsSubtitle.defaultText}
                      entry={unitsSubtitle.entry}
                      isEditMode={isEditMode}
                      onCommit={handleCommitText}
                      className="mt-1.5 block text-sm text-ink-muted"
                    />
                  )}
                />
              </Suspense>
            ) : (
              <section
                id="unidades"
                className="min-h-[540px] border-t border-border bg-card py-16"
              >
                <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-text">
                    {unitsEyebrow.entry?.text || unitsEyebrow.defaultText}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                    {unitsTitle.entry?.text || unitsTitle.defaultText}
                  </h2>
                  <p className="mt-1.5 text-sm text-ink-muted">
                    {unitsSubtitle.entry?.text || unitsSubtitle.defaultText}
                  </p>
                </div>
              </section>
            )}
          </ErrorBoundary>
        );
      }

      case 'footer': {
        const footerSocial = getLocalizedContent('footer_social_label');
        const footerHoursTitle = getLocalizedContent('footer_hours_title');
        const footerHoursWeekdays = getLocalizedContent('footer_hours_weekdays');
        const footerHoursSaturday = getLocalizedContent('footer_hours_saturday');
        const footerPoliciesTitle = getLocalizedContent('footer_policies_title');
        const footerDisclaimer = getLocalizedContent('footer_disclaimer');
        const footerSlogan = getLocalizedContent('footer_slogan');
        const footerCredits = getLocalizedContent('footer_credits');
        return (
          <footer className="border-t border-border bg-surface text-ink-muted">
            <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                {/* Coluna 1: Logo + Redes + Tema escuro */}
                <div>
                  <div className="inline-flex items-center gap-3">
                    {effectiveLogoUrl && !logoLoadFailed ? (
                      <img
                        src={effectiveLogoUrl}
                        alt={data.seo.logo_alt || 'RODALEVE'}
                        width={147}
                        height={36}
                        loading="lazy"
                        decoding="async"
                        onError={() => setLogoLoadFailed(true)}
                        className="h-9 w-auto object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <EditableText
                        textKey="footer_brand_text"
                        defaultText={DEFAULT_SITE_CONTENT.footer_brand_text}
                        entry={vbConfig.siteContent.footer_brand_text}
                        isEditMode={isEditMode}
                        onCommit={handleCommitText}
                        className="font-display text-2xl font-extrabold tracking-tight text-brand-text"
                      />
                    )}
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() =>
                          setImageModal({
                            kind: 'logo',
                            title: 'Logo Principal (Cabeçalho e Rodapé)',
                            currentUrl: effectiveLogoUrl,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1 text-[11px] font-bold text-on-ink hover:bg-brand hover:text-on-brand"
                      >
                        <ImageIcon className="h-3 w-3" />
                        Trocar Imagem
                      </button>
                    )}
                  </div>
                  <EditableText
                    as="p"
                    textKey="footer_social_label"
                    defaultText={footerSocial.defaultText}
                    entry={footerSocial.entry}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="mt-3 block text-sm text-ink-muted"
                  />
                  <div className="mt-2.5 flex items-center gap-3">
                    <a
                      href={data.seo.instagram_url || 'https://instagram.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram Rodaleve"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-[#E1306C]/50 hover:shadow-sm"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                        <defs>
                          <linearGradient id="rodaleve-ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#F58529" />
                            <stop offset="35%" stopColor="#DD2A7B" />
                            <stop offset="70%" stopColor="#8134AF" />
                            <stop offset="100%" stopColor="#515BD4" />
                          </linearGradient>
                        </defs>
                        <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#rodaleve-ig-grad)" />
                        <rect
                          x="5.5"
                          y="5.5"
                          width="13"
                          height="13"
                          rx="3.6"
                          fill="none"
                          stroke="#FFFFFF"
                          strokeWidth="1.7"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3.1"
                          fill="none"
                          stroke="#FFFFFF"
                          strokeWidth="1.7"
                        />
                        <circle cx="15.8" cy="8.2" r="0.95" fill="#FFFFFF" />
                      </svg>
                    </a>
                    <a
                      href={data.seo.youtube_url || 'https://youtube.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="YouTube Rodaleve"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-[#FF0000]/50 hover:shadow-sm"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#FF0000"
                          d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58Z"
                        />
                        <path fill="#FFFFFF" d="M9.75 15.02 15.5 12 9.75 8.98v6.04Z" />
                      </svg>
                    </a>
                    <a
                      href={
                        data.seo.facebook_url ||
                        'https://www.facebook.com/concessionariarodaleve/'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook Rodaleve"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-[#1877F2]/50 hover:shadow-sm"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" fill="#1877F2" />
                        <path
                          fill="#FFFFFF"
                          d="M15.12 12.78l.45-2.9h-2.78V8c0-.8.39-1.57 1.64-1.57h1.27V3.96s-1.15-.2-2.26-.2c-2.3 0-3.81 1.4-3.81 3.92v2.2H7.08v2.9h2.55v7.02a10.2 10.2 0 0 0 3.16 0v-7.02h2.33Z"
                        />
                      </svg>
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleDarkMode}
                    className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                  >
                    {darkMode ? (
                      <>
                        <Sun className="h-3.5 w-3.5" />
                        {dict.lightTheme}
                      </>
                    ) : (
                      <>
                        <Moon className="h-3.5 w-3.5" />
                        {dict.darkTheme}
                      </>
                    )}
                  </button>
                </div>

                {/* Coluna 2: Horários de Funcionamento */}
                <div>
                  <EditableText
                    as="h3"
                    textKey="footer_hours_title"
                    defaultText={footerHoursTitle.defaultText}
                    entry={footerHoursTitle.entry}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="text-sm font-bold text-ink"
                  />
                  <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
                    <li>
                      <EditableText
                        textKey="footer_hours_weekdays"
                        defaultText={footerHoursWeekdays.defaultText}
                        entry={footerHoursWeekdays.entry}
                        isEditMode={isEditMode}
                        onCommit={handleCommitText}
                      />
                    </li>
                    <li>
                      <EditableText
                        textKey="footer_hours_saturday"
                        defaultText={footerHoursSaturday.defaultText}
                        entry={footerHoursSaturday.entry}
                        isEditMode={isEditMode}
                        onCommit={handleCommitText}
                      />
                    </li>
                    <li className="pt-1 font-semibold text-ink">
                      WhatsApp:{' '}
                      <a
                        href={buildWhatsAppUrl(primaryWhatsAppNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() =>
                          trackAllPixelsLeadContact(
                            data.seo,
                            {
                              content_name: 'WhatsApp Rodapé',
                            },
                            data.tracking_config
                          )
                        }
                        className="tabular-nums text-brand-text hover:underline"
                      >
                        {primaryWhatsAppNumber}
                      </a>
                    </li>
                  </ul>
                </div>

                {/* Coluna 3: Políticas e Termos */}
                <div>
                  <EditableText
                    as="h3"
                    textKey="footer_policies_title"
                    defaultText={footerPoliciesTitle.defaultText}
                    entry={footerPoliciesTitle.entry}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="text-sm font-bold text-ink"
                  />
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <button
                      type="button"
                      onClick={() => setLegalModal('privacy')}
                      className="text-ink-muted underline-offset-4 hover:text-brand-text hover:underline"
                    >
                      {dict.privacyPolicy}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLegalModal('terms')}
                      className="text-ink-muted underline-offset-4 hover:text-brand-text hover:underline"
                    >
                      {dict.termsOfUse}
                    </button>
                  </div>
                  <EditableText
                    as="p"
                    textKey="footer_disclaimer"
                    defaultText={footerDisclaimer.defaultText}
                    entry={footerDisclaimer.entry}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="mt-3 block text-xs leading-relaxed text-ink-muted"
                  />
                </div>
              </div>

              {/* Faixa inferior */}
              <div className="mt-10 grid grid-cols-1 items-center gap-3 border-t border-border pt-6 text-center text-xs text-ink-muted sm:grid-cols-3">
                <div className="sm:text-left">
                  <EditableText
                    as="p"
                    textKey="footer_slogan"
                    defaultText={footerSlogan.defaultText}
                    entry={footerSlogan.entry}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="font-bold tracking-wide text-ink"
                  />
                </div>
                <div className="flex justify-center">
                  <FooterClock />
                </div>
                <p className="sm:text-right">
                  <EditableText
                    textKey="footer_credits"
                    defaultText={footerCredits.defaultText}
                    entry={
                      language === 'pt'
                        ? vbConfig.siteContent?.footer_credits
                          ? {
                              ...vbConfig.siteContent.footer_credits,
                              text:
                                (vbConfig.siteContent.footer_credits.text || '')
                                  .replace(/\s*Zarvic Marketing\s*[–-]?\s*/gi, '')
                                  .trim() || DEFAULT_SITE_CONTENT.footer_credits,
                            }
                          : undefined
                        : footerCredits.entry
                    }
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                  />{' '}
                  <a
                    href="https://api.whatsapp.com/send?phone=5577981677591&text=Ola%20tudo%20bem%20Vi%20o%20site%20da%20Rodaleve%20e%20achei%20muito%20bem%20estruturado%20Tenho%20um%20negocio%20e%20gostaria%20de%20solicitar%20um%20orcamento%20para%20criar%20um%20site%20completo%20para%20a%20minha%20empresa%20Podemos%20conversar%20sobre%20possibilidades%20prazos%20e%20valores"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-ink-muted underline-offset-4 transition-colors hover:text-brand-text hover:underline"
                  >
                    Zarvic Marketing
                  </a>
                  {isAdminLoggedIn && (
                    <>
                      {' · '}
                      <a
                        href="/gestor"
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate('/gestor');
                        }}
                        className="font-semibold text-ink-muted underline-offset-4 hover:text-brand-text hover:underline"
                      >
                        {dict.gestorLink}
                      </a>
                    </>
                  )}
                </p>
              </div>
            </div>
          </footer>
        );
      }

      case 'custom': {
        const custom = block.customData;
        if (!custom) return null;
        const isRed = custom.theme === 'red';
        const isGray = custom.theme === 'gray';
        const customSectionHtml = vbConfig.htmlOverrides?.[`section_html_${block.id}`]?.trim();
        return (
          <section className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6">
            <div
              className={`overflow-hidden rounded-2xl border p-6 sm:p-8 ${
                isRed
                  ? 'border-brand bg-brand text-on-brand'
                  : isGray
                    ? 'border-border bg-surface-neutral text-ink'
                    : 'border-border bg-card text-ink'
              }`}
            >
              <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                {customSectionHtml ? (
                  <SafeHtml
                    html={customSectionHtml}
                    className={`min-w-0 flex-1 space-y-2 text-sm leading-relaxed [&_a]:underline ${
                      isRed ? 'text-on-brand' : 'text-ink [&_a]:text-brand-text'
                    }`}
                  />
                ) : (
                <div className="flex-1 space-y-2">
                  {custom.badge !== undefined && (
                    <EditableText
                      as="p"
                      textKey={`custom_badge_${block.id}`}
                      defaultText={custom.badge}
                      entry={vbConfig.siteContent[`custom_badge_${block.id}`]}
                      isEditMode={isEditMode}
                      onCommit={handleCommitText}
                      className={`text-xs font-bold uppercase tracking-widest ${
                        isRed ? 'text-on-brand' : 'text-brand-text'
                      }`}
                    />
                  )}
                  <EditableText
                    as="h2"
                    textKey={`custom_title_${block.id}`}
                    defaultText={custom.title}
                    entry={vbConfig.siteContent[`custom_title_${block.id}`]}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="block font-display text-2xl font-extrabold tracking-tight"
                  />
                  <EditableText
                    as="p"
                    textKey={`custom_body_${block.id}`}
                    defaultText={custom.body}
                    entry={vbConfig.siteContent[`custom_body_${block.id}`]}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className={`block text-sm leading-relaxed ${
                      isRed ? 'text-on-brand' : 'text-ink-muted'
                    }`}
                  />
                  {custom.cta_label && (
                    <div className="pt-2">
                      <a
                        href={custom.cta_url || buildWhatsAppUrl(primaryWhatsAppNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          if (isEditMode) e.preventDefault();
                        }}
                        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition-colors ${
                          isRed
                            ? 'bg-card text-brand-text hover:bg-surface'
                            : 'bg-brand text-on-brand hover:bg-brand-hover'
                        }`}
                      >
                        <EditableText
                          textKey={`custom_cta_${block.id}`}
                          defaultText={custom.cta_label}
                          entry={vbConfig.siteContent[`custom_cta_${block.id}`]}
                          isEditMode={isEditMode}
                          onCommit={handleCommitText}
                        />
                      </a>
                    </div>
                  )}
                </div>
                )}

                {(custom.image_url || isEditMode) && (
                  <div className="relative flex w-full shrink-0 flex-col items-center justify-center md:w-64">
                    {custom.image_url ? (
                      <img
                        src={custom.image_url}
                        alt={custom.title}
                        width={512}
                        height={352}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="max-h-44 w-full rounded-xl object-contain"
                      />
                    ) : (
                      isEditMode && (
                        <div className="flex h-28 w-full items-center justify-center rounded-xl border border-dashed border-current/30 text-xs opacity-70">
                          Imagem opcional
                        </div>
                      )
                    )}
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() =>
                          setImageModal({
                            kind: 'custom_block',
                            blockId: block.id,
                            title: `Imagem do bloco "${block.label}"`,
                            currentUrl: custom.image_url || '',
                          })
                        }
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-on-ink shadow hover:bg-brand hover:text-on-brand"
                      >
                        <ImageIcon className="h-3 w-3" />
                        Trocar Imagem
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      }

      default:
        return null;
    }
  };

  return (
    <HtmlEditorProvider
      value={{
        isHtmlEditMode: activeHtmlEditMode,
        htmlOverrides: vbConfig.htmlOverrides || {},
        onOpenHtmlEditor: (key, text) => openHtmlModalForKey(key, text),
      }}
    >
      <div
        className={`min-h-screen transition-colors ${
          isEditMode || activeHtmlEditMode
            ? 'bg-surface-neutral pt-[54px]'
            : 'bg-surface text-ink'
        }`}
      >
        {/* Visual Editor Fixed Top Toolbar */}
        {isEditMode && (
          <Suspense fallback={null}>
            <VisualEditorToolbar
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              viewport={viewport}
              saving={savingVisual}
              hasUnsavedChanges={hasUnsavedChanges}
              autoSaveEnabled={autoSaveEnabled}
              autoSaveStatus={autoSaveStatus}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onChangeViewport={setViewport}
              onOpenAddBlock={() => {
                setAddBlockAfterIndex(null);
                setIsAddBlockOpen(true);
              }}
              onEditFavicon={() =>
                setImageModal({
                  kind: 'favicon',
                  title: 'Favicon do Site (ícone da aba)',
                  currentUrl: effectiveFaviconUrl,
                })
              }
              onRestoreDefaultOrder={handleRestoreDefaultOrder}
              onRestoreDefault={handleRestoreDefault}
              onBackToGestor={onExitEditModeToGestor}
              onSaveAndPublish={handleSaveAndPublish}
            />
          </Suspense>
        )}

        {/* In-Page HTML Editor Fixed Top Toolbar (Admin Only) */}
        {activeHtmlEditMode && (
          <div className="fixed inset-x-0 top-0 z-50 border-b border-border/30 bg-[#111827]/95 text-white shadow-xl backdrop-blur">
            <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-5">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-lg border border-brand/40 bg-brand/20 px-2.5 py-1.5 text-xs font-bold text-white">
                  <Code2 className="h-3.5 w-3.5 text-brand" />
                  <span>Modo Edição HTML na Página</span>
                </div>
                <span className="hidden text-xs text-white/75 md:inline">
                  Clique em qualquer texto, aviso, seção ou modelo do site para editar o HTML e salvar na hora.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onExitHtmlEditModeToGestor
                      ? onExitHtmlEditModeToGestor()
                      : onNavigate('/gestor?tab=editor_html')
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Editor HTML no Gestor
                </button>
                <button
                  type="button"
                  onClick={() => (onExitHtmlEditMode ? onExitHtmlEditMode() : onNavigate('/'))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
                >
                  <X className="h-3.5 w-3.5" />
                  Sair do Modo HTML
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Main Preview Canvas (switches width smoothly between Desktop and Mobile in edit mode) */}
      <div
        className={
          isEditMode && viewport === 'mobile'
            ? 'mx-auto my-6 max-w-[390px] overflow-x-hidden rounded-[28px] border-4 border-ink bg-surface text-ink shadow-2xl'
            : 'min-h-screen bg-surface text-ink'
        }
      >
        {/* 1. Cabeçalho fixo no topo com Glassmorphism */}
        <header
          className={`${
            isEditMode ? 'relative' : 'sticky top-0'
          } z-50 w-full border-b border-border bg-card/85 backdrop-blur-md transition-shadow duration-200 ${
            isScrolled && !isEditMode ? 'shadow-sm' : ''
          }`}
        >
          <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  if (!isEditMode) handleNavClick('revisoes');
                }}
                className="flex items-center gap-2"
              >
                {effectiveLogoUrl && !logoLoadFailed ? (
                  <img
                    src={effectiveLogoUrl}
                    alt={data.seo.logo_alt || 'RODALEVE'}
                    width={131}
                    height={32}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    onError={() => setLogoLoadFailed(true)}
                    className="h-8 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <EditableText
                    textKey="header_brand_text"
                    defaultText={DEFAULT_SITE_CONTENT.header_brand_text}
                    entry={vbConfig.siteContent.header_brand_text}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="font-display text-xl font-extrabold tracking-tight text-brand-text"
                  />
                )}
              </a>
              {isEditMode && (
                <button
                  type="button"
                  onClick={() =>
                    setImageModal({
                      kind: 'logo',
                      title: 'Logo Principal do Site',
                      currentUrl: effectiveLogoUrl,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-neutral px-2 py-1 text-[10px] font-bold text-ink hover:bg-brand hover:text-on-brand"
                >
                  <ImageIcon className="h-3 w-3" />
                  Trocar Imagem
                </button>
              )}
            </div>

            <nav className="hidden items-center gap-6 md:flex">
              {(() => {
                const navRev = getLocalizedContent('nav_revisions');
                const navCalc = getLocalizedContent('nav_calculator');
                const navFaq = getLocalizedContent('nav_faq');
                const navUnits = getLocalizedContent('nav_units');
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => handleNavClick('revisoes')}
                      className={`whitespace-nowrap border-b-2 py-5 text-sm font-semibold transition-colors ${
                        activeNav === 'revisoes' && heroTab === 'tabela'
                          ? 'border-brand text-ink'
                          : 'border-transparent text-ink-muted hover:text-ink'
                      }`}
                    >
                      <EditableText
                        textKey="nav_revisions"
                        defaultText={navRev.defaultText}
                        entry={navRev.entry}
                        isEditMode={isEditMode}
                        onCommit={handleCommitText}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('calculadora')}
                      className={`whitespace-nowrap border-b-2 py-5 text-sm font-semibold transition-colors ${
                        activeNav === 'calculadora' || heroTab === 'calculadora'
                          ? 'border-brand text-ink'
                          : 'border-transparent text-ink-muted hover:text-ink'
                      }`}
                    >
                      <EditableText
                        textKey="nav_calculator"
                        defaultText={navCalc.defaultText}
                        entry={navCalc.entry}
                        isEditMode={isEditMode}
                        onCommit={handleCommitText}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('faq')}
                      className={`whitespace-nowrap border-b-2 py-5 text-sm font-semibold transition-colors ${
                        activeNav === 'faq' || heroTab === 'faq'
                          ? 'border-brand text-ink'
                          : 'border-transparent text-ink-muted hover:text-ink'
                      }`}
                    >
                      <EditableText
                        textKey="nav_faq"
                        defaultText={navFaq.defaultText}
                        entry={navFaq.entry}
                        isEditMode={isEditMode}
                        onCommit={handleCommitText}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavClick('unidades')}
                      className={`whitespace-nowrap border-b-2 py-5 text-sm font-semibold transition-colors ${
                        activeNav === 'unidades'
                          ? 'border-brand text-ink'
                          : 'border-transparent text-ink-muted hover:text-ink'
                      }`}
                    >
                      <EditableText
                        textKey="nav_units"
                        defaultText={navUnits.defaultText}
                        entry={navUnits.entry}
                        isEditMode={isEditMode}
                        onCommit={handleCommitText}
                      />
                    </button>
                  </>
                );
              })()}
            </nav>

            <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
              <LanguageSelector language={language} onChange={onChangeLanguage} />
              <a
                href={buildWhatsAppUrl(primaryWhatsAppNumber)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (isEditMode) {
                    e.preventDefault();
                    return;
                  }
                  trackAllPixelsLeadContact(
                    data.seo,
                    {
                      content_name: 'Botão Agendar Revisão (Header)',
                    },
                    data.tracking_config
                  );
                }}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-brand to-brand-hover px-3.5 py-2 text-xs font-bold text-on-brand shadow-sm transition-all hover:from-brand-hover hover:to-brand-hover sm:px-5 sm:py-2.5 sm:text-sm"
              >
                <WhatsAppIcon className="h-4 w-4 shrink-0" />
                {(() => {
                  const headerCta = getLocalizedContent('header_cta');
                  return (
                    <EditableText
                      textKey="header_cta"
                      defaultText={headerCta.defaultText}
                      entry={headerCta.entry}
                      isEditMode={isEditMode}
                      onCommit={handleCommitText}
                    />
                  );
                })()}
              </a>
            </div>
          </div>

          {/* Navegação mobile compacta dentro do header glass */}
          <nav className="flex items-center justify-around border-t border-border px-2 md:hidden">
            <button
              type="button"
              onClick={() => handleNavClick('revisoes')}
              className={`whitespace-nowrap border-b-2 px-1.5 py-2 text-xs font-semibold transition-colors ${
                activeNav === 'revisoes' && heroTab === 'tabela'
                  ? 'border-brand text-ink'
                  : 'border-transparent text-ink-muted'
              }`}
            >
              {getLocalizedContent('nav_revisions').entry?.text ||
                getLocalizedContent('nav_revisions').defaultText}
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('calculadora')}
              className={`whitespace-nowrap border-b-2 px-1.5 py-2 text-xs font-semibold transition-colors ${
                activeNav === 'calculadora' || heroTab === 'calculadora'
                  ? 'border-brand text-ink'
                  : 'border-transparent text-ink-muted'
              }`}
            >
              {getLocalizedContent('nav_calculator').entry?.text ||
                getLocalizedContent('nav_calculator').defaultText}
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('faq')}
              className={`whitespace-nowrap border-b-2 px-1.5 py-2 text-xs font-semibold transition-colors ${
                activeNav === 'faq' || heroTab === 'faq'
                  ? 'border-brand text-ink'
                  : 'border-transparent text-ink-muted'
              }`}
            >
              {getLocalizedContent('nav_faq').entry?.text ||
                getLocalizedContent('nav_faq').defaultText}
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('unidades')}
              className={`whitespace-nowrap border-b-2 px-1.5 py-2 text-xs font-semibold transition-colors ${
                activeNav === 'unidades'
                  ? 'border-brand text-ink'
                  : 'border-transparent text-ink-muted'
              }`}
            >
              {getLocalizedContent('nav_units').entry?.text ||
                getLocalizedContent('nav_units').defaultText}
            </button>
          </nav>
        </header>

        {/* Render Dynamic Section Blocks */}
        {vbConfig.sections.map((block, index) => {
          const content = renderSectionContent(block);
          if (!content && !isEditMode) return null;
          const isDropTarget =
            dragOverSectionTarget && dragOverSectionTarget.index === index;
          const sectionCustomHtml =
            block.type !== 'custom' && block.id !== 'notice_box'
              ? vbConfig.htmlOverrides?.[`section_html_${block.id}`]?.trim()
              : undefined;
          return (
            <SectionEditorWrapper
              key={block.id}
              block={block}
              index={index}
              total={vbConfig.sections.length}
              isEditMode={isEditMode}
              isDraggingSelf={dragSectionIdx === index}
              dropPosition={isDropTarget ? dragOverSectionTarget.position : null}
              onDragStart={(idx) => setDragSectionIdx(idx)}
              onDragOver={(_e, idx, position) =>
                setDragOverSectionTarget((prev) =>
                  prev && prev.index === idx && prev.position === position
                    ? prev
                    : { index: idx, position }
                )
              }
              onDragEnd={() => {
                setDragSectionIdx(null);
                setDragOverSectionTarget(null);
              }}
              onDrop={(idx, position) => {
                if (dragSectionIdx !== null) {
                  moveSectionByDrop(dragSectionIdx, idx, position);
                }
                setDragSectionIdx(null);
                setDragOverSectionTarget(null);
              }}
              onMoveUp={(idx) => moveSection(idx, idx - 1)}
              onMoveDown={(idx) => moveSection(idx, idx + 1)}
              onToggleVisibility={toggleSectionVisibility}
              onDuplicate={duplicateSection}
              onInsertBelow={(idx) => {
                setAddBlockAfterIndex(idx);
                setIsAddBlockOpen(true);
              }}
              onDelete={deleteSection}
            >
              {activeHtmlEditMode && (
                <div className="mx-auto flex max-w-[1180px] justify-end px-4 pt-2 sm:px-6">
                  <button
                    type="button"
                    onClick={() =>
                      openHtmlModalForKey(
                        `section_html_${block.id}`,
                        buildSectionDefaultHtml(block, vbConfig)
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand-soft px-3 py-1 text-[11px] font-bold text-brand-text shadow-xs transition-colors hover:bg-brand hover:text-on-brand"
                  >
                    <Code2 className="h-3 w-3" />
                    Editar HTML da Seção: {block.label}
                  </button>
                </div>
              )}
              {sectionCustomHtml && (
                <div className="mx-auto max-w-[1180px] px-4 pt-4 sm:px-6">
                  <SafeHtml
                    html={sectionCustomHtml}
                    onClick={
                      activeHtmlEditMode
                        ? () =>
                            openHtmlModalForKey(
                              `section_html_${block.id}`,
                              buildSectionDefaultHtml(block, vbConfig)
                            )
                        : undefined
                    }
                    className={`text-sm leading-relaxed text-ink [&_a]:text-brand-text [&_a]:underline ${
                      activeHtmlEditMode
                        ? 'cursor-pointer rounded-xl outline-2 outline-dashed outline-brand/50 hover:outline-brand'
                        : ''
                    }`}
                  />
                </div>
              )}
              {content}
            </SectionEditorWrapper>
          );
        })}
      </div>

      {/* Botão flutuante e arrastável do WhatsApp */}
      <FloatingWhatsApp
        href={buildWhatsAppUrl(primaryWhatsAppNumber)}
        isEditMode={isEditMode}
        ariaLabel={dict.floatingWhatsAppAria}
        titleText={dict.floatingWhatsAppTitle}
        onTrackClick={() =>
          trackAllPixelsLeadContact(
            data.seo,
            {
              content_name: 'Botão Flutuante WhatsApp',
            },
            data.tracking_config
          )
        }
      />

      {/* Modal rápido de escolha de unidade para agendamento via WhatsApp */}
      {scheduleTarget && (
        <Suspense fallback={null}>
          <WhatsAppScheduleModal
            model={scheduleTarget.model}
            revisionNumber={scheduleTarget.revisionNumber ?? selectedRevision}
            revisionLabel={scheduleTarget.revisionLabel ?? revisionLabel}
            revisionSubtitle={scheduleTarget.revisionSubtitle ?? revisionSubtitle}
            summary={scheduleTarget.summary}
            initialIncludeOptionals={scheduleTarget.includeOptionals}
            units={data.seo?.units || []}
            language={language}
            darkMode={darkMode}
            calculatorContext={scheduleTarget.calculatorContext}
            onClose={() => setScheduleTarget(null)}
            onTrackLead={(unitName) =>
              trackAllPixelsLeadContact(
                data.seo,
                {
                  content_name: `${
                    scheduleTarget.calculatorContext?.modelLabel || scheduleTarget.model.name
                  } - ${scheduleTarget.revisionLabel ?? revisionLabel}`,
                  content_category: unitName,
                },
                data.tracking_config
              )
            }
          />
        </Suspense>
      )}

      {/* Botão flutuante discreto visível EXCLUSIVAMENTE para o administrador autenticado */}
      {isAdminLoggedIn && !isEditMode && !activeHtmlEditMode && (
        <div className="fixed bottom-5 right-5 z-40 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/gestor')}
            className="rounded-full border border-border bg-card/95 px-3.5 py-2 text-xs font-semibold text-ink shadow-md backdrop-blur transition-colors hover:bg-surface"
          >
            Gestor
          </button>
          <button
            type="button"
            onClick={() =>
              onEnterHtmlEditMode ? onEnterHtmlEditMode() : onNavigate('/?html_editor=1')
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft px-3.5 py-2 text-xs font-bold text-brand-text shadow-md backdrop-blur transition-colors hover:bg-brand hover:text-on-brand"
          >
            <Code2 className="h-3.5 w-3.5" />
            Editar HTML na Página
          </button>
          <button
            type="button"
            onClick={onEnterEditMode}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-bold text-on-ink shadow-lg backdrop-blur transition-all hover:bg-brand hover:text-on-brand"
          >
            <Paintbrush className="h-3.5 w-3.5" />
            Editar Site Visualmente
          </button>
        </div>
      )}

      {/* Modal do Editor HTML na Página (apenas admin autenticado) */}
      {isAdminLoggedIn && htmlModalTarget && (
        <Suspense fallback={null}>
          <HtmlEditorModal
            target={htmlModalTarget}
            saving={savingHtmlModal}
            onClose={() => !savingHtmlModal && setHtmlModalTarget(null)}
            onSave={handleSaveHtmlOverride}
            onReset={handleResetHtmlOverride}
          />
        </Suspense>
      )}

      {/* Visual Editor Toast */}
      {visualToast && (
        <div
          className={`fixed right-5 top-16 z-50 rounded-xl border px-4 py-2.5 text-xs font-bold shadow-xl ${
            visualToast.type === 'success'
              ? 'border-border bg-card text-ink'
              : 'border-brand bg-brand-soft text-brand-text'
          }`}
        >
          {visualToast.msg}
        </div>
      )}

      {/* Modais do Editor Visual */}
      {isAddBlockOpen && (
        <Suspense fallback={null}>
          <AddBlockModal
            onSelect={handleInsertCustomBlock}
            onClose={() => {
              setIsAddBlockOpen(false);
              setAddBlockAfterIndex(null);
            }}
          />
        </Suspense>
      )}

      {imageModal && (
        <Suspense fallback={null}>
          <ImageSwapModal
            title={imageModal.title}
            currentUrl={imageModal.currentUrl}
            onClose={() => setImageModal(null)}
            onApply={(nextUrl) => {
              if (imageModal.kind === 'logo') {
                setPendingLogoUrl(nextUrl);
                commitVisualChange((prev) => ({
                  ...prev,
                  imageOverrides: { ...prev.imageOverrides, site_logo: nextUrl },
                }));
              } else if (imageModal.kind === 'favicon') {
                setPendingFaviconUrl(nextUrl);
                commitVisualChange((prev) => ({
                  ...prev,
                  imageOverrides: { ...prev.imageOverrides, site_favicon: nextUrl },
                }));
              } else if (imageModal.kind === 'model') {
                const targetModelId = imageModal.modelId;
                setPendingModelImageById((prev) => ({ ...prev, [targetModelId]: nextUrl }));
                commitVisualChange((prev) => ({
                  ...prev,
                  imageOverrides: {
                    ...prev.imageOverrides,
                    [`model_${targetModelId}`]: nextUrl,
                  },
                }));
              } else if (imageModal.kind === 'custom_block') {
                updateCustomBlockData(imageModal.blockId, { image_url: nextUrl });
              }
            }}
          />
        </Suspense>
      )}

      {/* Modal Políticas e Termos */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px]">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h4 className="font-display text-lg font-bold text-ink">
                {legalModal === 'privacy' ? dict.privacyPolicy : dict.termsOfUse}
              </h4>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="rounded-lg p-1 text-ink-muted hover:bg-surface"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-muted">
              {legalModal === 'privacy' ? (
                <>
                  <p>{dict.privacyParagraph1}</p>
                  <p>{dict.privacyParagraph2}</p>
                </>
              ) : (
                <>
                  <p>{dict.termsParagraph1}</p>
                  <p>{dict.termsParagraph2}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </HtmlEditorProvider>
  );
}
