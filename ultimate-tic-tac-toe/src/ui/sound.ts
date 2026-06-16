export type SoundName = 'place' | 'capture' | 'win' | 'draw';

interface Note {
  freq: number;
  at: number; // seconds after trigger
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

const BLIPS: Record<SoundName, Note[]> = {
  place: [{ freq: 520, at: 0, dur: 0.07 }],
  capture: [
    { freq: 660, at: 0, dur: 0.09 },
    { freq: 880, at: 0.08, dur: 0.12 },
  ],
  win: [
    { freq: 523, at: 0, dur: 0.12 },
    { freq: 659, at: 0.1, dur: 0.12 },
    { freq: 784, at: 0.2, dur: 0.22 },
  ],
  draw: [
    { freq: 392, at: 0, dur: 0.14 },
    { freq: 330, at: 0.13, dur: 0.2 },
  ],
};

/** Short synthesized blips — no asset files. Short-circuits when muted. */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private muted = false;

  play(name: SoundName): void {
    if (this.muted) {
      return;
    }
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      for (const note of BLIPS[name]) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = note.type ?? 'sine';
        osc.frequency.value = note.freq;
        const start = now + note.at;
        const peak = note.gain ?? 0.08;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(peak, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0005, start + note.dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + note.dur + 0.02);
      }
    } catch {
      // No audio available (or autoplay blocked): stay silent.
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }
}
