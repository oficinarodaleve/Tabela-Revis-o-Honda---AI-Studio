import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Facebook,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Instagram,
  LayoutGrid,
  List,
  MapPin,
  Moon,
  Paintbrush,
  Search,
  Sun,
  Wrench,
  X,
  Youtube,
} from 'lucide-react';
import {
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
  ComputedRevisionSummary,
  computeModelRevision,
  formatBRL,
  formatPartQuantity,
} from '../utils/pricing';
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
import { FloatingWhatsApp } from './FloatingWhatsApp';
import { LanguageSelector } from './LanguageSelector';
import { UnitsMapSection } from './UnitsMapSection';
import {
  WhatsAppIcon,
  buildWhatsAppHref,
  getUnitWhatsAppNumber,
} from './WhatsAppIcon';
import { WhatsAppScheduleModal } from './WhatsAppScheduleModal';
import { AddBlockModal } from './editor/AddBlockModal';
import { EditableText } from './editor/EditableText';
import { ImageSwapModal } from './editor/ImageSwapModal';
import { DropPosition, SectionEditorWrapper } from './editor/SectionEditorWrapper';
import { VisualEditorToolbar } from './editor/VisualEditorToolbar';
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
  onEnterEditMode: () => void;
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
      className="block text-center text-xs font-normal text-neutral-500 tabular-nums dark:text-neutral-400"
    >
      {formatFooterDateTimeBR(now)}
    </time>
  );
}

type ActiveImageModalTarget =
  | { kind: 'logo'; title: string; currentUrl: string }
  | { kind: 'favicon'; title: string; currentUrl: string }
  | { kind: 'model'; modelId: number; title: string; currentUrl: string }
  | { kind: 'custom_block'; blockId: string; title: string; currentUrl: string };

