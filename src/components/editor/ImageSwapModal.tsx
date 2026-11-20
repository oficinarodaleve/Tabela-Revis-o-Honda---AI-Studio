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
              Trocar Imagem
            </h3>
            <p className="text-xs text-neutral-500">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-colors ${
              mode === 'upload'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
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
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
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
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center transition-colors hover:border-[#E4002B] hover:bg-red-50/30"
            >
              <Upload className="h-6 w-6 text-[#E4002B]" />
              <span className="text-xs font-bold text-neutral-800">
                {processing
                  ? 'Comprimindo imagem...'
                  : 'Clique para enviar PNG, JPG, WEBP ou SVG'}
              </span>
              <span className="text-[11px] text-neutral-500">
                Compressão automática otimizada para armazenamento local
              </span>
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-neutral-700">
              URL da imagem
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://exemplo.com/imagem.webp"
              className="mt-1.5 w-full rounded-xl border border-neutral-200 px-3.5 py-2 text-xs text-neutral-900 focus:border-[#E4002B] focus:outline-none"
            />
          </div>
        )}

        {/* Instant preview */}
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold text-neutral-500">
            Pré-visualização instantânea
          </p>
          <div className="flex h-36 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 p-3">
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
              <div className="flex flex-col items-center gap-1 text-neutral-400">
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs">Sem imagem selecionada</span>
              </div>
            )}
          </div>
          {error && <p className="mt-1.5 text-xs font-medium text-[#E4002B]">{error}</p>}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={() => {
              onApply('');
              onClose();
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 hover:text-[#E4002B]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remover
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(urlInput.trim());
                onClose();
              }}
              className="rounded-xl bg-[#E4002B] px-4 py-2 text-xs font-bold text-white hover:bg-[#C80024]"
            >
              Aplicar Imagem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
