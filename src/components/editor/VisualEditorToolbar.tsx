import React from 'react';
import {
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
  onUndo: () => void;
  onRedo: () => void;
  onChangeViewport: (v: 'desktop' | 'mobile') => void;
  onOpenAddBlock: () => void;
  onEditFavicon: () => void;
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
  onUndo,
  onRedo,
  onChangeViewport,
  onOpenAddBlock,
  onEditFavicon,
  onRestoreDefault,
  onBackToGestor,
  onSaveAndPublish,
}: VisualEditorToolbarProps) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 text-white shadow-xl backdrop-blur">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-5">
        {/* Left: Status + Undo/Redo */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span>Modo Edição Ativo</span>
          </div>

          <div className="inline-flex items-center rounded-lg border border-neutral-800 bg-neutral-900 p-0.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Desfazer (Ctrl+Z)"
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desfazer</span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Refazer (Ctrl+Y)"
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refazer</span>
            </button>
          </div>

          <div className="inline-flex items-center rounded-lg border border-neutral-800 bg-neutral-900 p-0.5">
            <button
              type="button"
              onClick={() => onChangeViewport('desktop')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                viewport === 'desktop'
                  ? 'bg-white text-neutral-950'
                  : 'text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeViewport('mobile')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                viewport === 'mobile'
                  ? 'bg-white text-neutral-950'
                  : 'text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Mobile</span>
            </button>
          </div>
        </div>

        {/* Right: Add Block, Favicon, Reset, Gestor, Publish */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenAddBlock}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-neutral-100 transition-colors hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5 text-[#E4002B]" />
            <span>Adicionar bloco</span>
          </button>

          <button
            type="button"
            onClick={onEditFavicon}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-neutral-100 transition-colors hover:bg-neutral-800"
          >
            <ImageIcon className="h-3.5 w-3.5 text-neutral-300" />
            <span className="hidden sm:inline">Favicon</span>
          </button>

          <button
            type="button"
            onClick={onRestoreDefault}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Restaurar padrão</span>
          </button>

          <button
            type="button"
            onClick={onBackToGestor}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-700"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Painel Gestor</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={onSaveAndPublish}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#E4002B] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#C80024] disabled:opacity-60"
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
