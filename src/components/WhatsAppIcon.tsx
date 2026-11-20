import React from 'react';
import { UnitLocation } from '../types';

export function sanitizeWhatsAppDigits(rawPhone?: string): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '557728880003';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function buildWhatsAppHref(rawPhone: string | undefined, message: string): string {
  const digits = sanitizeWhatsAppDigits(rawPhone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function getUnitWhatsAppNumber(unit: UnitLocation | undefined): string {
  return unit?.whatsapp?.trim() || unit?.phone?.trim() || '(77) 2888-0003';
}

export function WhatsAppIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={`fill-current ${className}`}
      aria-hidden="true"
    >
      <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.256.59 4.462 1.71 6.404L3.09 28.8l6.544-1.716a12.74 12.74 0 0 0 6.37 1.716h.006c7.058 0 12.796-5.74 12.796-12.8 0-3.418-1.33-6.632-3.748-9.05A12.71 12.71 0 0 0 16.004 3.2zm0 23.43h-.005a10.6 10.6 0 0 1-5.406-1.48l-.388-.23-3.884 1.018 1.036-3.786-.252-.4a10.57 10.57 0 0 1-1.622-5.632c0-5.854 4.764-10.618 10.622-10.618 2.836 0 5.502 1.106 7.506 3.112a10.55 10.55 0 0 1 3.108 7.508c0 5.856-4.764 10.618-10.615 10.618zm5.822-7.954c-.318-.16-1.886-.93-2.178-1.036-.292-.106-.504-.16-.718.16-.212.318-.824 1.036-1.01 1.248-.186.214-.372.24-.69.08-.318-.16-1.344-.496-2.56-1.58-.946-.844-1.584-1.886-1.77-2.204-.186-.318-.02-.49.14-.648.144-.144.318-.372.478-.558.16-.186.212-.318.318-.53.106-.212.054-.398-.026-.558-.08-.16-.718-1.728-.984-2.366-.258-.622-.522-.538-.718-.548-.186-.01-.398-.012-.61-.012s-.558.08-.85.398c-.292.318-1.116 1.09-1.116 2.658s1.142 3.084 1.302 3.296c.16.214 2.248 3.432 5.446 4.812.76.328 1.354.524 1.816.672.764.242 1.46.208 2.01.126.612-.092 1.886-.77 2.152-1.514.266-.744.266-1.382.186-1.514-.08-.132-.292-.212-.61-.372z" />
    </svg>
  );
}
