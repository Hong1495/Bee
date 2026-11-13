// Same 24px grid, round caps and 2px stroke as the surrounding Lucide icons.
export function ViolinIcon({ size = 19 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m14.5 8.5 5-5m-1-1 3 3M16 5l3 3M13 9c-2-2-4-1-4 1 0 1-1 2-2 2-2 0-4 1-4 3a6 6 0 0 0 6 6c2 0 3-2 3-4 0-1 1-2 2-2 2 0 3-2 1-4Z"/>
    <path d="m6 18 7-7m-6 3 3 3M16 21l6-12"/>
  </svg>;
}

export function RadioInstrumentIcon({ kind }: { kind: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind==='peacefulpiano'?<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 12v8m6-8v8M7 4v8h3V4m4 0v8h3V4"/></>:kind==='chambermusic'?<><path d="M13 3v7c3 0 5 2 4 4-2 2-2 3 0 4 0 3-3 4-5 4s-5-1-5-4c2-1 2-2 0-4-1-2 1-4 4-4V3m-1 0h4M12 10v10m-3-4h6"/><path d="m20 5-1 16"/></>:kind==='relax'?<><path d="M4 4h15M5 4c0 10 5 15 12 16l2-16M8 5l3 12M12 5l2 14M16 5v14M15 20h5"/></>:<><path d="M4 15c2-1 4-4 5-8h3l-1 8h5l4-4v10l-4-3H7c-3 0-4-2-3-3Z"/><path d="M11 10h5m-2-3v6M5 15h11"/></>}
  </svg>;
}
