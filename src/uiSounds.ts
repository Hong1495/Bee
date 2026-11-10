type Cue = 'flat-hover' | 'natural-step';
let context: AudioContext | undefined;
const buffers = new Map<Cue, AudioBuffer>();
let loading: Promise<void> | undefined;
let enabled = true;
let lastPlayed = -Infinity;
let voice: AudioBufferSourceNode | undefined;
let voiceGain: GainNode | undefined;

export function setUISoundsEnabled(value: boolean) {
  enabled = value;
  if (!value && context && voiceGain) voiceGain.gain.setTargetAtTime(0, context.currentTime, .005);
}
function prepare() {
  if (loading) return loading;
  context ??= new AudioContext();
  loading = Promise.all((['flat-hover','natural-step'] as Cue[]).map(async cue => {
    const response = await fetch(`/sounds/${cue}.wav`);
    if (!response.ok) throw new Error('Sound unavailable');
    buffers.set(cue, await context!.decodeAudioData(await response.arrayBuffer()));
  })).then(() => {}).catch(() => { loading = undefined; });
  return loading;
}
export function installUISounds() {
  void prepare();
  const unlock = () => { if (enabled) { void prepare(); void context?.resume().catch(() => {}); } };
  const hide = () => { if (document.hidden && context) void context.suspend(); };
  window.addEventListener('pointerdown', unlock, {passive:true});
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', hide);
  return () => {
    window.removeEventListener('pointerdown',unlock);
    window.removeEventListener('keydown',unlock);
    document.removeEventListener('visibilitychange',hide);
  };
}
export function playUISound(cue: Cue) {
  if (!enabled || document.hidden) return;
  const now = performance.now();
  if (now - lastPlayed < (cue === 'natural-step' ? 85 : 170)) return;
  if (!context || !buffers.has(cue)) { void prepare(); return; }
  // Never queue delayed hover sounds behind WebKit's gesture restriction.
  if (context.state !== 'running') { void context.resume().catch(() => {}); return; }
  lastPlayed = now;
  const time = context.currentTime;
  if (voice && voiceGain) {
    voiceGain.gain.setTargetAtTime(0,time,.004);
    voice.stop(time+.025);
  }
  const source = context.createBufferSource(), gain = context.createGain();
  source.buffer = buffers.get(cue)!;
  gain.gain.value = cue === 'natural-step' ? .22 : .28;
  source.connect(gain).connect(context.destination);
  source.onended = () => { source.disconnect(); gain.disconnect(); if (voice === source) {voice = undefined; voiceGain = undefined;} };
  voice = source; voiceGain = gain; source.start();
}
