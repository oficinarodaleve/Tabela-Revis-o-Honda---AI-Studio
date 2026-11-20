import React, { useCallback, useEffect, useState } from 'react';
import { PublicBootstrapData } from './types';
import { adminFetch, getAdminToken } from './utils/adminAuth';
import { PublicPage } from './components/PublicPage';
import { AdminPanel } from './components/admin/AdminPanel';
import { SeoHeadSync } from './components/SeoHeadSync';

export default function App() {
  const [route, setRoute] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [publicData, setPublicData] = useState<PublicBootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('rodaleve_theme') === 'dark';
  });
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => Boolean(getAdminToken()));
  const [isEditMode, setIsEditMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.search.includes('visual_editor=1');
  });

  const loadPublicData = useCallback(async () => {
    try {
      const res = await fetch('/api/public/bootstrap');
      if (!res.ok) throw new Error('Falha ao carregar dados da tabela de revisões.');
      const json = (await res.json()) as PublicBootstrapData;
      setPublicData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPublicData();
  }, [loadPublicData]);

  // Verifica silenciosamente se há sessão administrativa válida (cookie ou token em memória/storage)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await adminFetch('/api/auth/me');
        if (!active) return;
        if (res.ok) {
          setIsAdminLoggedIn(true);
        } else {
          setIsAdminLoggedIn(false);
          setIsEditMode(false);
        }
      } catch {
        if (active) {
          setIsAdminLoggedIn(false);
          setIsEditMode(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [route]);

  useEffect(() => {
    const onPopState = () => {
      setRoute(window.location.pathname);
      setIsEditMode(window.location.search.includes('visual_editor=1'));
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
    localStorage.setItem('rodaleve_theme', darkMode ? 'dark' : 'light');
  }, [darkMode, route]);

  const navigate = useCallback((path: string) => {
    const [pathname] = path.split('?');
    const currentFull = `${window.location.pathname}${window.location.search}`;
    if (currentFull !== path) {
      window.history.pushState({}, '', path);
      setRoute(pathname || '/');
      setIsEditMode(path.includes('visual_editor=1'));
      window.scrollTo({ top: 0 });
    }
  }, []);

  const enterEditMode = useCallback(() => {
    setIsEditMode(true);
    window.history.pushState({}, '', '/?visual_editor=1');
    setRoute('/');
    window.scrollTo({ top: 0 });
  }, []);

  const exitEditModeToGestor = useCallback(() => {
    setIsEditMode(false);
    navigate('/gestor');
  }, [navigate]);

  const isGestor = route.startsWith('/gestor');

  return (
    <>
      <SeoHeadSync seo={publicData?.seo ?? null} />

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
        <AdminPanel
          onNavigate={navigate}
          onPublicDataChanged={loadPublicData}
          onOpenVisualEditor={enterEditMode}
          onAuthChange={setIsAdminLoggedIn}
        />
      ) : loading ? (
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] text-sm font-medium text-neutral-500">
          Carregando Tabela de Manutenção Rodaleve Honda...
        </div>
      ) : error || !publicData ? (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#FAFAFA] px-4 text-center">
          <p className="text-base font-bold text-neutral-900">
            Não foi possível carregar os dados
          </p>
          <p className="text-sm text-neutral-500">{error}</p>
          <button
            type="button"
            onClick={() => void loadPublicData()}
            className="rounded-xl bg-[#E4002B] px-5 py-2.5 text-xs font-bold text-white"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <PublicPage
          data={publicData}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
          onNavigate={navigate}
          isAdminLoggedIn={isAdminLoggedIn}
          isEditMode={isEditMode && isAdminLoggedIn}
          onEnterEditMode={enterEditMode}
          onExitEditModeToGestor={exitEditModeToGestor}
          onPublicDataChanged={loadPublicData}
        />
      )}
    </>
  );
}
