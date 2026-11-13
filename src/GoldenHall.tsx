import type { CSSProperties } from 'react';
/** Architectural study of Musikverein's audience-to-stage view.
 * Reference: musikverein.at/en/vermietung/grosser-saal/ (Grabner / Leitner).
 * Original vector drawing; no reference photographs are redistributed.
 */
function Chandelier({ x, y, scale }: { x:number; y:number; scale:number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <path d="M0-150V0" stroke="#746044" strokeWidth="1"/>
    <path d="M-14 0Q0-8 14 0L20 40Q32 44 36 51L28 67Q0 85-28 67L-36 51Q-32 44-20 40Z" fill="url(#crystal)" stroke="#c4a76b" strokeWidth="1"/>
    {Array.from({length:13},(_,i)=><path key={i} d={`M${-12+i*2} 1L${-31+i*5.2} 52L${-24+i*4} 69`} fill="none" stroke="#fff6d4" strokeWidth="1.3" opacity=".7"/>)}
    <path d="M-20 40Q0 47 20 40M-35 52Q0 65 35 52M-27 68Q0 77 27 68" fill="none" stroke="#efd39a" strokeWidth="2"/>
    <ellipse cy="55" rx="48" ry="40" fill="url(#lampGlow)"/>
  </g>;
}
type Instrument = 'violin' | 'viola' | 'cello' | 'bass' | 'flute' | 'oboe' | 'horn';

/** Seated three-quarter silhouettes; articulation is anchored at the hip and elbow. */
function Player({ x, y, scale, index, kind, facing = 1 }: {
  x:number; y:number; scale:number; index:number; kind:Instrument; facing?:number;
}) {
  const skin = ['#b89b7e','#c7ab8e','#a88b73','#bb9d83','#947662'][index % 5];
  const hair = ['#332e2a','#797267','#41372f','#9a9282','#55463b'][index % 5];
  const strings = kind === 'violin' || kind === 'viola';
  const upright = kind === 'bass';
  const gown = index % 4 === 1;
  const lean = [-3, 1, -1, 3, -2, 0][index % 6];
  const motion = {'--player-delay':`-${(index%8)*.16}s`,'--bow-duration':`${3.6+(index%3)*.18}s`} as CSSProperties;
  return <g transform={`translate(${x} ${y}) scale(${scale})`} style={motion}>
    <ellipse cx="1" cy="2" rx="19" ry="2.3" fill="#392d23" opacity=".16"/>
    <g transform={`scale(${facing} 1)`}>
      {!upright&&<g fill="#514536" stroke="#655541" strokeWidth="1">
        <path d="M-17-22-19-39Q-19-44-14-44h8q3 0 3 4v17Z"/>
        <path d="M-17-22Q-4-25 9-21l-1 4h-24Z"/>
        <path d="m-15-18-2 18M6-18l5 18" fill="none"/>
      </g>}
      {upright?<path d="M-10-29Q-2-31 5-27L6-4l7 4q-4 2-10 0L-2-20-6-3l-8 4q-5-1-1-4l4-4Z" fill="#292b2c"/>:
        gown?<path d="M-13-29Q-3-32 9-23L14-3Q3 0-14-3l-3-13Z" fill="url(#concertCloth)"/>:
        <g fill="#292b2c"><path d="M-13-28Q-1-28 11-21q3 2 2 7L10-3l7 2q4 3-3 3L5 0 5-17-6-17Z"/><path d="M-10-24Q-2-22 0-17l-9 14 6 3q2 2-3 2l-10-2 1-4 7-15Z"/></g>}
      <g transform={`rotate(${lean} -4 -24)`}>
        <g className="ensemble-body">
          <path d="M-5-57C-12-56-17-54-18-48L-15-31Q-15-26-13-22q12 4 23-1L6-35Q9-44 4-51L0-56Z" fill="url(#concertCloth)"/>
          <path d="M-7-54q-8 2-8 9l3 15M-8-28q6 2 13 0" stroke="#746b5f" strokeWidth=".8" opacity=".5" fill="none"/>
          <path d="M-3-59-1-52 3-53 1-60" fill={skin}/>
          {/* A small neck, rounded skull and quiet profile keep faces subordinate to posture. */}
          <g transform={`rotate(${strings?14:index%3*5-5} -1 -59)`}>
            <path d="M-7-69C-7-75-3-78 2-76q6 2 5 8l-1 3 1.5 2-2.5 1q0 4-4 4l-4-2Z" fill={skin}/>
            <path d={index%3===0?'M-7-66q-5-9 2-12 8-3 11 4l1 5-4-3q-5-2-6 4v4Z':'M-7-66q-4-10 3-12 9-2 11 7l-4-2-5 1-1 6Z'} fill={hair}/>
            {gown&&<path d="M-8-73q-5 5-2 11l5 2 2-6-2-8Z" fill={hair}/>}
            <path d="m-3-66 1 3" stroke="#796451" strokeWidth=".65" opacity=".6"/>
          </g>
          {!gown&&<path d="M-3-54 1-49 3-53M-6-52-3-44l3-3" fill="#c1b7a4" opacity=".65"/>}
          {strings?<>
            {/* Left elbow rests below the violin; the thumb meets the neck. */}
            <path d="M-11-49Q-17-40-7-34q4 2 8-2l17-13" fill="none" stroke="url(#concertCloth)" strokeWidth="6" strokeLinecap="round"/>
            <path d="M15-49q1-4 4-3l3 2-1 3-4 1Z" fill={skin}/>
            <g transform={`translate(6 -53) rotate(${-10-index%3*3})`}>
              <path d="M-9-1C-12-7-6-10-2-6l3 1q5-5 10-1l-1 4 1 4q-5 5-10 0l-3 1c-5 5-11 1-7-4Z" fill="url(#wood)" stroke="#67432b" strokeWidth=".65"/>
              <path d="M5-1h24v2H5Z" fill="#40352c"/><path d="M-8 0h38" stroke="#d2b47d" strokeWidth=".5"/>
              <path d="m-4-4-1 6m8-6-1 6" stroke="#583823" strokeWidth=".65"/>
              <path d="M29-1q4-3 4 0t-4 1" fill="#956536"/>
            </g>
            {/* The upper arm stays attached; forearm and bow pivot together at the elbow. */}
            <path d="M1-49Q8-43 11-35" stroke="url(#concertCloth)" strokeWidth="6" fill="none" strokeLinecap="round"/>
            <g className="ensemble-forearm violin-forearm">
              <path d="M11-35Q17-38 22-47" stroke="url(#concertCloth)" strokeWidth="5" fill="none" strokeLinecap="round"/>
              <path d="m20-48 3-3q3 0 3 3l-3 3Z" fill={skin}/>
              <path d="M8-24 33-65" stroke="#ad9064" strokeWidth="1.1"/><path d="M9-24 34-65" stroke="#e2d1ac" strokeWidth=".45"/>
            </g>
          </>:kind==='cello'||upright?<>
            <g transform={upright?'translate(6 -16) scale(1.05)':'translate(9 -4) rotate(7)'}>
              <path d="M6-54v19c-8-4-15 3-10 10l2 5c-12 8-8 23 4 24 15 2 21-12 12-23l2-5c3-9-2-14-8-11v-19Z" fill="url(#wood)" stroke="#69472e" strokeWidth=".8"/>
              <path d="M6-58h2L7 0H5Z" fill="#3a3028"/><path d="M6-54v55M6 5v12M0-5h13" stroke="#cdb185" strokeWidth=".65"/>
              <path d="m-1-17-2 8m14-8 2 8" stroke="#583823" strokeWidth="1"/>
              <path d="M-4-2q4 5 10 4" stroke="#d7ac6c" strokeWidth=".7" fill="none"/>
            </g>
            <path d="M-12-49Q-16-38-7-35Q2-36 11-51" fill="none" stroke="url(#concertCloth)" strokeWidth="6" strokeLinecap="round"/>
            <path d="m9-53 4-3 2 2-3 5Z" fill={skin}/>
            <path d="M2-47Q11-39 12-29" fill="none" stroke="url(#concertCloth)" strokeWidth="6" strokeLinecap="round"/>
            <g className="ensemble-forearm cello-forearm">
              <path d="M12-29Q17-25 24-23" fill="none" stroke="url(#concertCloth)" strokeWidth="5" strokeLinecap="round"/>
              <path d="m23-25 5 1 1 3-5 1Z" fill={skin}/><path d="M-8-15 36-27" stroke="#d0b78d" strokeWidth="1"/>
            </g>
          </>:kind==='horn'?<g>
            <path d="M4-65 13-48q15 4 11 14-5 9-14 3-7-6 1-10 10-2 9 6M23-43l10-8 4 11-13 2" fill="none" stroke="#b39760" strokeWidth="2.3"/>
            <path d="M-12-49Q-12-34-2-33l14-3M3-49q3 9 12 10" fill="none" stroke="url(#concertCloth)" strokeWidth="5.5" strokeLinecap="round"/><path d="m11-36 4 1m-2-5 4 2" stroke={skin} strokeWidth="2.5"/>
          </g>:<g>
            <path d={kind==='flute'?'M5-65 35-57':'M5-65 16-30'} stroke={kind==='flute'?'#c2b99c':'#3c332a'} strokeWidth="2"/>
            <path d={kind==='flute'?'M-12-49Q-13-37-4-40l18-18M3-50Q12-40 19-46l8-10':'M-12-49Q-14-36-6-36l16-12M3-49Q18-43 14-35'} fill="none" stroke="url(#concertCloth)" strokeWidth="5.5" strokeLinecap="round"/>
            <path d={kind==='flute'?'m14-58 4-1m9 3 4 1':'m9-49 4 1m-1 12 4 1'} stroke={skin} strokeWidth="2.5"/>
          </g>}
        </g>
      </g>
      {index%2===0&&<g transform={`translate(26 -27) rotate(${index%3*4-4})`}><path d="m-6-7 22-2 2 13-23 1Z" fill="#34322e"/><path d="m-3-5 8-.6 1 9-9 .4m10-10 8-.5 1 9-8 .5" fill="#bdb199"/><path d="m-1-2 5-.3m-5 2 5-.3m5-2 5-.3m-5 2 5-.3" stroke="#776d59" strokeWidth=".5"/><path d="M7 5V28m-7 3 7-3 8 3" fill="none" stroke="#403a32" strokeWidth="1"/></g>}
    </g>
  </g>;
}

// Deliberately staggered sections following the curved front of the stage.
const ensemble: {x:number;y:number;scale:number;kind:Instrument;facing:number}[] = [];
for (let row=0;row<3;row++) {
  for(let seat=0;seat<8;seat++) {
    const x=320+seat*31+row*19+[-3,2,0,4,-2,1,-1,3][seat];
    ensemble.push({x,y:582+row*32+Math.pow((x-570)/245,2)*23+[0,5,-3,2,-4,4,-2,1][seat],scale:.66+row*.09+(seat%3-1)*.045,kind:seat>5?'viola':'violin',facing:1});
  }
  for(let seat=0;seat<6;seat++) {
    const x=657+seat*33-row*9+[2,-3,1,4,-2,0][seat];
    ensemble.push({x,y:579+row*33+Math.pow((x-620)/245,2)*24+[3,-3,4,-2,0,5][seat],scale:.67+row*.09+(seat%3-1)*.04,kind:seat<2?'viola':'cello',facing:-1});
  }
}
for(let seat=0;seat<11;seat++) ensemble.push({x:418+seat*32,y:559+(seat%3)*3,scale:.61,kind:seat<4?'flute':seat<8?'oboe':'horn',facing:seat<6?1:-1});
for(let seat=0;seat<7;seat++) ensemble.push({x:748+seat*24,y:539+(seat%3)*6,scale:.61+(seat%2)*.04,kind:'bass',facing:-1});
ensemble.sort((a,b)=>a.y-b.y);

/** Decorative notation only: live orchestral transcription is not available. */
function FloatingScore() {
  return <g className="hall-floating-score" fill="none" stroke="currentColor" strokeLinecap="round">
    {[0,1,2].map(phrase=><g key={phrase} className={`hall-score-phrase hall-score-phrase-${phrase}`}>
      <g transform={`translate(${575+phrase*9} ${556-phrase*3}) rotate(${-9+phrase*7})`}>
        {[0,1,2,3,4].map(line=><path key={line} d={`M-28 ${line*5}Q0 ${line*5-4} 54 ${line*5+1}`} strokeWidth=".8" opacity=".38"/>)}
        {[0,1,2].map(note=><g key={note} transform={`translate(${note*23-12} ${[14,5,11][(note+phrase)%3]})`} strokeWidth="1.7">
          <ellipse rx="3.8" ry="2.5" transform="rotate(-22)" fill="currentColor" stroke="none"/><path d="M3 0v-17q9 4 5 9"/>
        </g>)}
      </g>
    </g>)}
  </g>;
}

export function GoldenHall({ active }: { active:boolean }) {
  return <svg className={`golden-hall-art ${active?'is-performing':''}`} viewBox="0 45 1200 670" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs>
      <filter id="hallNightTone" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feComponentTransfer>
          <feFuncR type="linear" slope=".55"/>
          <feFuncG type="linear" slope=".55"/>
          <feFuncB type="linear" slope=".55"/>
        </feComponentTransfer>
      </filter>
      <linearGradient id="hallWall" x2="0" y2="1"><stop stopColor="#c8ad7c"/><stop offset=".5" stopColor="#e1c795"/><stop offset="1" stopColor="#ae8b58"/></linearGradient>
      <linearGradient id="gilding"><stop stopColor="#6f502c"/><stop offset=".23" stopColor="#c7a56a"/><stop offset=".48" stopColor="#f1db9f"/><stop offset=".72" stopColor="#b78e4f"/><stop offset="1" stopColor="#795a32"/></linearGradient>
      <linearGradient id="recess" x2="0" y2="1"><stop stopColor="#4a3c2c"/><stop offset="1" stopColor="#947750"/></linearGradient>
      <linearGradient id="floor" x2="0" y2="1"><stop stopColor="#a08158"/><stop offset="1" stopColor="#d0b386"/></linearGradient>
      <linearGradient id="crystal" x2="0" y2="1"><stop stopColor="#e5d6b3"/><stop offset=".65" stopColor="#fff4ce"/><stop offset="1" stopColor="#cfb477"/></linearGradient>
      <linearGradient id="pipe"><stop stopColor="#5e5848"/><stop offset=".4" stopColor="#d4c9a7"/><stop offset=".6" stopColor="#eee3bc"/><stop offset="1" stopColor="#8c8063"/></linearGradient>
      <linearGradient id="suit"><stop stopColor="#52423d"/><stop offset=".5" stopColor="#252429"/><stop offset="1" stopColor="#403731"/></linearGradient>
      <linearGradient id="concertCloth" x1="0" y1="0" x2="1" y2=".4"><stop stopColor="#48423e"/><stop offset=".4" stopColor="#323234"/><stop offset="1" stopColor="#24272b"/></linearGradient>
      <linearGradient id="wood"><stop stopColor="#6e3720"/><stop offset=".5" stopColor="#b87936"/><stop offset="1" stopColor="#744126"/></linearGradient>
      <radialGradient id="lampGlow"><stop stopColor="#fff3c9" stopOpacity=".35"/><stop offset="1" stopColor="#fff3c9" stopOpacity="0"/></radialGradient>
      <pattern id="ornament" width="30" height="22" patternUnits="userSpaceOnUse"><path d="M0 11q8-14 15 0t15 0M0 11q8 14 15 0t15 0" fill="none" stroke="#e3c78b" strokeWidth="1"/><path d="m15 5 4 6-4 6-4-6Z" fill="#c6a568"/></pattern>
    </defs>
    <rect className="hall-theme-ground" x="0" y="45" width="1200" height="670"/>
    <g className="hall-interior">
    <rect width="1200" height="760" fill="#c3a573"/>
    {/* The actual hall is rectangular, with long balconies converging on the organ. */}
    <path d="M0 0H1200L865 215H335Z" fill="#9d7e50"/>
    {[0,1,2,3,4].map(i=>{const t=i/5;const l=335*t,r=1200-335*t,top=215*t;return <g key={i}><path d={`M${l} ${top}H${r}`} stroke="#e7c990" strokeWidth={9-i}/><path d={`M${l} ${top+9}H${r}`} stroke="#72532f" strokeWidth="3"/>
      {[0,1,2].map(j=><path key={j} d={`M${l+(r-l)*(j/3)+18} ${top+15}h${(r-l)/3-36}l-26 24h-${(r-l)/3-90}Z`} fill={j===1?'#777a69':'#b69763'} stroke="#d7b77b" strokeWidth="3"/>)}</g>;})}
    <path d="M0 0L335 215V505L0 655Z" fill="url(#hallWall)"/>
    <path d="M1200 0L865 215V505L1200 655Z" fill="url(#hallWall)"/>
    <rect x="335" y="215" width="530" height="320" fill="url(#hallWall)"/>
    {/* Far wall niches and three organ bays. */}
    {Array.from({length:9},(_,i)=><g key={i} transform={`translate(${350+i*57} 228)`}><path d="M0 80V25Q0 2 18 2T36 25V80Z" fill="#ae9164" stroke="#ddc28e" strokeWidth="3"/><path d="M-6 0v86M42 0v86" stroke="url(#gilding)" strokeWidth="7"/></g>)}
    <path d="M420 327v-15h360v15M455 310l145-48 145 48Z" fill="url(#gilding)" stroke="#e3c78c" strokeWidth="3"/>
    <path d="m480 303 120-31 120 31Z" fill="url(#ornament)"/>
    {[438,553,668].map((x,i)=><g key={x}><rect x={x} y="331" width="94" height="134" fill="url(#recess)" stroke="url(#gilding)" strokeWidth="9"/>
      {Array.from({length:13},(_,p)=>{const h=105-Math.abs(p-6)*(i===1?3:2);return <g key={p}><rect x={x+7+p*6.3} y="337" width="5" height={h} fill="url(#pipe)"/><path d={`m${x+7+p*6.3} ${337+h} 2.5 9 2.5-9`} fill="#a19574"/></g>;})}
      <rect x={x-4} y="472" width="102" height="36" fill="#c8ad79" stroke="#e1c48a" strokeWidth="3"/><rect x={x+6} y="480" width="82" height="20" fill="none" stroke="#ad8954"/>
    </g>)}
    {/* Perspective wall bays, balconies and gilded caryatid columns. */}
    {[false,true].map(right=><g key={String(right)} transform={right?'translate(1200 0) scale(-1 1)':undefined}>
      {[0,1,2,3,4,5].map(i=>{const t=i/6,x=25+300*t,y=35+180*t,k=1-t*.62;return <g key={i} transform={`translate(${x} ${y}) skewY(22) scale(${k})`}>
        <path d="M0 0H52V233H0Z" fill="#d6bd91" stroke="#b79662" strokeWidth="3"/><path d="M8 100V32Q8 12 25 12T43 32V100Z" fill="url(#recess)" stroke="url(#gilding)" strokeWidth="4"/>
        <path d="M25 15v83M10 61h31" stroke="#a28b67" strokeWidth="2"/><path d="M8 131h35v78H8Z" fill="#6c5b46" stroke="url(#gilding)" strokeWidth="4"/><path d="M13 137h25v66H13Z" fill="#a48c69"/>
        <path d="M-9 5v215M60 5v215" stroke="url(#gilding)" strokeWidth="8"/>
        <path d="m-11 115 37-12 37 12M-3 121h58" fill="none" stroke="#edd6a3" strokeWidth="4"/>
      </g>;})}
      <path d="M0 344L335 410V455L0 434Z" fill="#b08b53" stroke="#ebd19b" strokeWidth="5"/>
      <path d="M0 354L335 419V442L0 418Z" fill="url(#ornament)" stroke="#775932" strokeWidth="2"/>
      <path d="M0 437L335 457V470L0 466Z" fill="#63482d"/>
      {[0,1,2,3,4,5].map(i=>{const x=15+i*58,k=1-i*.115,y=458+i*1.3;return <g key={i} transform={`translate(${x} ${y}) scale(${k})`}>
        <rect x="-10" y="0" width="36" height="12" fill="url(#gilding)"/><path d="M3 25Q-3 19 0 13q2-8 9-7 9 0 10 8 1 7-5 11l2 9 2 19-3 12 5 42H-3l6-43-3-12 3-20Z" fill="url(#gilding)" stroke="#99703c" strokeWidth="1"/><path d="M2 31Q-2 38-1 49l5 11m10-29q8 13 1 28M5 51l-5 53m10-49-4 51m8-52 3 50M4 69l9 8-12 11 14 9" fill="none" stroke="#e7cc93" strokeWidth="2"/><rect x="-8" y="108" width="30" height="12" fill="url(#gilding)"/>
      </g>;})}
    </g>)}
    <path d="M335 411H865V456H335Z" fill="#b8955e" stroke="#e5c98d" strokeWidth="4"/><rect x="342" y="422" width="516" height="23" fill="url(#ornament)"/>
    <path d="M335 460H865V531H335Z" fill="#b29870"/>
    {Array.from({length:8},(_,i)=><g key={i}><rect x={350+i*63} y="470" width="45" height="50" fill="#d6bf93" stroke="#9b7b4e" strokeWidth="2"/><path d={`M${360+i*63} 479h25v30h-25Z`} fill="none" stroke="#bc9d65"/></g>)}
    <path d="M335 521H865L1010 657H190Z" fill="url(#floor)"/>
    {[0,1,2,3].map(i=><path key={i} d={`M${335-i*28} ${525+i*24}H${865+i*28}`} stroke="#75593c" strokeWidth="6"/>)}
    {[0,1,2,3].map(i=><g key={i}><Chandelier x={145+i*69} y={15+i*96} scale={1.25-i*.23}/><Chandelier x={1055-i*69} y={15+i*96} scale={1.25-i*.23}/></g>)}
    {/* Dark tonal masses, curved seating and inward-facing instrumental sections. */}
    <ellipse cx="601" cy="628" rx="288" ry="43" fill="#65513d" opacity=".17"/>
    {ensemble.map((player,index)=><Player key={index} {...player} index={index}/>)}
    <g transform="translate(605 661) scale(.95)" strokeLinecap="round">
      <path d="M-22-4 19-7 24 3-43 3Z" fill="#594735"/><path d="M-43 3h67v5h-67Z" fill="#785f42"/>
      {/* The conductor faces the orchestra; gestures turn from shoulder and wrist. */}
      <path d="M-10-27Q-3-29 4-26L8-4l7 3q3 3-2 3L3 0-2-18-7-2l-10 4q-4-2 0-4l4-4Z" fill="#292b2c"/>
      <g className="conductor-torso">
        <path d="M-5-66Q-16-65-18-56l2 19-2 14q7 5 14 1l3-6 4 6 10-2-3-17q3-12-3-20Z" fill="url(#concertCloth)"/>
        <path d="M-5-65-3-69 2-69 3-64" fill="#b89c7f"/>
        <path d="M-7-72q-5-12 2-15 10-4 12 6l-1 9-6 4Z" fill="#ac9981"/>
        <path d="M-9-76q-4-12 5-14 11-2 13 9l-3 5-2-7-9 2-1 6Z" fill="#696358"/>
        <path d="M-3-62-2-34M-12-47l3 16M4-49l2 15" stroke="#746a5b" strokeWidth=".65" fill="none" opacity=".6"/>
        <g className="conductor-left">
          <path d="M-13-59Q-25-55-28-48Q-35-49-40-56" stroke="url(#concertCloth)" strokeWidth="6" strokeLinecap="round" fill="none"/>
          <path d="M-40-55q-5-1-6-6l1-3 2 5 1-7 2 1 1 7 3 2Z" fill="#b69b7e"/>
        </g>
        <g className="conductor-right">
          <path d="M7-58Q17-55 21-47Q28-49 33-62" fill="none" stroke="url(#concertCloth)" strokeWidth="6" strokeLinecap="round"/>
          <g className="conductor-wrist"><path d="m31-62 1-5q2-3 5-1l1 4-5 4Z" fill="#b69b7e"/><path d="m36-67 8-21" stroke="#eee0bd" strokeWidth="1"/></g>
        </g>
      </g>
    </g>
    <path d="M190 658H1010V670H190Z" fill="#725238"/>
    {/* A restrained hint of the audience establishes the balcony viewpoint. */}
    {Array.from({length:4},(_,row)=>Array.from({length:28},(_,i)=><path key={`${row}-${i}`} d={`M${105+i*36-row*9} ${690+row*25}v-12q13-9 26 0v12Z`} fill={row%2?'#78604b':'#8d7050'} opacity={.65-row*.1}/>))}
    </g>
    {active&&<FloatingScore/>}
  </svg>;
}