export function PublicPage({
  data,
  language,
  onChangeLanguage,
  darkMode,
  onToggleDarkMode,
  onNavigate,
  isAdminLoggedIn,
  isEditMode,
  onEnterEditMode,
  onExitEditModeToGestor,
  onPublicDataChanged,
}: PublicPageProps) {
  const dict = UI_TRANSLATIONS[language];
  const [activeNav, setActiveNav] = useState<'revisoes' | 'faq' | 'unidades'>('revisoes');
  const [heroTab, setHeroTab] = useState<'tabela' | 'faq'>('tabela');
  const [selectedRevision, setSelectedRevision] = useState<number>(
    data.revision_tabs?.[0]?.revision_number ?? 1
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAllModels, setShowAllModels] = useState(false);
  const [highlightedModelId, setHighlightedModelId] = useState<number | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<{
    model: MotoModel;
    summary: ComputedRevisionSummary;
    includeOptionals: boolean;
  } | null>(null);
  const [openFaqId, setOpenFaqId] = useState<number | null>(data.faqs?.[0]?.id ?? null);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Pixels, Tags (GTM, GA4, Google Ads, Meta Pixel, TikTok Pixel): injeção única no site público
  useEffect(() => {
    if (!isEditMode) {
      try {
        initAllTrackingPixels(data.seo, data.tracking_config);
      } catch {
        // Ignore tracking script errors so the public page never fails to render
      }
    }
  }, [data.seo, data.tracking_config, isEditMode]);

  // Glassmorphism scroll shadow + scroll-spy de seção ativa na navbar
  useEffect(() => {
    if (isEditMode) return;
    const handleScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 10);

      const unitsEl = document.getElementById('unidades');
      const faqEl = document.getElementById('perguntas-frequentes');
      const unitsTop = unitsEl ? unitsEl.getBoundingClientRect().top : Infinity;
      const faqTop = faqEl ? faqEl.getBoundingClientRect().top : Infinity;

      if (unitsTop <= 190) {
        setActiveNav('unidades');
      } else if (faqTop <= 190 || heroTab === 'faq') {
        setActiveNav('faq');
      } else {
        setActiveNav('revisoes');
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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

  // Modals for visual editor
  const [addBlockAfterIndex, setAddBlockAfterIndex] = useState<number | null>(null);
  const [isAddBlockOpen, setIsAddBlockOpen] = useState(false);
  const [imageModal, setImageModal] = useState<ActiveImageModalTarget | null>(null);

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
      if (isEditMode) {
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
            <strong className="font-bold text-neutral-900 dark:text-white">
              {match[1]}
            </strong>{' '}
            {match[2]}
          </p>
        );
      }
      return <p className="block">{fullText}</p>;
    },
    [getLocalizedContent, handleCommitText, isEditMode]
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
          partsMap
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
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const updateRailScrollState = useCallback(() => {
    const el = railRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  const scrollRailBy = useCallback((direction: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    const step = Math.max(320, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(updateRailScrollState);
    window.addEventListener('resize', updateRailScrollState, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateRailScrollState);
    };
  }, [updateRailScrollState, computedModels.length, viewMode, heroTab]);

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
      setShowAllModels(true);
      setHighlightedModelId(id);
      setTimeout(() => {
        const card = document.getElementById(`model-card-${id}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          const rect = card.getBoundingClientRect();
          if (rect.top < 120 || rect.bottom > window.innerHeight) {
            const topTarget = Math.max(0, window.scrollY + rect.top - 165);
            window.scrollTo({ top: topTarget, behavior: 'smooth' });
          }
        }
        updateRailScrollState();
      }, 90);
      setTimeout(() => {
        setHighlightedModelId((curr) => (curr === id ? null : curr));
      }, 2400);
    },
    [orderedModels, data.seo, data.tracking_config, segmentNameMap, updateRailScrollState]
  );

  const handleNavClick = (target: 'revisoes' | 'faq' | 'unidades') => {
    setActiveNav(target);
    if (target === 'revisoes') {
      setHeroTab('tabela');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'faq') {
      setHeroTab('tabela');
      setTimeout(() => scrollToSection('perguntas-frequentes'), 40);
    } else if (target === 'unidades') {
      scrollToSection('unidades');
    }
  };

  const renderSectionContent = (block: PageSectionBlock) => {
    switch (block.type) {
      case 'hero': {
        const heroEyebrow = getLocalizedContent('hero_eyebrow');
        const heroTitle = getLocalizedContent('hero_title');
        const heroSubtitle = getLocalizedContent('hero_subtitle');
        const heroTabTable = getLocalizedContent('hero_tab_table');
        const heroTabFaq = getLocalizedContent('hero_tab_faq');
        return (
          <section
            id="hero-tabs"
            className="border-b border-neutral-200/70 bg-white py-10 dark:border-neutral-800 dark:bg-neutral-950 sm:py-12"
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
                    className="text-xs font-bold uppercase tracking-widest text-[#E4002B]"
                  />
                  <EditableText
                    as="h1"
                    textKey="hero_title"
                    defaultText={heroTitle.defaultText}
                    entry={heroTitle.entry}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="mt-2 block text-balance font-display text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-4xl lg:text-[42px] lg:leading-[1.12]"
                  />
                  <EditableText
                    as="p"
                    textKey="hero_subtitle"
                    defaultText={heroSubtitle.defaultText}
                    entry={heroSubtitle.entry}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="mt-3 block text-base text-neutral-600 dark:text-neutral-400"
                  />
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
                      setHeroTab('faq');
                      setActiveNav('faq');
                    }}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                      heroTab === 'faq'
                        ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                        : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
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
              className="mb-3 block text-sm font-semibold text-neutral-700 dark:text-neutral-300"
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
                        ? 'border-[#E4002B] bg-[#E4002B] text-white shadow-sm'
                        : 'border-neutral-200 bg-white text-neutral-900 hover:-translate-y-0.5 hover:border-[#E4002B]/75 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:hover:border-[#E4002B]/80'
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
                        isSelected ? 'text-white/90' : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      case 'notice_box':
        if (heroTab !== 'tabela' && !isEditMode) return null;
        return (
          <div className="mx-auto max-w-[1180px] px-4 pt-6 pb-1 sm:px-6 sm:pt-8 sm:pb-2">
            <div className="flex items-start gap-3.5 rounded-2xl border border-neutral-200 bg-neutral-100/80 p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#E4002B]" />
              <div className="space-y-1.5 text-xs leading-relaxed text-neutral-700 sm:text-sm dark:text-neutral-300">
                {renderNoticeParagraph('notice_line_1')}
                {renderNoticeParagraph('notice_line_2')}
              </div>
            </div>
          </div>
        );

      case 'filters_catalog': {
        if (heroTab !== 'tabela' && !isEditMode) return null;
        const canCollapseModels =
          viewMode === 'list' &&
          !isEditMode &&
          !searchQuery.trim() &&
          computedModels.length > 9;
        const visibleModels =
          viewMode === 'grid'
            ? computedModels
            : canCollapseModels && !showAllModels
              ? computedModels.slice(0, 9)
              : computedModels;
        const isFreeLabor = selectedRevision <= 2;

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
              className="mb-3 block text-sm font-semibold text-neutral-700 dark:text-neutral-300"
            />
            {/* Barra horizontal compacta de busca, seleção rápida e filtros */}
            <div
              className="relative -mx-1 rounded-2xl border border-neutral-200/90 bg-white/95 p-2.5 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 sm:mx-0 sm:p-3"
            >
              {/* Linha 1 horizontal: Busca + Ir direto para a moto + Atalhos */}
              <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                <div className="relative min-w-[210px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={dict.searchPlaceholder}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/70 py-2 pl-9 pr-8 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-[#E4002B] focus:bg-white focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white sm:text-sm"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label={dict.clearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <select
                  aria-label={dict.quickSelectPlaceholder}
                  value=""
                  onChange={(e) => handleQuickSelectModel(e.target.value)}
                  className="w-full shrink-0 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 focus:border-[#E4002B] focus:outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 sm:w-auto sm:min-w-[190px]"
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
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:border-[#E4002B] hover:text-[#E4002B] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-[#E4002B]" />
                  {dict.shortcutFaq}
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('unidades')}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:border-[#E4002B] hover:text-[#E4002B] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300"
                >
                  <MapPin className="h-3.5 w-3.5 text-[#E4002B]" />
                  {dict.shortcutUnits}
                </button>
              </div>

              {/* Linha 2 horizontal: Pílulas de segmento + contador + setas do carrossel + alternador grade/lista */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                <div className="no-scrollbar flex max-w-full items-center gap-1.5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedSegment('all')}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      selectedSegment === 'all'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800'
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
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800'
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
                  <span className="whitespace-nowrap text-xs font-medium text-neutral-500 tabular-nums">
                    {dict.showingModels(visibleModels.length, computedModels.length)}
                  </span>

                  {viewMode === 'grid' && computedModels.length > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-950">
                      <button
                        type="button"
                        onClick={() => scrollRailBy(-1)}
                        disabled={!canScrollLeft}
                        aria-label={dict.prevModel}
                        title={dict.scrollModelsLeft}
                        className="rounded-lg p-1.5 text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-[#E4002B] disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollRailBy(1)}
                        disabled={!canScrollRight}
                        aria-label={dict.nextModel}
                        title={dict.scrollModelsRight}
                        className="rounded-lg p-1.5 text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-[#E4002B] disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Grid/List switcher */}
                  <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-950">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      aria-label={dict.gridViewAria}
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
                      aria-label={dict.listViewAria}
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
            </div>

            {/* Trilho horizontal rolável / Lista de cards de motos */}
            {computedModels.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-10 text-center dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-base font-semibold text-neutral-900 dark:text-white">
                  {dict.noModelsTitle}
                </p>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {dict.noModelsDesc}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedSegment('all');
                  }}
                  className="mt-4 rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900"
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
                  className="hidden sm:flex absolute -left-3 top-1/2 z-20 h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-800 shadow-md backdrop-blur transition-all hover:border-[#E4002B] hover:text-[#E4002B] disabled:pointer-events-none disabled:opacity-0 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div
                  ref={railRef}
                  onScroll={updateRailScrollState}
                  className="flex flex-row items-stretch gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 pt-1"
                >
                  {visibleModels.map(({ model, summary, isVisuallyHidden }) => {
                    const categoryLabel = segmentNameMap[model.segment_slug] || 'Street';
                    const revTitleUpper = `${dict.totalOfPrefix} ${revisionLabel.toUpperCase()}`;
                    const includeOptionals = true;
                    const activeTotal = summary.totalWithOptionals;
                    const isHighlighted = highlightedModelId === model.id;

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
                        className={`relative flex w-[285px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-200 dark:bg-neutral-900 sm:w-[318px] md:w-[336px] ${
                          isEditMode && dragOverModelId === model.id
                            ? 'border-[#E4002B] ring-2 ring-[#E4002B]'
                            : isHighlighted
                              ? 'border-[#E4002B] ring-2 ring-[#E4002B]/50 shadow-lg'
                              : 'border-neutral-200 hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800'
                        } ${isVisuallyHidden ? 'opacity-45 grayscale' : ''}`}
                      >
                        {isEditMode && (
                          <div className="flex items-center justify-between gap-1 border-b border-indigo-100 bg-indigo-50/90 px-3 py-1.5 text-[11px] text-indigo-950">
                            <span className="inline-flex cursor-grab items-center gap-1 font-bold active:cursor-grabbing">
                              <GripVertical className="h-3.5 w-3.5 text-indigo-500" />
                              Arrastar card
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveModelCard(model.id, -1)}
                                title="Mover para esquerda"
                                className="rounded bg-white p-1 hover:bg-indigo-100"
                              >
                                <ArrowLeft className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveModelCard(model.id, 1)}
                                title="Mover para direita"
                                className="rounded bg-white p-1 hover:bg-indigo-100"
                              >
                                <ArrowRight className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleModelCardHidden(model.id)}
                                title={isVisuallyHidden ? 'Exibir card' : 'Ocultar card'}
                                className="rounded bg-white p-1 hover:bg-indigo-100"
                              >
                                {isVisuallyHidden ? (
                                  <EyeOff className="h-3 w-3 text-[#E4002B]" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Foto compacta da moto (fundo branco, centralizada) */}
                        <div className="group/img relative flex h-40 w-full items-center justify-center overflow-hidden border-b border-neutral-100 bg-white p-3.5 dark:border-neutral-800 sm:h-44">
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
                          {isEditMode && (
                            <button
                              type="button"
                              onClick={() =>
                                setImageModal({
                                  kind: 'model',
                                  modelId: model.id,
                                  title: `Foto de ${model.name}`,
                                  currentUrl: model.image_url,
                                })
                              }
                              className="absolute inset-x-0 bottom-2 mx-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-neutral-950/85 px-3.5 py-1.5 text-xs font-bold text-white opacity-95 shadow-lg backdrop-blur transition-all hover:bg-[#E4002B] group-hover/img:opacity-100"
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
                              className="truncate font-display text-base font-bold tracking-tight text-neutral-900 dark:text-white sm:text-lg"
                            />
                            <EditableText
                              as="p"
                              textKey={`model_cat_${model.id}`}
                              defaultText={categoryLabel}
                              entry={vbConfig.siteContent[`model_cat_${model.id}`]}
                              isEditMode={isEditMode}
                              onCommit={handleCommitText}
                              className="block text-xs font-medium text-neutral-500 dark:text-neutral-400"
                            />
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-neutral-500 tabular-nums dark:text-neutral-400">
                            {summary.items.length}{' '}
                            {summary.items.length === 1 ? dict.itemSingular : dict.itemPlural}
                          </span>
                        </div>

                        {/* Badges informativos transparentes (Atendimento, Mão de obra e Opcionais) */}
                        <div className="mt-2 flex flex-wrap items-center gap-1 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              isFreeLabor
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            }`}
                          >
                            <Clock className="h-3 w-3 shrink-0" />
                            {isFreeLabor ? dict.walkInBadge : dict.appointmentBadge}
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                            <Wrench className="h-3 w-3 shrink-0 text-[#E4002B]" />
                            {isFreeLabor ? dict.freeLaborBadge : dict.consultLaborBadge}
                          </span>
                        </div>

                        {/* Lista compacta de peças da revisão (altura alinhada no carrossel) */}
                        <div className="mt-2.5 h-[196px] flex-1 overflow-y-auto divide-y divide-neutral-100 px-4 dark:divide-neutral-800">
                          {summary.items.length === 0 ? (
                            <p className="py-6 text-center text-xs text-neutral-400">
                              {dict.noPartsLinked}
                            </p>
                          ) : (
                            summary.items.map(({ revisionPart, part, lineTotal }) => {
                              const dimmedOptional = part.is_optional && !includeOptionals;
                              const translatedDesc = translatePartDescription(
                                part.description,
                                language
                              );
                              return (
                                <div
                                  key={`${revisionPart.id}-${part.code}`}
                                  className={`flex items-start justify-between gap-2.5 py-2 transition-opacity ${
                                    dimmedOptional ? 'opacity-45' : ''
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p
                                      className={`text-xs font-medium leading-snug text-neutral-800 dark:text-neutral-200 ${
                                        dimmedOptional ? 'line-through' : ''
                                      }`}
                                    >
                                      {translatedDesc}
                                      {part.is_optional &&
                                      !translatedDesc.includes('[Opcional]') &&
                                      !translatedDesc.includes('[Optional]') ? (
                                        <span className="ml-1 text-neutral-500">
                                          {dict.optionalTag}
                                        </span>
                                      ) : null}
                                    </p>
                                    <p className="mt-0.5 font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                                      {dict.codePrefix} {part.code}
                                      {(part.unit === 'ML' || revisionPart.quantity > 1) &&
                                        ` · ${formatPartQuantity(part, revisionPart.quantity)}`}
                                    </p>
                                  </div>
                                  <span
                                    className={`shrink-0 text-xs font-bold text-neutral-900 tabular-nums dark:text-white ${
                                      dimmedOptional ? 'line-through' : ''
                                    }`}
                                  >
                                    {formatBRL(lineTotal)}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Rodapé vermelho de destaque */}
                        <div className="mt-2.5 bg-[#E4002B] px-4 py-3 text-white">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-white/95">
                                {revTitleUpper}
                              </p>
                              <p className="text-[10px] text-white/90 tabular-nums">
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
                          className="flex items-center justify-center gap-2 bg-neutral-50 px-4 py-2.5 text-xs font-bold text-neutral-800 transition-colors hover:bg-emerald-50 hover:text-emerald-800 dark:bg-neutral-950/60 dark:text-neutral-200 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366] text-white">
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
                  className="hidden sm:flex absolute -right-3 top-1/2 z-20 h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white/95 text-neutral-800 shadow-md backdrop-blur transition-all hover:border-[#E4002B] hover:text-[#E4002B] disabled:pointer-events-none disabled:opacity-0 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : (
              /* List View */
              <div className="mt-7 space-y-4">
                {visibleModels.map(({ model, summary, isVisuallyHidden }) => {
                  const categoryLabel = segmentNameMap[model.segment_slug] || 'Street';
                  const includeOptionals = true;
                  const activeTotal = summary.totalWithOptionals;
                  const isHighlighted = highlightedModelId === model.id;

                  return (
                    <article
                      id={`model-card-${model.id}`}
                      key={model.id}
                      className={`flex flex-col overflow-hidden rounded-2xl border bg-white dark:bg-neutral-900 md:flex-row ${
                        isHighlighted
                          ? 'border-[#E4002B] ring-2 ring-[#E4002B]/50 shadow-lg'
                          : 'border-neutral-200 dark:border-neutral-800'
                      } ${isVisuallyHidden ? 'opacity-45 grayscale' : ''}`}
                    >
                      <div className="relative flex w-full shrink-0 items-center justify-center bg-white p-5 md:w-60 md:border-r md:border-neutral-100 dark:md:border-neutral-800">
                        <img
                          src={model.image_url}
                          alt={`Honda ${model.name}`}
                          referrerPolicy="no-referrer"
                          className="h-40 w-full object-contain"
                        />
                        {isEditMode && (
                          <button
                            type="button"
                            onClick={() =>
                              setImageModal({
                                kind: 'model',
                                modelId: model.id,
                                title: `Foto de ${model.name}`,
                                currentUrl: model.image_url,
                              })
                            }
                            className="absolute bottom-2 inline-flex items-center gap-1 rounded-full bg-neutral-950/85 px-3 py-1 text-[11px] font-bold text-white shadow hover:bg-[#E4002B]"
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
                              <h2 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
                                {model.name}
                              </h2>
                              <span className="text-xs font-medium text-neutral-500">
                                {categoryLabel}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-neutral-500 tabular-nums">
                              {summary.items.length}{' '}
                              {summary.items.length === 1 ? dict.itemSingular : dict.itemPlural}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                isFreeLabor
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              {isFreeLabor ? dict.walkInBadge : dict.appointmentBadge}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                              <Wrench className="h-3 w-3 text-[#E4002B]" />
                              {isFreeLabor ? dict.freeLaborBadge : dict.consultLaborBadge}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
                            {summary.items.map(({ revisionPart, part, lineTotal }) => {
                              const dimmedOptional = part.is_optional && !includeOptionals;
                              const translatedDesc = translatePartDescription(
                                part.description,
                                language
                              );
                              return (
                                <div
                                  key={`${revisionPart.id}-${part.code}`}
                                  className={`flex items-center justify-between border-b border-neutral-100 py-1.5 text-xs dark:border-neutral-800 ${
                                    dimmedOptional ? 'opacity-45 line-through' : ''
                                  }`}
                                >
                                  <span className="truncate pr-2 text-neutral-700 dark:text-neutral-300">
                                    {translatedDesc}
                                    {part.is_optional &&
                                    !translatedDesc.includes('[Opcional]') &&
                                    !translatedDesc.includes('[Optional]')
                                      ? ` ${dict.optionalTag}`
                                      : ''}
                                    <span className="ml-1.5 font-mono text-[10px] text-neutral-400">
                                      ({part.code})
                                    </span>
                                  </span>
                                  <span className="shrink-0 font-semibold text-neutral-900 tabular-nums dark:text-white">
                                    {formatBRL(lineTotal)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#E4002B] px-4 py-3 text-white">
                          <div>
                            <span className="text-xs font-bold uppercase tracking-wider">
                              {dict.totalOfPrefix} {revisionLabel.toUpperCase()}
                            </span>
                            <span className="ml-3 text-xs text-white/90 tabular-nums">
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
                              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-neutral-900 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
                            >
                              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#25D366] text-white">
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

            {/* Controle de exibição: Ver todos os modelos (X) / Recolher */}
            {canCollapseModels && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllModels((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-900 shadow-sm transition-all hover:border-[#E4002B] hover:text-[#E4002B] dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                >
                  {showAllModels ? (
                    <>
                      <ChevronUp className="h-4 w-4 text-[#E4002B]" />
                      {dict.collapseModels}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 text-[#E4002B]" />
                      {dict.viewAllModels(computedModels.length)}
                    </>
                  )}
                </button>
              </div>
            )}
          </main>
        );
      }

      case 'faq_section': {
        const faqTitleContent = getLocalizedContent('faq_title');
        const faqSubtitleContent = getLocalizedContent('faq_subtitle');
        return (
          <section
            id="perguntas-frequentes"
            className="mx-auto max-w-[920px] scroll-mt-24 px-4 py-10 sm:px-6 sm:py-12"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <EditableText
                  as="h2"
                  textKey="faq_title"
                  defaultText={faqTitleContent.defaultText}
                  entry={faqTitleContent.entry}
                  isEditMode={isEditMode}
                  onCommit={handleCommitText}
                  className="font-display text-2xl font-bold text-neutral-900 dark:text-white"
                />
                <EditableText
                  as="p"
                  textKey="faq_subtitle"
                  defaultText={faqSubtitleContent.defaultText}
                  entry={faqSubtitleContent.entry}
                  isEditMode={isEditMode}
                  onCommit={handleCommitText}
                  className="mt-1 block text-sm text-neutral-600 dark:text-neutral-400"
                />
              </div>
            </div>

            <div className="space-y-3">
              {(data.faqs || []).map((faq) => {
                const isOpen = openFaqId === faq.id;
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
                  <div
                    key={faq.id}
                    className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <EditableText
                        textKey={`faq_q_${faq.id}`}
                        defaultText={translatedFaq.question}
                        entry={qEntry}
                        isEditMode={isEditMode}
                        onCommit={handleCommitText}
                        className="text-sm font-bold text-neutral-900 dark:text-white sm:text-base"
                      />
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform ${
                          isOpen ? 'rotate-180 text-[#E4002B]' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
                        <EditableText
                          as="p"
                          textKey={`faq_a_${faq.id}`}
                          defaultText={translatedFaq.answer}
                          entry={aEntry}
                          isEditMode={isEditMode}
                          onCommit={handleCommitText}
                        />
                      </div>
                    )}
                  </div>
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
                className="text-xs font-bold uppercase tracking-widest text-[#E4002B]"
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
                className="mt-1 block text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl"
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
                className="mt-1.5 block text-sm text-neutral-600 dark:text-neutral-400"
              />
            )}
          />
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
          <footer className="border-t border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                {/* Coluna 1: Logo + Redes + Tema escuro */}
                <div>
                  <div className="inline-flex items-center gap-3">
                    {effectiveLogoUrl ? (
                      <img
                        src={effectiveLogoUrl}
                        alt={data.seo.logo_alt || 'RODALEVE'}
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
                        className="font-display text-2xl font-extrabold tracking-tight text-[#E4002B]"
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
                        className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#E4002B]"
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
                    className="mt-3 block text-sm text-neutral-600 dark:text-neutral-400"
                  />
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
                    <a
                      href={
                        data.seo.facebook_url ||
                        'https://www.facebook.com/concessionariarodaleve/'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook Rodaleve"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 transition-colors hover:border-[#E4002B] hover:text-[#E4002B] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                    >
                      <Facebook className="h-4 w-4" />
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
                    className="text-sm font-bold text-neutral-900 dark:text-white"
                  />
                  <ul className="mt-3 space-y-1.5 text-sm text-neutral-600 dark:text-neutral-400">
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
                    <li className="pt-1 font-semibold text-neutral-800 dark:text-neutral-200">
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
                        className="tabular-nums text-[#E4002B] hover:underline"
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
                    className="text-sm font-bold text-neutral-900 dark:text-white"
                  />
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <button
                      type="button"
                      onClick={() => setLegalModal('privacy')}
                      className="text-neutral-700 underline-offset-4 hover:text-[#E4002B] hover:underline dark:text-neutral-300"
                    >
                      {dict.privacyPolicy}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLegalModal('terms')}
                      className="text-neutral-700 underline-offset-4 hover:text-[#E4002B] hover:underline dark:text-neutral-300"
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
                    className="mt-3 block text-xs leading-relaxed text-neutral-500 dark:text-neutral-400"
                  />
                </div>
              </div>

              {/* Faixa inferior */}
              <div className="mt-10 grid grid-cols-1 items-center gap-3 border-t border-neutral-200 pt-6 text-center text-xs text-neutral-500 dark:border-neutral-800 sm:grid-cols-3">
                <div className="sm:text-left">
                  <EditableText
                    as="p"
                    textKey="footer_slogan"
                    defaultText={footerSlogan.defaultText}
                    entry={footerSlogan.entry}
                    isEditMode={isEditMode}
                    onCommit={handleCommitText}
                    className="font-bold tracking-wide text-neutral-800 dark:text-neutral-200"
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
                    className="font-semibold text-neutral-700 underline-offset-4 transition-colors hover:text-[#E4002B] hover:underline dark:text-neutral-300"
                  >
                    Zarvic Marketing
                  </a>
                  {' · '}
                  <a
                    href="/gestor"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/gestor');
                    }}
                    className="font-semibold text-neutral-700 underline-offset-4 hover:text-[#E4002B] hover:underline dark:text-neutral-300"
                  >
                    {dict.gestorLink}
                  </a>
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
        return (
          <section className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6">
            <div
              className={`overflow-hidden rounded-2xl border p-6 sm:p-8 ${
                isRed
                  ? 'border-[#E4002B] bg-[#E4002B] text-white'
                  : isGray
                    ? 'border-neutral-200 bg-neutral-100 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white'
                    : 'border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white'
              }`}
            >
              <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
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
                        isRed ? 'text-white/90' : 'text-[#E4002B]'
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
                      isRed ? 'text-white/90' : 'text-neutral-600 dark:text-neutral-300'
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
                            ? 'bg-white text-[#E4002B] hover:bg-neutral-100'
                            : 'bg-[#E4002B] text-white hover:bg-[#C80024]'
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

                {(custom.image_url || isEditMode) && (
                  <div className="relative flex w-full shrink-0 flex-col items-center justify-center md:w-64">
                    {custom.image_url ? (
                      <img
                        src={custom.image_url}
                        alt={custom.title}
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
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-neutral-950 px-3 py-1 text-[11px] font-bold text-white shadow hover:bg-neutral-800"
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
    <div
      className={`min-h-screen transition-colors ${
        isEditMode
          ? 'bg-neutral-200/80 pt-[54px] dark:bg-neutral-900'
          : 'bg-[#FAFAFA] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100'
      }`}
    >
      {/* Visual Editor Fixed Top Toolbar */}
      {isEditMode && (
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
      )}

      {/* Main Preview Canvas (switches width smoothly between Desktop and Mobile in edit mode) */}
      <div
        className={
          isEditMode && viewport === 'mobile'
            ? 'mx-auto my-6 max-w-[390px] overflow-x-hidden rounded-[28px] border-4 border-neutral-800 bg-[#FAFAFA] text-neutral-900 shadow-2xl dark:bg-neutral-950 dark:text-neutral-100'
            : 'min-h-screen bg-[#FAFAFA] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100'
        }
      >
        {/* 1. Cabeçalho fixo no topo com Glassmorphism */}
        <header
          className={`${
            isEditMode ? 'relative' : 'sticky top-0'
          } z-50 w-full border-b border-gray-200/70 bg-white/75 backdrop-blur-md transition-shadow duration-200 dark:border-white/10 dark:bg-gray-900/75 ${
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
                {effectiveLogoUrl ? (
                  <img
                    src={effectiveLogoUrl}
                    alt={data.seo.logo_alt || 'RODALEVE'}
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
                    className="font-display text-xl font-extrabold tracking-tight text-[#E4002B]"
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
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-800 hover:bg-[#E4002B] hover:text-white"
                >
                  <ImageIcon className="h-3 w-3" />
                  Trocar Imagem
                </button>
              )}
            </div>

            <nav className="hidden items-center gap-7 md:flex">
              {(() => {
                const navRev = getLocalizedContent('nav_revisions');
                const navFaq = getLocalizedContent('nav_faq');
                const navUnits = getLocalizedContent('nav_units');
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => handleNavClick('revisoes')}
                      className={`whitespace-nowrap border-b-2 py-5 text-sm font-semibold transition-colors ${
                        activeNav === 'revisoes' && heroTab === 'tabela'
                          ? 'border-[#dc2626] text-neutral-900 dark:text-white'
                          : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
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
                      onClick={() => handleNavClick('faq')}
                      className={`whitespace-nowrap border-b-2 py-5 text-sm font-semibold transition-colors ${
                        activeNav === 'faq' || heroTab === 'faq'
                          ? 'border-[#dc2626] text-neutral-900 dark:text-white'
                          : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
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
                          ? 'border-[#dc2626] text-neutral-900 dark:text-white'
                          : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
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
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-red-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 sm:px-5 sm:py-2.5 sm:text-sm"
              >
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
          <nav className="flex items-center justify-around border-t border-gray-200/50 px-3 dark:border-white/10 md:hidden">
            <button
              type="button"
              onClick={() => handleNavClick('revisoes')}
              className={`border-b-2 px-2 py-2 text-xs font-semibold transition-colors ${
                activeNav === 'revisoes' && heroTab === 'tabela'
                  ? 'border-[#dc2626] text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-600 dark:text-neutral-300'
              }`}
            >
              {getLocalizedContent('nav_revisions').entry?.text ||
                getLocalizedContent('nav_revisions').defaultText}
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('faq')}
              className={`border-b-2 px-2 py-2 text-xs font-semibold transition-colors ${
                activeNav === 'faq' || heroTab === 'faq'
                  ? 'border-[#dc2626] text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-600 dark:text-neutral-300'
              }`}
            >
              {getLocalizedContent('nav_faq').entry?.text ||
                getLocalizedContent('nav_faq').defaultText}
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('unidades')}
              className={`border-b-2 px-2 py-2 text-xs font-semibold transition-colors ${
                activeNav === 'unidades'
                  ? 'border-[#dc2626] text-neutral-900 dark:text-white'
                  : 'border-transparent text-neutral-600 dark:text-neutral-300'
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
        <WhatsAppScheduleModal
          model={scheduleTarget.model}
          revisionNumber={selectedRevision}
          revisionLabel={revisionLabel}
          revisionSubtitle={revisionSubtitle}
          summary={scheduleTarget.summary}
          initialIncludeOptionals={scheduleTarget.includeOptionals}
          units={data.seo?.units || []}
          language={language}
          onClose={() => setScheduleTarget(null)}
          onTrackLead={(unitName) =>
            trackAllPixelsLeadContact(
              data.seo,
              {
                content_name: `${scheduleTarget.model.name} - ${revisionLabel}`,
                content_category: unitName,
              },
              data.tracking_config
            )
          }
        />
      )}

      {/* Botão flutuante discreto para o administrador autenticado */}
      {isAdminLoggedIn && !isEditMode && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/gestor')}
            className="rounded-full border border-neutral-200 bg-white/95 px-3.5 py-2 text-xs font-semibold text-neutral-700 shadow-md backdrop-blur transition-colors hover:bg-neutral-50"
          >
            Gestor
          </button>
          <button
            type="button"
            onClick={onEnterEditMode}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950/90 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition-all hover:bg-[#E4002B]"
          >
            <Paintbrush className="h-3.5 w-3.5" />
            Editar Site Visualmente
          </button>
        </div>
      )}

      {/* Visual Editor Toast */}
      {visualToast && (
        <div
          className={`fixed right-5 top-16 z-50 rounded-xl border px-4 py-2.5 text-xs font-bold shadow-xl ${
            visualToast.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-red-300 bg-red-50 text-[#E4002B]'
          }`}
        >
          {visualToast.msg}
        </div>
      )}

      {/* Modais do Editor Visual */}
      {isAddBlockOpen && (
        <AddBlockModal
          onSelect={handleInsertCustomBlock}
          onClose={() => {
            setIsAddBlockOpen(false);
            setAddBlockAfterIndex(null);
          }}
        />
      )}

      {imageModal && (
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
      )}

      {/* Modal Políticas e Termos */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
              <h4 className="font-display text-lg font-bold text-neutral-900 dark:text-white">
                {legalModal === 'privacy' ? dict.privacyPolicy : dict.termsOfUse}
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
  );
}
