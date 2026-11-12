import { t, useLanguage } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownWideNarrow, Check } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { Menu, CheckMenuItem } from '@tauri-apps/api/menu';
import { LogicalPosition } from '@tauri-apps/api/dpi';



export function SortMenu({ value, onChange }: { value:string; onChange:(value:string) => void }) {
  useLanguage();
  const choices = [{ id:'added', text:t("添加日期") }, { id:'title', text:t("专辑名称") }, { id:'year', text:t("发行年份") }];
  const button = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const nativeMenu = useRef<Menu | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => () => { void nativeMenu.current?.close(); }, []);
  useEffect(() => {
    if (!open) return;
    popup.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const dismiss = (event:PointerEvent) => {
      if (!popup.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  const show = async () => {
    if (!isTauri()) { setOpen(current => !current); return; }
    try {
      await nativeMenu.current?.close();
      const items = await Promise.all(choices.map(choice => CheckMenuItem.new({ ...choice, checked:value === choice.id, action:() => onChange(choice.id) })));
      const menu = await Menu.new({ items });
      nativeMenu.current = menu;
      await Promise.all(items.map(item => item.close()));
      const rect = button.current!.getBoundingClientRect();
      await menu.popup(new LogicalPosition(rect.left, rect.bottom + 6));
    } catch { setOpen(true); }
  };
  return <div className="sort-menu-anchor" onMouseDown={event => event.stopPropagation()}>
    <button ref={button} type="button" className="icon-button toolbar-sort" aria-label={t("专辑排序")} aria-haspopup="menu"
      title={t("排序：{0}", choices.find(choice => choice.id === value)?.text)} onClick={() => void show()}><ArrowDownWideNarrow size={17}/></button>
    {open && <div ref={popup} role="menu" className="sort-popup" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); button.current?.focus(); }
      if (event.key === 'Tab') setOpen(false);
      if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault();
        const items = [...event.currentTarget.querySelectorAll('button')];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length-1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    }}>{choices.map(choice => <button key={choice.id} role="menuitemradio" aria-checked={value === choice.id} onClick={() => { onChange(choice.id); setOpen(false); button.current?.focus(); }}>
      <Check size={13} style={{ visibility:value === choice.id ? 'visible' : 'hidden' }}/>{choice.text}
    </button>)}</div>}
  </div>;
}
