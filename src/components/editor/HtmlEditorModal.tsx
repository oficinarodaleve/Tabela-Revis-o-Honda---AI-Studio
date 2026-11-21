import React, { useEffect, useRef, useState } from 'react';
import { Code2, Eye, RotateCcw, Save, Sparkles, X } from 'lucide-react';
import { SafeHtml } from '../SafeHtml';

export interface HtmlModalTarget {
  key: string;
  label: string;
  categoryLabel?: string;
  description?: string;
  initialHtml: string;
  hasOverride: boolean;
}

interface HtmlEditorModalProps {
  target: HtmlModalTarget;
  saving?: boolean;
  onClose: () => void;
  onSave: (key: string, html: string) => Promise<void> | void;
  onReset: (key: string) => Promise<void> | void;
}

const QUICK_HTML_SNIPPETS = [
  { label: 'Negrito', snippet: '<strong>texto</strong>' },
  { label: 'Destaque Marca', snippet: '<span class="font-bold text-brand-text">destaque</span>' },
  { label: 'Parágrafo', snippet: '<p>Novo parágrafo aqui.</p>' },
  { label: 'Quebra', snippet: '<br />' },
  {
    label: 'Link',
    snippet:
      '<a href="https://wa.me/557728880003" target="_blank" rel="noopener noreferrer" class="font-semibold text-brand-text underline">Falar no WhatsApp</a>',
  },
  {
    label: 'Lista',
    snippet: '<ul class="list-disc pl-5 space-y-1">\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>',
  },
  {
    label: 'Caixa Destaque',
    snippet:
      '<div class="rounded-xl border border-border bg-brand-soft px-4 py-3 text-sm text-ink">\n  <strong>Atenção:</strong> Mensagem destacada aqui.\n</div>',
  },
];

export function HtmlEditorModal({
  target,
  saving = false,
  onClose,
  onSave,
  onReset,
}: HtmlEditorModalProps) {
  const [draftHtml, setDraftHtml] = useState(target.initialHtml);
  const [activeMobilePane, setActiveMobilePane] = useState<'code' | 'preview'>('code');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraftHtml(target.initialHtml);
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const insertSnippet = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setDraftHtml((prev) => `${prev}${prev ? '\n' : ''}${snippet}`);
      return;
    }
    const start = el.selectionStart ?? draftHtml.length;
    const end = el.selectionEnd ?? draftHtml.length;
    const next = `${draftHtml.slice(0, start)}${snippet}${draftHtml.slice(end)}`;
    setDraftHtml(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + snippet.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3 backdrop-blur-xs sm:p-5"
      onClick={() => !saving && onClose()}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-surface px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand-text">
                <Code2 className="h-3 w-3" />
                Editor HTML na Página
              </span>
              {target.categoryLabel && (
                <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                  {target.categoryLabel}
                </span>
              )}
              <code className="rounded bg-surface-neutral px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                {target.key}
              </code>
            </div>
            <h3 className="mt-1.5 font-display text-base font-extrabold text-ink sm:text-lg">
              {target.label}
            </h3>
            {target.description && (
              <p className="mt-0.5 text-xs text-ink-muted">{target.description}</p>
            )}
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Fechar editor HTML"
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-neutral hover:text-ink disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Snippets toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-5 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-bold text-ink-muted">
              <Sparkles className="h-3 w-3 text-brand-text" />
              Inserir tag:
            </span>
            {QUICK_HTML_SNIPPETS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => insertSnippet(item.snippet)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-text"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 lg:hidden">
            <button
              type="button"
              onClick={() => setActiveMobilePane('code')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold ${
                activeMobilePane === 'code' ? 'bg-brand text-on-brand' : 'text-ink-muted'
              }`}
            >
              <Code2 className="h-3 w-3" />
              Código
            </button>
            <button
              type="button"
              onClick={() => setActiveMobilePane('preview')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold ${
                activeMobilePane === 'preview' ? 'bg-brand text-on-brand' : 'text-ink-muted'
              }`}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>
        </div>

        {/* Split Editor + Live Preview */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
          {/* Code pane */}
          <div
            className={`flex min-h-[280px] flex-col border-b border-border bg-surface p-4 lg:border-b-0 lg:border-r ${
              activeMobilePane === 'preview' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                Código HTML
              </span>
              <span className="font-mono text-[10px] text-ink-muted">
                {draftHtml.length} caracteres
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={draftHtml}
              onChange={(e) => setDraftHtml(e.target.value)}
              spellCheck={false}
              placeholder="Digite ou cole o código HTML deste bloco..."
              className="min-h-[240px] w-full flex-1 resize-none rounded-xl border border-border bg-card p-3.5 font-mono text-xs leading-relaxed text-ink focus:border-brand focus:outline-none"
            />
          </div>

          {/* Live preview pane */}
          <div
            className={`flex min-h-[280px] flex-col overflow-y-auto bg-card p-4 ${
              activeMobilePane === 'code' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <Eye className="h-3.5 w-3.5 text-brand-text" />
                Preview ao vivo
              </span>
              <span className="text-[10px] text-ink-muted">
                Renderização segura com tokens da marca
              </span>
            </div>
            <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-surface p-4">
              {draftHtml.trim() ? (
                <SafeHtml
                  html={draftHtml}
                  className="text-sm leading-relaxed text-ink [&_a]:text-brand-text [&_a]:underline [&_h1]:text-2xl [&_h1]:font-extrabold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-bold"
                />
              ) : (
                <p className="text-xs italic text-ink-muted">
                  Conteúdo vazio — o texto padrão original será mantido se você restaurar.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-5 py-3.5">
          <div>
            {target.hasOverride && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void onReset(target.key)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand hover:text-brand-text disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restaurar padrão original
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-ink transition-colors hover:bg-surface-neutral disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSave(target.key, draftHtml)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-xs font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Salvando...' : 'Salvar e Aplicar na Hora'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
