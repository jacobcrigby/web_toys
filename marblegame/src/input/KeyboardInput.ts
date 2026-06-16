import type { InputSource } from "./InputSource";
import type { TiltIntent } from "./TiltIntent";

const POS_X = new Set(["ArrowUp", "w", "W"]);
const NEG_X = new Set(["ArrowDown", "s", "S"]);
const POS_Z = new Set(["ArrowLeft", "a", "A"]);
const NEG_Z = new Set(["ArrowRight", "d", "D"]);

export class KeyboardInput implements InputSource {
  private readonly pressed = new Set<string>();
  private readonly onDown = (e: KeyboardEvent) => this.pressed.add(e.key);
  private readonly onUp = (e: KeyboardEvent) => this.pressed.delete(e.key);

  constructor() {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
  }

  read(): TiltIntent {
    return {
      x: this.axis(POS_X, NEG_X),
      z: this.axis(POS_Z, NEG_Z),
    };
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
  }

  private axis(positive: Set<string>, negative: Set<string>): number {
    let value = 0;
    for (const key of this.pressed) {
      if (positive.has(key)) value += 1;
      if (negative.has(key)) value -= 1;
    }
    return Math.sign(value);
  }
}
