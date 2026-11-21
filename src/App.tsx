import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { PublicBootstrapData } from './types';
import { adminFetch, clearAdminToken, getAdminToken } from './utils/adminAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicPage } from './components/PublicPage';
import { SeoHeadSync } from './components/SeoHeadSync';
import { fetchWithRetry, normalizePublicBootstrapData } from './utils/bootstrapNormalize';
import {
  LANGUAGE_META,
  SiteLanguage,
  UI_TRANSLATIONS,
  getInitialLanguage,
  persistLanguage,
} from './utils/i18n';

const AdminPanel = lazy(() =>
  import('./components/admin/AdminPanel').then((m) => ({ default: m.AdminPanel }))
);

const BOOTSTRAP_CACHE_KEY = 'rodaleve_bootstrap_cache_v1';
const ADMIN_HINT_KEY = 'rodaleve_admin_hint';

type InitialBootstrapState = {
  data: PublicBootstrapData | null;
  source: 'inline' | 'cache' | 'none';
};

function readInitialPublicBootstrap(): InitialBootstrapState {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { data: null, source: 'none' };
  }
  try {
    const inlineEl = document.getElementById('__RODALEVE_BOOTSTRAP__');
    if (inlineEl?.textContent) {
      const parsed = JSON.parse(inlineEl.textContent) as unknown;
      const normalized = normalizePublicBootstrapData(parsed);
      if (normalized.models.length > 0 || normalized.revision_tabs.length > 0) {
        try {
          window.localStorage?.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify(normalized));
        } catch {
          // Ignore storage quota errors
        }
        return { data: normalized, source: 'inline' };
      }
    }
  } catch {
    // Fallback to localStorage cache
  }

  try {
    const cached = window.localStorage?.getItem(BOOTSTRAP_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as unknown;
      const normalized = normalizePublicBootstrapData(parsed);
      if (normalized.models.length > 0 || normalized.revision_tabs.length > 0) {
        return { data: normalized, source: 'cache' };
      }
    }
  } catch {
    // Ignore corrupted cache
  }

  return { data: null, source: 'none' };
}

function PublicLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-surface" aria-busy="true">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/90">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 sm:px-6">
          <div className="h-8 w-32 rounded-lg bg-surface-neutral" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 rounded-full bg-surface-neutral" />
            <div className="h-9 w-36 rounded-full bg-brand/85" />
          </div>
        </div>
      </header>
      <section className="border-b border-border bg-card py-10 sm:py-12">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          <div className="h-3.5 w-44 rounded bg-brand-soft" />
          <div className="mt-3 h-9 w-4/5 max-w-xl rounded-lg bg-surface-neutral" />
          <div className="mt-3 h-5 w-3/4 max-w-lg rounded bg-surface" />
        </div>
      </section>
      <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6">
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 w-28 shrink-0 rounded-2xl border border-border bg-card"
            />
          ))}
        </div>
        <div className="mt-6 flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[430px] w-[285px] shrink-0 rounded-2xl border border-border bg-card sm:w-[318px]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const initialBootstrapRef = useRef<InitialBootstrapState | null>(null);
  if (initialBootstrapRef.current === null) {
    initialBootstrapRef.current = readInitialPublicBootstrap();
  }
  const initialBootstrap = initialBootstrapRef.current;

  const [route, setRoute] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [publicData, setPublicData] = useState<PublicBootstrapData | null>(initialBootstrap.data);
  const [loading, setLoading] = useState<boolean>(() => !initialBootstrap.data);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage?.getItem('rodaleve_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => Boolean(getAdminToken()));
  const [isEditMode, setIsEditMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('visual_editor=1');
  });
  const [isHtmlEditMode, setIsHtmlEditMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('html_editor=1');
  });
  const [language, setLanguage] = useState<SiteLanguage>(() => getInitialLanguage());
  const hasPublicDataRef = useRef(Boolean(initialBootstrap.data));

  const loadPublicData = useCallback(async (options?: { manualRetry?: boolean }) => {
    if (options?.manualRetry) {
      setError(null);
      if (!hasPublicDataRef.current) {
        setLoading(true);
      }
    }
    try {
      const win = window as Window & { __rodaleveBootstrapPromise?: Promise<Response> };
      const preloadedPromise = !options?.manualRetry ? win.__rodaleveBootstrapPromise : undefined;
      if (preloadedPromise) {
        win.__rodaleveBootstrapPromise = undefined;
      }

      let res: Response | null = null;
      if (preloadedPromise) {
        try {
          const candidate = await preloadedPromise;
          if (candidate.ok) {
            res = candidate;
          }
        } catch {
          res = null;
        }
      }

      if (!res) {
        res = await fetchWithRetry(() => fetch('/api/public/bootstrap'), 2, 400);
      }

      if (!res.ok) {
        throw new Error(`Falha ao carregar dados da tabela de revisões (HTTP ${res.status}).`);
      }
      const rawJson = (await res.json()) as unknown;
      const normalized = normalizePublicBootstrapData(rawJson);
      hasPublicDataRef.current = true;
      setPublicData(normalized);
      setError(null);
      try {
        window.localStorage?.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify(normalized));
      } catch {
        // Ignore storage quota errors
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Erro ao carregar dados.';
      console.error('[App] Falha ao carregar /api/public/bootstrap:', e);
      if (!hasPublicDataRef.current) {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialBootstrap.source === 'inline') {
      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      let timerId: number | null = null;
      let idleId: number | null = null;
      if (typeof win.requestIdleCallback === 'function') {
        idleId = win.requestIdleCallback(() => void loadPublicData(), { timeout: 2500 });
      } else {
        timerId = window.setTimeout(() => void loadPublicData(), 1800);
      }
      return () => {
        if (idleId !== null && typeof win.cancelIdleCallback === 'function') {
          win.cancelIdleCallback(idleId);
        }
        if (timerId !== null) {
          window.clearTimeout(timerId);
        }
      };
    }

    void loadPublicData();
    return undefined;
  }, [initialBootstrap.source, loadPublicData]);

  // Verifica sessão administrativa Firebase apenas em rotas do gestor ou quando já existe sessão prévia
  useEffect(() => {
    let active = true;
    const isUrgentAuthRoute =
      route.startsWith('/gestor') ||
      (typeof window !== 'undefined' &&
        (window.location.search.includes('visual_editor=1') ||
          window.location.search.includes('html_editor=1')));

    let hasAdminHint = Boolean(getAdminToken());
    if (!hasAdminHint && typeof window !== 'undefined') {
      try {
        hasAdminHint = window.localStorage?.getItem(ADMIN_HINT_KEY) === '1';
      } catch {
        hasAdminHint = false;
      }
    }

    if (!isUrgentAuthRoute && !hasAdminHint) {
      return () => {
        active = false;
      };
    }

    const checkAuth = async () => {
      try {
        const { auth } = await import('./lib/firebase');
        await auth.authStateReady();
        if (!active) return;
        if (!auth.currentUser) {
          clearAdminToken();
          try {
            window.localStorage?.removeItem(ADMIN_HINT_KEY);
          } catch {
            // Ignore storage errors
          }
          setIsAdminLoggedIn(false);
          setIsEditMode(false);
          setIsHtmlEditMode(false);
          return;
        }
        const res = await adminFetch('/api/auth/me');
        if (!active) return;
        if (res.ok) {
          try {
            window.localStorage?.setItem(ADMIN_HINT_KEY, '1');
          } catch {
            // Ignore storage errors
          }
          setIsAdminLoggedIn(true);
        } else {
          try {
            window.localStorage?.removeItem(ADMIN_HINT_KEY);
          } catch {
            // Ignore storage errors
          }
          setIsAdminLoggedIn(false);
          setIsEditMode(false);
          setIsHtmlEditMode(false);
        }
      } catch {
        if (active) {
          setIsAdminLoggedIn(false);
          setIsEditMode(false);
          setIsHtmlEditMode(false);
        }
      }
    };

    if (isUrgentAuthRoute) {
      void checkAuth();
      return () => {
        active = false;
      };
    }

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let timerId: number | null = null;
    let idleId: number | null = null;

    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(() => void checkAuth(), { timeout: 2200 });
    } else {
      timerId = window.setTimeout(() => void checkAuth(), 1500);
    }

    return () => {
      active = false;
      if (idleId !== null && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
      }
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [route]);

  useEffect(() => {
    const onPopState = () => {
      setRoute(window.location.pathname);
      setIsEditMode(window.location.search.includes('visual_editor=1'));
      setIsHtmlEditMode(window.location.search.includes('html_editor=1'));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode && !route.startsWith('/gestor')) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage?.setItem('rodaleve_theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignora bloqueio de storage em iframe/sandbox
    }
  }, [darkMode, route]);

  useEffect(() => {
    const isGestorRoute = route.startsWith('/gestor');
    const langMeta = LANGUAGE_META[language] || LANGUAGE_META.pt;
    document.documentElement.lang = isGestorRoute ? 'pt-BR' : langMeta.htmlLang;
  }, [language, route]);

  const handleChangeLanguage = useCallback((nextLang: SiteLanguage) => {
    setLanguage(nextLang);
    persistLanguage(nextLang);
  }, []);

  const navigate = useCallback((path: string) => {
    const [pathname] = path.split('?');
    const currentFull = `${window.location.pathname}${window.location.search}`;
    if (currentFull !== path) {
      window.history.pushState({}, '', path);
      setRoute(pathname || '/');
      setIsEditMode(path.includes('visual_editor=1'));
      setIsHtmlEditMode(path.includes('html_editor=1'));
      window.scrollTo({ top: 0 });
    }
  }, []);

  // Atalho discreto Ctrl+Shift+G (ou Cmd+Shift+G) para acessar /gestor sem exibir botões a visitantes comuns
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        navigate('/gestor');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  const enterEditMode = useCallback(() => {
    setIsHtmlEditMode(false);
    setIsEditMode(true);
    window.history.pushState({}, '', '/?visual_editor=1');
    setRoute('/');
    window.scrollTo({ top: 0 });
  }, []);

  const exitEditModeToGestor = useCallback(() => {
    setIsEditMode(false);
    setIsHtmlEditMode(false);
    navigate('/gestor');
  }, [navigate]);

  const enterHtmlEditMode = useCallback(() => {
    setIsEditMode(false);
    setIsHtmlEditMode(true);
    window.history.pushState({}, '', '/?html_editor=1');
    setRoute('/');
    window.scrollTo({ top: 0 });
  }, []);

  const exitHtmlEditMode = useCallback(() => {
    setIsHtmlEditMode(false);
    navigate('/');
  }, [navigate]);

  const exitHtmlEditModeToGestor = useCallback(() => {
    setIsHtmlEditMode(false);
    navigate('/gestor?tab=editor_html');
  }, [navigate]);

  const isGestor = route.startsWith('/gestor');

  return (
    <>
      <SeoHeadSync seo={publicData?.seo ?? null} faqs={publicData?.faqs ?? []} />

      {gmpQuotaExceeded && !isGestor && (
        <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs text-amber-900 shadow-sm md:text-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-950 underline hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {isGestor ? (
        <ErrorBoundary
          screenName="Gestor Rodaleve"
          onReset={() => {
            setError(null);
          }}
        >
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-surface text-sm font-medium text-ink-muted">
                Carregando Gestor Rodaleve...
              </div>
            }
          >
            <AdminPanel
              onNavigate={navigate}
              onPublicDataChanged={loadPublicData}
              onOpenVisualEditor={enterEditMode}
              onOpenHtmlEditor={enterHtmlEditMode}
              onAuthChange={setIsAdminLoggedIn}
            />
          </Suspense>
        </ErrorBoundary>
      ) : loading ? (
        <PublicLoadingSkeleton />
      ) : error || !publicData ? (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface px-4 text-center">
          <p className="text-base font-bold text-ink">
            {(UI_TRANSLATIONS[language] || UI_TRANSLATIONS.pt).loadErrorTitle}
          </p>
          <p className="text-sm text-ink-muted">{error}</p>
          <button
            type="button"
            onClick={() => void loadPublicData({ manualRetry: true })}
            className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-on-brand transition-colors hover:bg-brand-hover"
          >
            {(UI_TRANSLATIONS[language] || UI_TRANSLATIONS.pt).tryAgain}
          </button>
        </div>
      ) : (
        <ErrorBoundary
          screenName="Página Pública"
          onReset={() => {
            setError(null);
            return loadPublicData();
          }}
        >
          <PublicPage
            data={publicData}
            language={language}
            onChangeLanguage={handleChangeLanguage}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((prev) => !prev)}
            onNavigate={navigate}
            isAdminLoggedIn={isAdminLoggedIn}
            isEditMode={isEditMode && isAdminLoggedIn}
            isHtmlEditMode={isHtmlEditMode && isAdminLoggedIn}
            onEnterEditMode={enterEditMode}
            onEnterHtmlEditMode={enterHtmlEditMode}
            onExitHtmlEditMode={exitHtmlEditMode}
            onExitHtmlEditModeToGestor={exitHtmlEditModeToGestor}
            onExitEditModeToGestor={exitEditModeToGestor}
            onPublicDataChanged={loadPublicData}
          />
        </ErrorBoundary>
      )}
    </>
  );
}
