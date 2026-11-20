import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, LogOut, XCircle } from 'lucide-react';
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

export function AdminPanel({ onNavigate, onPublicDataChanged }: AdminPanelProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<GestorTab>('revisoes');
  const [adminData, setAdminData] = useState<AdminBootstrap | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => {
      setToast((curr) => (curr?.msg === msg ? null : curr));
    }, 4000);
  }, []);

  const loadAdminBootstrap = useCallback(async () => {
    const res = await fetch('/api/admin/bootstrap');
    if (res.status === 401) {
      setUser(null);
      return;
    }
    if (res.ok) {
      const json = (await res.json()) as AdminBootstrap;
      setAdminData(json);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          setUser(json.user);
          await loadAdminBootstrap();
        }
      } finally {
        setCheckingAuth(false);
      }
    })();
  }, [loadAdminBootstrap]);

  const handleSavedAndRefresh = useCallback(async () => {
    await Promise.all([loadAdminBootstrap(), onPublicDataChanged()]);
  }, [loadAdminBootstrap, onPublicDataChanged]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setAdminData(null);
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

          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-medium text-neutral-500 sm:inline">
              {user.email}
            </span>

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
          <div className="py-12 text-center text-sm text-neutral-500">
            Carregando dados do gestor...
          </div>
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
