"""Original Bee earcons: B-flat and B-natural, no sampled recordings."""
import math, struct, wave
from pathlib import Path
RATE = 48000
OUT = Path(__file__).resolve().parent.parent / 'public' / 'sounds'
OUT.mkdir(parents=True, exist_ok=True)
for name, frequency, duration, decay in [('flat-hover',466.163762,0.19,0.052),('natural-step',493.883301,0.115,0.029)]:
    samples = []
    for i in range(round(RATE * duration)):
        t = i / RATE
        attack = 1 - math.exp(-t / 0.0025)
        tail = min(1, (duration-t)/0.018)**2
        # Soft felt-pluck fundamental with a short, quiet upper partial.
        value = (math.sin(2*math.pi*frequency*t)*math.exp(-t/decay)
                 + 0.18*math.sin(2*math.pi*frequency*2*t)*math.exp(-t/(decay*0.55))
                 + 0.045*math.sin(2*math.pi*frequency*3*t)*math.exp(-t/0.012))
        samples.append(value * attack * tail * 0.24)
    with wave.open(str(OUT / (name+'.wav')), 'wb') as output:
        output.setparams((1,2,RATE,len(samples),'NONE','not compressed'))
        output.writeframes(b''.join(struct.pack('<h',round(v*32767)) for v in samples))
    assert max(abs(v) for v in samples) < 1
    assert abs(samples[0]) < 1e-6 and abs(samples[-1]) < 1e-6
    print(name, f'{duration*1000:.0f}ms', f'{frequency:.2f}Hz', f'{len(samples)*2} bytes PCM')
