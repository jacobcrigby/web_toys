export interface AudioService {
  playClack(volume: number): void;
}

export class NullAudioService implements AudioService {
  playClack(_volume: number): void {}
}
