import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Palette,
} from 'lucide-react';
import {
  EditableTextEntry,
  TextAlignOption,
  TextSizeOption,
  TextWeightOption,
} from '../../types';

interface EditableTextProps {
  textKey: string;
  defaultText: string;
  entry?: EditableTextEntry;
  isEditMode: boolean;
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div' | 'strong';
  className?: string;
  onCommit: (key: string, next: EditableTextEntry) => void;
}

const SIZE_CLASS_MAP: Record<TextSizeOption, string> = {
  default: '',
  xs: '!text-xs',
  sm: '!text-sm',
  base: '!text-base',
  lg: '!text-lg',
  xl: '!text-xl',
  '2xl': '!text-2xl',
  '3xl': '!text-3xl',
};

const WEIGHT_CLASS_MAP: Record<TextWeightOption, string> = {
  normal: '!font-normal',
  semibold: '!font-semibold',
  bold: '!font-bold',
};

const ALIGN_CLASS_MAP: Record<TextAlignOption, string> = {
  left: '!text-left',
  center: '!text-center',
  right: '!text-right',
};

const QUICK_COLORS = [
  { label: 'Padrão', value: '' },
  { label: 'Vermelho Honda', value: '#E4002B' },
  { label: 'Preto', value: '#171717' },
  { label: 'Cinza', value: '#525252' },
  { label: 'Branco', value: '#FFFFFF' },
];

export function EditableText({
  textKey,
  defaultText,
  entry,
  isEditMode,
  as: Tag = 'span',
  className = '',
  onCommit,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableTextEntry>({
    text: entry?.text ?? defaultText,
    color: entry?.color || '',
    size: entry?.size || 'default',
    weight: entry?.weight,
    align: entry?.align,
  });

  const editableRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const resolvedText = entry?.text ?? defaultText;
  const resolvedColor = editing ? draft.color : entry?.color;
  const resolvedSize = editing ? draft.size : entry?.size;
  const resolvedWeight = editing ? draft.weight : entry?.weight;
  const resolvedAlign = editing ? draft.align : entry?.align;

  useEffect(() => {
    if (!editing) {
      setDraft({
        text: entry?.text ?? defaultText,
        color: entry?.color || '',
        size: entry?.size || 'default',
        weight: entry?.weight,
        align: entry?.align,
      });
    }
  }, [entry, defaultText, editing]);

  const commitNow = (nextDraft?: EditableTextEntry) => {
    const finalDraft = nextDraft || draft;
    const textFromDom =
      editableRef.current?.innerText !== undefined
        ? editableRef.current.innerText.replace(/\n$/, '')
        : finalDraft.text;
    const cleanText = textFromDom.trim().length > 0 ? textFromDom : defaultText;
    onCommit(textKey, {
      ...finalDraft,
      text: cleanText,
    });
    setEditing(false);
  };

  useEffect(() => {
    if (!editing) return;
    const handleOutside = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (
        editableRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      commitNow();
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  });

  const computedStyleClass = [
    className,
    resolvedSize && resolvedSize !== 'default' ? SIZE_CLASS_MAP[resolvedSize] : '',
    resolvedWeight ? WEIGHT_CLASS_MAP[resolvedWeight] : '',
    resolvedAlign ? ALIGN_CLASS_MAP[resolvedAlign] : '',
    isEditMode
      ? editing
        ? 'outline-2 outline-dashed outline-[#E4002B] rounded px-1 -mx-1 bg-white/10 cursor-text'
        : 'hover:outline-2 hover:outline-dashed hover:outline-indigo-500/70 rounded cursor-pointer transition-all'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inlineStyle: React.CSSProperties | undefined = resolvedColor
    ? { color: resolvedColor }
    : undefined;

  if (!isEditMode) {
    return (
      <Tag className={computedStyleClass} style={inlineStyle}>
        {resolvedText}
      </Tag>
    );
  }

  return (
    <span className="relative inline-block max-w-full">
      <Tag
        ref={(el: HTMLElement | null) => {
          editableRef.current = el;
        }}
        contentEditable={editing}
        suppressContentEditableWarning
        onClick={(e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (!editing) {
            setEditing(true);
            setTimeout(() => {
              editableRef.current?.focus();
            }, 10);
          }
        }}
        onInput={(e: React.FormEvent<HTMLElement>) => {
          const val = e.currentTarget.innerText;
          setDraft((prev) => ({ ...prev, text: val }));
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className={computedStyleClass}
        style={inlineStyle}
      >
        {resolvedText}
      </Tag>

      {editing && (
        <div
          ref={popoverRef}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="fixed bottom-4 left-1/2 z-50 flex w-[94vw] max-w-[560px] -translate-x-1/2 flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-3 text-xs text-white shadow-2xl backdrop-blur"
        >
          <div className="flex w-full items-center gap-2">
            <input
              type="text"
              value={draft.text}
              onChange={(e) => {
                const nextVal = e.target.value;
                setDraft((prev) => ({ ...prev, text: nextVal }));
                if (editableRef.current) {
                  editableRef.current.innerText = nextVal;
                }
              }}
              placeholder="Texto..."
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-white focus:border-[#E4002B] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => commitNow()}
              className="inline-flex items-center gap-1 rounded-lg bg-[#E4002B] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#C80024]"
            >
              <Check className="h-3.5 w-3.5" />
              Aplicar
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Colors */}
            <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1">
              <Palette className="mr-1 h-3.5 w-3.5 text-neutral-400" />
              {QUICK_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  title={c.label}
                  onClick={() => setDraft((prev) => ({ ...prev, color: c.value }))}
                  className={`h-4 w-4 rounded-full border ${
                    (draft.color || '') === c.value
                      ? 'scale-110 border-white ring-1 ring-white'
                      : 'border-neutral-600'
                  }`}
                  style={{
                    background:
                      c.value || 'linear-gradient(135deg, #d4d4d4 50%, #525252 50%)',
                  }}
                />
              ))}
              <input
                type="color"
                value={draft.color || '#171717'}
                onChange={(e) => setDraft((prev) => ({ ...prev, color: e.target.value }))}
                title="Cor personalizada"
                className="ml-1 h-4 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </div>

            {/* Size */}
            <select
              value={draft.size || 'default'}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  size: e.target.value as TextSizeOption,
                }))
              }
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] font-semibold text-neutral-200"
            >
              <option value="default">Tamanho padrão</option>
              <option value="xs">Extra pequeno</option>
              <option value="sm">Pequeno</option>
              <option value="base">Normal</option>
              <option value="lg">Médio</option>
              <option value="xl">Grande</option>
              <option value="2xl">Título G</option>
              <option value="3xl">Título GG</option>
            </select>

            {/* Weight */}
            <select
              value={draft.weight || ''}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  weight: (e.target.value || undefined) as TextWeightOption | undefined,
                }))
              }
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] font-semibold text-neutral-200"
            >
              <option value="">Peso padrão</option>
              <option value="normal">Normal</option>
              <option value="semibold">Semi-bold</option>
              <option value="bold">Negrito</option>
            </select>

            {/* Align */}
            <div className="inline-flex items-center rounded-lg border border-neutral-700 bg-neutral-900 p-0.5">
              {(
                [
                  { id: 'left', icon: AlignLeft, label: 'Esquerda' },
                  { id: 'center', icon: AlignCenter, label: 'Centro' },
                  { id: 'right', icon: AlignRight, label: 'Direita' },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      align: prev.align === id ? undefined : id,
                    }))
                  }
                  className={`rounded p-1 ${
                    draft.align === id
                      ? 'bg-white text-neutral-950'
                      : 'text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
