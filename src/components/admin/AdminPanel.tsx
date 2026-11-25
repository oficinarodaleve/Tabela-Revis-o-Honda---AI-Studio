import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileDown,
  LogOut,
  Paintbrush,
  Pencil,
  RotateCcw,
  Save,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  AdminUser,
  CalculatorSettings,
  FaqItem,
  IntegrationsData,
  MotoModel,
  Part,
  RevisionPart,
  RevisionTab,
  Segment,
  SeoSettings,
  VisualBuilderConfig,
} from '../../types';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { adminFetch, clearAdminToken, uploadAdminImageFile } from '../../utils/adminAuth';
import {
  ParsedBackupResult,
  collectEmbeddedUploads,
  exportFullSiteZip,
  exportGestorConfigJson,
  getAutoSavePreference,
  parseAndValidateBackupFile,
  setAutoSavePreference,
} from '../../utils/gestorBackup';
import {
  loadLocalVisualConfig,
  mergeWithDefaultVisualConfig,
  saveLocalVisualConfig,
} from '../../utils/visualBuilder';
import {
  fetchWithRetry,
  normalizeIntegrationsData,
  normalizeSeoSettings,
} from '../../utils/bootstrapNormalize';
import { normalizeCalculatorSettings } from '../../utils/revisionCalculator';
import { ErrorBoundary } from '../ErrorBoundary';
import { AdminLogin } from './AdminLogin';
import { TabCalculator } from './TabCalculator';
import { TabCategoriesTabs } from './TabCategoriesTabs';
import { TabFaqs } from './TabFaqs';
import { TabHtmlEditor } from './TabHtmlEditor';
import { TabIntegrations } from './TabIntegrations';
import { TabLabor } from './TabLabor';
import { TabModelsPhotos } from './TabModelsPhotos';
import { TabPricesParts } from './TabPricesParts';
import { TabRevisions } from './TabRevisions';
import { TabSeoIdentity } from './TabSeoIdentity';

type GestorTab =
  | 'revisoes'
  | 'calculadora'
  | 'mao_de_obra'
  | 'precos'
  | 'modelos'
  | 'faqs'
  | 'categorias'
  | 'seo'
  | 'integracoes'
  | 'editor_html';

interface AdminBootstrap {
  models: MotoModel[];
  segments: Segment[];
  revision_tabs: RevisionTab[];
  parts: Part[];
  revision_parts: RevisionPart[];
  faqs: FaqItem[];
  seo: SeoSettings;
  last_price_sync: string;
  integrations: IntegrationsData;
  calculator_settings: CalculatorSettings;
}

interface AdminPanelProps {
  onNavigate: (path: string) => void;
  onPublicDataChanged: () => Promise<void>;
  onOpenVisualEditor: () => void;
  onOpenHtmlEditor?: () => void;
  onAuthChange?: (loggedIn: boolean) => void;
}

const DEFAULT_GESTOR_LOGO = '/rodaleve-gestor-logo.svg';
const DEFAULT_GESTOR_TITLE = 'Gestor Rodaleve';
const DEFAULT_GESTOR_SUBTITLE = 'Tabela de manutenção e revisões';

const TABS: Array<{ id: GestorTab; label: string }> = [
  { id: 'revisoes', label: 'Revisões' },
  { id: 'calculadora', label: 'Calculadora' },
  { id: 'mao_de_obra', label: 'Mão de Obra' },
  { id: 'precos', label: 'Preços e Peças' },
  { id: 'modelos', label: 'Modelos e fotos' },
  { id: 'faqs', label: 'Perguntas frequentes' },
  { id: 'categorias', label: 'Categorias e abas' },
  { id: 'seo', label: 'SEO & Identidade' },
  { id: 'integracoes', label: 'Integrações & APIs' },
  { id: 'editor_html', label: 'Editor HTML' },
];

interface ActionTooltipProps {
  id: string;
  text: string;
  children: React.ReactElement<{
    title?: string;
    'aria-describedby'?: string;
    onMouseEnter?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
    onFocus?: React.FocusEventHandler;
    onBlur?: React.FocusEventHandler;
  }>;
}

