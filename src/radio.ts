// Published for radio apps by YourClassical. Keep endpoints separate from playback.
// https://www.yourclassical.org/story/2018/04/18/listen-to-yourclassical-streams-online-internet-radio
export const radioStations = [
  { id: 'ycradio', name: 'YourClassical Radio', label: '综合古典', description: '交响、协奏与经典作品，全天相伴。', url: 'https://ycradio.stream.publicradio.org/ycradio.aac' },
  { id: 'peacefulpiano', name: 'Peaceful Piano', label: '宁静钢琴', description: '让琴键之间的留白，陪你慢下来。', url: 'https://peacefulpiano.stream.publicradio.org/peacefulpiano.aac' },
  { id: 'chambermusic', name: 'Chamber Music', label: '室内乐', description: '聆听弦乐与管乐之间亲密的对话。', url: 'https://chambermusic.stream.publicradio.org/chambermusic.aac' },
  { id: 'relax', name: 'Relax', label: '舒缓古典', description: '柔和的旋律，给日常一点安静。', url: 'https://relax.stream.publicradio.org/relax.aac' },
] as const;
export type RadioStation = typeof radioStations[number];
export type RadioPhase = 'idle' | 'connecting' | 'playing' | 'buffering' | 'retrying' | 'stopped' | 'error';
export type RadioState = { station: RadioStation | null; phase: RadioPhase };

/** One live connection at a time. Stop releases the connection; resume rejoins live. */
export class RadioSession {
  private audio: HTMLAudioElement | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private station: RadioStation | null = null;
  private attempts = 0;
  private volume = .7;
  constructor(private changed: (state: RadioState) => void, private createAudio = () => new Audio()) {}
  private publish(phase: RadioPhase) { this.changed({ station: this.station, phase }); }
  private release() {
    clearTimeout(this.timer); this.timer = undefined;
    this.generation++;
    const audio = this.audio;
    this.audio = null;
    if (audio) {
      audio.onplaying = audio.onwaiting = audio.onstalled = audio.onerror = audio.onended = null;
      audio.pause(); audio.removeAttribute('src'); audio.load();
    }
  }
  start(station: RadioStation) {
    this.station = station; this.attempts = 0;
    this.connect();
  }
  private connect() {
    this.release();
    const generation = this.generation;
    const audio = this.createAudio(); this.audio = audio;
    audio.preload = 'none'; audio.volume = this.volume;
    const active = () => generation === this.generation;
    const fail = () => {
      if (!active()) return;
      this.release();
      if (this.attempts++ < 2) {
        this.publish('retrying');
        this.timer = setTimeout(() => this.connect(), this.attempts * 2000);
      } else this.publish('error');
    };
    const timeout = () => { clearTimeout(this.timer); this.timer = undefined; this.timer = setTimeout(fail, 15000); };
    audio.onplaying = () => { if (active()) { clearTimeout(this.timer); this.timer = undefined; this.publish('playing'); } };
    audio.onwaiting = audio.onstalled = () => { if (active()) { this.publish('buffering'); if (!this.timer) timeout(); } };
    audio.onerror = audio.onended = fail;
    this.publish(this.attempts ? 'retrying' : 'connecting');
    audio.src = this.station!.url;
    timeout();
    void audio.play().catch(error => {
      if (!active()) return;
      if (error?.name === 'NotAllowedError') { this.release(); this.publish('error'); }
      else fail();
    });
  }
  stop() { this.release(); this.publish('stopped'); }
  clear() { this.release(); this.station = null; this.publish('idle'); }
  setVolume(value: number) { this.volume = Math.max(0, Math.min(1, value)); if (this.audio) this.audio.volume = this.volume; }
  dispose() { this.release(); }
}
