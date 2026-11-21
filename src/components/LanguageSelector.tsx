import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { LANGUAGE_META, LANGUAGE_OPTIONS, SiteLanguage, UI_TRANSLATIONS } from '../utils/i18n';

function FlagSvg({ lang, className = 'h-[18px] w-[18px]' }: { lang: SiteLanguage; className?: string }) {
  if (lang === 'pt') {
    // Brasil
    return (
      <svg
        viewBox="0 0 24 24"
        className={`${className} shrink-0 overflow-hidden rounded-full ring-1 ring-border`}
        aria-hidden="true"
      >
        <rect width="24" height="24" fill="#009B3A" />
        <polygon points="12,3.2 21.6,12 12,20.8 2.4,12" fill="#FEDF00" />
        <circle cx="12" cy="12" r="4.6" fill="#002776" />
        <path
          d="M7.7 11.1 C10.3 10.1 13.8 10.6 16.4 12.6"
          stroke="#FFFFFF"
          strokeWidth="1.15"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (lang === 'en') {
    // Estados Unidos
    return (
      <svg
        viewBox="0 0 24 24"
        className={`${className} shrink-0 overflow-hidden rounded-full ring-1 ring-border`}
        aria-hidden="true"
      >
        <rect width="24" height="24" fill="#FFFFFF" />
        <rect y="0" width="24" height="2.4" fill="#B22234" />
        <rect y="4.8" width="24" height="2.4" fill="#B22234" />
        <rect y="9.6" width="24" height="2.4" fill="#B22234" />
        <rect y="14.4" width="24" height="2.4" fill="#B22234" />
        <rect y="19.2" width="24" height="2.4" fill="#B22234" />
        <rect width="12.5" height="12" fill="#3C3B6E" />
        <circle cx="3.2" cy="3" r="0.75" fill="#FFFFFF" />
        <circle cx="6.2" cy="3" r="0.75" fill="#FFFFFF" />
        <circle cx="9.2" cy="3" r="0.75" fill="#FFFFFF" />
        <circle cx="4.7" cy="5.5" r="0.75" fill="#FFFFFF" />
        <circle cx="7.7" cy="5.5" r="0.75" fill="#FFFFFF" />
        <circle cx="3.2" cy="8" r="0.75" fill="#FFFFFF" />
        <circle cx="6.2" cy="8" r="0.75" fill="#FFFFFF" />
        <circle cx="9.2" cy="8" r="0.75" fill="#FFFFFF" />
        <circle cx="4.7" cy="10.3" r="0.75" fill="#FFFFFF" />
        <circle cx="7.7" cy="10.3" r="0.75" fill="#FFFFFF" />
      </svg>
    );
  }

  // Espanha
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0 overflow-hidden rounded-full ring-1 ring-border`}
      aria-hidden="true"
    >
      <rect width="24" height="6.2" fill="#AA151B" />
      <rect y="6.2" width="24" height="11.6" fill="#F1BF00" />
      <rect y="17.8" width="24" height="6.2" fill="#AA151B" />
      <rect x="6.5" y="9" width="3.2" height="5.2" rx="1" fill="#AA151B" opacity="0.85" />
      <rect x="7.3" y="9.8" width="1.6" height="2.4" fill="#F1BF00" />
    </svg>
  );
}

interface LanguageSelectorProps {
  language: SiteLanguage;
  onChange: (lang: SiteLanguage) => void;
}

export function LanguageSelector({ language, onChange }: LanguageSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeOption = LANGUAGE_META[language];
  const dict = UI_TRANSLATIONS[language];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={dict.languageSelectorLabel}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card/95 px-2.5 text-xs font-bold text-ink shadow-xs transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:h-10 sm:gap-2 sm:px-3"
      >
        <FlagSvg lang={language} className="h-[18px] w-[18px]" />
        <span className="tracking-wide">{activeOption.code}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-ink-muted transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={dict.languageSelectorLabel}
          className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-xl"
        >
          {LANGUAGE_OPTIONS.map((opt) => {
            const isSelected = opt.id === language;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-brand-soft font-bold text-brand-text'
                    : 'font-medium text-ink hover:bg-surface'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FlagSvg lang={opt.id} className="h-[18px] w-[18px]" />
                  <span className="whitespace-nowrap">{opt.nativeName}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      isSelected ? 'text-brand-text' : 'text-ink-muted'
                    }`}
                  >
                    {opt.code}
                  </span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-text" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
