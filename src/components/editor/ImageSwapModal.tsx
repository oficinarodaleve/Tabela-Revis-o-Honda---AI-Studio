import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Link2, Trash2, Upload, X } from 'lucide-react';
import { compressImageFile } from '../../utils/visualBuilder';

interface ImageSwapModalProps {
  title: string;
  currentUrl: string;
  onApply: (nextUrl: string) => void;
  onClose: () => void;
}

export function ImageSwapModal({
  title,
  currentUrl,
  onApply,
  onClose,
}: ImageSwapModalProps) {
  const [urlInput, setUrlInput] = useState(currentUrl || '');
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (file: File) => {
    setProcessing(true);
    setError(null);
    try {
      const compressedDataUrl = await compressImageFile(file, 1200);
      setUrlInput(compressedDataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao processar imagem.');
    } finally {
      setProcessing(false);
    }
  };

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
            <h3 className="font-display text-base font-bold text-ink">Trocar Imagem</h3>
            <p className="text-xs text-ink-muted">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-muted hover:bg-surface hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-surface p-1">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
              mode === 'upload'
                ? 'bg-card text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Enviar arquivo
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
              mode === 'url'
                ? 'bg-card text-ink shadow-xs'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            Colar URL
          </button>
        </div>

        {mode === 'upload' ? (
          <div className="mt-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,.ico"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileChange(f);
              }}
            />
            <button
              type="button"
              disabled={processing}
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface px-4 py-6 text-center transition-colors hover:border-brand hover:bg-brand-soft/40"
            >
              <Upload className="h-6 w-6 text-brand-text" />
              <span className="text-xs font-bold text-ink">
                {processing
                  ? 'Comprimindo imagem...'
                  : 'Clique para enviar PNG, JPG, WEBP ou SVG'}
              </span>
              <span className="text-[11px] text-ink-muted">
                Compressão automática otimizada para armazenamento local
              </span>
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-ink">URL da imagem</label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://exemplo.com/imagem.webp"
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs text-ink focus:border-brand focus:outline-none"
            />
          </div>
        )}

        {/* Instant preview */}
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold text-ink-muted">
            Pré-visualização instantânea
          </p>
          <div className="flex h-36 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface p-3">
            {urlInput ? (
              <img
                src={urlInput}
                alt="Pré-visualização"
                referrerPolicy="no-referrer"
                onError={() => setError('Não foi possível carregar esta URL de imagem.')}
                onLoad={() => setError(null)}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-ink-muted">
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs">Sem imagem selecionada</span>
              </div>
            )}
          </div>
          {error && <p className="mt-1.5 text-xs font-medium text-brand-text">{error}</p>}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => {
              onApply('');
              onClose();
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-surface hover:text-brand-text"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-ink hover:bg-surface"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(urlInput.trim());
                onClose();
              }}
              className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-on-brand hover:bg-brand-hover"
            >
              Aplicar Imagem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
