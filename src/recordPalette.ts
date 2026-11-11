export type RecordPalette = { paper: string; ink: string; edge?:string; edgeDark?:string; edgeInk?:string };
export const defaultPalette: RecordPalette = { paper:'#d5d2c9', ink:'#292923' };

// Quantize a tiny decoded cover, not a full-resolution image. Prefer its main
// coloured area over white margins, but keep monochrome artwork monochrome.
export function paletteFromPixels(pixels: ArrayLike<number>): RecordPalette {
  const bins = new Map<number, { count:number; r:number; g:number; b:number }>();
  for (let i=0; i<pixels.length; i+=4) {
    if (pixels[i+3]<192) continue;
    const [r,g,b] = [pixels[i],pixels[i+1],pixels[i+2]];
    const key = (r>>5)*64+(g>>5)*8+(b>>5);
    const bin = bins.get(key) ?? {count:0,r:0,g:0,b:0};
    bin.count++; bin.r+=r; bin.g+=g; bin.b+=b; bins.set(key,bin);
  }
  if (!bins.size) return defaultPalette;
  const groups = [...bins.values()].map(bin => {
    const rgb = [bin.r,bin.g,bin.b].map(n=>n/bin.count);
    const chroma = (Math.max(...rgb)-Math.min(...rgb))/255;
    const light = (Math.max(...rgb)+Math.min(...rgb))/510;
    return {rgb, count:bin.count, score:bin.count*(1+chroma*.7), coloured:chroma>.12 && light>.12 && light<.9};
  });
  const coloured = groups.filter(bin=>bin.coloured);
  const total = groups.reduce((n,bin)=>n+bin.count,0);
  const pool = coloured.reduce((n,bin)=>n+bin.count,0)>total*.18 ? coloured : groups;
  const dominant = pool.reduce((a,b)=>a.score>b.score?a:b);
  // A small warm-paper mix gives ink a matte substrate without losing hue.
  const rgb = dominant.rgb.map((v,i)=>Math.round(v*.78+[225,222,212][i]*.22));
  const linear = rgb.map(v=>v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4);
  const luminance = linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
  return {paper:`rgb(${rgb.join(',')})`,ink:luminance>.179?'#171715':'#fffdf5'};
}

const palettes = new Map<string, {source:string; palette:RecordPalette}>();
const listeners = new Map<string, Set<()=>void>>();
let samplingContext: CanvasRenderingContext2D | null | undefined;
export function readRecordPalette(id: string) { return palettes.get(id)?.palette ?? defaultPalette; }
export function subscribeRecordPalette(id: string, listener: ()=>void) {
  const group = listeners.get(id) ?? new Set();
  group.add(listener); listeners.set(id,group);
  return () => { group.delete(listener); if (!group.size) listeners.delete(id); };
}
// A sleeve extension follows the perimeter, not a face or logo in the centre.
// Quantized mode avoids averaging opposite edge colours into muddy grey.
export function edgePalette(pixels:ArrayLike<number>,width:number,height:number) {
  const bins=new Map<number,{count:number;rgb:number[]}>();
  const border=Math.max(1,Math.round(Math.min(width,height)*.08));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(x>=border&&x<width-border&&y>=border&&y<height-border)continue;
    const i=(y*width+x)*4;if(pixels[i+3]<192)continue;
    const rgb=[pixels[i],pixels[i+1],pixels[i+2]],key=(rgb[0]>>5)*64+(rgb[1]>>5)*8+(rgb[2]>>5);
    const bin=bins.get(key)??{count:0,rgb:[0,0,0]};bin.count++;rgb.forEach((v,j)=>bin.rgb[j]+=v);bins.set(key,bin);
  }
  if(!bins.size)return {};
  const mode=[...bins.values()].reduce((a,b)=>a.count>=b.count?a:b);
  const rgb=mode.rgb.map(n=>n/mode.count),grey=rgb.reduce((a,b)=>a+b)/3;
  const paper=rgb.map(v=>Math.round(v*.94+grey*.06));
  const dark=paper.map(v=>Math.round(v*.94));
  const luminance=paper.reduce((n,v,i)=>n+([.2126,.7152,.0722][i])*(v/255<=.04045?v/3294.6:((v/255+.055)/1.055)**2.4),0);
  return {edge:`rgb(${paper.join(',')})`,edgeDark:`rgb(${dark.join(',')})`,edgeInk:luminance>.179?'#171715':'#fffdf5'};
}
export function sampleRecordPalette(id: string, image: HTMLImageElement) {
  const source = image.currentSrc || image.src;
  if (!image.naturalWidth || source.includes('/artwork/placeholder.svg') || palettes.get(id)?.source===source) return;
  let palette = defaultPalette;
  try {
    if (samplingContext===undefined) {
      const canvas = document.createElement('canvas'); canvas.width=32; canvas.height=32;
      samplingContext = canvas.getContext('2d', {willReadFrequently:true});
    }
    const context = samplingContext;
    if (context) {
      context.clearRect(0,0,32,32);
      context.drawImage(image,0,0,32,32);
      const pixels=context.getImageData(0,0,32,32).data;
      palette = {...paletteFromPixels(pixels),...edgePalette(pixels,32,32)};
    }
  } catch { samplingContext=undefined; /* Discard a tainted canvas before sampling another cover. */ }
  palettes.set(id,{source,palette});
  listeners.get(id)?.forEach(listener=>listener());
}
if (typeof window!=='undefined') window.addEventListener('bee-artwork-reset',()=>{
  palettes.clear(); listeners.forEach(group=>group.forEach(listener=>listener()));
});