function ActionWithTooltip({ id, text, children }: ActionTooltipProps) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<'center' | 'left' | 'right'>('center');
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    const wrap = wrapperRef.current;
    const tip = tooltipRef.current;
    if (!wrap || !tip) return;
    const wrapRect = wrap.getBoundingClientRect();
    const tipWidth = tip.offsetWidth || 256;
    const center = wrapRect.left + wrapRect.width / 2;
    const margin = 12;
    if (center - tipWidth / 2 < margin) {
      setAlign('left');
    } else if (center + tipWidth / 2 > window.innerWidth - margin) {
      setAlign('right');
    } else {
      setAlign('center');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(updatePosition);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', updatePosition);
    window.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, updatePosition]);

  const childWithHandlers = React.cloneElement(children, {
    title: text,
    'aria-describedby': open ? id : undefined,
    onMouseEnter: (e) => {
      setOpen(true);
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e) => {
      setOpen(false);
      children.props.onMouseLeave?.(e);
    },
    onFocus: (e) => {
      setOpen(true);
      children.props.onFocus?.(e);
    },
    onBlur: (e) => {
      setOpen(false);
      children.props.onBlur?.(e);
    },
  });

  const alignClass =
    align === 'left'
      ? 'left-0'
      : align === 'right'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2';

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      {childWithHandlers}
      <div
        ref={tooltipRef}
        id={id}
        role="tooltip"
        aria-hidden={!open}
        className={`pointer-events-none absolute top-full z-50 mt-2 w-64 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-ink px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-on-ink shadow-lg transition-all duration-150 ease-out ${alignClass} ${
          open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
        }`}
      >
        {text}
      </div>
    </div>
  );
}

