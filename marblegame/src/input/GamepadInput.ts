import { GameConfig } from "../config/GameConfig";
import type { InputSource } from "./InputSource";
import type { TiltIntent } from "./TiltIntent";

export class GamepadInput implements InputSource {
  read(): TiltIntent {
    const pad = navigator.getGamepads?.().find((p) => p !== null);
    if (!pad) return { x: 0, z: 0 };
    return {
      x: this.deadzone(pad.axes[1] ?? 0),
      z: this.deadzone(pad.axes[0] ?? 0),
    };
  }

  dispose(): void {}

  private deadzone(value: number): number {
    return Math.abs(value) < GameConfig.input.gamepadDeadzone ? 0 : value;
  }
}
