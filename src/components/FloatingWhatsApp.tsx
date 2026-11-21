import React, { useEffect, useRef, useState } from 'react';
import { WhatsAppIcon } from './WhatsAppIcon';

interface FloatingWhatsAppProps {
  href: string;
  isEditMode?: boolean;
  onTrackClick?: () => void;
  ariaLabel?: string;
  titleText?: string;
}

interface Position {
  x: number;
  y: number;
}

const STORAGE_KEY = 'rodaleve_whatsapp_pos_v2';
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
      ? clampPosition({
          x: window.innerWidth - BUTTON_SIZE - 20,
          y: window.innerHeight - BUTTON_SIZE - 20,
        })
      : { x: 1100, y: 500 };
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

export function FloatingWhatsApp({
  href,
  isEditMode = false,
  onTrackClick,
  ariaLabel = 'Falar no WhatsApp Rodaleve (arrastável)',
  titleText = 'Falar no WhatsApp Rodaleve (arraste para reposicionar)',
}: FloatingWhatsAppProps) {
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
      return;
    }
    onTrackClick?.();
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
      aria-label={ariaLabel}
      title={titleText}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${BUTTON_SIZE}px`,
        height: `${BUTTON_SIZE}px`,
      }}
      className="fixed z-40 inline-flex touch-none select-none items-center justify-center rounded-full bg-whatsapp text-on-brand shadow-[0_6px_20px_rgba(37,211,102,0.42)] ring-2 ring-card/90 transition-transform hover:scale-105 hover:bg-whatsapp-hover active:scale-95"
    >
      <span className="pointer-events-none flex items-center justify-center">
        <WhatsAppIcon className="h-7 w-7" />
      </span>
    </a>
  );
}