export function AdminPanel({
  onNavigate,
  onPublicDataChanged,
  onOpenVisualEditor,
  onOpenHtmlEditor,
  onAuthChange,
}: AdminPanelProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<GestorTab>(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'editor_html') return 'editor_html';
    }
    return 'revisoes';
  });
  const [adminData, setAdminData] = useState<AdminBootstrap | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => getAutoSavePreference());
  const [tabDirty, setTabDirty] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [autoSaveErrorMsg, setAutoSaveErrorMsg] = useState<string | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [pendingTabSwitch, setPendingTabSwitch] = useState<GestorTab | null>(null);
  const [exportingZip, setExportingZip] = useState(false);
  const [exportingConfig, setExportingConfig] = useState(false);

  // Import validation & confirmation modal state
  const [importingBackup, setImportingBackup] = useState(false);
  const [pendingImport, setPendingImport] = useState<ParsedBackupResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [creatingPreImportBackup, setCreatingPreImportBackup] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Gestor header branding modal state
  const [brandingModalOpen, setBrandingModalOpen] = useState(false);
  const [brandingLogoUrl, setBrandingLogoUrl] = useState(DEFAULT_GESTOR_LOGO);
  const [brandingTitle, setBrandingTitle] = useState(DEFAULT_GESTOR_TITLE);
  const [brandingSubtitle, setBrandingSubtitle] = useState(DEFAULT_GESTOR_SUBTITLE);
  const [uploadingBrandingLogo, setUploadingBrandingLogo] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [logoImgFailed, setLogoImgFailed] = useState(false);
  const brandingFileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => {
      setToast((curr) => (curr?.msg === msg ? null : curr));
    }, 4500);
  }, []);

  const loadAdminBootstrap = useCallback(async () => {
    setBootstrapError(null);
    try {
      const res = await fetchWithRetry(() => adminFetch('/api/admin/bootstrap'), 2, 400);
      if (res.status === 401) {
        clearAdminToken();
        setUser(null);
        onAuthChange?.(false);
        return;
      }
      if (!res.ok) {
        console.error(`[AdminPanel] Erro HTTP ${res.status} ao carregar /api/admin/bootstrap`);
        setBootstrapError(
          `Não foi possível carregar os dados do painel (HTTP ${res.status}). Tente novamente.`
        );
        return;
      }
      const raw = (await res.json()) as Partial<AdminBootstrap> | null;
      const normalized: AdminBootstrap = {
        models: Array.isArray(raw?.models) ? raw.models : [],
        segments: Array.isArray(raw?.segments) ? raw.segments : [],
        revision_tabs: Array.isArray(raw?.revision_tabs) ? raw.revision_tabs : [],
        parts: Array.isArray(raw?.parts) ? raw.parts : [],
        revision_parts: Array.isArray(raw?.revision_parts) ? raw.revision_parts : [],
        faqs: Array.isArray(raw?.faqs) ? raw.faqs : [],
        seo: normalizeSeoSettings(raw?.seo),
        last_price_sync: String(raw?.last_price_sync || ''),
        integrations: normalizeIntegrationsData(raw?.integrations),
        calculator_settings: normalizeCalculatorSettings(raw?.calculator_settings),
      };
      setAdminData(normalized);
    } catch (err) {
      console.error('[AdminPanel] Falha ao carregar /api/admin/bootstrap:', err);
      setBootstrapError('Falha de conexão ao carregar os dados do gestor.');
    }
  }, [onAuthChange]);

  useEffect(() => {
    (async () => {
      try {
        await auth.authStateReady();
        if (!auth.currentUser) {
          clearAdminToken();
          try {
            window.localStorage?.removeItem('rodaleve_admin_hint');
          } catch {
            // Ignore storage errors
          }
          onAuthChange?.(false);
          return;
        }
        const res = await adminFetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          try {
            window.localStorage?.setItem('rodaleve_admin_hint', '1');
          } catch {
            // Ignore storage errors
          }
          setUser(json.user);
          onAuthChange?.(true);
          await loadAdminBootstrap();
        } else {
          clearAdminToken();
          try {
            window.localStorage?.removeItem('rodaleve_admin_hint');
          } catch {
            // Ignore storage errors
          }
          onAuthChange?.(false);
        }
      } catch {
        clearAdminToken();
        try {
          window.localStorage?.removeItem('rodaleve_admin_hint');
        } catch {
          // Ignore storage errors
        }
        onAuthChange?.(false);
      } finally {
        setCheckingAuth(false);
      }
    })();
  }, [loadAdminBootstrap, onAuthChange]);

  // Sync branding logo error reset whenever logo URL changes
  const activeGestorLogo = adminData?.seo?.gestor_logo_url ?? DEFAULT_GESTOR_LOGO;
  const activeGestorTitle = adminData?.seo?.gestor_title || DEFAULT_GESTOR_TITLE;
  const activeGestorSubtitle = adminData?.seo?.gestor_subtitle || DEFAULT_GESTOR_SUBTITLE;

  useEffect(() => {
    setLogoImgFailed(false);
  }, [activeGestorLogo]);

  // Proteção contra fechamento/recarregamento da aba quando auto-save está desligado e há alterações não salvas
  useEffect(() => {
    if (autoSaveEnabled || !tabDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [autoSaveEnabled, tabDirty]);

  const handleSavedAndRefresh = useCallback(async () => {
    await Promise.all([loadAdminBootstrap(), onPublicDataChanged()]);
  }, [loadAdminBootstrap, onPublicDataChanged]);

  const handleAutoSaveStart = useCallback(() => {
    setAutoSaveStatus('saving');
    setAutoSaveErrorMsg(null);
  }, []);

  const handleAutoSaveComplete = useCallback(() => {
    const timeStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setLastAutoSavedAt(timeStr);
    setAutoSaveStatus('saved');
    setAutoSaveErrorMsg(null);
    setTabDirty(false);
  }, []);

  const handleAutoSaveError = useCallback((msg?: string) => {
    setAutoSaveStatus('error');
    setAutoSaveErrorMsg(msg || 'Erro ao salvar — tente novamente');
  }, []);

  const handleToggleAutoSave = () => {
    const next = !autoSaveEnabled;
    setAutoSaveEnabled(next);
    setAutoSavePreference(next);
    if (!next) {
      setAutoSaveStatus('idle');
      setAutoSaveErrorMsg(null);
    }
    showToast(
      'success',
      next
        ? 'Salvamento automático ativado. Suas edições serão salvas em segundo plano.'
        : 'Salvamento automático desativado. Lembre-se de clicar em Salvar após editar.'
    );
  };

  const handleSelectTab = (target: GestorTab) => {
    if (target === activeTab) return;
    if (!autoSaveEnabled && tabDirty) {
      setPendingTabSwitch(target);
      return;
    }
    setTabDirty(false);
    setAutoSaveStatus('idle');
    setAutoSaveErrorMsg(null);
    setActiveTab(target);
  };

  const openBrandingModal = () => {
    setBrandingLogoUrl(activeGestorLogo || DEFAULT_GESTOR_LOGO);
    setBrandingTitle(activeGestorTitle);
    setBrandingSubtitle(activeGestorSubtitle);
    setBrandingModalOpen(true);
  };

  const handleUploadBrandingLogo = async (file: File) => {
    const allowedTypes = ['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['png', 'svg', 'webp', 'jpg', 'jpeg'];
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      showToast('error', 'Formato não suportado. Use PNG, SVG, WEBP ou JPG.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('error', 'Arquivo muito grande. O limite máximo permitido é de 8 MB.');
      return;
    }
    setUploadingBrandingLogo(true);
    try {
      const uploadedUrl = await uploadAdminImageFile(file, {
        convertWebpToPng: true,
        maxDimension: 900,
      });
      setBrandingLogoUrl(uploadedUrl);
      showToast('success', 'Logo enviada! Clique em Salvar para aplicar no topo do Gestor.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao enviar logo.');
    } finally {
      setUploadingBrandingLogo(false);
    }
  };

  const handleSaveBranding = async (
    override?: { logo?: string; title?: string; subtitle?: string }
  ) => {
    setSavingBranding(true);
    try {
      const res = await adminFetch('/api/admin/gestor-branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gestor_logo_url: override?.logo ?? brandingLogoUrl.trim(),
          gestor_title: override?.title ?? brandingTitle.trim(),
          gestor_subtitle: override?.subtitle ?? brandingSubtitle.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar identificação do Gestor.');
      await handleSavedAndRefresh();
      setBrandingModalOpen(false);
      showToast('success', 'Logo e cabeçalho do Gestor atualizados com sucesso!');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao salvar logo do Gestor.');
    } finally {
      setSavingBranding(false);
    }
  };

  const fetchLatestVisualBuilder = useCallback(async () => {
    let visualBuilder: Partial<VisualBuilderConfig> | null = loadLocalVisualConfig();
    try {
      const pubRes = await fetch('/api/public/bootstrap');
      if (pubRes.ok) {
        const pubJson = (await pubRes.json()) as {
          visual_builder?: Partial<VisualBuilderConfig> | null;
        };
        if (pubJson.visual_builder) {
          visualBuilder = pubJson.visual_builder;
        }
      }
    } catch {
      // Usa visualBuilder local se falhar
    }
    return visualBuilder;
  }, []);

  const handleExportZip = async () => {
    if (!adminData) return;
    setExportingZip(true);
    try {
      const visualBuilder = await fetchLatestVisualBuilder();
      const filename = await exportFullSiteZip({
        ...adminData,
        visual_builder: visualBuilder,
      });
      showToast('success', `Estrutura completa do site exportada: ${filename}`);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Erro ao exportar ZIP completo do site.');
    } finally {
      setExportingZip(false);
    }
  };

  const handleExportConfigJson = async () => {
    if (!adminData) return;
    setExportingConfig(true);
    try {
      const visualBuilder = await fetchLatestVisualBuilder();
      const source = {
        ...adminData,
        visual_builder: visualBuilder,
      };
      const embeddedUploads = await collectEmbeddedUploads(source);
      const filename = exportGestorConfigJson({
        ...source,
        embedded_uploads: embeddedUploads,
      });
      showToast('success', `Configurações do Gestor exportadas: ${filename}`);
    } catch (e) {
      showToast(
        'error',
        e instanceof Error ? e.message : 'Erro ao exportar configurações do Gestor.'
      );
    } finally {
      setExportingConfig(false);
    }
  };

  const handleSelectImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportError(null);
    try {
      const parsed = await parseAndValidateBackupFile(file);
      setPendingImport(parsed);
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Arquivo inválido ou corrompido para importação.'
      );
    }
  };

  const handleQuickBackupBeforeImport = async () => {
    if (!adminData) return;
    setCreatingPreImportBackup(true);
    try {
      const visualBuilder = await fetchLatestVisualBuilder();
      const source = {
        ...adminData,
        visual_builder: visualBuilder,
      };
      const embeddedUploads = await collectEmbeddedUploads(source);
      const filename = exportGestorConfigJson({
        ...source,
        embedded_uploads: embeddedUploads,
      });
      showToast('success', `Backup rápido criado: ${filename}`);
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Não foi possível criar o backup rápido.'
      );
    } finally {
      setCreatingPreImportBackup(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    setImportingBackup(true);
    setImportError(null);
    try {
      const { payload } = pendingImport;
      const res = await adminFetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao restaurar configurações no servidor.');

      if (payload.visual_builder) {
        const modelIds = (payload.models || adminData?.models || []).map((m) => m.id);
        saveLocalVisualConfig(
          mergeWithDefaultVisualConfig(payload.visual_builder, modelIds)
        );
      }
      setTabDirty(false);
      setAutoSaveStatus('idle');
      await handleSavedAndRefresh();
      setRestoreVersion((v) => v + 1);
      setPendingImport(null);
      showToast('success', 'Configurações do Gestor restauradas e aplicadas com sucesso!');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Falha ao restaurar arquivo de backup.';
      setImportError(msg);
      showToast('error', msg);
    } finally {
      setImportingBackup(false);
    }
  };

  const handleLogout = async () => {
    try {
      await adminFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Garantir limpeza local mesmo se a rede falhar
    }
    await signOut(auth).catch(() => undefined);
    clearAdminToken();
    try {
      window.localStorage?.removeItem('rodaleve_admin_hint');
    } catch {
      // Ignore storage errors
    }
    setUser(null);
    setAdminData(null);
    onAuthChange?.(false);
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-sm text-ink-muted">
        Verificando acesso...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminLogin
        onSuccess={async (loggedUser) => {
          setUser(loggedUser);
          onAuthChange?.(true);
          await loadAdminBootstrap();
        }}
        onBackToSite={() => onNavigate('/')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* Cabeçalho branco */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1150px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          {/* Bloco esquerdo: Logo + Título + Subtítulo */}
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="flex items-center gap-3.5">
              {/* Logo da empresa com opção discreta de editar ao passar o mouse */}
              <div className="group relative flex shrink-0 items-center">
                {activeGestorLogo && !logoImgFailed ? (
                  <img
                    src={activeGestorLogo}
                    alt={activeGestorTitle}
                    referrerPolicy="no-referrer"
                    onError={() => setLogoImgFailed(true)}
                    className="h-auto max-h-[46px] w-auto max-w-[190px] object-contain sm:max-h-[50px]"
                  />
                ) : (
                  <div className="flex h-[46px] items-center rounded-xl border border-border bg-surface-neutral px-3">
                    <span className="font-display text-sm font-extrabold tracking-tight text-brand-text">
                      RODALEVE
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={openBrandingModal}
                  title="Trocar logo ou editar título do cabeçalho do Gestor"
                  className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-ink/80 px-2 text-[11px] font-bold text-on-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
              </div>

              {/* Título e Subtítulo alinhados verticalmente ao centro */}
              <div className="border-l border-border pl-3.5">
                <h1 className="font-display text-base font-bold leading-tight tracking-tight text-ink sm:text-lg">
                  {activeGestorTitle}
                </h1>
                <p className="text-xs font-normal text-ink-muted">
                  {activeGestorSubtitle}
                </p>
              </div>
            </div>

            {/* Indicador discreto do estado do Auto-save / alterações pendentes */}
            {autoSaveStatus === 'error' && autoSaveErrorMsg ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-text">
                <AlertTriangle className="h-3 w-3" />
                {autoSaveErrorMsg}
              </span>
            ) : !autoSaveEnabled && tabDirty ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand-text">
                <AlertTriangle className="h-3 w-3" />
                Alterações não salvas
              </span>
            ) : autoSaveEnabled && (autoSaveStatus === 'saving' || tabDirty) ? (
              <span className="inline-flex items-center rounded-full border border-border bg-surface-neutral px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                Salvando...
              </span>
            ) : autoSaveEnabled && lastAutoSavedAt ? (
              <span className="hidden items-center gap-1 rounded-full border border-border bg-surface-neutral px-2.5 py-0.5 text-[11px] font-semibold text-ink sm:inline-flex">
                <CheckCircle2 className="h-3 w-3 text-ink" />
                Salvo automaticamente às {lastAutoSavedAt}
              </span>
            ) : null}
          </div>

          {/* Barra de ações superiores (botões pill com bordas suaves, ícones e tooltips) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Toggle Auto-save */}
            <ActionWithTooltip
              id="tooltip-gestor-autosave"
              text="Salva automaticamente qualquer alteração feita no Gestor. Clique para ligar ou desligar."
            >
              <button
                type="button"
                onClick={handleToggleAutoSave}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  autoSaveEnabled
                    ? 'border-brand/25 bg-brand-soft text-brand-text hover:opacity-90'
                    : 'border-border bg-surface-neutral text-ink-muted hover:text-ink'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    autoSaveEnabled ? 'bg-brand' : 'bg-ink-muted'
                  }`}
                />
                Auto-save: {autoSaveEnabled ? 'Ligado' : 'Desligado'}
              </button>
            </ActionWithTooltip>

            {/* 2. Exportar Site ZIP */}
            <ActionWithTooltip
              id="tooltip-gestor-export-zip"
              text="Baixa um arquivo .ZIP completo com o site e as configurações para usar ou migrar em outras plataformas."
            >
              <button
                type="button"
                disabled={!adminData || exportingZip}
                onClick={handleExportZip}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-neutral disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-brand-text" />
                {exportingZip ? 'Exportando site...' : 'Exportar Site ZIP'}
              </button>
            </ActionWithTooltip>

            {/* 3. Exportar Configurações (JSON leve) */}
            <ActionWithTooltip
              id="tooltip-gestor-export-config"
              text="Baixa apenas as configurações salvas no Gestor (arquivo JSON) para backup rápido ou restauração."
            >
              <button
                type="button"
                disabled={!adminData || exportingConfig}
                onClick={handleExportConfigJson}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-neutral disabled:opacity-50"
              >
                <FileDown className="h-3.5 w-3.5 text-brand-text" />
                {exportingConfig ? 'Exportando...' : 'Exportar Configurações'}
              </button>
            </ActionWithTooltip>

            {/* 4. Importar */}
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.zip"
              className="hidden"
              onChange={handleSelectImportFile}
            />
            <ActionWithTooltip
              id="tooltip-gestor-import"
              text="Carrega e restaura um arquivo de configurações exportado do Gestor para recuperar ou aplicar seus ajustes."
            >
              <button
                type="button"
                disabled={importingBackup}
                onClick={() => importInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-neutral disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5 text-ink-muted" />
                {importingBackup ? 'Restaurando...' : 'Importar'}
              </button>
            </ActionWithTooltip>

            <button
              type="button"
              onClick={onOpenVisualEditor}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand px-3.5 py-1.5 text-xs font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
            >
              <Paintbrush className="h-3.5 w-3.5" />
              Editar Site Visualmente
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-brand hover:bg-surface-neutral hover:text-brand-text"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-brand-text" />
              Voltar para o site
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-on-ink transition-opacity hover:opacity-90"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>

        {/* Menu de abas */}
        <div className="mx-auto max-w-[1150px] overflow-x-auto px-4 pb-3 pt-1 sm:px-6">
          <div className="flex items-center gap-1.5">
            {TABS.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTab(t.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                    active
                      ? 'bg-brand text-on-brand'
                      : 'text-ink-muted hover:bg-surface-neutral hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Conteúdo centralizado máx 1150px */}
      <main className="mx-auto max-w-[1150px] px-4 py-8 sm:px-6">
        {!adminData ? (
          bootstrapError ? (
            <div className="mx-auto max-w-md rounded-2xl border border-brand/30 bg-card p-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-brand-text">{bootstrapError}</p>
              <button
                type="button"
                onClick={loadAdminBootstrap}
                className="mt-4 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand hover:bg-brand-hover"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-ink-muted">
              Carregando dados do gestor...
            </div>
          )
        ) : (
          <ErrorBoundary
            compact
            screenName={`Gestor · ${TABS.find((t) => t.id === activeTab)?.label || activeTab}`}
            onReset={loadAdminBootstrap}
          >
            <React.Fragment key={restoreVersion}>
              {activeTab === 'revisoes' && (
                <TabRevisions
                  models={adminData.models}
                  revisionTabs={adminData.revision_tabs}
                  parts={adminData.parts}
                  revisionParts={adminData.revision_parts}
                  onSaved={handleSavedAndRefresh}
                  onToast={showToast}
                  autoSaveEnabled={autoSaveEnabled}
                  onDirtyChange={setTabDirty}
                  onAutoSaveStart={handleAutoSaveStart}
                  onAutoSaveComplete={handleAutoSaveComplete}
                  onAutoSaveError={handleAutoSaveError}
                />
              )}
              {activeTab === 'calculadora' && (
                <TabCalculator
                  calculatorSettings={adminData.calculator_settings}
                  onSaved={handleSavedAndRefresh}
                  onToast={showToast}
                  autoSaveEnabled={autoSaveEnabled}
                  onDirtyChange={setTabDirty}
                  onAutoSaveStart={handleAutoSaveStart}
                  onAutoSaveComplete={handleAutoSaveComplete}
                  onAutoSaveError={handleAutoSaveError}
                />
              )}
              {activeTab === 'mao_de_obra' && (
                <TabLabor
                  models={adminData.models}
                  onSaved={handleSavedAndRefresh}
                  onToast={showToast}
                  autoSaveEnabled={autoSaveEnabled}
                  onDirtyChange={setTabDirty}
                  onAutoSaveStart={handleAutoSaveStart}
                  onAutoSaveComplete={handleAutoSaveComplete}
                  onAutoSaveError={handleAutoSaveError}
                />
              )}
              {activeTab === 'precos' && (
                <TabPricesParts
                  parts={adminData.parts}
                  lastSync={adminData.last_price_sync}
                  onSaved={handleSavedAndRefresh}
                  onToast={showToast}
                  autoSaveEnabled={autoSaveEnabled}
                  onDirtyChange={setTabDirty}
                  onAutoSaveStart={handleAutoSaveStart}
                  onAutoSaveComplete={handleAutoSaveComplete}
                  onAutoSaveError={handleAutoSaveError}
                />
              )}
              {activeTab === 'modelos' && (
                <TabModelsPhotos
                  models={adminData.models}
                  segments={adminData.segments}
                  onSaved={handleSavedAndRefresh}
                  onToast={showToast}
                  autoSaveEnabled={autoSaveEnabled}
                  onDirtyChange={setTabDirty}
                  onAutoSaveStart={handleAutoSaveStart}
                  onAutoSaveComplete={handleAutoSaveComplete}
                  onAutoSaveError={handleAutoSaveError}
                />
              )}
              {activeTab === 'faqs' && (
                <TabFaqs
                  faqs={adminData.faqs}
                  onSaved={handleSavedAndRefresh}
                  onToast={showToast}
                  autoSaveEnabled={autoSaveEnabled}
                  onDirtyChange={setTabDirty}
                  onAutoSaveStart={handleAutoSaveStart}
                  onAutoSaveComplete={handleAutoSaveComplete}
                  onAutoSaveError={handleAutoSaveError}
                />
              )}
              {activeTab === 'categorias' && (
                <TabCategoriesTabs
                  segments={adminData.segments}
                  revisionTabs={adminData.revision_tabs}
                  onSaved={handleSavedAndRefresh}
                  onToast={showToast}
                  autoSaveEnabled={autoSaveEnabled}
                  onDirtyChange={setTabDirty}
                  onAutoSaveStart={handleAutoSaveStart}
                  onAutoSaveComplete={handleAutoSaveComplete}
                  onAutoSaveError={handleAutoSaveError}
                />
              )}
              {activeTab === 'seo' && (
                <TabSeoIdentity
                  seo={adminData.seo}
                  faqs={adminData.faqs}
                  onSaved={handleSavedAndRefresh}
                  onToast={showToast}
                  autoSaveEnabled={autoSaveEnabled}
                  onDirtyChange={setTabDirty}
                  onAutoSaveStart={handleAutoSaveStart}
                  onAutoSaveComplete={handleAutoSaveComplete}
                  onAutoSaveError={handleAutoSaveError}
                />
              )}
              {activeTab === 'integracoes' && (
                <TabIntegrations
                  integrations={adminData.integrations}
                  onSaved={handleSavedAndRefresh}
                  onToast={showToast}
                  autoSaveEnabled={autoSaveEnabled}
                  onDirtyChange={setTabDirty}
                  onAutoSaveStart={handleAutoSaveStart}
                  onAutoSaveComplete={handleAutoSaveComplete}
                  onAutoSaveError={handleAutoSaveError}
                />
              )}
              {activeTab === 'editor_html' && (
                <TabHtmlEditor
                  models={adminData.models}
                  faqs={adminData.faqs}
                  onSaved={handleSavedAndRefresh}
                  onToast={showToast}
                  onOpenOnPageHtmlEditor={() => {
                    if (onOpenHtmlEditor) {
                      onOpenHtmlEditor();
                    } else {
                      onNavigate('/?html_editor=1');
                    }
                  }}
                  autoSaveEnabled={autoSaveEnabled}
                  onDirtyChange={setTabDirty}
                  onAutoSaveStart={handleAutoSaveStart}
                  onAutoSaveComplete={handleAutoSaveComplete}
                  onAutoSaveError={handleAutoSaveError}
                />
              )}
            </React.Fragment>
          </ErrorBoundary>
        )}
      </main>

      {/* Modal para editar Logo, Título e Subtítulo do cabeçalho do Gestor */}
      {brandingModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 dark:bg-surface/80 p-4 backdrop-blur-xs"
          onClick={() => !savingBranding && setBrandingModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  Identificação do Cabeçalho do Gestor
                </h3>
                <p className="text-xs text-ink-muted">
                  Troque a logo (PNG, SVG, WEBP ou JPG) ou ajuste o título e subtítulo do painel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBrandingModalOpen(false)}
                className="rounded-lg p-1 text-ink-muted hover:bg-surface-neutral hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Pré-visualização fiel */}
            <div className="mt-4 rounded-xl border border-border bg-surface p-3.5">
              <p className="mb-2 text-[11px] font-semibold text-ink-muted">
                Pré-visualização no topo do Gestor
              </p>
              <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-2.5">
                {brandingLogoUrl ? (
                  <img
                    src={brandingLogoUrl}
                    alt={brandingTitle || DEFAULT_GESTOR_TITLE}
                    referrerPolicy="no-referrer"
                    className="h-auto max-h-[48px] w-auto max-w-[180px] object-contain"
                  />
                ) : (
                  <span className="font-display text-sm font-extrabold text-brand-text">RODALEVE</span>
                )}
                <div className="border-l border-border pl-3.5">
                  <p className="font-display text-base font-bold leading-tight text-ink">
                    {brandingTitle || DEFAULT_GESTOR_TITLE}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {brandingSubtitle || DEFAULT_GESTOR_SUBTITLE}
                  </p>
                </div>
              </div>
            </div>

            {/* Upload ou URL da logo */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink">
                  Imagem da Logo (URL ou upload do computador)
                </label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={brandingLogoUrl}
                    onChange={(e) => setBrandingLogoUrl(e.target.value)}
                    placeholder="Cole a URL da imagem ou envie abaixo..."
                    className="min-w-[200px] flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                  />
                  <input
                    ref={brandingFileInputRef}
                    type="file"
                    accept=".png,.svg,.webp,.jpg,.jpeg,image/png,image/svg+xml,image/webp,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void handleUploadBrandingLogo(f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploadingBrandingLogo}
                    onClick={() => brandingFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-neutral disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5 text-brand-text" />
                    {uploadingBrandingLogo ? 'Enviando...' : 'Enviar arquivo'}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">
                  Formatos aceitos: PNG, SVG, WEBP ou JPG (preferencialmente com fundo transparente).
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink">
                    Título principal
                  </label>
                  <input
                    type="text"
                    value={brandingTitle}
                    onChange={(e) => setBrandingTitle(e.target.value)}
                    placeholder="Gestor Rodaleve"
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink">
                    Subtítulo
                  </label>
                  <input
                    type="text"
                    value={brandingSubtitle}
                    onChange={(e) => setBrandingSubtitle(e.target.value)}
                    placeholder="Tabela de manutenção e revisões"
                    className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4">
              <button
                type="button"
                disabled={savingBranding}
                onClick={() => {
                  setBrandingLogoUrl(DEFAULT_GESTOR_LOGO);
                  setBrandingTitle(DEFAULT_GESTOR_TITLE);
                  setBrandingSubtitle(DEFAULT_GESTOR_SUBTITLE);
                  void handleSaveBranding({
                    logo: DEFAULT_GESTOR_LOGO,
                    title: DEFAULT_GESTOR_TITLE,
                    subtitle: DEFAULT_GESTOR_SUBTITLE,
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-neutral disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restaurar padrão
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingBranding}
                  onClick={() => setBrandingModalOpen(false)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-neutral"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingBranding || uploadingBrandingLogo}
                  onClick={() => void handleSaveBranding()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingBranding ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação antes de importar backup */}
      {pendingImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 dark:bg-surface/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base font-bold text-ink">
                  Confirmar restauração de configurações
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  As configurações atuais do Gestor serão substituídas pelos dados do arquivo selecionado. Recomendamos baixar um backup rápido antes caso queira preservar a versão atual.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-surface p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                <span className="truncate font-bold text-ink">
                  {pendingImport.summary.fileName}
                </span>
                <span className="font-mono text-[11px] text-ink-muted">
                  v{pendingImport.summary.backupVersion} · {pendingImport.summary.format.toUpperCase()}
                </span>
              </div>
              {pendingImport.summary.exportedAt && (
                <p className="mt-2 text-[11px] text-ink-muted">
                  Exportado em:{' '}
                  <span className="font-medium text-ink tabular-nums">
                    {new Date(pendingImport.summary.exportedAt).toLocaleString('pt-BR')}
                  </span>
                </p>
              )}
              <div className="mt-2.5">
                <p className="text-[11px] font-semibold text-ink-muted">
                  Seções identificadas para restauração:
                </p>
                <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {pendingImport.summary.sections.map((sec) => (
                    <li key={sec} className="flex items-center gap-1.5 text-[11px] text-ink">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-text" />
                      <span>{sec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {importError && (
              <div className="mt-3 rounded-xl border border-brand/30 bg-brand-soft px-3 py-2 text-xs font-medium text-brand-text">
                {importError}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4">
              <button
                type="button"
                disabled={creatingPreImportBackup || importingBackup || !adminData}
                onClick={handleQuickBackupBeforeImport}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-neutral disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-brand-text" />
                {creatingPreImportBackup ? 'Gerando backup...' : 'Baixar backup rápido antes'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={importingBackup}
                  onClick={() => {
                    setPendingImport(null);
                    setImportError(null);
                  }}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-ink-muted hover:bg-surface-neutral hover:text-ink disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={importingBackup}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {importingBackup ? 'Restaurando...' : 'Confirmar e Restaurar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de alterações não salvas ao trocar de aba com auto-save desligado */}
      {pendingTabSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 dark:bg-surface/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-text">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  Alterações não salvas
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Você tem modificações pendentes nesta aba e o salvamento automático está desligado. Se trocar de aba agora, as alterações não salvas serão descartadas.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingTabSwitch(null)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-ink hover:bg-surface-neutral"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = pendingTabSwitch;
                  setPendingTabSwitch(null);
                  setTabDirty(false);
                  setActiveTab(target);
                }}
                className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand hover:bg-brand-hover"
              >
                Descartar e trocar de aba
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-semibold shadow-lg ${
            toast.type === 'success'
              ? 'border-border bg-card text-ink'
              : 'border-brand/30 bg-brand-soft text-brand-text'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-ink" />
          ) : (
            <XCircle className="h-4 w-4 text-brand-text" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
