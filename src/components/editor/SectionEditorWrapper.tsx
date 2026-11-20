import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import { PageSectionBlock } from '../../types';

export type DropPosition = 'before' | 'after';

interface SectionEditorWrapperProps {
  block: PageSectionBlock;
  index: number;
  total: number;
  isEditMode: boolean;
  isDraggingSelf: boolean;
  dropPosition: DropPosition | null;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number, position: DropPosition) => void;
  onDragEnd: () => void;
  onDrop: (index: number, position: DropPosition) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onToggleVisibility: (blockId: string) => void;
  onDuplicate: (index: number) => void;
  onInsertBelow: (index: number) => void;
  onDelete: (blockId: string) => void;
  children: React.ReactNode;
}

export function SectionEditorWrapper({
  block,
  index,
  total,
  isEditMode,
  isDraggingSelf,
  dropPosition,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onDuplicate,
  onInsertBelow,
  onDelete,
  children,
}: SectionEditorWrapperProps) {
  const [dragArmed, setDragArmed] = useState(false);

  if (!isEditMode) {
    if (!block.visible) return null;
    return <>{children}</>;
  }

  const computeDropPos = (e: React.DragEvent<HTMLDivElement>): DropPosition => {
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    return e.clientY < midY ? 'before' : 'after';
  };

  return (
    <div
      draggable={dragArmed}
      onDragStart={(e) => {
        if (!dragArmed) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        onDragStart(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(e, index, computeDropPos(e));
      }}
      onDrop={(e) => {
        e.preventDefault();
        const pos = dropPosition || computeDropPos(e);
        setDragArmed(false);
        onDrop(index, pos);
      }}
      onDragEnd={() => {
        setDragArmed(false);
        onDragEnd();
      }}
      className={`group relative border-b border-dashed transition-all ${
        isDraggingSelf
          ? 'scale-[0.995] border-[#E4002B]/50 bg-red-50/20 opacity-55'
          : dropPosition
            ? 'border-[#E4002B]/60 bg-red-50/15'
            : 'border-indigo-300/60 hover:border-indigo-500/80'
      }`}
    >
      {/* Indicador de soltura ACIMA do bloco */}
      {dropPosition === 'before' && !isDraggingSelf && (
        <div className="pointer-events-none relative z-40 mx-auto max-w-[1180px] px-4 sm:px-6">
          <div className="flex items-center gap-2 py-1">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E4002B] shadow-sm" />
            <div className="h-1 flex-1 rounded-full bg-[#E4002B] shadow-sm" />
            <span className="rounded-full bg-[#E4002B] px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
              Soltar bloco aqui
            </span>
            <div className="h-1 flex-1 rounded-full bg-[#E4002B] shadow-sm" />
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E4002B] shadow-sm" />
          </div>
        </div>
      )}

      {/* Barra discreta de controles do bloco (visível apenas no Modo Edição Visual) */}
      <div className="sticky top-[52px] z-30 mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 rounded-b-lg border-x border-b border-indigo-900/20 bg-neutral-900/90 px-3 py-1.5 text-[11px] text-white shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <span
            onMouseEnter={() => setDragArmed(true)}
            onMouseLeave={() => setDragArmed(false)}
            onPointerDown={() => setDragArmed(true)}
            title="Arraste por aqui para reordenar este bloco na página"
            className="inline-flex cursor-grab select-none items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-2 py-0.5 font-semibold text-white transition-colors hover:border-[#E4002B]/80 hover:bg-[#E4002B]/80 active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5 text-neutral-300" />
            <span className="font-bold">{block.label}</span>
          </span>
          {!block.visible && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
              Oculto no site
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMoveUp(index)}
            title="Mover para cima"
            aria-label={`Mover bloco ${block.label} para cima`}
            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 font-semibold transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowUp className="h-3 w-3" />
            <span className="hidden sm:inline">Mover para cima</span>
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMoveDown(index)}
            title="Mover para baixo"
            aria-label={`Mover bloco ${block.label} para baixo`}
            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 font-semibold transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowDown className="h-3 w-3" />
            <span className="hidden sm:inline">Mover para baixo</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleVisibility(block.id)}
            title={block.visible ? 'Ocultar bloco' : 'Exibir bloco'}
            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 font-semibold transition-colors hover:bg-white/20"
          >
            {block.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-amber-300" />}
            <span className="hidden md:inline">{block.visible ? 'Ocultar' : 'Exibir'}</span>
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(index)}
            title="Duplicar bloco"
            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 font-semibold transition-colors hover:bg-white/20"
          >
            <Copy className="h-3 w-3" />
            <span className="hidden md:inline">Duplicar</span>
          </button>
          <button
            type="button"
            onClick={() => onInsertBelow(index)}
            title="Adicionar bloco abaixo"
            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 font-semibold transition-colors hover:bg-white/20"
          >
            <Plus className="h-3 w-3" />
            <span className="hidden lg:inline">Novo bloco</span>
          </button>
          {block.type === 'custom' && (
            <button
              type="button"
              onClick={() => onDelete(block.id)}
              title="Excluir bloco personalizado"
              className="inline-flex items-center gap-1 rounded bg-red-500/80 px-2 py-1 font-semibold text-white transition-colors hover:bg-red-600"
            >
              <Trash2 className="h-3 w-3" />
              <span className="hidden sm:inline">Excluir</span>
            </button>
          )}
        </div>
      </div>

      <div className={!block.visible ? 'opacity-45 grayscale-[40%]' : ''}>{children}</div>

      {/* Indicador de soltura ABAIXO do bloco */}
      {dropPosition === 'after' && !isDraggingSelf && (
        <div className="pointer-events-none relative z-40 mx-auto max-w-[1180px] px-4 sm:px-6">
          <div className="flex items-center gap-2 py-1">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E4002B] shadow-sm" />
            <div className="h-1 flex-1 rounded-full bg-[#E4002B] shadow-sm" />
            <span className="rounded-full bg-[#E4002B] px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm">
              Soltar bloco aqui
            </span>
            <div className="h-1 flex-1 rounded-full bg-[#E4002B] shadow-sm" />
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E4002B] shadow-sm" />
          </div>
        </div>
      )}
    </div>
  );
}
