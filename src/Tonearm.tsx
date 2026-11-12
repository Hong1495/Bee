import { t, useLanguage } from './i18n';
import { memo, useEffect, useRef, type RefObject } from 'react';
import type { PlaybackPosition } from './useMusic';

// Geometry in deck-width units: pivot, record center and stylus travel.
export function tonearmAngle(progress:number) {
  const pivotX = .9325, pivotY = .03973;
  const centerX = .63, centerY = .27655;
  const length = .87 / 1.85 * .91;
  const dx = pivotX-centerX, dy = centerY-pivotY;
  const distance = Math.hypot(dx,dy);
  const radius = .2425 * (.92 - .54 * Math.max(0,Math.min(1,progress)));
  const cosine = Math.max(-1,Math.min(1,(distance*distance+length*length-radius*radius)/(2*distance*length)));
  return (Math.atan2(dx,dy)-Math.acos(cosine))*180/Math.PI;
}

export const Tonearm = memo(function Tonearm({ playing, trackId, position, onToggle }: {
  playing:boolean; trackId:string; position:RefObject<PlaybackPosition>; onToggle:() => void;
}) {
  useLanguage();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let frame = 0;
    let previous = '';
    const update = () => {
      const sample = position.current;
      if (sample.trackId === trackId && sample.duration > 0) {
        // Interpolate between Music samples, but stop extrapolating if the
        // bridge stalls. Updating only this transform avoids app-wide renders.
        const elapsed = sample.playing ? Math.min(2,(performance.now()-sample.sampledAt)/1000) : 0;
        const angle = `${tonearmAngle((sample.seconds+elapsed)/sample.duration).toFixed(3)}deg`;
        if (angle !== previous) { ref.current?.style.setProperty('--playing-angle',angle); previous=angle; }
      }
      if (playing) frame = requestAnimationFrame(update);
    };
    const visibility = () => { cancelAnimationFrame(frame); if (!document.hidden) update(); };
    visibility();
    document.addEventListener('visibilitychange',visibility);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange',visibility); };
  }, [position,trackId,playing]);
  return <button ref={ref} type="button" className={`tonearm ${playing ? 'engaged' : ''}`}
    aria-label={playing ? t("点击唱臂暂停") : t("点击唱臂播放")} aria-pressed={playing}
    title={playing ? t("抬起唱臂，暂停") : t("放下唱臂，播放")} onClick={onToggle}>
    <span className="arm-base"/><span className="arm-shaft"/><span className="arm-head"/>
  </button>;
});
