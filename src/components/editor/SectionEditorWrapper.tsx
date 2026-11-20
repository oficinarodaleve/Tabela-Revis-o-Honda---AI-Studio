import React from 'react';
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

interface SectionEditorWrapperProps {
  block: PageSectionBlock;
  index: number;
  total: number;
  isEditMode: boolean;
  isDragOver: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
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
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onDuplicate,
  onInsertBelow,
  onDelete,
  children,
}: SectionEditorWrapperProps) {
  if (!isEditMode) {
    if (!block.visible) return null;
    return <>{children}</>;
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        onDragStart(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(e, index);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(index);
      }}
      className={`group relative border-b-2 border-dashed transition-all ${
        isDragOver
          ? 'border-[#E4002B] bg-red-50/30 ring-2 ring-[#E4002B]'
          : 'border-indigo-300/60 hover:border-indigo-500'
      }`}
    >
      {/* Floating section editor controls bar */}
      <div className="sticky top-[52px] z-30 mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 bg-indigo-950/90 px-3 py-1.5 text-[11px] text-white shadow-sm backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="inline-flex cursor-grab items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-bold active:cursor-grabbing">
            <GripVertical className="h-3.5 w-3.5 text-indigo-300" />
            Arrastar bloco
          </span>
          <span className="font-semibold text-indigo-100">{block.label}</span>
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
            title="Subir bloco"
            className="inline-flex items-center gap-0.5 rounded bg-white/10 px-2 py-1 font-semibold hover:bg-white/20 disabled:opacity-40"
          >
            <ArrowUp className="h-3 w-3" />
            Subir
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMoveDown(index)}
            title="Descer bloco"
            className="inline-flex items-center gap-0.5 rounded bg-white/10 px-2 py-1 font-semibold hover:bg-white/20 disabled:opacity-40"
          >
            <ArrowDown className="h-3 w-3" />
            Descer
          </button>
          <button
            type="button"
            onClick={() => onToggleVisibility(block.id)}
            title={block.visible ? 'Ocultar bloco' : 'Exibir bloco'}
            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 font-semibold hover:bg-white/20"
          >
            {block.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-amber-300" />}
            <span>{block.visible ? 'Ocultar' : 'Exibir'}</span>
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(index)}
            title="Duplicar bloco"
            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 font-semibold hover:bg-white/20"
          >
            <Copy className="h-3 w-3" />
            Duplicar
          </button>
          <button
            type="button"
            onClick={() => onInsertBelow(index)}
            title="Adicionar bloco abaixo"
            className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 font-semibold hover:bg-white/20"
          >
            <Plus className="h-3 w-3" />
            Novo bloco
          </button>
          {block.type === 'custom' && (
            <button
              type="button"
              onClick={() => onDelete(block.id)}
              title="Excluir bloco personalizado"
              className="inline-flex items-center gap-1 rounded bg-red-500/80 px-2 py-1 font-semibold text-white hover:bg-red-600"
            >
              <Trash2 className="h-3 w-3" />
              Excluir
            </button>
          )}
        </div>
      </div>

      <div className={!block.visible ? 'opacity-45 grayscale-[40%]' : ''}>{children}</div>
    </div>
  );
}
