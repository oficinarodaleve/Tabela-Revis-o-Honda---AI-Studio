import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  LogOut,
  Paintbrush,
  Upload,
  XCircle,
} from 'lucide-react';
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
  VisualBuilderConfig,
} from '../../types';
import { adminFetch, clearAdminToken } from '../../utils/adminAuth';
import {
  exportFullSiteZip,
  getAutoSavePreference,
  parseBackupFile,
  setAutoSavePreference,
} from '../../utils/gestorBackup';
import {
  loadLocalVisualConfig,
  mergeWithDefaultVisualConfig,
  saveLocalVisualConfig,
} from '../../utils/visualBuilder';
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

  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => getAutoSavePreference());
  const [tabDirty, setTabDirty] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [pendingTabSwitch, setPendingTabSwitch] = useState<GestorTab | null>(null);
  const [exportingZip, setExportingZip] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleAutoSaveComplete = useCallback(() => {
    const timeStr = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setLastAutoSavedAt(timeStr);
    setTabDirty(false);
  }, []);

  const handleToggleAutoSave = () => {
    const next = !autoSaveEnabled;
    setAutoSaveEnabled(next);
    setAutoSavePreference(next);
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
    setActiveTab(target);
  };

  const handleExportZip = async () => {
    if (!adminData) return;
    setExportingZip(true);
    try {
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

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportingBackup(true);
    try {
      const payload = await parseBackupFile(file);
      const res = await adminFetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao restaurar backup.');

      if (payload.visual_builder) {
        const modelIds = (payload.models || adminData?.models || []).map((m) => m.id);
        saveLocalVisualConfig(
          mergeWithDefaultVisualConfig(payload.visual_builder, modelIds)
        );
      }
      setTabDirty(false);
      await handleSavedAndRefresh();
      showToast('success', 'Backup restaurado e publicado com sucesso!');
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Falha ao importar arquivo de backup.'
      );
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
        <div className="mx-auto flex min-h-16 max-w-[1150px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="font-display text-lg font-extrabold uppercase tracking-tight sm:text-xl">
              <span className="text-neutral-900">RODALEVE </span>
              <span className="text-[#E4002B]">GESTOR</span>
            </div>

            {/* Indicador de salvamento / alterações pendentes */}
            {!autoSaveEnabled && tabDirty ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                <AlertTriangle className="h-3 w-3" />
                Alterações não salvas
              </span>
            ) : autoSaveEnabled && tabDirty ? (
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600">
                Salvando...
              </span>
            ) : autoSaveEnabled && lastAutoSavedAt ? (
              <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
                <CheckCircle2 className="h-3 w-3" />
                Salvo automaticamente às {lastAutoSavedAt}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2">
            {/* Toggle Salvamento Automático */}
            <button
              type="button"
              onClick={handleToggleAutoSave}
              title="Ativar ou desativar o salvamento automático ao editar campos no gestor"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                autoSaveEnabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  autoSaveEnabled ? 'bg-emerald-500' : 'bg-neutral-400'
                }`}
              />
              Auto-save: {autoSaveEnabled ? 'Ligado' : 'Desligado'}
            </button>

            {/* Exportar ZIP completo do site (código-fonte, assets, banco e backup do Gestor) */}
            <button
              type="button"
              disabled={!adminData || exportingZip}
              onClick={handleExportZip}
              title="Baixar arquivo ZIP completo com toda a estrutura do site (código-fonte, assets, banco de dados e backup do Gestor) para importar em outras plataformas"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 text-[#E4002B]" />
              {exportingZip ? 'Exportando site...' : 'Exportar Site ZIP'}
            </button>

            {/* Importar Backup (.zip ou .json) */}
            <input
              ref={importInputRef}
              type="file"
              accept=".zip,.json"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              disabled={importingBackup}
              onClick={() => importInputRef.current?.click()}
              title="Restaurar dados a partir de um backup .zip ou .json"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5 text-neutral-600" />
              {importingBackup ? 'Restaurando...' : 'Importar'}
            </button>

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
                  onClick={() => handleSelectTab(t.id)}
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
                autoSaveEnabled={autoSaveEnabled}
                onDirtyChange={setTabDirty}
                onAutoSaveComplete={handleAutoSaveComplete}
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
                onAutoSaveComplete={handleAutoSaveComplete}
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
                onAutoSaveComplete={handleAutoSaveComplete}
              />
            )}
            {activeTab === 'faqs' && (
              <TabFaqs
                faqs={adminData.faqs}
                onSaved={handleSavedAndRefresh}
                onToast={showToast}
                autoSaveEnabled={autoSaveEnabled}
                onDirtyChange={setTabDirty}
                onAutoSaveComplete={handleAutoSaveComplete}
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
                onAutoSaveComplete={handleAutoSaveComplete}
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
                onAutoSaveComplete={handleAutoSaveComplete}
              />
            )}
            {activeTab === 'integracoes' && (
              <TabIntegrations
                integrations={adminData.integrations}
                onSaved={handleSavedAndRefresh}
                onToast={showToast}
                autoSaveEnabled={autoSaveEnabled}
                onDirtyChange={setTabDirty}
                onAutoSaveComplete={handleAutoSaveComplete}
              />
            )}
          </>
        )}
      </main>

      {/* Modal de confirmação de alterações não salvas ao trocar de aba com auto-save desligado */}
      {pendingTabSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-neutral-900">
                  Alterações não salvas
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                  Você tem modificações pendentes nesta aba e o salvamento automático está desligado. Se trocar de aba agora, as alterações não salvas serão descartadas.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingTabSwitch(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-800 hover:bg-neutral-50"
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
                className="rounded-xl bg-[#E4002B] px-4 py-2 text-xs font-bold text-white hover:bg-[#C80024]"
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
