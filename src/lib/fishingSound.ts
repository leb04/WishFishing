// Clip order in fishing-foley.wav. Each clip starts on a 1.6-second boundary.
const FOLEY_CUES = ['cast', 'plop', 'dive', 'bite', 'escape', 'reel', 'strain', 'water-tug', 'riser', 'splash'] as const;
const FOLEY_SLOT_SECONDS = 1.6;
const FOLEY_URL = `${import.meta.env.BASE_URL}audio/fishing-foley.wav`;
export type FishingCue = typeof FOLEY_CUES[number] | 'reveal';
const SCORES = {
  idle: { file: 'clear-waters.wav', loop: true, level: 0.35, fade: 0.85 },
  suspense: { file: 'dark-fog.wav', loop: true, level: 0.58, fade: 0.72 },
  reel: { file: 'undaunted.wav', loop: true, level: 0.76, fade: 0.46 },
  victory: { file: 'the-curtain-rises.wav', loop: false, level: 0.68, fade: 0.32 },
};
type Music = keyof typeof SCORES;

/** Recorded effects and score share a master output and stop on interruption. */
export class FishingSound {
  private context?: AudioContext;
  private output?: GainNode;
  private readonly active = new Set<AudioBufferSourceNode>();
  private foley?: Promise<AudioBuffer | undefined>;
  private foleyBytes?: Promise<ArrayBuffer | undefined>;
  private effectsRun = 0;
  private readonly tracks = new Map<Music, Promise<AudioBuffer | undefined>>();
  private readonly fadingTracks = new Set<AudioBufferSourceNode>();
  private music?: { source: AudioBufferSourceNode; gain: GainNode; kind: Music; startedAt: number };
  private desiredMusic?: Music;
  private musicRequest = 0;
  private resumed?: Promise<void>;

  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.output = this.context.createGain();
        this.output.gain.value = 0.45;
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -13;
        limiter.ratio.value = 6;
        this.output.connect(limiter).connect(this.context.destination);
      }
      if (this.context.state !== 'running') {
        this.resumed = this.context.resume().catch(() => {});
        // A silent source on the gesture also activates engines that gate start().
        const source = this.context.createBufferSource();
        source.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
        source.connect(this.output!);
        source.onended = () => source.disconnect();
        source.start();
      }
      this.loadTrack('idle', this.context);
      this.loadTrack('suspense', this.context);
      this.loadTrack('reel', this.context);
      this.loadTrack('victory', this.context);
      const context = this.context;
      this.foley ??= this.preloadEffects()
        .then(bytes => bytes && context.decodeAudioData(bytes.slice(0)))
        .catch(() => undefined);
    } catch {
      // Playback still works in browsers without an available audio device.
    }
  }

  preloadEffects() {
    this.foleyBytes ??= fetch(FOLEY_URL)
      .then(response => response.ok ? response.arrayBuffer() : undefined)
      .catch(() => undefined);
    return this.foleyBytes;
  }

  stopEffects() {
    this.effectsRun++;
    for (const source of this.active) source.stop();
    this.active.clear();
  }

  stop(immediate = false) {
    this.stopEffects();
    this.desiredMusic = undefined;
    this.musicRequest++;
    this.fadeMusic(immediate ? 0 : 0.12);
    if (immediate) {
      for (const source of this.fadingTracks) source.stop();
      this.fadingTracks.clear();
    }
  }

  close() {
    this.stop(true);
    void this.context?.close().catch(() => {});
    this.context = undefined;
    this.output = undefined;
    this.foley = undefined;
    this.resumed = undefined;
    this.tracks.clear();
  }

  private loadBuffer(url: string, context: AudioContext) {
    return fetch(url)
      .then(response => response.ok ? response.arrayBuffer() : Promise.reject())
      .then(buffer => context.decodeAudioData(buffer))
      .catch(() => undefined);
  }

  private loadTrack(kind: Music, context: AudioContext) {
    const cached = this.tracks.get(kind);
    if (cached) return cached;
    const track = this.loadBuffer(`${import.meta.env.BASE_URL}audio/${SCORES[kind].file}`, context);
    this.tracks.set(kind, track);
    return track;
  }

  private fadeMusic(fade: number) {
    const current = this.music;
    if (!this.context || !current) return;
    this.music = undefined;
    const now = this.context.currentTime;
    if (fade > 0) {
      const { level, fade: fadeIn } = SCORES[current.kind];
      const currentLevel = level * Math.min(1, (now - current.startedAt) / fadeIn);
      current.gain.gain.cancelScheduledValues(now);
      current.gain.gain.setValueAtTime(currentLevel, now);
      current.gain.gain.linearRampToValueAtTime(0, now + fade);
    }
    this.fadingTracks.add(current.source);
    current.source.stop(now + fade);
  }

  setMusic(kind: Music) {
    const context = this.context;
    const output = this.output;
    if (!context || !output || this.desiredMusic === kind) return;
    this.desiredMusic = kind;
    const request = ++this.musicRequest;
    if (this.music?.kind === kind) return;
    void Promise.all([this.loadTrack(kind, context), this.resumed]).then(([buffer]) => {
      if (!buffer || request !== this.musicRequest || context.state !== 'running') return;
      const { loop, level, fade } = SCORES[kind];
      this.fadeMusic(fade);
      const source = context.createBufferSource();
      const gain = context.createGain();
      const now = context.currentTime;
      source.buffer = buffer;
      source.loop = loop;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level, now + fade);
      source.connect(gain).connect(output);
      source.onended = () => {
        if (this.music?.source === source) this.music = undefined;
        this.fadingTracks.delete(source);
        source.disconnect();
        gain.disconnect();
      };
      this.music = { source, gain, kind, startedAt: now };
      source.start();
    });
  }

  play = (cue: FishingCue) => {
    if (cue === 'reveal') {
      this.setMusic('victory');
      return;
    }
    const context = this.context;
    const output = this.output;
    if (!context || !output || !this.foley) return;
    const requestedAt = context.currentTime;
    const run = this.effectsRun;
    const offset = FOLEY_CUES.indexOf(cue) * FOLEY_SLOT_SECONDS;
    void Promise.all([this.foley, this.resumed]).then(([buffer]) => {
      if (!buffer || run !== this.effectsRun || context.state !== 'running') return;
      // Leave missed cues silent if the bank arrives after the matching action.
      if (context.currentTime - requestedAt > 0.22) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(output);
      this.active.add(source);
      source.onended = () => {
        this.active.delete(source);
        source.disconnect();
      };
      source.start(0, offset, FOLEY_SLOT_SECONDS);
    });
  };
}
