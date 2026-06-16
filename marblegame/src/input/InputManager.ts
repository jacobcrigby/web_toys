import { Scalar } from "@babylonjs/core";
import type { InputSource } from "./InputSource";
import type { TiltIntent } from "./TiltIntent";

export class InputManager {
  private readonly sources: InputSource[] = [];

  add(source: InputSource): void {
    this.sources.push(source);
  }

  poll(): TiltIntent {
    let x = 0;
    let z = 0;
    for (const source of this.sources) {
      const intent = source.read();
      x += intent.x;
      z += intent.z;
    }
    return { x: Scalar.Clamp(x, -1, 1), z: Scalar.Clamp(z, -1, 1) };
  }

  dispose(): void {
    for (const source of this.sources) source.dispose();
  }
}
