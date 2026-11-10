import { memo, useCallback, useId, useSyncExternalStore, type CSSProperties } from 'react';
import { type Album, type Track, time } from './data';
import { readRecordPalette, subscribeRecordPalette } from './recordPalette';

// Bound printed text in the label's own coordinates; long metadata must never
// touch the spindle or overflow the paper edge, regardless of window size.
function fitText(text: string, limit: number) {
  let units=0, result='';
  for (const character of text) {
    units += /[^\u0000-\u00ff]/.test(character) ? 1 : .55;
    if (units>limit) return result.trimEnd()+'…';
    result+=character;
  }
  return result;
}
export const Vinyl = memo(function Vinyl({ album, track, playing = false, mounted = false, className = '' }: { album:Album; track?:Track; playing?: boolean; mounted?: boolean; className?: string }) {
  const id = useId().replace(/:/g,'');
  const subscribe = useCallback((listener:()=>void)=>subscribeRecordPalette(album.id,listener),[album.id]);
  const snapshot = useCallback(()=>readRecordPalette(album.id),[album.id]);
  const palette = useSyncExternalStore(subscribe,snapshot);
  const title = fitText(track?.title || album.title,16);
  const titleUnits = [...title].reduce((n,c)=>n+(/[^\u0000-\u00ff]/.test(c)?1:.55),0);
  const titleSize = Math.min(18,142/Math.max(titleUnits,1));
  const artist = fitText(track?.artist || album.artist,19);
  const details = [album.year,album.genre].filter(Boolean).join(' · ');
  const position = track ? [track.number>0 ? String(track.number).padStart(2,'0') : '',track.duration>0 ? time(track.duration) : ''].filter(Boolean).join('   ·   ') : `${album.tracks.length} TRACKS`;
  return <div aria-hidden="true" className={`vinyl ${playing ? 'spinning' : ''} ${className}`}>
    <div className="vinyl-face">
      <div className="vinyl-grain"/>
      <div className="record-label" style={{'--label-paper':palette.paper,'--label-ink':palette.ink} as CSSProperties}>
        <svg className="label-print" viewBox="0 0 200 200" focusable="false">
          <defs>
            <path id={`${id}-top`} d="M 12 100 A 88 88 0 0 1 188 100"/>
            <path id={`${id}-bottom`} d="M 12 100 A 88 88 0 0 0 188 100"/>
          </defs>
          <text className="label-rim"><textPath href={`#${id}-top`} startOffset="50%">{fitText(album.title,43)}</textPath></text>
          <text className="label-brand" x="100" y="44">B E E</text>
          <text className="label-title" x="100" y="76" style={{fontSize:titleSize}}>{title}</text>
          <circle className="label-pressing" cx="100" cy="100" r="15"/>
          <text className="label-artist" x="100" y="133" style={{fontSize:Math.min(12,140/Math.max([...artist].reduce((n,c)=>n+(/[^\u0000-\u00ff]/.test(c)?1:.55),0),1))}}>{artist}</text>
          <text className="label-details" x="100" y="154">{position}</text>
          <text className="label-rim label-rim-bottom"><textPath href={`#${id}-bottom`} startOffset="50%">{fitText(details,40)}</textPath></text>
        </svg>
      </div>
      <span className="record-hole"/>
    </div>
    <div className="vinyl-glint"/>
    {mounted && <span className="record-spindle"/>}
  </div>;
});
