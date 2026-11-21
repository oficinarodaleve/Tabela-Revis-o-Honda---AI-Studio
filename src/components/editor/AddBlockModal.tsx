import React from 'react';
import { AlertCircle, FileText, Megaphone, X } from 'lucide-react';
import { CustomBlockVariant } from '../../types';

interface AddBlockModalProps {
  onSelect: (variant: CustomBlockVariant) => void;
  onClose: () => void;
}

export function AddBlockModal({ onSelect, onClose }: AddBlockModalProps) {
  const options: Array<{
    variant: CustomBlockVariant;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      variant: 'banner',
      title: 'Banner de Destaque',
      desc: 'Faixa promocional com título, texto, imagem opcional e botão de ação.',
      icon: Megaphone,
    },
    {
      variant: 'notice',
      title: 'Bloco de Aviso Informativo',
      desc: 'Caixa destacada para comunicados, condições ou avisos de oficina.',
      icon: AlertCircle,
    },
    {
      variant: 'text',
      title: 'Bloco de Texto Livre',
      desc: 'Seção limpa com título, parágrafo editável e imagem opcional.',
      icon: FileText,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-display text-base font-bold text-ink">
              Adicionar Novo Bloco
            </h3>
            <p className="text-xs text-ink-muted">
              Escolha o tipo de bloco para inserir na página
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-muted hover:bg-surface hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {options.map(({ variant, title, desc, icon: Icon }) => (
            <button
              key={variant}
              type="button"
              onClick={() => {
                onSelect(variant);
                onClose();
              }}
              className="flex w-full items-start gap-3.5 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-brand hover:bg-brand-soft/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-text">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">{title}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
