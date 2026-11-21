import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Code2,
  ExternalLink,
  Eye,
  FileDown,
  Moon,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import { FaqItem, MotoModel, VisualBuilderConfig } from '../../types';
import { adminFetch } from '../../utils/adminAuth';
import { exportHtmlEditorBackupJson } from '../../utils/gestorBackup';
import {
  HTML_CATEGORY_LABELS,
  HtmlEditableTarget,
  HtmlTargetCategory,
  buildHtmlEditableTargets,
} from '../../utils/htmlTargets';
import {
  loadLocalVisualConfig,
  mergeWithDefaultVisualConfig,
  saveLocalVisualConfig,
} from '../../utils/visualBuilder';
import { SafeHtml } from '../SafeHtml';

interface TabHtmlEditorProps {
  models: MotoModel[];
  faqs: FaqItem[];
  onSaved: () => Promise<void>;
  onToast: (type: 'success' | 'error', msg: string) => void;
  onOpenOnPageHtmlEditor: () => void;
  autoSaveEnabled: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onAutoSaveStart: () => void;
  onAutoSaveComplete: () => void;
  onAutoSaveError: (msg?: string) => void;
}

const SNIPPETS = [
  { label: 'Negrito', code: '<strong>texto</strong>' },
  { label: 'Destaque', code: '<span class="font-bold text-brand-text">destaque</span>' },
  { label: 'Parágrafo', code: '<p>Parágrafo de texto aqui.</p>' },
  {
    label: 'Aviso Caixa',
    code: '<div class="rounded-xl border border-border bg-brand-soft px-4 py-3 text-xs text-ink">\n  <strong>Importante:</strong> Seu texto aqui.\n</div>',
  },
  {
    label: 'Botão Link',
    code: '<a href="https://wa.me/557728880003" target="_blank" rel="noopener noreferrer" class="inline-flex items-center rounded-full bg-brand px-4 py-2 text-xs font-bold text-on-brand">Agendar agora</a>',
  },
  {
    label: 'Lista',
    code: '<ul class="list-disc pl-5 space-y-1 text-sm">\n  <li>Primeiro item</li>\n  <li>Segundo item</li>\n</ul>',
  },
];

