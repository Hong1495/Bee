import { t, useLanguage } from './i18n';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

export function ToolbarSearch({ query, onChange, label }: { query: string; onChange: (value: string) => void; label: string }) {
  useLanguage();
  const [expanded, setExpanded] = useState(Boolean(query));
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const open = () => { setExpanded(true); inputRef.current?.focus(); };

  useLayoutEffect(() => { if (expanded) inputRef.current?.focus(); }, [expanded]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setExpanded(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return <div className={`toolbar-search ${expanded ? 'expanded' : ''}`}
    onMouseDown={event => event.stopPropagation()}
    onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null) && !query) setExpanded(false);
    }}
    onKeyDown={event => {
      if (event.key === 'Escape' && expanded) {
        event.preventDefault();
        event.stopPropagation();
        onChange('');
        setExpanded(false);
        buttonRef.current?.focus();
      }
    }}>
    <button ref={buttonRef} type="button" className="icon-button toolbar-search-trigger" aria-label={label}
      title={`${label} (⌘F)`} aria-expanded={expanded} aria-controls="toolbar-search-input" onClick={open}>
      <Search size={17}/>
    </button>
    <div className="toolbar-search-field" inert={!expanded}>
      <input id="toolbar-search-input" ref={inputRef} aria-label={label} placeholder={t("搜索")} value={query}
        onChange={event => onChange(event.target.value)}/>
      <button type="button" aria-label={query ? t("清除搜索") : t("收起搜索")} title={query ? t("清除搜索") : t("收起搜索")} onClick={() => {
        if (query) { onChange(''); inputRef.current?.focus(); }
        else { setExpanded(false); buttonRef.current?.focus(); }
      }}><X size={13}/></button>
    </div>
  </div>;
}
