import { Scalar } from "@babylonjs/core";
import { GameConfig } from "../config/GameConfig";
import type { InputSource } from "./InputSource";
import type { TiltIntent } from "./TiltIntent";

export class MouseInput implements InputSource {
  private intent: TiltIntent = { x: 0, z: 0 };
  private dragging = false;
  private originX = 0;
  private originY = 0;

  private readonly onDown = (e: PointerEvent) => {
    this.dragging = true;
    this.originX = e.clientX;
    this.originY = e.clientY;
  };
  private readonly onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const sensitivity = GameConfig.input.mouseSensitivity;
    this.intent = {
      x: Scalar.Clamp((e.clientY - this.originY) * sensitivity, -1, 1),
      z: Scalar.Clamp((e.clientX - this.originX) * sensitivity, -1, 1),
    };
  };
  private readonly onUp = () => {
    this.dragging = false;
    this.intent = { x: 0, z: 0 };
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
  }

  read(): TiltIntent {
    return this.intent;
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
  }
}
