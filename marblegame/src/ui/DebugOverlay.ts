import "@babylonjs/core/Debug/debugLayer";
import type { Engine, Scene } from "@babylonjs/core";

export class DebugOverlay {
  private readonly element: HTMLDivElement;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === "i" || e.key === "I") this.toggleInspector();
  };

  constructor(private readonly scene: Scene, private readonly engine: Engine) {
    this.element = document.createElement("div");
    this.element.style.cssText = [
      "position:fixed",
      "top:8px",
      "left:8px",
      "padding:4px 8px",
      "font:12px/1.4 monospace",
      "color:#9fe8b0",
      "background:rgba(0,0,0,0.45)",
      "border-radius:4px",
      "pointer-events:none",
      "z-index:10",
    ].join(";");
    document.body.appendChild(this.element);
    window.addEventListener("keydown", this.onKey);
  }

  update(): void {
    this.element.textContent = `${this.engine.getFps().toFixed(0)} fps · [I] inspector · [R] reset`;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKey);
    this.element.remove();
  }

  private async toggleInspector(): Promise<void> {
    if (this.scene.debugLayer.isVisible()) {
      this.scene.debugLayer.hide();
      return;
    }
    await import("@babylonjs/inspector");
    await this.scene.debugLayer.show({ embedMode: true });
  }
}
