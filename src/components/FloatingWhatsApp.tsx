import React, { useEffect, useRef, useState } from 'react';

interface FloatingWhatsAppProps {
  href: string;
  isEditMode?: boolean;
}

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY = 'rodaleve_whatsapp_pos';
const BUTTON_SIZE = 56;
const MARGIN = 12;

let memoryPosition: Position | null = null;

function clampPosition(pos: Position): Position {
  if (typeof window === 'undefined') return pos;
  const maxX = Math.max(MARGIN, window.innerWidth - BUTTON_SIZE - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - BUTTON_SIZE - MARGIN);
  return {
    x: Math.min(Math.max(MARGIN, pos.x), maxX),
    y: Math.min(Math.max(MARGIN, pos.y), maxY),
  };
}

function getInitialPosition(): Position {
  if (memoryPosition) return clampPosition(memoryPosition);
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Position>;
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        const clamped = clampPosition({ x: parsed.x, y: parsed.y });
        memoryPosition = clamped;
        return clamped;
      }
    }
  } catch {
    // Ignorar bloqueio de sandbox/iframe
  }
  const defaultPos =
    typeof window !== 'undefined'
      ? clampPosition({ x: 20, y: window.innerHeight - BUTTON_SIZE - 20 })
      : { x: 20, y: 500 };
  return defaultPos;
}

function savePosition(pos: Position): void {
  memoryPosition = pos;
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // Fallback em memória já atualizado
  }
}

export function FloatingWhatsApp({ href, isEditMode = false }: FloatingWhatsAppProps) {
  const [pos, setPos] = useState<Position>(() => getInitialPosition());
  const dragStateRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    movedDistance: number;
    wasDragged: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: pos.x,
    originY: pos.y,
    movedDistance: 0,
    wasDragged: false,
  });

  useEffect(() => {
    const handleResize = () => {
      setPos((curr) => {
        const clamped = clampPosition(curr);
        savePosition(clamped);
        return clamped;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      movedDistance: 0,
      wasDragged: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const state = dragStateRef.current;
    if (state.pointerId !== e.pointerId) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const dist = Math.hypot(dx, dy);
    state.movedDistance = Math.max(state.movedDistance, dist);
    if (dist >= 6) {
      state.wasDragged = true;
      const next = clampPosition({
        x: state.originX + dx,
        y: state.originY + dy,
      });
      setPos(next);
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const state = dragStateRef.current;
    if (state.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (state.wasDragged) {
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      const finalPos = clampPosition({
        x: state.originX + dx,
        y: state.originY + dy,
      });
      setPos(finalPos);
      savePosition(finalPos);
    }
    state.pointerId = null;
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (dragStateRef.current.wasDragged || dragStateRef.current.movedDistance >= 6 || isEditMode) {
      e.preventDefault();
      dragStateRef.current.wasDragged = false;
      dragStateRef.current.movedDistance = 0;
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onClick={handleClick}
      aria-label="Falar no WhatsApp Rodaleve (arrastável)"
      title="Falar no WhatsApp Rodaleve (arraste para reposicionar)"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${BUTTON_SIZE}px`,
        height: `${BUTTON_SIZE}px`,
      }}
      className="fixed z-40 inline-flex touch-none select-none items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_6px_20px_rgba(37,211,102,0.42)] ring-2 ring-white/90 transition-transform hover:scale-105 hover:bg-[#20BD5A] active:scale-95"
    >
      {/* Official WhatsApp glyph */}
      <svg
        viewBox="0 0 32 32"
        className="pointer-events-none h-7 w-7 fill-current"
        aria-hidden="true"
      >
        <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.256.59 4.462 1.71 6.404L3.09 28.8l6.544-1.716a12.74 12.74 0 0 0 6.37 1.716h.006c7.058 0 12.796-5.74 12.796-12.8 0-3.418-1.33-6.632-3.748-9.05A12.71 12.71 0 0 0 16.004 3.2zm0 23.43h-.005a10.6 10.6 0 0 1-5.406-1.48l-.388-.23-3.884 1.018 1.036-3.786-.252-.4a10.57 10.57 0 0 1-1.622-5.632c0-5.854 4.764-10.618 10.622-10.618 2.836 0 5.502 1.106 7.506 3.112a10.55 10.55 0 0 1 3.108 7.508c0 5.856-4.764 10.618-10.615 10.618zm5.822-7.954c-.318-.16-1.886-.93-2.178-1.036-.292-.106-.504-.16-.718.16-.212.318-.824 1.036-1.01 1.248-.186.214-.372.24-.69.08-.318-.16-1.344-.496-2.56-1.58-.946-.844-1.584-1.886-1.77-2.204-.186-.318-.02-.49.14-.648.144-.144.318-.372.478-.558.16-.186.212-.318.318-.53.106-.212.054-.398-.026-.558-.08-.16-.718-1.728-.984-2.366-.258-.622-.522-.538-.718-.548-.186-.01-.398-.012-.61-.012s-.558.08-.85.398c-.292.318-1.116 1.09-1.116 2.658s1.142 3.084 1.302 3.296c.16.214 2.248 3.432 5.446 4.812.76.328 1.354.524 1.816.672.764.242 1.46.208 2.01.126.612-.092 1.886-.77 2.152-1.514.266-.744.266-1.382.186-1.514-.08-.132-.292-.212-.61-.372z" />
      </svg>
    </a>
  );
}
