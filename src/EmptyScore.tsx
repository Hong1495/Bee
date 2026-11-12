import { t, useLanguage } from './i18n';
/** Quiet empty-state motif: a flat and a natural cancel on the same staff pitch. */
export function EmptyScore({label = t("暂无音乐"), compact = false}: {label?:string;compact?:boolean}) {
  useLanguage();
  return <div className={`empty-score${compact ? ' compact' : ''}`} role="img" aria-label={label}>
    <svg viewBox="0 0 360 116" aria-hidden="true">
      <g className="score-staff" fill="none" stroke="currentColor" strokeWidth="1">
        {[38,48,58,68,78].map(y => <path key={y} d={`M16 ${y}H344`}/>)}
        <path d="M18 38V78 M184 38V78 M337 38V78 M343 38V78"/>
      </g>
      <g fill="currentColor">
        <text className="score-clef" x="24" y="79" fontSize="57" fontFamily="Apple Symbols, serif">𝄞</text>
        <text className="score-berry" x="74" y="63" fontSize="32" fontFamily="Apple Symbols, serif">♭</text>
        <text className="score-violet" x="217" y="63" fontSize="32" fontFamily="Apple Symbols, serif">♮</text>
        {[[106,58],[146,48],[253,58],[297,68]].map(([x,y]) => <g key={x} className={x < 184 ? 'score-berry' : 'score-violet'}>
          <ellipse cx={x} cy={y} rx="6.5" ry="4.4" transform={`rotate(-22 ${x} ${y})`}/>
          <path d={`M${x+5} ${y}v-29`} fill="none" stroke="currentColor" strokeWidth="1.8"/>
        </g>)}
      </g>
    </svg>
  </div>;
}
