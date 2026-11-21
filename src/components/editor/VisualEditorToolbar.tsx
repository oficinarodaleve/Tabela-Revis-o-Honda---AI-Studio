import React from 'react';
import {
  ArrowUpDown,
  Check,
  Image as ImageIcon,
  LayoutGrid,
  Monitor,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Smartphone,
  Undo2,
} from 'lucide-react';

interface VisualEditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  viewport: 'desktop' | 'mobile';
  saving: boolean;
  hasUnsavedChanges: boolean;
  autoSaveEnabled: boolean;
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onUndo: () => void;
  onRedo: () => void;
  onChangeViewport: (v: 'desktop' | 'mobile') => void;
  onOpenAddBlock: () => void;
  onEditFavicon: () => void;
  onRestoreDefaultOrder: () => void;
  onRestoreDefault: () => void;
  onBackToGestor: () => void;
  onSaveAndPublish: () => void;
}

export function VisualEditorToolbar({
  canUndo,
  canRedo,
  viewport,
  saving,
  hasUnsavedChanges,
  autoSaveEnabled,
  autoSaveStatus,
  onUndo,
  onRedo,
  onChangeViewport,
  onOpenAddBlock,
  onEditFavicon,
  onRestoreDefaultOrder,
  onRestoreDefault,
  onBackToGestor,
  onSaveAndPublish,
}: VisualEditorToolbarProps) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-border/30 bg-[#111827]/95 text-white shadow-xl backdrop-blur">
      <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-5">
        {/* Left: Status + Auto-save badge + Undo/Redo + Viewport */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-brand/40 bg-brand/20 px-2.5 py-1.5 text-xs font-bold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
            <span>Modo Edição Ativo</span>
          </div>

          <div
            title={
              autoSaveEnabled
                ? 'Auto-save do Gestor ligado: a ordem dos blocos e edições são salvas automaticamente.'
                : 'Auto-save do Gestor desligado: clique em Salvar e Publicar para gravar no servidor.'
            }
            className={`hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold sm:inline-flex ${
              autoSaveEnabled
                ? autoSaveStatus === 'error'
                  ? 'border-brand/50 bg-brand/20 text-white'
                  : 'border-white/15 bg-white/5 text-white/90'
                : 'border-white/15 bg-white/5 text-white/60'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                autoSaveEnabled
                  ? autoSaveStatus === 'error'
                    ? 'bg-brand'
                    : 'bg-white'
                  : 'bg-white/40'
              }`}
            />
            {autoSaveEnabled
              ? autoSaveStatus === 'saving'
                ? 'Salvando...'
                : autoSaveStatus === 'saved'
                  ? 'Salvo automaticamente'
                  : autoSaveStatus === 'error'
                    ? 'Falha no auto-save'
                    : 'Auto-save: Ligado'
              : 'Auto-save: Desligado'}
          </div>

          <div className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Desfazer (Ctrl+Z)"
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Desfazer</span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Refazer (Ctrl+Y)"
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Refazer</span>
            </button>
          </div>

          <div className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => onChangeViewport('desktop')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                viewport === 'desktop'
                  ? 'bg-white text-[#111827]'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeViewport('mobile')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                viewport === 'mobile'
                  ? 'bg-white text-[#111827]'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Mobile</span>
            </button>
          </div>
        </div>

        {/* Right: Add Block, Favicon, Restore Order, Reset All, Gestor, Publish */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenAddBlock}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
          >
            <Plus className="h-3.5 w-3.5 text-brand" />
            <span>Adicionar bloco</span>
          </button>

          <button
            type="button"
            onClick={onEditFavicon}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
          >
            <ImageIcon className="h-3.5 w-3.5 text-white/80" />
            <span className="hidden xl:inline">Favicon</span>
          </button>

          <button
            type="button"
            onClick={onRestoreDefaultOrder}
            title="Voltar os blocos da página para a organização padrão original mantendo textos e imagens"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-brand" />
            <span>Restaurar ordem padrão</span>
          </button>

          <button
            type="button"
            onClick={onRestoreDefault}
            title="Restaurar ordem, textos e imagens para o padrão original"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Restaurar tudo</span>
          </button>

          <button
            type="button"
            onClick={onBackToGestor}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Painel Gestor</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={onSaveAndPublish}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-bold text-on-brand shadow-sm transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {saving ? (
              <span>Publicando...</span>
            ) : hasUnsavedChanges ? (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Salvar e Publicar</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Salvar e Publicar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
