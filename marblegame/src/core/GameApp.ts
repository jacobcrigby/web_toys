import {
  Color4,
  Engine,
  Scalar,
  Scene,
  type IPhysicsCollisionEvent,
} from "@babylonjs/core";
import { GameConfig } from "../config/GameConfig";
import { enablePhysics } from "../physics/PhysicsWorld";
import { SceneBuilder } from "../scene/SceneBuilder";
import { Table } from "../scene/Table";
import { Marble } from "../scene/Marble";
import { InputManager } from "../input/InputManager";
import { KeyboardInput } from "../input/KeyboardInput";
import { MouseInput } from "../input/MouseInput";
import { GamepadInput } from "../input/GamepadInput";
import { NullAudioService, type AudioService } from "../audio/AudioService";
import { DebugOverlay } from "../ui/DebugOverlay";

export class GameApp {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly audio: AudioService = new NullAudioService();
  private lastClackAt = 0;

  private constructor(private readonly canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.06, 0.08, 1);
  }

  static async create(canvas: HTMLCanvasElement): Promise<GameApp> {
    const app = new GameApp(canvas);
    await app.build();
    return app;
  }

  private async build(): Promise<void> {
    await enablePhysics(this.scene);

    const sceneBuilder = new SceneBuilder(this.scene);
    const table = new Table(this.scene);
    const marble = new Marble(this.scene, sceneBuilder.reflectionTexture);
    sceneBuilder.reflect([...table.meshes]);

    const input = new InputManager();
    input.add(new KeyboardInput());
    input.add(new MouseInput(this.canvas));
    input.add(new GamepadInput());

    const debug = new DebugOverlay(this.scene, this.engine);

    marble.collisions.add((event) => this.onCollision(event));
    window.addEventListener("keydown", (e) => {
      if (e.key === "r" || e.key === "R") {
        marble.reset();
        table.level();
      }
    });

    this.scene.onBeforePhysicsObservable.add(() => {
      table.setTilt(input.poll());
      table.update();
    });
    this.scene.onBeforeRenderObservable.add(() => debug.update());

    window.addEventListener("resize", () => {
      this.engine.resize();
      sceneBuilder.frame();
    });
    this.engine.runRenderLoop(() => this.scene.render());
  }

  private onCollision(event: IPhysicsCollisionEvent): void {
    const now = performance.now();
    if (now - this.lastClackAt < GameConfig.audio.clackThrottleMs) return;
    const speed = Math.abs(event.impulse ?? 0);
    if (speed < GameConfig.audio.minImpactSpeed) return;
    this.lastClackAt = now;
    this.audio.playClack(Scalar.Clamp(speed / 10, 0, 1));
  }
}
