import { t, useLanguage } from './i18n';
import { useEffect, useRef, useState } from 'react';

// Reserve the native traffic lights, update dot and three window controls.
export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 320;
export const clampSidebar = (width: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Number.isFinite(width) ? width : 220));

export function SidebarDivider({ width, onChange, onPreview }: { width: number; onChange: (width: number) => void; onPreview?: (width: number) => void }) {
  useLanguage();
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const frame = useRef(0);
  const pending = useRef(width);
  const element = useRef<HTMLDivElement>(null);
  const preview = (value: number) => {
    element.current?.closest<HTMLElement>('.app')?.style.setProperty('--sidebar-width', `${value}px`);
    element.current?.setAttribute('aria-valuenow', String(value));
    onPreview?.(value);
  };
  const commit = (value: number) => {
    const next = clampSidebar(value);
    preview(next);
    onChange(next);
    localStorage.setItem('bee-sidebar-width', JSON.stringify(next));
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    if (!dragging) return;
    document.documentElement.classList.add('resizing-sidebar');
    return () => document.documentElement.classList.remove('resizing-sidebar');
  }, [dragging]);
  return <div ref={element} className="sidebar-divider" role="separator" aria-label={t("侧栏宽度")} aria-orientation="vertical"
    aria-valuemin={SIDEBAR_MIN} aria-valuemax={SIDEBAR_MAX} aria-valuenow={width} tabIndex={0}
    title={t("拖动调整侧栏宽度，双击恢复默认")}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      drag.current = { x: event.clientX, width };
      pending.current = width;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }}
    onPointerMove={event => {
      if (!drag.current) return;
      pending.current = clampSidebar(drag.current.width + event.clientX - drag.current.x);
      if (!frame.current) frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        preview(pending.current);
      });
    }}
    onPointerUp={event => {
      if (!drag.current) return;
      cancelAnimationFrame(frame.current); frame.current = 0;
      commit(clampSidebar(drag.current.width + event.clientX - drag.current.x));
      drag.current = null; setDragging(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onLostPointerCapture={() => {
      if (!drag.current) return;
      cancelAnimationFrame(frame.current); frame.current = 0;
      commit(pending.current); drag.current = null; setDragging(false);
    }}
    onDoubleClick={() => commit(220)}
    onKeyDown={event => {
      let next = width;
      if (event.key === 'ArrowLeft') next -= event.shiftKey ? 20 : 4;
      else if (event.key === 'ArrowRight') next += event.shiftKey ? 20 : 4;
      else if (event.key === 'Home') next = SIDEBAR_MIN;
      else if (event.key === 'End') next = SIDEBAR_MAX;
      else return;
      event.preventDefault(); commit(next);
    }} />;
}
