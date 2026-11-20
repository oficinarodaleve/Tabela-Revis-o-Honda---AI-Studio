import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, LogOut, Paintbrush, XCircle } from 'lucide-react';
import {
  AdminUser,
  FaqItem,
  IntegrationsData,
  MotoModel,
  Part,
  RevisionPart,
  RevisionTab,
  Segment,
  SeoSettings,
} from '../../types';
import { adminFetch, clearAdminToken } from '../../utils/adminAuth';
import { AdminLogin } from './AdminLogin';
import { TabCategoriesTabs } from './TabCategoriesTabs';
import { TabFaqs } from './TabFaqs';
import { TabIntegrations } from './TabIntegrations';
import { TabModelsPhotos } from './TabModelsPhotos';
import { TabPricesParts } from './TabPricesParts';
import { TabRevisions } from './TabRevisions';
import { TabSeoIdentity } from './TabSeoIdentity';

type GestorTab =
  | 'revisoes'
  | 'precos'
  | 'modelos'
  | 'faqs'
  | 'categorias'
  | 'seo'
  | 'integracoes';

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
}

interface AdminPanelProps {
  onNavigate: (path: string) => void;
  onPublicDataChanged: () => Promise<void>;
  onOpenVisualEditor: () => void;
  onAuthChange?: (loggedIn: boolean) => void;
}

const TABS: Array<{ id: GestorTab; label: string }> = [
  { id: 'revisoes', label: 'Revisões' },
  { id: 'precos', label: 'Preços e Peças' },
  { id: 'modelos', label: 'Modelos e fotos' },
  { id: 'faqs', label: 'Perguntas frequentes' },
  { id: 'categorias', label: 'Categorias e abas' },
  { id: 'seo', label: 'SEO & Identidade' },
  { id: 'integracoes', label: 'Integrações & APIs' },
];

export function AdminPanel({
  onNavigate,
  onPublicDataChanged,
  onOpenVisualEditor,
  onAuthChange,
}: AdminPanelProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<GestorTab>('revisoes');
  const [adminData, setAdminData] = useState<AdminBootstrap | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => {
      setToast((curr) => (curr?.msg === msg ? null : curr));
    }, 4000);
  }, []);

  const loadAdminBootstrap = useCallback(async () => {
    setBootstrapError(null);
    try {
      const res = await adminFetch('/api/admin/bootstrap');
      if (res.status === 401) {
        clearAdminToken();
        setUser(null);
        onAuthChange?.(false);
        return;
      }
      if (!res.ok) {
        setBootstrapError('Não foi possível carregar os dados do painel. Tente novamente.');
        return;
      }
      const json = (await res.json()) as AdminBootstrap;
      setAdminData(json);
    } catch {
      setBootstrapError('Falha de conexão ao carregar os dados do gestor.');
    }
  }, [onAuthChange]);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          setUser(json.user);
          onAuthChange?.(true);
          await loadAdminBootstrap();
        } else {
          onAuthChange?.(false);
        }
      } finally {
        setCheckingAuth(false);
      }
    })();
  }, [loadAdminBootstrap, onAuthChange]);

  const handleSavedAndRefresh = useCallback(async () => {
    await Promise.all([loadAdminBootstrap(), onPublicDataChanged()]);
  }, [loadAdminBootstrap, onPublicDataChanged]);

  const handleLogout = async () => {
    try {
      await adminFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Garantir limpeza local mesmo se a rede falhar
    }
    clearAdminToken();
    setUser(null);
    setAdminData(null);
    onAuthChange?.(false);
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] text-sm text-neutral-500">
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
    <div className="min-h-screen bg-[#FAFAFA] text-neutral-900">
      {/* Cabeçalho branco */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1150px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="font-display text-lg font-extrabold uppercase tracking-tight sm:text-xl">
            <span className="text-neutral-900">RODALEVE </span>
            <span className="text-[#E4002B]">GESTOR</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <span className="hidden text-xs font-medium text-neutral-500 lg:inline">
              {user.email}
            </span>

            <button
              type="button"
              onClick={onOpenVisualEditor}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E4002B] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#C80024]"
            >
              <Paintbrush className="h-3.5 w-3.5" />
              Editar Site Visualmente
            </button>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver site
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-neutral-800"
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
                  onClick={() => setActiveTab(t.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                    active
                      ? 'bg-[#E4002B] text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
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
            <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-[#E4002B]">{bootstrapError}</p>
              <button
                type="button"
                onClick={loadAdminBootstrap}
                className="mt-4 rounded-xl bg-[#E4002B] px-4 py-2 text-xs font-bold text-white hover:bg-[#C80024]"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-neutral-500">
              Carregando dados do gestor...
            </div>
          )
        ) : (
          <>
            {activeTab === 'revisoes' && (
              <TabRevisions
                models={adminData.models}
                revisionTabs={adminData.revision_tabs}
                parts={adminData.parts}
                revisionParts={adminData.revision_parts}
                onSaved={handleSavedAndRefresh}
                onToast={showToast}
              />
            )}
            {activeTab === 'precos' && (
              <TabPricesParts
                parts={adminData.parts}
                lastSync={adminData.last_price_sync}
                onSaved={handleSavedAndRefresh}
                onToast={showToast}
              />
            )}
            {activeTab === 'modelos' && (
              <TabModelsPhotos
                models={adminData.models}
                segments={adminData.segments}
                onSaved={handleSavedAndRefresh}
                onToast={showToast}
              />
            )}
            {activeTab === 'faqs' && (
              <TabFaqs
                faqs={adminData.faqs}
                onSaved={handleSavedAndRefresh}
                onToast={showToast}
              />
            )}
            {activeTab === 'categorias' && (
              <TabCategoriesTabs
                segments={adminData.segments}
                revisionTabs={adminData.revision_tabs}
                onSaved={handleSavedAndRefresh}
                onToast={showToast}
              />
            )}
            {activeTab === 'seo' && (
              <TabSeoIdentity
                seo={adminData.seo}
                onSaved={handleSavedAndRefresh}
                onToast={showToast}
              />
            )}
            {activeTab === 'integracoes' && (
              <TabIntegrations
                integrations={adminData.integrations}
                onSaved={handleSavedAndRefresh}
                onToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* Toast Feedback */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-semibold shadow-lg ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-[#E4002B]'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <XCircle className="h-4 w-4 text-[#E4002B]" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