export function TabHtmlEditor({
  models,
  faqs,
  onSaved,
  onToast,
  onOpenOnPageHtmlEditor,
  autoSaveEnabled,
  onDirtyChange,
  onAutoSaveStart,
  onAutoSaveComplete,
  onAutoSaveError,
}: TabHtmlEditorProps) {
  const modelIds = useMemo(() => models.map((m) => m.id), [models]);

  const [vbConfig, setVbConfig] = useState<VisualBuilderConfig>(() =>
    mergeWithDefaultVisualConfig(loadLocalVisualConfig(), modelIds)
  );
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<HtmlTargetCategory | 'all' | 'edited'>('all');
  const [selectedKey, setSelectedKey] = useState<string>('notice_line_1');
  const [draftHtml, setDraftHtml] = useState<string>('');
  const [previewDark, setPreviewDark] = useState(false);
  const [saving, setSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  // Carrega a versão mais recente do servidor (unificando com o armazenamento local)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/public/bootstrap');
        if (res.ok) {
          const json = (await res.json()) as {
            visual_builder?: Partial<VisualBuilderConfig> | null;
          };
          if (mounted) {
            const local = loadLocalVisualConfig();
            const merged = mergeWithDefaultVisualConfig(
              json.visual_builder || local,
              modelIds
            );
            // Se houver overrides salvos localmente ainda não enviados, preserva ambos
            if (local?.htmlOverrides) {
              merged.htmlOverrides = {
                ...(merged.htmlOverrides || {}),
                ...local.htmlOverrides,
              };
            }
            setVbConfig(merged);
            saveLocalVisualConfig(merged);
          }
        }
      } catch {
        // Mantém configuração carregada localmente
      } finally {
        if (mounted) setLoadingConfig(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [modelIds]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const targets = useMemo<HtmlEditableTarget[]>(
    () =>
      buildHtmlEditableTargets({
        sections: vbConfig.sections,
        models,
        faqs,
        vbConfig,
      }),
    [vbConfig, models, faqs]
  );

  const selectedTarget = useMemo(
    () => targets.find((t) => t.key === selectedKey) || targets[0],
    [targets, selectedKey]
  );

  // Sincroniza rascunho ao trocar o item selecionado
  useEffect(() => {
    if (!selectedTarget) return;
    const savedHtml = vbConfig.htmlOverrides?.[selectedTarget.key];
    setDraftHtml(savedHtml !== undefined ? savedHtml : selectedTarget.defaultHtml);
  }, [selectedTarget?.key]);

  const editedCount = useMemo(
    () => Object.keys(vbConfig.htmlOverrides || {}).filter((k) => Boolean(vbConfig.htmlOverrides?.[k]?.trim())).length,
    [vbConfig.htmlOverrides]
  );

  const filteredTargets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return targets.filter((t) => {
      if (categoryFilter === 'edited' && !t.hasOverride) return false;
      if (categoryFilter !== 'all' && categoryFilter !== 'edited' && t.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        t.categoryLabel.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    });
  }, [targets, categoryFilter, searchTerm]);

  const persistConfig = useCallback(
    async (nextConfig: VisualBuilderConfig, successMsg?: string) => {
      saveLocalVisualConfig(nextConfig);
      setSaving(true);
      onAutoSaveStart();
      try {
        const res = await adminFetch('/api/admin/visual-builder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextConfig),
        });
        if (!res.ok) {
          throw new Error(`Erro HTTP ${res.status} ao salvar HTML no servidor.`);
        }
        onAutoSaveComplete();
        onDirtyChange(false);
        await onSaved();
        if (successMsg) onToast('success', successMsg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao salvar código HTML.';
        onAutoSaveError(msg);
        onToast('error', `${msg} (Salvo localmente no navegador.)`);
      } finally {
        setSaving(false);
      }
    },
    [onAutoSaveComplete, onAutoSaveError, onAutoSaveStart, onDirtyChange, onSaved, onToast]
  );

  const buildNextConfigWithHtml = useCallback(
    (key: string, html: string, removeOverride = false): VisualBuilderConfig => {
      const nextOverrides = { ...(vbConfig.htmlOverrides || {}) };
      if (removeOverride || !html.trim()) {
        delete nextOverrides[key];
      } else {
        nextOverrides[key] = html;
      }
      return {
        ...vbConfig,
        htmlOverrides: nextOverrides,
      };
    },
    [vbConfig]
  );

  const handleDraftChange = (nextHtml: string) => {
    setDraftHtml(nextHtml);
    if (!selectedTarget) return;

    const currentSaved = vbConfig.htmlOverrides?.[selectedTarget.key] ?? selectedTarget.defaultHtml;
    const isChanged = nextHtml !== currentSaved;
    onDirtyChange(isChanged);

    if (autoSaveEnabled) {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      const nextConfig = buildNextConfigWithHtml(selectedTarget.key, nextHtml);
      setVbConfig(nextConfig);
      saveLocalVisualConfig(nextConfig);
      autoSaveTimerRef.current = window.setTimeout(() => {
        void persistConfig(nextConfig);
      }, 850);
    }
  };

  const handleSaveCurrent = async () => {
    if (!selectedTarget) return;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const nextConfig = buildNextConfigWithHtml(selectedTarget.key, draftHtml);
    setVbConfig(nextConfig);
    await persistConfig(
      nextConfig,
      `HTML de "${selectedTarget.label}" salvo localmente e publicado no site!`
    );
  };

  const handleResetCurrent = async () => {
    if (!selectedTarget) return;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const nextConfig = buildNextConfigWithHtml(selectedTarget.key, '', true);
    setVbConfig(nextConfig);
    setDraftHtml(selectedTarget.defaultHtml);
    await persistConfig(
      nextConfig,
      `"${selectedTarget.label}" restaurado para o conteúdo padrão original.`
    );
  };

  const handleExportHtmlBackup = () => {
    const activeConfig = selectedTarget
      ? buildNextConfigWithHtml(
          selectedTarget.key,
          draftHtml !== selectedTarget.defaultHtml ? draftHtml : vbConfig.htmlOverrides?.[selectedTarget.key] || '',
          !(draftHtml !== selectedTarget.defaultHtml || vbConfig.htmlOverrides?.[selectedTarget.key])
        )
      : vbConfig;
    const filename = exportHtmlEditorBackupJson(activeConfig);
    onToast('success', `Backup JSON do Editor HTML baixado: ${filename}`);
  };

  const handleImportHtmlBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        html_overrides?: Record<string, string>;
        visual_builder?: Partial<VisualBuilderConfig>;
      };
      const importedOverrides =
        parsed.html_overrides || parsed.visual_builder?.htmlOverrides || null;
      if (!importedOverrides || typeof importedOverrides !== 'object') {
        throw new Error('O arquivo JSON não contém edições do Editor HTML (html_overrides).');
      }
      const cleanOverrides: Record<string, string> = {};
      for (const [k, v] of Object.entries(importedOverrides)) {
        if (typeof k === 'string' && typeof v === 'string' && v.trim()) {
          cleanOverrides[k] = v;
        }
      }
      const merged = mergeWithDefaultVisualConfig(
        {
          ...(parsed.visual_builder || vbConfig),
          htmlOverrides: {
            ...(vbConfig.htmlOverrides || {}),
            ...cleanOverrides,
          },
        },
        modelIds
      );
      setVbConfig(merged);
      if (selectedTarget) {
        setDraftHtml(merged.htmlOverrides?.[selectedTarget.key] ?? selectedTarget.defaultHtml);
      }
      await persistConfig(
        merged,
        `Backup importado com sucesso (${Object.keys(cleanOverrides).length} blocos HTML aplicados)!`
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error ? err.message : 'Arquivo JSON inválido para importação do Editor HTML.'
      );
    }
  };

  const insertSnippet = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      handleDraftChange(`${draftHtml}${draftHtml ? '\n' : ''}${snippet}`);
      return;
    }
    const start = el.selectionStart ?? draftHtml.length;
    const end = el.selectionEnd ?? draftHtml.length;
    const next = `${draftHtml.slice(0, start)}${snippet}${draftHtml.slice(end)}`;
    handleDraftChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-extrabold text-ink">
              Editor HTML Avançado
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand-text">
              <Code2 className="h-3 w-3" />
              {editedCount} {editedCount === 1 ? 'bloco personalizado' : 'blocos personalizados'}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Selecione qualquer seção, aviso, modelo de moto, pergunta do FAQ ou bloco do rodapé para editar o HTML livremente com preview ao vivo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportHtmlBackup}
          />

          <button
            type="button"
            onClick={onOpenOnPageHtmlEditor}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-bold text-ink transition-colors hover:border-brand hover:text-brand-text"
          >
            <ExternalLink className="h-3.5 w-3.5 text-brand-text" />
            Editar HTML na Página
          </button>

          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-neutral"
          >
            <Upload className="h-3.5 w-3.5 text-ink-muted" />
            Importar JSON
          </button>

          <button
            type="button"
            onClick={handleExportHtmlBackup}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-ink transition-colors hover:border-brand hover:text-brand-text"
          >
            <FileDown className="h-3.5 w-3.5 text-brand-text" />
            Exportar JSON/Backup
          </button>

          <button
            type="button"
            disabled={saving || !selectedTarget}
            onClick={() => void handleSaveCurrent()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand shadow-xs transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Main Layout: Target Selector + Editor & Live Preview */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Sidebar: Target Selector */}
        <aside className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-xs lg:col-span-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar seção, aviso, modelo..."
              className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-brand focus:bg-card focus:outline-none"
            />
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-ink text-on-ink'
                  : 'bg-surface-neutral text-ink-muted hover:text-ink'
              }`}
            >
              Todos ({targets.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('edited')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                categoryFilter === 'edited'
                  ? 'bg-brand text-on-brand'
                  : 'bg-brand-soft text-brand-text hover:opacity-90'
              }`}
            >
              Editados ({editedCount})
            </button>
            {(Object.keys(HTML_CATEGORY_LABELS) as HtmlTargetCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  categoryFilter === cat
                    ? 'bg-ink text-on-ink'
                    : 'bg-surface-neutral text-ink-muted hover:text-ink'
                }`}
              >
                {HTML_CATEGORY_LABELS[cat].split(' ')[0]}
              </button>
            ))}
          </div>

          <div className="mt-3 max-h-[540px] space-y-1.5 overflow-y-auto pr-1">
            {loadingConfig ? (
              <p className="py-6 text-center text-xs text-ink-muted">
                Carregando elementos da página...
              </p>
            ) : filteredTargets.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-muted">
                Nenhum bloco encontrado com esse filtro.
              </p>
            ) : (
              filteredTargets.map((item) => {
                const isSelected = selectedTarget?.key === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedKey(item.key)}
                    className={`flex w-full items-start justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                      isSelected
                        ? 'border-brand bg-brand-soft/60 ring-1 ring-brand'
                        : 'border-border bg-surface/60 hover:border-brand/50 hover:bg-surface'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">{item.label}</p>
                      <p className="mt-0.5 truncate text-[10px] text-ink-muted">
                        {item.categoryLabel}
                      </p>
                    </div>
                    {item.hasOverride && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-on-brand">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        HTML
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Workspace: HTML Code + Live Preview Side-by-Side */}
        <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-xs lg:col-span-8">
          {selectedTarget && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-surface-neutral px-2.5 py-0.5 text-[10px] font-bold text-ink-muted">
                      {selectedTarget.categoryLabel}
                    </span>
                    <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                      {selectedTarget.key}
                    </code>
                  </div>
                  <h3 className="mt-1 font-display text-base font-bold text-ink">
                    {selectedTarget.label}
                  </h3>
                  <p className="text-xs text-ink-muted">{selectedTarget.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewDark((p) => !p)}
                    title="Alternar tema do preview"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:bg-surface-neutral"
                  >
                    {previewDark ? (
                      <>
                        <Sun className="h-3.5 w-3.5" />
                        Preview Claro
                      </>
                    ) : (
                      <>
                        <Moon className="h-3.5 w-3.5" />
                        Preview Escuro
                      </>
                    )}
                  </button>

                  {selectedTarget.hasOverride && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleResetCurrent()}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:border-brand hover:text-brand-text disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restaurar padrão
                    </button>
                  )}
                </div>
              </div>

              {/* Quick HTML snippets */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-bold text-ink-muted">
                  <Sparkles className="h-3 w-3 text-brand-text" />
                  Snippets:
                </span>
                {SNIPPETS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => insertSnippet(item.code)}
                    className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-text"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Side-by-side Code + Live Preview */}
              <div className="mt-4 grid flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="flex flex-col">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                      Código HTML
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted">
                      {draftHtml.length} chars
                    </span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={draftHtml}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    spellCheck={false}
                    placeholder="Escreva ou cole o HTML aqui..."
                    className="min-h-[340px] w-full flex-1 resize-y rounded-xl border border-border bg-surface p-3.5 font-mono text-xs leading-relaxed text-ink focus:border-brand focus:bg-card focus:outline-none"
                  />
                </div>

                <div className="flex flex-col">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                      <Eye className="h-3.5 w-3.5 text-brand-text" />
                      Preview ao vivo
                    </span>
                    <span className="text-[10px] text-ink-muted">
                      HTML sanitizado em tempo real
                    </span>
                  </div>
                  <div
                    className={`${previewDark ? 'dark' : ''} min-h-[340px] flex-1 overflow-y-auto rounded-xl border border-border bg-surface p-4 text-ink`}
                  >
                    {draftHtml.trim() ? (
                      <SafeHtml
                        html={draftHtml}
                        className="text-sm leading-relaxed text-ink [&_a]:text-brand-text [&_a]:underline [&_h1]:text-2xl [&_h1]:font-extrabold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-bold"
                      />
                    ) : (
                      <p className="text-xs italic text-ink-muted">
                        Nenhum código HTML informado. O conteúdo padrão original será exibido.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
