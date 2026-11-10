# Bee browsing earcons

Original synthesized audio, no samples or third-party recordings.
Rebuild: `python3 scripts/build-ui-sounds.py`.

- flat-hover.wav: B-flat4 / 466.16Hz, 190ms, felt-pluck cue on cover hover.
- natural-step.wav: B-natural4 / 493.88Hz, 115ms, quiet cue when shelf focus crosses a slot during user browsing.

48kHz mono PCM16 WAV. Total PCM data 29,280 bytes. Attack/release envelopes avoid discontinuities. Playback gain: 0.28 / 0.22. A shared voice fades the previous cue and throttles rapid input. Settings can mute cues; background pages stay silent. WebKit may require an initial click/key gesture before sound playback.
