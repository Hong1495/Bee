import { Play, Pause, RotateCw, LoaderCircle } from 'lucide-react';
import { t } from './i18n';
import { radioStations, type RadioState, type RadioStation } from './radio';
import { GoldenHall } from './GoldenHall';
import './radio.css';
export const radioPhaseText = (phase: RadioState['phase']) => ({idle:'',connecting:t('正在连接直播…'),playing:t('正在直播'),buffering:t('正在缓冲…'),retrying:t('正在重新连接…'),stopped:t('已停止'),error:t('暂时无法连接，请重试或切换频道')})[phase];
export function RadioHall({ state, onPlay, onStop, busy }: { state:RadioState; onPlay:(station:RadioStation)=>unknown; onStop:()=>void; busy:boolean }) {
  const station=state.station??radioStations[0];
  const active=['connecting','playing','buffering','retrying'].includes(state.phase);
  const loading=['connecting','buffering','retrying'].includes(state.phase);
  return <section className="radio-page" aria-label={t('古典电台')}>
    <span className="radio-status-announcement" role="status" aria-live="polite">{radioPhaseText(state.phase)}</span>
    <div className="radio-listening-stack">
      <div className="golden-hall-scene"><GoldenHall active={state.phase==='playing'}/></div>
      <div className="radio-listening-footer">
        <div className="floating-transport radio-transport" role="group" aria-label={t('播放控制')}>
          <button className="transport-primary radio-play-action" disabled={busy} onClick={()=>active?onStop():void onPlay(station)} aria-label={active?t('停止电台'):t('播放电台')} title={state.phase==='error'||loading?radioPhaseText(state.phase):active?t('停止电台'):t('播放电台')}>
            {loading?<LoaderCircle className="radio-spinner"/>:active?<Pause size={21} fill="currentColor"/>:state.phase==='error'?<RotateCw/>:<Play size={21} fill="currentColor"/>}
            <span>{loading?t('正在连接直播…'):active?t('停止电台'):t('播放电台')}</span>
          </button>

        </div>
      </div>
    </div>
  </section>;
}
