import fs from 'node:fs';
const palettes=[['#eee8df','#695b50','#b78370'],['#e5e8ed','#4c596b','#849bb3'],['#e8e4ef','#655970','#a48bad'],['#e4ebe7','#50665b','#89a394'],['#efe2e5','#755561','#b98190'],['#eae8db','#68634c','#aaa075']];
for(let i=0;i<48;i++){
 const [paper,ink,accent]=palettes[i%6],motif=Math.floor(i/6),y=226;
 let art='';
 const note=(x,y,stem=true)=>`<ellipse cx="${x}" cy="${y}" rx="13" ry="9" transform="rotate(-22 ${x} ${y})" fill="${ink}"/>${stem?`<path d="M${x+11} ${y}v-64" stroke="${ink}" stroke-width="3"/>`:''}`;
 const flat=x=>`<path d="M${x} 174v84c38-30 27-49 0-21" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>`;
 const natural=x=>`<path d="M${x} 176v78l23-8v-76m-23 39 23-8m-23 32 23-8" fill="none" stroke="${accent}" stroke-width="5"/>`;
 if(motif===0)art=flat(190)+note(268,246);
 if(motif===1)art=natural(188)+note(280,230);
 if(motif===2)art=note(174,246)+note(286,230)+`<path d="M185 182 297 166v9l-112 16Z" fill="${ink}"/>`;
 if(motif===3)art=flat(130)+note(201,246)+natural(282)+note(354,230);
 if(motif===4)art=note(162,262)+note(248,230)+note(334,246);
 if(motif===5)art=`<path d="m238 185 19 30-26 24 24 28q-35-10-23 23" fill="none" stroke="${ink}" stroke-width="9" stroke-linejoin="round"/>`;
 if(motif===6)art=note(210,246)+`<circle cx="245" cy="244" r="4" fill="${accent}"/>`+natural(304);
 if(motif===7)art=note(186,230,false)+note(298,246,false)+`<path d="M163 276q68 43 158 0" fill="none" stroke="${accent}" stroke-width="3"/>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="${paper}"/><path d="M32 32h448v448H32Z" fill="none" stroke="${ink}" stroke-opacity=".12"/><g stroke="${ink}" stroke-opacity=".22" stroke-width="1.2">${[0,1,2,3,4].map(n=>`<path d="M68 ${y+n*16}H444"/>`).join('')}<path d="M76 226v64M433 226v64"/></g>${art}<path d="M220 401h72" stroke="${accent}" stroke-width="2"/></svg>`;
 fs.writeFileSync(`public/artwork/notation/${String(i).padStart(2,'0')}.svg`,svg+'\n');
}
console.log('Generated 48 notation covers');
