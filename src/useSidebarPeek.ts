import { useCallback, useEffect, useRef, useState } from 'react';

// Hover only previews the collapsed sidebar; it never changes the pinned layout.
export function useSidebarPeek(pinned: boolean) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useCallback(() => { clearTimeout(timer.current); }, []);
  const dismiss = useCallback(() => { cancel(); setOpen(false); }, [cancel]);
  const enter = useCallback(() => {
    cancel();
    if (!pinned) timer.current = setTimeout(() => setOpen(true), 160);
  }, [cancel, pinned]);
  const keep = useCallback(() => { cancel(); }, [cancel]);
  const leave = useCallback(() => {
    cancel();
    timer.current = setTimeout(() => setOpen(false), 220);
  }, [cancel]);
  useEffect(() => { dismiss(); return cancel; }, [pinned, dismiss, cancel]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) dismiss(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', dismiss);
    };
  }, [dismiss]);
  return { open: !pinned && open, panel, trigger, enter, keep, leave, dismiss };
}
