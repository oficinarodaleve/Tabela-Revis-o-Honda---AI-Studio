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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h3 className="font-display text-base font-bold text-neutral-900">
              Adicionar Novo Bloco
            </h3>
            <p className="text-xs text-neutral-500">
              Escolha o tipo de bloco para inserir na página
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
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
              className="flex w-full items-start gap-3.5 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-all hover:border-[#E4002B] hover:bg-red-50/30"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#E4002B]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-900">{title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
