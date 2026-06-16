import type { TiltIntent } from "./TiltIntent";

export interface InputSource {
  read(): TiltIntent;
  dispose(): void;
}
